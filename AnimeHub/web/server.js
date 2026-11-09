const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const CUSTOM_FILE = path.join(__dirname, 'custom_animes.json');
const SERVERS_FILE = path.join(__dirname, 'anime_servers.json');
const EPISODES_FILE = path.join(__dirname, 'anime_episodes.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ANILIST_URL = 'https://graphql.anilist.co';

function getCustomAnimes() {
    try {
        if (!fs.existsSync(CUSTOM_FILE)) fs.writeFileSync(CUSTOM_FILE, JSON.stringify([]));
        return JSON.parse(fs.readFileSync(CUSTOM_FILE, 'utf8') || '[]');
    } catch (e) {
        return [];
    }
}

function saveCustomAnimes(animes) {
    fs.writeFileSync(CUSTOM_FILE, JSON.stringify(animes, null, 2), 'utf8');
}

// Convert a Mega download link (mega.nz/file/ID#KEY) into its embeddable
// player URL (mega.nz/embed/ID#KEY). Other URLs pass through unchanged.
function normalizeEmbedUrl(url) {
    const trimmed = (url || '').trim();
    try {
        const u = new URL(trimmed);
        const host = u.hostname.toLowerCase();
        if (host === 'mega.nz' || host.endsWith('.mega.nz')) {
            const m = u.pathname.match(/^\/file\/([A-Za-z0-9_-]+)\/?$/);
            if (m) {
                const key = u.hash ? u.hash.slice(1) : u.search.replace(/^\?/, '');
                if (key) return `https://mega.nz/embed/${m[1]}#${key}`;
            }
        }
    } catch (e) { /* not a valid URL, return as-is */ }

    // Video hosters: convert watch-page URLs into embed/player URLs so only
    // the player loads inside the iframe (no site chrome or ads).
    //   voe.sx/watch/ID  -> voe.sx/e/ID
    //   streamtape.com/v/ID -> streamtape.com/e/ID
    try {
        const u = new URL(trimmed);
        const host = u.hostname.toLowerCase();
        const watchToEmbed = [
            { hosts: ['voe.'], from: '/watch/', to: '/e/' },
            { hosts: ['streamtape.com', 'streamtape.net'], from: '/v/', to: '/e/' }
        ];
        for (const rule of watchToEmbed) {
            const matches = rule.hosts.some(h => host === h || host.startsWith(h) || host.endsWith(h));
            if (matches && u.pathname.startsWith(rule.from)) {
                u.pathname = rule.to + u.pathname.slice(rule.from.length);
                return u.toString();
            }
        }
    } catch (e) { /* not a valid URL, return as-is */ }
    return trimmed;
}

function getAnimeServers() {
    try {
        if (!fs.existsSync(SERVERS_FILE)) fs.writeFileSync(SERVERS_FILE, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(SERVERS_FILE, 'utf8') || '{}');
    } catch (e) {
        return {};
    }
}

function saveAnimeServers(data) {
    fs.writeFileSync(SERVERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Per-anime episode overrides: episodes added beyond the official count,
// episodes hidden from the list, and custom servers per episode number.
// Shape: { "<animeId>": { "added": [13], "removed": [5], "servers": { "13": [...] } } }
function getEpisodeData() {
    try {
        if (!fs.existsSync(EPISODES_FILE)) fs.writeFileSync(EPISODES_FILE, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf8') || '{}');
    } catch (e) {
        return {};
    }
}

function saveEpisodeData(data) {
    fs.writeFileSync(EPISODES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getEpisodeEntry(allData, animeId) {
    const key = String(animeId);
    if (!allData[key]) allData[key] = { added: [], removed: [], servers: {} };
    if (!Array.isArray(allData[key].added)) allData[key].added = [];
    if (!Array.isArray(allData[key].removed)) allData[key].removed = [];
    if (!allData[key].servers || typeof allData[key].servers !== 'object') allData[key].servers = {};
    return allData[key];
}

// ---- Admin authentication ----
// Password comes from ADMIN_PASSWORD env var, or is auto-generated once and
// stored in admin_password.txt (gitignored). Write endpoints require the token.
const AUTH_FILE = path.join(__dirname, 'admin_password.txt');
let cachedPassword = null;
let cachedToken = null;

function getAdminPassword() {
    if (cachedPassword) return cachedPassword;
    if (process.env.ADMIN_PASSWORD) {
        cachedPassword = process.env.ADMIN_PASSWORD;
        return cachedPassword;
    }
    try {
        if (fs.existsSync(AUTH_FILE)) {
            cachedPassword = fs.readFileSync(AUTH_FILE, 'utf8').trim();
            if (cachedPassword) return cachedPassword;
        }
    } catch (e) { /* regenerate */ }
    cachedPassword = 'animehub-' + crypto.randomBytes(4).toString('hex');
    try { fs.writeFileSync(AUTH_FILE, cachedPassword, 'utf8'); } catch (e) {}
    console.log('=================================');
    console.log(`🔑 Contraseña de administrador generada: ${cachedPassword}`);
    console.log('   (guardada en web/admin_password.txt — no la compartas)');
    console.log('=================================');
    return cachedPassword;
}

function adminToken() {
    if (!cachedToken) {
        cachedToken = crypto.createHmac('sha256', getAdminPassword())
            .update('animehub-admin-token').digest('hex');
    }
    return cachedToken;
}

function requireAuth(req, res, next) {
    if (req.headers['x-admin-token'] === adminToken()) return next();
    res.status(401).json({ error: 'No autorizado', needsAuth: true });
}

app.post('/api/login', (req, res) => {
    const password = (req.body && req.body.password) || '';
    if (password && password === getAdminPassword()) {
        res.json({ success: true, token: adminToken() });
    } else {
        res.status(401).json({ error: 'Contraseña incorrecta' });
    }
});

async function fetchAniList(query, variables = {}) {
    const response = await axios.post(ANILIST_URL, { query, variables }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        timeout: 10000
    });
    return response.data.data;
}

// Route: Add a custom server to ANY anime (or to a single episode if `episode` is given)
app.post('/api/anime-servers', requireAuth, (req, res) => {
    const { animeId, name, url, episode } = req.body;
    if (!animeId || !url) return res.status(400).json({ error: 'animeId y URL son requeridos' });

    const epNum = parseInt(episode, 10);
    if (!isNaN(epNum) && epNum > 0) {
        const allEpisodes = getEpisodeData();
        const entry = getEpisodeEntry(allEpisodes, animeId);
        const epKey = String(epNum);
        if (!entry.servers[epKey]) entry.servers[epKey] = [];
        const newServer = {
            id: 'epsrv_' + Date.now(),
            name: name || 'Servidor del Episodio',
            url: normalizeEmbedUrl(url)
        };
        entry.servers[epKey].push(newServer);
        saveEpisodeData(allEpisodes);
        return res.json({ success: true, server: newServer, episode: epNum });
    }

    const allServers = getAnimeServers();
    const idKey = String(animeId);
    if (!allServers[idKey]) allServers[idKey] = [];

    const newServer = {
        id: 'srv_' + Date.now(),
        name: name || 'Servidor Personalizado',
        url: normalizeEmbedUrl(url)
    };

    allServers[idKey].push(newServer);
    saveAnimeServers(allServers);
    res.json({ success: true, server: newServer, servers: allServers[idKey] });
});

// Route: Delete a server (custom or default) from ANY anime or episode
app.delete('/api/anime-servers', requireAuth, (req, res) => {
    const { animeId, serverId, episode } = req.body;
    if (!animeId || !serverId) return res.status(400).json({ error: 'Faltan parámetros' });

    const epNum = parseInt(episode, 10);
    if (!isNaN(epNum) && epNum > 0 && !String(serverId).startsWith('def_')) {
        const allEpisodes = getEpisodeData();
        const entry = allEpisodes[String(animeId)];
        const epList = entry && entry.servers ? entry.servers[String(epNum)] : null;
        if (epList && epList.some(s => s.id === serverId)) {
            entry.servers[String(epNum)] = epList.filter(s => s.id !== serverId);
            saveEpisodeData(allEpisodes);
            return res.json({ success: true });
        }
    }

    const allServers = getAnimeServers();
    const idKey = String(animeId);

    if (String(serverId).startsWith('def_')) {
        // Default servers are regenerated per request, so "deleting" one means
        // remembering that this anime has it hidden.
        if (!allServers._removedDefaults) allServers._removedDefaults = {};
        const removed = allServers._removedDefaults[idKey] || [];
        if (!removed.includes(serverId)) removed.push(serverId);
        allServers._removedDefaults[idKey] = removed;
        saveAnimeServers(allServers);
    } else if (allServers[idKey]) {
        allServers[idKey] = allServers[idKey].filter(s => s.id !== serverId);
        saveAnimeServers(allServers);
    }
    res.json({ success: true });
});

// Route: Get Custom User Animes
app.get('/api/custom', (req, res) => {
    res.json(getCustomAnimes());
});

// Route: Add / Update Custom Anime
app.post('/api/custom', requireAuth, (req, res) => {
    const { title, image, synopsis, genres, episodes, servers } = req.body;
    if (!title) return res.status(400).json({ error: 'El título es obligatorio' });

    const customList = getCustomAnimes();
    const animeId = 'custom_' + Date.now();
    const newAnime = {
        id: animeId,
        isCustom: true,
        title: { english: title, romaji: title },
        coverImage: { extraLarge: image || 'https://via.placeholder.com/300x450?text=Anime+Hub', large: image || 'https://via.placeholder.com/300x450?text=Anime+Hub' },
        description: synopsis || 'Anime personalizado con servidores personalizados.',
        genres: genres ? genres.split(',').map(g => g.trim()) : ['Personalizado'],
        episodes: parseInt(episodes, 10) || 12,
        averageScore: 100,
        status: 'Completado'
    };

    customList.unshift(newAnime);
    saveCustomAnimes(customList);

    // Save servers if provided
    if (Array.isArray(servers) && servers.length > 0) {
        const allServers = getAnimeServers();
        allServers[animeId] = servers.map((s, idx) => ({
            id: 'srv_' + (Date.now() + idx),
            name: s.name,
            url: normalizeEmbedUrl(s.url)
        }));
        saveAnimeServers(allServers);
    }

    res.json({ success: true, anime: newAnime });
});

// Route: Delete Custom Anime
app.delete('/api/custom/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    let customList = getCustomAnimes();
    customList = customList.filter(a => a.id !== id);
    saveCustomAnimes(customList);

    // Also delete servers and episode overrides
    const allServers = getAnimeServers();
    delete allServers[String(id)];
    if (allServers._removedDefaults) delete allServers._removedDefaults[String(id)];
    saveAnimeServers(allServers);

    const allEpisodes = getEpisodeData();
    delete allEpisodes[String(id)];
    saveEpisodeData(allEpisodes);

    res.json({ success: true });
});

// Route: Get episode overrides for an anime (added / removed episodes)
app.get('/api/episodes/:animeId', (req, res) => {
    const entry = getEpisodeData()[String(req.params.animeId)];
    res.json({
        added: (entry && entry.added) || [],
        removed: (entry && entry.removed) || []
    });
});

// Route: Add an episode (optionally with its own servers)
app.post('/api/episodes', requireAuth, (req, res) => {
    const { animeId, episode, servers } = req.body;
    const epNum = parseInt(episode, 10);
    if (!animeId || isNaN(epNum) || epNum < 1) {
        return res.status(400).json({ error: 'animeId y un número de episodio válido son requeridos' });
    }

    const allEpisodes = getEpisodeData();
    const entry = getEpisodeEntry(allEpisodes, animeId);
    const epKey = String(epNum);

    if (!entry.added.includes(epNum)) entry.added.push(epNum);
    entry.added.sort((a, b) => a - b);
    entry.removed = entry.removed.filter(e => e !== epNum);

    if (Array.isArray(servers) && servers.length > 0) {
        if (!entry.servers[epKey]) entry.servers[epKey] = [];
        servers.forEach((s, idx) => {
            if (s && s.url) {
                entry.servers[epKey].push({
                    id: 'epsrv_' + Date.now() + '_' + idx,
                    name: s.name || 'Servidor del Episodio',
                    url: normalizeEmbedUrl(s.url)
                });
            }
        });
    }

    saveEpisodeData(allEpisodes);
    res.json({ success: true, episode: epNum, added: entry.added, removed: entry.removed });
});

// Route: Delete an episode from the list (hides official eps, removes added ones)
app.delete('/api/episodes', requireAuth, (req, res) => {
    const { animeId, episode } = req.body;
    const epNum = parseInt(episode, 10);
    if (!animeId || isNaN(epNum) || epNum < 1) {
        return res.status(400).json({ error: 'Faltan parámetros' });
    }

    const allEpisodes = getEpisodeData();
    const entry = getEpisodeEntry(allEpisodes, animeId);

    if (entry.added.includes(epNum)) {
        entry.added = entry.added.filter(e => e !== epNum);
    } else if (!entry.removed.includes(epNum)) {
        entry.removed.push(epNum);
    }
    delete entry.servers[String(epNum)];

    saveEpisodeData(allEpisodes);
    res.json({ success: true, added: entry.added, removed: entry.removed });
});

// Route: Get Current Season Anime (Emisión)
app.get('/api/season', async (req, res) => {
    const query = `
    query {
      Page(page: 1, perPage: 24) {
        media(type: ANIME, status: RELEASING, sort: TRENDING_DESC) {
          id
          title { romaji english native }
          coverImage { extraLarge large }
          episodes
          averageScore
          genres
          format
          status
        }
      }
    }`;
    try {
        const data = await fetchAniList(query);
        res.json(data.Page.media);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener animes en emisión' });
    }
});

// Route: Get Top Popular Anime
app.get('/api/trending', async (req, res) => {
    const query = `
    query {
      Page(page: 1, perPage: 24) {
        media(type: ANIME, sort: POPULARITY_DESC) {
          id
          title { romaji english native }
          coverImage { extraLarge large }
          episodes
          averageScore
          genres
          format
          status
        }
      }
    }`;
    try {
        const data = await fetchAniList(query);
        res.json(data.Page.media);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener animes populares' });
    }
});

// Route: Search Anime
app.get('/api/search', async (req, res) => {
    const search = req.query.q;
    if (!search) return res.status(400).json({ error: 'Query vacía' });

    const customList = getCustomAnimes().filter(a =>
        a.title.english.toLowerCase().includes(search.toLowerCase()) ||
        a.title.romaji.toLowerCase().includes(search.toLowerCase())
    );

    const query = `
    query ($search: String) {
      Page(page: 1, perPage: 24) {
        media(type: ANIME, search: $search) {
          id
          title { romaji english native }
          coverImage { extraLarge large }
          episodes
          averageScore
          genres
          format
          status
        }
      }
    }`;
    try {
        const data = await fetchAniList(query, { search });
        res.json([...customList, ...data.Page.media]);
    } catch (error) {
        res.json(customList);
    }
});

// Route: Get Anime Details
app.get('/api/anime/:id', async (req, res) => {
    const id = req.params.id;

    if (id.startsWith('custom_')) {
        const customList = getCustomAnimes();
        const found = customList.find(a => a.id === id);
        if (found) return res.json(found);
        return res.status(404).json({ error: 'Anime no encontrado' });
    }

    const numId = parseInt(id, 10);
    const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title { romaji english native }
        description
        coverImage { extraLarge large }
        bannerImage
        episodes
        averageScore
        genres
        status
        seasonYear
        studios(isMain: true) { nodes { name } }
        trailer { id site thumbnail }
      }
    }`;
    try {
        const data = await fetchAniList(query, { id: numId });
        res.json(data.Media);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener detalle del anime' });
    }
});

// Route: Get Stream Servers for Episode (Combining saved custom servers with defaults)
app.get('/api/servers', async (req, res) => {
    const { title, episode, animeId, malId } = req.query;
    const ep = parseInt(episode, 10) || 1;
    const idKey = String(animeId || '');

    const allSaved = getAnimeServers();
    const userSaved = allSaved[idKey] || [];
    const removedDefaults = (allSaved._removedDefaults && allSaved._removedDefaults[idKey]) || [];

    const epEntry = getEpisodeData()[idKey];
    const episodeServers = (epEntry && epEntry.servers && epEntry.servers[String(ep)]) || [];

    const mal = parseInt(malId, 10);

    const defaultServers = [];
    if (mal && !isNaN(mal)) {
        defaultServers.push(
            { id: 'def_1', name: 'VidSrc.me', url: `https://vidsrc.me/embed/anime/${mal}/${ep}`, isDefault: true },
            { id: 'def_2', name: '2Embed', url: `https://www.2embed.cc/embed/anime/${mal}/${ep}`, isDefault: true },
            { id: 'def_3', name: 'Embed.su', url: `https://embed.su/embed/anime/${mal}/${ep}`, isDefault: true },
            { id: 'def_4', name: 'VidSrc.pm', url: `https://vidsrc.pm/embed/anime/${mal}/${ep}`, isDefault: true },
            { id: 'def_5', name: 'VidSrc.app', url: `https://vidsrc.app/embed/anime/${mal}/${ep}`, isDefault: true },
        );
    }

    // Episode-specific servers come FIRST, then anime-level saved servers, then defaults
    const visibleDefaults = defaultServers.filter(s => !removedDefaults.includes(s.id));
    const combined = [...episodeServers, ...userSaved, ...visibleDefaults];

    res.json({ episode: ep, servers: combined });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`=================================`);
    console.log(`🚀 Servidor Anime Hub corriendo en:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`=================================`);
});

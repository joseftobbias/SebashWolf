const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const CUSTOM_FILE = path.join(__dirname, 'custom_animes.json');
const SERVERS_FILE = path.join(__dirname, 'anime_servers.json');

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

async function fetchAniList(query, variables = {}) {
    const response = await axios.post(ANILIST_URL, { query, variables }, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        timeout: 10000
    });
    return response.data.data;
}

// Route: Add a custom server to ANY anime
app.post('/api/anime-servers', (req, res) => {
    const { animeId, name, url } = req.body;
    if (!animeId || !url) return res.status(400).json({ error: 'animeId y URL son requeridos' });

    const allServers = getAnimeServers();
    const idKey = String(animeId);
    if (!allServers[idKey]) allServers[idKey] = [];

    const newServer = {
        id: 'srv_' + Date.now(),
        name: name || 'Servidor Personalizado',
        url: url.trim()
    };

    allServers[idKey].push(newServer);
    saveAnimeServers(allServers);
    res.json({ success: true, server: newServer, servers: allServers[idKey] });
});

// Route: Delete a custom server from ANY anime
app.delete('/api/anime-servers', (req, res) => {
    const { animeId, serverId } = req.body;
    if (!animeId || !serverId) return res.status(400).json({ error: 'Faltan parámetros' });

    const allServers = getAnimeServers();
    const idKey = String(animeId);
    if (allServers[idKey]) {
        allServers[idKey] = allServers[idKey].filter(s => s.id !== serverId);
        saveAnimeServers(allServers);
    }
    res.json({ success: true, servers: allServers[idKey] || [] });
});

// Route: Get Custom User Animes
app.get('/api/custom', (req, res) => {
    res.json(getCustomAnimes());
});

// Route: Add / Update Custom Anime
app.post('/api/custom', (req, res) => {
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
            url: s.url
        }));
        saveAnimeServers(allServers);
    }

    res.json({ success: true, anime: newAnime });
});

// Route: Delete Custom Anime
app.delete('/api/custom/:id', (req, res) => {
    const id = req.params.id;
    let customList = getCustomAnimes();
    customList = customList.filter(a => a.id !== id);
    saveCustomAnimes(customList);

    // Also delete servers
    const allServers = getAnimeServers();
    delete allServers[String(id)];
    saveAnimeServers(allServers);

    res.json({ success: true });
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
    const { title, episode, animeId } = req.query;
    const ep = episode || 1;
    const idKey = String(animeId || '');

    const allSaved = getAnimeServers();
    const userSaved = allSaved[idKey] || [];

    const cleanTitle = (title || 'anime').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    const defaultServers = [
        { id: 'def_1', name: '⚡ Mega / HD (Opción 1)', url: `https://mega.nz/embed/#!placeholder_ep_${ep}`, isDefault: true },
        { id: 'def_2', name: '🎬 Streamwish (Opción 2)', url: `https://streamwish.to/e/${cleanTitle}-ep-${ep}`, isDefault: true },
        { id: 'def_3', name: '🌙 Filemoon (Opción 3)', url: `https://filemoon.sx/e/${cleanTitle}-ep-${ep}`, isDefault: true },
        { id: 'def_4', name: '🚀 DoodStream (Opción 4)', url: `https://doodstream.com/e/${cleanTitle}-ep-${ep}`, isDefault: true },
        { id: 'def_5', name: '📦 Mp4upload (Opción 5)', url: `https://www.mp4upload.com/embed-${cleanTitle}-${ep}.html`, isDefault: true }
    ];

    // User saved servers come FIRST!
    const combined = [...userSaved, ...defaultServers];

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

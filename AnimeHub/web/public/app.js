document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('anime-grid');
    const sectionTitle = document.getElementById('section-title');
    const itemCount = document.getElementById('item-count');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const btnSeason = document.getElementById('btn-season');
    const btnPopular = document.getElementById('btn-popular');
    const btnFavorites = document.getElementById('btn-favorites');
    const btnCustom = document.getElementById('btn-custom');
    const brandLogo = document.getElementById('brand-logo');

    const continueSection = document.getElementById('continue-section');
    const continueGrid = document.getElementById('continue-grid');

    const modal = document.getElementById('anime-modal');
    const closeModal = document.getElementById('close-modal');
    const modalBody = document.getElementById('modal-body');

    const addModal = document.getElementById('add-anime-modal');
    const openAddModal = document.getElementById('open-add-modal');
    const closeAddModal = document.getElementById('close-add-modal');
    const addForm = document.getElementById('add-anime-form');

    const addServerModal = document.getElementById('add-server-modal');
    const closeAddServerModal = document.getElementById('close-add-server-modal');
    const addServerForm = document.getElementById('add-server-form');

    const episodeModal = document.getElementById('episode-modal');
    const closeEpisodeModal = document.getElementById('close-episode-modal');
    const episodeForm = document.getElementById('episode-form');

    const loginModal = document.getElementById('login-modal');
    const closeLoginModal = document.getElementById('close-login-modal');
    const loginForm = document.getElementById('login-form');
    const authBtn = document.getElementById('auth-btn');
    const authIcon = document.getElementById('auth-icon');

    let currentTab = 'season';
    let currentAnimeList = [];
    let selectedGenre = 'all';
    let activeAnime = null;
    let activeEpNum = 1;

    // Helpers compatible con WebViews antiguos (sin optional chaining)
    function animeTitle(anime) {
        const t = anime.title || {};
        return t.english || t.romaji || (typeof anime.title === 'string' ? anime.title : 'Anime');
    }
    function animeImage(anime, fallback) {
        const c = anime.coverImage || {};
        const img = c.extraLarge || c.large || (typeof anime.coverImage === 'string' ? anime.coverImage : null);
        return img || fallback;
    }
    function animeStudio(anime) {
        const nodes = (anime.studios && anime.studios.nodes) || [];
        return (nodes[0] && nodes[0].name) || 'Personal';
    }

    // Escape HTML to prevent XSS when injecting remote/user data
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---- Admin auth ----
    let adminToken = localStorage.getItem('animehub_token') || '';

    function updateAuthIcon() {
        authIcon.className = adminToken ? 'fa-solid fa-lock-open' : 'fa-solid fa-lock';
        authBtn.title = adminToken ? 'Sesión de administrador (clic para salir)' : 'Acceso administrador';
    }

    function openLoginModal() {
        document.getElementById('login-error').style.display = 'none';
        loginModal.classList.add('open');
        setTimeout(() => document.getElementById('login-password').focus(), 50);
    }

    // fetch wrapper for write endpoints: attaches the admin token and
    // opens the login modal automatically on 401.
    async function apiFetch(url, options) {
        options = options || {};
        options.headers = Object.assign(
            { 'Content-Type': 'application/json' },
            options.headers || {}
        );
        if (adminToken) options.headers['x-admin-token'] = adminToken;
        const res = await fetch(url, options);
        if (res.status === 401) {
            openLoginModal();
            const err = new Error('AUTH_REQUIRED');
            err.auth = true;
            throw err;
        }
        return res;
    }

    updateAuthIcon();

    // Login modal listeners
    closeLoginModal.addEventListener('click', () => loginModal.classList.remove('open'));
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) loginModal.classList.remove('open');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (data.success && data.token) {
                adminToken = data.token;
                localStorage.setItem('animehub_token', adminToken);
                updateAuthIcon();
                loginForm.reset();
                loginModal.classList.remove('open');
            } else {
                errorEl.textContent = data.error || 'Contraseña incorrecta';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'Error de conexión';
            errorEl.style.display = 'block';
        }
    });

    authBtn.addEventListener('click', () => {
        if (adminToken) {
            if (confirm('¿Cerrar sesión de administrador?')) {
                adminToken = '';
                localStorage.removeItem('animehub_token');
                updateAuthIcon();
            }
        } else {
            openLoginModal();
        }
    });

    // Initial Load
    renderContinueWatching();
    loadSeason();

    // Event Listeners for Nav
    brandLogo.addEventListener('click', () => {
        setActiveTab(btnSeason);
        currentTab = 'season';
        sectionTitle.textContent = 'Animes en Emisión';
        loadSeason();
    });

    btnSeason.addEventListener('click', () => {
        if (currentTab === 'season') return;
        setActiveTab(btnSeason);
        currentTab = 'season';
        sectionTitle.textContent = 'Animes en Emisión';
        loadSeason();
    });

    btnPopular.addEventListener('click', () => {
        if (currentTab === 'popular') return;
        setActiveTab(btnPopular);
        currentTab = 'popular';
        sectionTitle.textContent = 'Animes Más Populares';
        loadPopular();
    });

    btnFavorites.addEventListener('click', () => {
        if (currentTab === 'favorites') return;
        setActiveTab(btnFavorites);
        currentTab = 'favorites';
        sectionTitle.textContent = 'Mi Lista (Favoritos)';
        loadFavorites();
    });

    btnCustom.addEventListener('click', () => {
        if (currentTab === 'custom') return;
        setActiveTab(btnCustom);
        currentTab = 'custom';
        sectionTitle.textContent = 'Mis Animes Personalizados';
        loadCustomAnimes();
    });

    // Genre Filtering
    const genreBtns = document.querySelectorAll('.genre-btn');
    genreBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            genreBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedGenre = btn.getAttribute('data-genre');
            filterAndRenderCurrentList();
        });
    });

    // Add Anime Modal Listeners
    openAddModal.addEventListener('click', () => addModal.classList.add('open'));
    closeAddModal.addEventListener('click', () => addModal.classList.remove('open'));
    addModal.addEventListener('click', (e) => {
        if (e.target === addModal) addModal.classList.remove('open');
    });

    // Add Server Modal Listeners
    closeAddServerModal.addEventListener('click', () => addServerModal.classList.remove('open'));
    addServerModal.addEventListener('click', (e) => {
        if (e.target === addServerModal) addServerModal.classList.remove('open');
    });

    // Episode Modal Listeners
    closeEpisodeModal.addEventListener('click', () => episodeModal.classList.remove('open'));
    episodeModal.addEventListener('click', (e) => {
        if (e.target === episodeModal) episodeModal.classList.remove('open');
    });

    // Submit Add Episode Form
    episodeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeAnime) return;

        const epNum = parseInt(document.getElementById('ep-num').value, 10);
        if (isNaN(epNum) || epNum < 1) {
            alert('Introduce un número de episodio válido.');
            return;
        }

        const servers = [];
        const epSrv1Name = document.getElementById('ep-srv1-name').value.trim();
        const epSrv1Url = document.getElementById('ep-srv1-url').value.trim();
        const epSrv2Name = document.getElementById('ep-srv2-name').value.trim();
        const epSrv2Url = document.getElementById('ep-srv2-url').value.trim();
        if (epSrv1Url) servers.push({ name: epSrv1Name || 'Servidor 1', url: epSrv1Url });
        if (epSrv2Url) servers.push({ name: epSrv2Name || 'Servidor 2', url: epSrv2Url });

        try {
            const res = await apiFetch('/api/episodes', {
                method: 'POST',
                body: JSON.stringify({ animeId: activeAnime.id, episode: epNum, servers })
            });
            const data = await res.json();
            if (data.success) {
                episodeForm.reset();
                episodeModal.classList.remove('open');
                renderModal(activeAnime, activeEpNum);
            } else {
                alert(data.error || 'Error al añadir el episodio.');
            }
        } catch (err) {
            if (!err.auth) alert('Error al añadir el episodio.');
        }
    });

    // Submit Add Server Form
    addServerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeAnime) return;

        const srvName = document.getElementById('new-srv-name').value.trim();
        const srvUrl = document.getElementById('new-srv-url').value.trim();
        const episodeOnly = document.getElementById('new-srv-episode-only').checked;

        const body = {
            animeId: activeAnime.id,
            name: srvName,
            url: srvUrl
        };
        if (episodeOnly) body.episode = activeEpNum;

        try {
            const res = await apiFetch('/api/anime-servers', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (data.success) {
                addServerForm.reset();
                addServerModal.classList.remove('open');

                // Re-render episode servers
                if (window.loadCurrentEpisodeServers) {
                    window.loadCurrentEpisodeServers(activeEpNum);
                }
            }
        } catch (err) {
            if (!err.auth) alert('Error al guardar el nuevo servidor.');
        }
    });

    // Submit Add Anime Form with Custom Servers
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('add-title').value.trim();
        const image = document.getElementById('add-image').value.trim();
        const episodes = document.getElementById('add-episodes').value;
        const genres = document.getElementById('add-genres').value.trim();
        const synopsis = document.getElementById('add-synopsis').value.trim();

        const srv1Name = document.getElementById('srv1-name').value.trim();
        const srv1Url = document.getElementById('srv1-url').value.trim();
        const srv2Name = document.getElementById('srv2-name').value.trim();
        const srv2Url = document.getElementById('srv2-url').value.trim();

        const servers = [];
        if (srv1Url) servers.push({ name: srv1Name || 'Mega HD', url: srv1Url });
        if (srv2Url) servers.push({ name: srv2Name || 'Streamwish', url: srv2Url });

        try {
            const res = await apiFetch('/api/custom', {
                method: 'POST',
                body: JSON.stringify({ title, image, episodes, genres, synopsis, servers })
            });
            const data = await res.json();
            if (data.success) {
                addForm.reset();
                addModal.classList.remove('open');
                setActiveTab(btnCustom);
                currentTab = 'custom';
                sectionTitle.textContent = 'Mis Animes Personalizados';
                loadCustomAnimes();
            }
        } catch (err) {
            if (!err.auth) alert('Error al guardar el anime.');
        }
    });

    searchBtn.addEventListener('click', () => performSearch());
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    closeModal.addEventListener('click', () => {
        modal.classList.remove('open');
        modalBody.innerHTML = '';
        activeAnime = null;
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('open');
            modalBody.innerHTML = '';
            activeAnime = null;
        }
    });

    function setActiveTab(activeBtn) {
        btnSeason.classList.remove('active');
        btnPopular.classList.remove('active');
        btnFavorites.classList.remove('active');
        btnCustom.classList.remove('active');
        activeBtn.classList.add('active');
    }

    // LocalStorage Helpers: Favorites & History
    function getFavorites() {
        return JSON.parse(localStorage.getItem('anime_favorites') || '[]');
    }

    function isFavorite(id) {
        const favs = getFavorites();
        return favs.some(a => String(a.id) === String(id));
    }

    function toggleFavorite(anime) {
        let favs = getFavorites();
        const exists = favs.some(a => String(a.id) === String(anime.id));
        if (exists) {
            favs = favs.filter(a => String(a.id) !== String(anime.id));
        } else {
            favs.unshift(anime);
        }
        localStorage.setItem('anime_favorites', JSON.stringify(favs));
    }

    function getHistory() {
        return JSON.parse(localStorage.getItem('anime_history') || '[]');
    }

    function saveHistory(anime, epNum) {
        let hist = getHistory();
        hist = hist.filter(h => String(h.id) !== String(anime.id));
        const title = animeTitle(anime);
        const image = animeImage(anime, null);

        hist.unshift({
            id: anime.id,
            title,
            epNum,
            image,
            time: Date.now()
        });

        if (hist.length > 6) hist.pop();
        localStorage.setItem('anime_history', JSON.stringify(hist));
        renderContinueWatching();
    }

    function renderContinueWatching() {
        const hist = getHistory();
        if (!hist || hist.length === 0) {
            continueSection.style.display = 'none';
            return;
        }

        continueSection.style.display = 'block';
        continueGrid.innerHTML = hist.map(item => `
            <div class="continue-card" data-id="${esc(item.id)}" data-ep="${esc(item.epNum)}">
                <img src="${esc(item.image || 'https://via.placeholder.com/60x80')}" alt="${esc(item.title)}">
                <div class="continue-info">
                    <span class="continue-title">${esc(item.title)}</span>
                    <span class="continue-ep">Continuar Ep. ${esc(item.epNum)}</span>
                </div>
            </div>
        `).join('');

        const cards = continueGrid.querySelectorAll('.continue-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                const id = card.getAttribute('data-id');
                const ep = card.getAttribute('data-ep');
                openDetail(id, ep);
            });
        });
    }

    // Fetch API Methods
    async function loadSeason() {
        showLoading();
        try {
            const res = await fetch('/api/season');
            currentAnimeList = await res.json();
            filterAndRenderCurrentList();
        } catch (err) {
            showError('Error al cargar la lista de emisión.');
        }
    }

    async function loadPopular() {
        showLoading();
        try {
            const res = await fetch('/api/trending');
            currentAnimeList = await res.json();
            filterAndRenderCurrentList();
        } catch (err) {
            showError('Error al cargar la lista de populares.');
        }
    }

    async function loadFavorites() {
        currentAnimeList = getFavorites();
        filterAndRenderCurrentList();
    }

    async function loadCustomAnimes() {
        showLoading();
        try {
            const res = await fetch('/api/custom');
            currentAnimeList = await res.json();
            filterAndRenderCurrentList();
        } catch (err) {
            showError('Error al cargar tus animes personalizados.');
        }
    }

    async function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        btnSeason.classList.remove('active');
        btnPopular.classList.remove('active');
        btnFavorites.classList.remove('active');
        btnCustom.classList.remove('active');
        sectionTitle.textContent = `Resultados para: "${query}"`;
        showLoading();

        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            currentAnimeList = await res.json();
            filterAndRenderCurrentList();
        } catch (err) {
            showError('Error en la búsqueda.');
        }
    }

    function filterAndRenderCurrentList() {
        let filtered = currentAnimeList;
        if (selectedGenre !== 'all') {
            filtered = currentAnimeList.filter(anime => {
                const genres = anime.genres || [];
                return genres.some(g => String(g).toLowerCase().includes(selectedGenre.toLowerCase()));
            });
        }
        renderGrid(filtered);
    }

    function showLoading() {
        itemCount.textContent = '...';
        grid.innerHTML = `
            <div class="loading-spinner">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Cargando anime...</p>
            </div>
        `;
    }

    function showError(message) {
        itemCount.textContent = '0';
        grid.innerHTML = `
            <div class="loading-spinner">
                <i class="fa-solid fa-folder-open"></i>
                <p>${esc(message)}</p>
            </div>
        `;
    }

    function renderGrid(animeList) {
        if (!animeList || animeList.length === 0) {
            showError('No hay animes en esta sección.');
            return;
        }

        itemCount.textContent = `${animeList.length} ítems`;
        grid.innerHTML = '';

        animeList.forEach(anime => {
            const card = document.createElement('div');
            card.className = 'anime-card';

            const title = animeTitle(anime);
            const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '10.0';
            const episodes = anime.episodes ? `${anime.episodes} eps` : 'En emisión';
            const imageUrl = animeImage(anime, 'https://via.placeholder.com/300x450');
            const isFav = isFavorite(anime.id);

            card.innerHTML = `
                <div class="poster-wrapper">
                    <img src="${esc(imageUrl)}" alt="${esc(title)}" loading="lazy">
                    <div class="score-tag"><i class="fa-solid fa-star"></i> ${esc(score)}</div>
                    <button class="fav-card-btn ${isFav ? 'active' : ''}" title="Favorito">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                </div>
                <div class="card-info">
                    <h3 class="anime-title">${esc(title)}</h3>
                    <div class="anime-meta">${esc(episodes)} • ${anime.isCustom ? 'Personal' : esc(anime.format || 'TV')}</div>
                </div>
            `;

            const favBtn = card.querySelector('.fav-card-btn');
            favBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(anime);
                renderGrid(animeList);
            });

            card.addEventListener('click', () => openDetail(anime.id));
            grid.appendChild(card);
        });
    }

    async function openDetail(animeId, initialEp = 1) {
        modal.classList.add('open');
        modalBody.innerHTML = `
            <div class="loading-spinner">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Cargando detalles...</p>
            </div>
        `;

        try {
            const res = await fetch(`/api/anime/${animeId}`);
            const data = await res.json();
            activeAnime = data;
            renderModal(data, parseInt(initialEp, 10));
        } catch (err) {
            modalBody.innerHTML = `<p style="color:red; text-align:center;">Error al cargar información del anime.</p>`;
        }
    }

    async function renderModal(anime, startEp = 1) {
        const title = animeTitle(anime);
        const imageUrl = animeImage(anime, 'https://via.placeholder.com/300x450');
        const genresHtml = (anime.genres || []).map(g => `<span class="tag">${esc(g)}</span>`).join('');
        const studio = esc(animeStudio(anime));
        const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '10.0';
        const cleanSynopsis = esc((anime.description || 'Sin descripción disponible.').replace(/<[^>]*>?/gm, ''));
        const isFav = isFavorite(anime.id);

        let defaultVideoEmbed = '';
        if (anime.trailer && anime.trailer.site === 'youtube') {
            defaultVideoEmbed = `https://www.youtube.com/embed/${anime.trailer.id}?autoplay=0`;
        }

        const totalEp = anime.episodes || 12;
        activeEpNum = startEp;

        // Cargar episodios añadidos/eliminados por el usuario
        let epAdded = [];
        let epRemoved = [];
        try {
            const epRes = await fetch(`/api/episodes/${anime.id}`);
            const epData = await epRes.json();
            epAdded = epData.added || [];
            epRemoved = epData.removed || [];
        } catch (e) { /* sin overrides */ }

        const removedSet = {};
        epRemoved.forEach(n => { removedSet[n] = true; });

        const effectiveEps = [];
        for (let i = 1; i <= totalEp; i++) {
            if (!removedSet[i]) effectiveEps.push(i);
        }
        epAdded.forEach(n => {
            if (effectiveEps.indexOf(n) === -1) effectiveEps.push(n);
        });
        effectiveEps.sort((a, b) => a - b);
        const maxEp = effectiveEps.length ? effectiveEps[effectiveEps.length - 1] : totalEp;

        let episodesHtml = '';
        effectiveEps.slice(0, 60).forEach(i => {
            episodesHtml += `
                <div class="ep-item">
                    <button class="ep-btn ${i === activeEpNum ? 'active' : ''}" data-ep="${i}">Episodio ${i}</button>
                    <button class="ep-del-btn" data-ep="${i}" title="Eliminar episodio"><i class="fa-solid fa-xmark"></i></button>
                </div>
            `;
        });

        modalBody.innerHTML = `
            <div class="detail-header">
                <img src="${esc(imageUrl)}" class="detail-poster" alt="${esc(title)}">
                <div class="detail-info">
                    <h1 class="detail-title">${esc(title)}</h1>
                    <div class="genre-tags">${genresHtml}</div>
                    <p class="detail-synopsis">${cleanSynopsis}</p>
                    <div class="anime-meta">
                        <p><strong>Estado:</strong> ${esc(anime.status || 'Completado')}</p>
                        <p><strong>Puntuación:</strong> ⭐ ${esc(score)}</p>
                        <p><strong>Estudio:</strong> ${studio}</p>
                    </div>

                    <div style="display:flex; gap:0.8rem; margin-top:0.8rem;">
                        <button class="ctrl-btn" id="modal-fav-btn">
                            <i class="fa-${isFav ? 'solid' : 'regular'} fa-bookmark"></i>
                            ${isFav ? 'Guardado en Mi Lista' : 'Guardar en Mi Lista'}
                        </button>
                        ${anime.isCustom ? `
                            <button class="delete-btn" id="delete-anime-btn" style="margin:0;"><i class="fa-solid fa-trash"></i> Eliminar Anime</button>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Reproductor de Video -->
            <div class="video-section" id="video-section">
                <div class="video-section-title">
                    <h3 id="player-status-title"><i class="fa-solid fa-play-circle"></i> Reproductor de Video</h3>
                    <div class="server-selector" id="server-selector"></div>
                </div>

                <div class="player-container" id="player-container">
                    <iframe id="video-iframe" src="${esc(defaultVideoEmbed)}" allowfullscreen allow="autoplay; encrypted-media"></iframe>
                    <video id="video-player" controls playsinline></video>
                </div>

                <!-- Botones de Control del Reproductor -->
                <div class="player-controls-bar">
                    <button class="ctrl-btn" id="prev-ep-btn"><i class="fa-solid fa-backward"></i> Ep. Anterior</button>
                    <button class="ctrl-btn" id="theater-mode-btn"><i class="fa-solid fa-expand"></i> Modo Cine</button>
                    <button class="ctrl-btn" id="next-ep-btn">Ep. Siguiente <i class="fa-solid fa-forward"></i></button>
                </div>
            </div>

            <!-- Lista de Episodios -->
            <div class="episodes-section">
                <div class="episodes-header">
                    <h3>Lista de Episodios (${effectiveEps.length} eps)</h3>
                    <button class="ctrl-btn" id="add-ep-btn"><i class="fa-solid fa-plus"></i> Añadir Episodio</button>
                </div>
                <div class="episodes-grid">
                    ${episodesHtml}
                </div>
            </div>
        `;

        // Favorite Toggle inside Modal
        const modalFavBtn = document.getElementById('modal-fav-btn');
        modalFavBtn.addEventListener('click', () => {
            toggleFavorite(anime);
            const nowFav = isFavorite(anime.id);
            modalFavBtn.innerHTML = `
                <i class="fa-${nowFav ? 'solid' : 'regular'} fa-bookmark"></i>
                ${nowFav ? 'Guardado en Mi Lista' : 'Guardar en Mi Lista'}
            `;
            if (currentTab === 'favorites') loadFavorites();
        });

        if (anime.isCustom) {
            const delBtn = document.getElementById('delete-anime-btn');
            if (delBtn) {
                delBtn.addEventListener('click', async () => {
                    if (confirm(`¿Seguro que deseas eliminar "${title}"?`)) {
                        await apiFetch(`/api/custom/${anime.id}`, { method: 'DELETE' });
                        modal.classList.remove('open');
                        modalBody.innerHTML = '';
                        loadCustomAnimes();
                    }
                });
            }
        }

        // Add / Delete episode buttons
        const addEpBtn = document.getElementById('add-ep-btn');
        if (addEpBtn) {
            addEpBtn.addEventListener('click', () => {
                document.getElementById('ep-num').value = maxEp + 1;
                episodeModal.classList.add('open');
            });
        }

        const epDelBtns = modalBody.querySelectorAll('.ep-del-btn');
        epDelBtns.forEach(dBtn => {
            dBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const epNum = parseInt(dBtn.getAttribute('data-ep'), 10);
                if (confirm(`¿Eliminar el Episodio ${epNum} de la lista?`)) {
                    await apiFetch('/api/episodes', {
                        method: 'DELETE',
                        body: JSON.stringify({ animeId: anime.id, episode: epNum })
                    });
                    renderModal(anime, activeEpNum);
                }
            });
        });

        const videoIframe = document.getElementById('video-iframe');
        const videoPlayer = document.getElementById('video-player');
        let hlsInstance = null;

        function isDirectVideo(url) {
            return /\.(mp4|webm|ogv|ogg|m4v|mov)(\?|#|$)/i.test(url) || /\.m3u8(\?|#|$)/i.test(url);
        }

        function playServerUrl(url) {
            if (isDirectVideo(url)) {
                videoIframe.style.display = 'none';
                videoPlayer.style.display = 'block';
                if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
                videoPlayer.pause();
                videoPlayer.removeAttribute('src');
                videoPlayer.load();
                if (/\.m3u8(\?|#|$)/i.test(url) && window.Hls && Hls.isSupported()) {
                    hlsInstance = new Hls();
                    hlsInstance.loadSource(url);
                    hlsInstance.attachMedia(videoPlayer);
                } else {
                    videoPlayer.src = url;
                }
                const p = videoPlayer.play();
                if (p && p.catch) p.catch(() => {});
            } else {
                videoPlayer.style.display = 'none';
                videoPlayer.pause();
                if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
                videoIframe.style.display = 'block';
                videoIframe.src = url;
            }
        }

        const playerStatusTitle = document.getElementById('player-status-title');
        const serverSelector = document.getElementById('server-selector');
        const playerContainer = document.getElementById('player-container');
        const prevBtn = document.getElementById('prev-ep-btn');
        const nextBtn = document.getElementById('next-ep-btn');
        const theaterBtn = document.getElementById('theater-mode-btn');

        // Theater mode toggle
        theaterBtn.addEventListener('click', () => {
            playerContainer.classList.toggle('theater-mode');
            if (playerContainer.classList.contains('theater-mode')) {
                playerContainer.style.paddingTop = '75%';
            } else {
                playerContainer.style.paddingTop = '56.25%';
            }
        });

        // Load Episode function
        window.loadCurrentEpisodeServers = async function(epNum) {
            activeEpNum = epNum;
            saveHistory(anime, epNum);

            // Highlight episode button
            const epBtns = modalBody.querySelectorAll('.ep-btn');
            epBtns.forEach(b => {
                if (parseInt(b.getAttribute('data-ep'), 10) === epNum) {
                    b.classList.add('active');
                } else {
                    b.classList.remove('active');
                }
            });

            playerStatusTitle.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Cargando Episodio ${epNum}...`;

            try {
                const res = await fetch(`/api/servers?title=${encodeURIComponent(title)}&episode=${epNum}&animeId=${anime.id}&malId=${anime.idMal || ''}`);
                const serverData = await res.json();

                if (serverData.servers && serverData.servers.length > 0) {
                    playerStatusTitle.innerHTML = `<i class="fa-solid fa-play"></i> Reproduciendo: Episodio ${epNum}`;

                    serverSelector.style.display = 'flex';

                    let serversHtml = serverData.servers.map((srv, idx) => `
                        <div class="server-btn-wrapper">
                            <button class="server-btn ${idx === 0 ? 'active' : ''}" data-url="${esc(srv.url)}">
                                ${esc(srv.name)}
                            </button>
                            <button class="srv-del-btn" data-id="${srv.id}" title="Eliminar servidor"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `).join('');

                    serversHtml += `
                        <button class="add-srv-btn" id="inline-add-srv-btn" title="Añadir nuevo servidor">
                            <i class="fa-solid fa-plus"></i> Añadir Servidor
                        </button>
                    `;

                    serverSelector.innerHTML = serversHtml;

                    playServerUrl(serverData.servers[0].url);

                    // Server switch listeners
                    const srvBtns = serverSelector.querySelectorAll('.server-btn');
                    srvBtns.forEach(sBtn => {
                        sBtn.addEventListener('click', () => {
                            srvBtns.forEach(sb => sb.classList.remove('active'));
                            sBtn.classList.add('active');
                            playServerUrl(sBtn.getAttribute('data-url'));
                        });
                    });

                    // Add server button listener
                    const inlineAddBtn = document.getElementById('inline-add-srv-btn');
                    if (inlineAddBtn) {
                        inlineAddBtn.addEventListener('click', () => {
                            addServerModal.classList.add('open');
                        });
                    }

                    // Delete custom server listeners
                    const delSrvBtns = serverSelector.querySelectorAll('.srv-del-btn');
                    delSrvBtns.forEach(dBtn => {
                        dBtn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const serverId = dBtn.getAttribute('data-id');
                            if (confirm('¿Eliminar este servidor personalizado?')) {
                                await apiFetch('/api/anime-servers', {
                                    method: 'DELETE',
                                    body: JSON.stringify({ animeId: anime.id, serverId, episode: epNum })
                                });
                                window.loadCurrentEpisodeServers(epNum);
                            }
                        });
                    });
                } else {
                    playerStatusTitle.innerHTML = `<i class="fa-solid fa-circle-info"></i> Sin fuentes de video para el Episodio ${epNum}`;
                    serverSelector.style.display = 'flex';
                    serverSelector.innerHTML = `
                        <button class="add-srv-btn" id="inline-add-srv-btn">
                            <i class="fa-solid fa-plus"></i> Añadir Servidor
                        </button>
                    `;
                    videoIframe.removeAttribute('src');
                    document.getElementById('inline-add-srv-btn').addEventListener('click', () => {
                        addServerModal.classList.add('open');
                    });
                }
            } catch (err) {
                playerStatusTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al cargar servidor para Episodio ${epNum}`;
            }
        };

        // Navigation controls
        prevBtn.addEventListener('click', () => {
            if (activeEpNum > 1) window.loadCurrentEpisodeServers(activeEpNum - 1);
        });

        nextBtn.addEventListener('click', () => {
            if (activeEpNum < maxEp) window.loadCurrentEpisodeServers(activeEpNum + 1);
        });

        // Episode grid clicks
        const epBtns = modalBody.querySelectorAll('.ep-btn');
        epBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const epNum = parseInt(btn.getAttribute('data-ep'), 10);
                window.loadCurrentEpisodeServers(epNum);
            });
        });

        // Auto load start episode
        window.loadCurrentEpisodeServers(startEp);
    }
});

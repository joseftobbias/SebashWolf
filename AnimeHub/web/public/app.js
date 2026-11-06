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

    let currentTab = 'season';
    let currentAnimeList = [];
    let selectedGenre = 'all';
    let activeAnime = null;
    let activeEpNum = 1;

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

    // Submit Add Server Form
    addServerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!activeAnime) return;

        const srvName = document.getElementById('new-srv-name').value.trim();
        const srvUrl = document.getElementById('new-srv-url').value.trim();

        try {
            const res = await fetch('/api/anime-servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    animeId: activeAnime.id,
                    name: srvName,
                    url: srvUrl
                })
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
            alert('Error al guardar el nuevo servidor.');
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
            const res = await fetch('/api/custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            alert('Error al guardar el anime.');
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
        const title = anime.title?.english || anime.title?.romaji || anime.title || 'Anime';
        const image = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage;

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
            <div class="continue-card" data-id="${item.id}" data-ep="${item.epNum}">
                <img src="${item.image || 'https://via.placeholder.com/60x80'}" alt="${item.title}">
                <div class="continue-info">
                    <span class="continue-title">${item.title}</span>
                    <span class="continue-ep">Continuar Ep. ${item.epNum}</span>
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
                <p>${message}</p>
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

            const title = anime.title?.english || anime.title?.romaji || anime.title || 'Anime';
            const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '10.0';
            const episodes = anime.episodes ? `${anime.episodes} eps` : 'En emisión';
            const imageUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage || 'https://via.placeholder.com/300x450';
            const isFav = isFavorite(anime.id);

            card.innerHTML = `
                <div class="poster-wrapper">
                    <img src="${imageUrl}" alt="${title}" loading="lazy">
                    <div class="score-tag"><i class="fa-solid fa-star"></i> ${score}</div>
                    <button class="fav-card-btn ${isFav ? 'active' : ''}" title="Favorito">
                        <i class="fa-${isFav ? 'solid' : 'regular'} fa-bookmark"></i>
                    </button>
                </div>
                <div class="card-info">
                    <h3 class="anime-title">${title}</h3>
                    <div class="anime-meta">${episodes} • ${anime.isCustom ? 'Personal' : (anime.format || 'TV')}</div>
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

    function renderModal(anime, startEp = 1) {
        const title = anime.title?.english || anime.title?.romaji || anime.title || 'Anime';
        const imageUrl = anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage || 'https://via.placeholder.com/300x450';
        const genresHtml = (anime.genres || []).map(g => `<span class="tag">${g}</span>`).join('');
        const studio = (anime.studios?.nodes || [])[0]?.name || 'Personal';
        const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '10.0';
        const cleanSynopsis = (anime.description || 'Sin descripción disponible.').replace(/<[^>]*>?/gm, '');
        const isFav = isFavorite(anime.id);

        let defaultVideoEmbed = '';
        if (anime.trailer && anime.trailer.site === 'youtube') {
            defaultVideoEmbed = `https://www.youtube.com/embed/${anime.trailer.id}?autoplay=0`;
        }

        const totalEp = anime.episodes || 12;
        activeEpNum = startEp;

        let episodesHtml = '';
        for (let i = 1; i <= Math.min(totalEp, 50); i++) {
            episodesHtml += `<button class="ep-btn ${i === activeEpNum ? 'active' : ''}" data-ep="${i}">Episodio ${i}</button>`;
        }

        modalBody.innerHTML = `
            <div class="detail-header">
                <img src="${imageUrl}" class="detail-poster" alt="${title}">
                <div class="detail-info">
                    <h1 class="detail-title">${title}</h1>
                    <div class="genre-tags">${genresHtml}</div>
                    <p class="detail-synopsis">${cleanSynopsis}</p>
                    <div class="anime-meta">
                        <p><strong>Estado:</strong> ${anime.status || 'Completado'}</p>
                        <p><strong>Puntuación:</strong> ⭐ ${score}</p>
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
                    <iframe id="video-iframe" src="${defaultVideoEmbed}" allowfullscreen allow="autoplay; encrypted-media"></iframe>
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
                <h3>Lista de Episodios (${totalEp} eps)</h3>
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
                        await fetch(`/api/custom/${anime.id}`, { method: 'DELETE' });
                        modal.classList.remove('open');
                        modalBody.innerHTML = '';
                        loadCustomAnimes();
                    }
                });
            }
        }

        const videoIframe = document.getElementById('video-iframe');
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
                const res = await fetch(`/api/servers?title=${encodeURIComponent(title)}&episode=${epNum}&animeId=${anime.id}`);
                const serverData = await res.json();

                if (serverData.servers && serverData.servers.length > 0) {
                    playerStatusTitle.innerHTML = `<i class="fa-solid fa-play"></i> Reproduciendo: Episodio ${epNum}`;

                    serverSelector.style.display = 'flex';

                    let serversHtml = serverData.servers.map((srv, idx) => `
                        <div class="server-btn-wrapper">
                            <button class="server-btn ${idx === 0 ? 'active' : ''}" data-url="${srv.url}">
                                ${srv.name}
                            </button>
                            ${!srv.isDefault ? `
                                <button class="srv-del-btn" data-id="${srv.id}" title="Eliminar servidor"><i class="fa-solid fa-trash"></i></button>
                            ` : ''}
                        </div>
                    `).join('');

                    serversHtml += `
                        <button class="add-srv-btn" id="inline-add-srv-btn" title="Añadir nuevo servidor">
                            <i class="fa-solid fa-plus"></i> Añadir Servidor
                        </button>
                    `;

                    serverSelector.innerHTML = serversHtml;

                    videoIframe.src = serverData.servers[0].url;

                    // Server switch listeners
                    const srvBtns = serverSelector.querySelectorAll('.server-btn');
                    srvBtns.forEach(sBtn => {
                        sBtn.addEventListener('click', () => {
                            srvBtns.forEach(sb => sb.classList.remove('active'));
                            sBtn.classList.add('active');
                            videoIframe.src = sBtn.getAttribute('data-url');
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
                                await fetch('/api/anime-servers', {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ animeId: anime.id, serverId })
                                });
                                window.loadCurrentEpisodeServers(epNum);
                            }
                        });
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
            if (activeEpNum < totalEp) window.loadCurrentEpisodeServers(activeEpNum + 1);
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

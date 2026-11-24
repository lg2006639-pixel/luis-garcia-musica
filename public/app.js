const FALLBACK_COVER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff2e93"/>
          <stop offset="50%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#00e5ff"/>
        </linearGradient>
      </defs>
      <rect width="300" height="300" fill="url(#g)"/>
      <circle cx="150" cy="150" r="88" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="6"/>
      <text x="150" y="168" font-size="74" text-anchor="middle" fill="#ffffff">🎵</text>
    </svg>`
  );

const state = {
  region: 'world',
  genre: 'all',
  currentTrack: null,
  activeTab: 'history',
  history: JSON.parse(localStorage.getItem('lg_history') || '[]'),
  favorites: JSON.parse(localStorage.getItem('lg_favorites') || '[]'),
  discoveredCount: Number(localStorage.getItem('lg_discovered') || '0'),
  downloadCount: Number(localStorage.getItem('lg_downloads') || '0')
};

const els = {
  regionPills: document.getElementById('regionPills'),
  genreSelect: document.getElementById('genreSelect'),
  surpriseBtn: document.getElementById('surpriseBtn'),
  playerLoading: document.getElementById('playerLoading'),
  vinylWrap: document.getElementById('vinylWrap'),
  visualizer: document.getElementById('visualizer'),
  trackCover: document.getElementById('trackCover'),
  trackRegion: document.getElementById('trackRegion'),
  trackGenre: document.getElementById('trackGenre'),
  trackSize: document.getElementById('trackSize'),
  trackTitle: document.getElementById('trackTitle'),
  trackArtist: document.getElementById('trackArtist'),
  trackLicense: document.getElementById('trackLicense'),
  currentTime: document.getElementById('currentTime'),
  totalTime: document.getElementById('totalTime'),
  seekBar: document.getElementById('seekBar'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  playIcon: document.getElementById('playIcon'),
  playText: document.getElementById('playText'),
  downloadBtn: document.getElementById('downloadBtn'),
  favBtn: document.getElementById('favBtn'),
  nextBtn: document.getElementById('nextBtn'),
  volumeBar: document.getElementById('volumeBar'),
  archiveLink: document.getElementById('archiveLink'),
  batchGrid: document.getElementById('batchGrid'),
  refreshBatchBtn: document.getElementById('refreshBatchBtn'),
  libraryList: document.getElementById('libraryList'),
  discoveredCount: document.getElementById('discoveredCount'),
  downloadCount: document.getElementById('downloadCount'),
  favCount: document.getElementById('favCount'),
  toast: document.getElementById('toast'),
  audio: document.getElementById('audioPlayer')
};

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
}

function saveStorage() {
  localStorage.setItem('lg_history', JSON.stringify(state.history.slice(0, 20)));
  localStorage.setItem('lg_favorites', JSON.stringify(state.favorites.slice(0, 50)));
  localStorage.setItem('lg_discovered', String(state.discoveredCount));
  localStorage.setItem('lg_downloads', String(state.downloadCount));
  updateCounters();
}

function updateCounters() {
  els.discoveredCount.textContent = state.discoveredCount;
  els.downloadCount.textContent = state.downloadCount;
  els.favCount.textContent = state.favorites.length;
}

function formatTime(sec) {
  if (!sec || Number.isNaN(sec) || !Number.isFinite(sec)) return '0:00';
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function isFavorite(trackId) {
  return state.favorites.some((t) => t.id === trackId);
}

function registerDownload(track) {
  state.downloadCount += 1;
  saveStorage();
  showToast(`⬇️ Descargando "${track.title}" gratis...`);
}

function loadTrackIntoPlayer(track, autoPlay = false) {
  state.currentTrack = track;

  els.trackCover.src = track.coverUrl || FALLBACK_COVER;
  els.trackCover.onerror = () => {
    els.trackCover.src = FALLBACK_COVER;
  };

  els.trackRegion.textContent = `${track.regionEmoji || '🌍'} ${track.region || 'Todo el Mundo'}`;
  els.trackGenre.textContent = track.genre || 'Música del Mundo';
  els.trackSize.textContent = `${track.duration || 'MP3'} • ${track.size || 'MP3'}`;
  els.trackTitle.textContent = track.title;
  els.trackArtist.textContent = `${track.artist}${track.year ? ` • ${track.year}` : ''}`;
  els.trackLicense.textContent = `✓ ${track.license || 'Gratis / Creative Commons'}`;

  els.audio.src = track.streamUrl;
  els.audio.volume = Number(els.volumeBar.value);
  els.seekBar.value = 0;
  els.currentTime.textContent = '0:00';
  els.totalTime.textContent = track.duration || '0:00';

  els.playPauseBtn.disabled = false;
  els.favBtn.disabled = false;
  els.favBtn.textContent = isFavorite(track.id) ? '❤️' : '🤍';

  els.downloadBtn.href = track.downloadUrl;
  els.downloadBtn.classList.remove('disabled');
  els.downloadBtn.setAttribute('aria-disabled', 'false');

  if (track.archiveUrl) {
    els.archiveLink.href = track.archiveUrl;
    els.archiveLink.style.display = 'inline';
  }

  // Guardar en historial
  state.history = [track, ...state.history.filter((t) => t.id !== track.id)].slice(0, 20);
  state.discoveredCount += 1;
  saveStorage();
  renderLibrary();

  if (autoPlay) {
    els.audio.play().catch(() => {
      showToast('🎵 Canción lista. Presiona Reproducir para escucharla.');
    });
  }
}

async function fetchRandomTrack(autoPlay = true) {
  els.playerLoading.classList.add('show');
  try {
    const res = await fetch(`/api/random-track?region=${encodeURIComponent(state.region)}&genre=${encodeURIComponent(state.genre)}`);
    if (!res.ok) throw new Error('Error buscando canción');
    const track = await res.json();
    loadTrackIntoPlayer(track, autoPlay);
    showToast(`🌍 ¡Nueva canción de ${track.region}!`);
  } catch (err) {
    showToast('⚠️ No pudimos cargar una canción ahora. Intenta otra vez.');
  } finally {
    els.playerLoading.classList.remove('show');
  }
}

async function fetchBatchTracks() {
  els.batchGrid.innerHTML = `<p class="empty-msg">Cargando canciones aleatorias de todo el planeta...</p>`;
  try {
    const res = await fetch(`/api/batch-tracks?region=${encodeURIComponent(state.region)}&genre=${encodeURIComponent(state.genre)}&count=4`);
    if (!res.ok) throw new Error('Error cargando lista');
    const data = await res.json();
    renderBatchGrid(data.tracks || []);
  } catch {
    els.batchGrid.innerHTML = `<p class="empty-msg">No se pudo cargar la lista. Toca "Mezclar Lista" para reintentar.</p>`;
  }
}

function renderBatchGrid(tracks) {
  if (!tracks.length) {
    els.batchGrid.innerHTML = `<p class="empty-msg">No encontramos pistas con este filtro. Prueba otra región.</p>`;
    return;
  }

  els.batchGrid.innerHTML = '';
  tracks.forEach((track) => {
    const card = document.createElement('article');
    card.className = 'mini-card';
    card.innerHTML = `
      <div class="mini-card-top">
        <img class="mini-cover" src="${track.coverUrl || FALLBACK_COVER}" alt="${track.title.replace(/"/g, '&quot;')}" />
        <div style="min-width:0; flex:1;">
          <div class="mini-title"></div>
          <div class="mini-artist"></div>
        </div>
      </div>
      <div class="mini-meta">
        <span>${track.regionEmoji || '🌍'} ${track.region}</span>
        <span>${track.duration} • ${track.size}</span>
      </div>
      <div class="mini-actions">
        <button class="mini-btn-play">▶ Escuchar</button>
        <a class="mini-btn-dl" href="${track.downloadUrl}">⬇️ MP3</a>
      </div>
    `;

    const img = card.querySelector('.mini-cover');
    img.onerror = () => { img.src = FALLBACK_COVER; };
    card.querySelector('.mini-title').textContent = track.title;
    card.querySelector('.mini-artist').textContent = track.artist;

    card.querySelector('.mini-btn-play').addEventListener('click', () => {
      loadTrackIntoPlayer(track, true);
      window.scrollTo({ top: 180, behavior: 'smooth' });
    });

    card.querySelector('.mini-btn-dl').addEventListener('click', () => {
      registerDownload(track);
    });

    els.batchGrid.appendChild(card);
  });
}

function renderLibrary() {
  const list = state.activeTab === 'favorites' ? state.favorites : state.history;
  if (!list.length) {
    els.libraryList.innerHTML = `<p class="empty-msg">${
      state.activeTab === 'favorites'
        ? 'Aún no tienes favoritos. Toca el corazón 🤍 en cualquier canción.'
        : 'Todavía no has descubierto canciones. ¡Toca "¡Sorpréndeme!" arriba!'
    }</p>`;
    return;
  }

  els.libraryList.innerHTML = '';
  list.forEach((track) => {
    const item = document.createElement('div');
    item.className = 'library-item';
    item.innerHTML = `
      <div class="library-item-info">
        <span class="library-item-title"></span>
        <span class="library-item-sub"></span>
      </div>
      <div class="library-item-actions">
        <button class="mini-btn-play">▶ Reproducir</button>
        <a class="mini-btn-dl" href="${track.downloadUrl}">⬇️ MP3</a>
      </div>
    `;

    item.querySelector('.library-item-title').textContent = track.title;
    item.querySelector('.library-item-sub').textContent = `${track.artist} • ${track.regionEmoji || '🌍'} ${track.region} • ${track.size}`;

    item.querySelector('.mini-btn-play').addEventListener('click', () => {
      loadTrackIntoPlayer(track, true);
      window.scrollTo({ top: 180, behavior: 'smooth' });
    });

    item.querySelector('.mini-btn-dl').addEventListener('click', () => {
      registerDownload(track);
    });

    els.libraryList.appendChild(item);
  });
}

async function initMeta() {
  try {
    const res = await fetch('/api/meta');
    const data = await res.json();

    els.regionPills.innerHTML = '';
    data.regions.forEach((r) => {
      const btn = document.createElement('button');
      btn.className = `region-pill${r.key === state.region ? ' active' : ''}`;
      btn.textContent = `${r.emoji} ${r.label}`;
      btn.addEventListener('click', () => {
        state.region = r.key;
        document.querySelectorAll('.region-pill').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        fetchBatchTracks();
      });
      els.regionPills.appendChild(btn);
    });

    els.genreSelect.innerHTML = '';
    data.genres.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.key;
      opt.textContent = g.label;
      els.genreSelect.appendChild(opt);
    });
  } catch {
    showToast('⚠️ Error cargando regiones.');
  }
}

// Eventos de audio
els.audio.addEventListener('play', () => {
  els.playIcon.textContent = '⏸';
  els.playText.textContent = 'Pausar';
  els.vinylWrap.classList.add('playing');
  els.visualizer.classList.add('active');
});

els.audio.addEventListener('pause', () => {
  els.playIcon.textContent = '▶';
  els.playText.textContent = 'Reproducir';
  els.vinylWrap.classList.remove('playing');
  els.visualizer.classList.remove('active');
});

els.audio.addEventListener('timeupdate', () => {
  if (!els.audio.duration) return;
  els.seekBar.value = (els.audio.currentTime / els.audio.duration) * 100;
  els.currentTime.textContent = formatTime(els.audio.currentTime);
  els.totalTime.textContent = formatTime(els.audio.duration);
});

els.audio.addEventListener('ended', () => {
  fetchRandomTrack(true);
});

els.audio.addEventListener('error', () => {
  if (state.currentTrack) {
    showToast('⚠️ Esta pista tardó demasiado. Probando otra...');
  }
});

// Controles UI
els.playPauseBtn.addEventListener('click', () => {
  if (els.audio.paused) {
    els.audio.play().catch(() => showToast('No se pudo reproducir el audio.'));
  } else {
    els.audio.pause();
  }
});

els.seekBar.addEventListener('input', () => {
  if (!els.audio.duration) return;
  els.audio.currentTime = (Number(els.seekBar.value) / 100) * els.audio.duration;
});

els.volumeBar.addEventListener('input', () => {
  els.audio.volume = Number(els.volumeBar.value);
});

els.downloadBtn.addEventListener('click', () => {
  if (state.currentTrack) registerDownload(state.currentTrack);
});

els.favBtn.addEventListener('click', () => {
  if (!state.currentTrack) return;
  const exists = isFavorite(state.currentTrack.id);
  if (exists) {
    state.favorites = state.favorites.filter((t) => t.id !== state.currentTrack.id);
    els.favBtn.textContent = '🤍';
    showToast('Quitado de favoritos');
  } else {
    state.favorites = [state.currentTrack, ...state.favorites];
    els.favBtn.textContent = '❤️';
    showToast('❤️ Guardado en tus favoritos');
  }
  saveStorage();
  renderLibrary();
});

els.surpriseBtn.addEventListener('click', () => fetchRandomTrack(true));
els.nextBtn.addEventListener('click', () => fetchRandomTrack(true));
els.refreshBatchBtn.addEventListener('click', () => fetchBatchTracks());

els.genreSelect.addEventListener('change', (e) => {
  state.genre = e.target.value;
  fetchBatchTracks();
});

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderLibrary();
  });
});

// Inicialización
(async function boot() {
  els.trackCover.src = FALLBACK_COVER;
  updateCounters();
  renderLibrary();
  await initMeta();
  await Promise.all([fetchRandomTrack(false), fetchBatchTracks()]);
})();

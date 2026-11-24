const express = require('express');
const path = require('path');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Regiones del mundo con términos de búsqueda musicales en Internet Archive
const REGIONS = {
  world: {
    label: 'Todo el Mundo',
    emoji: '🌍',
    queries: [
      'world music', 'folk', 'cumbia', 'samba', 'afrobeat', 'flamenco',
      'jazz', 'electronic', 'reggae', 'bossa nova', 'sitar', 'koto',
      'tango', 'bolero', 'celtic', 'ambient', 'dub', 'salsa'
    ]
  },
  latam: {
    label: 'Latinoamérica',
    emoji: '💃',
    queries: ['cumbia', 'salsa', 'tango', 'bossa nova', 'samba', 'bolero', 'latin', 'mariachi', 'andean']
  },
  europe: {
    label: 'Europa',
    emoji: '🎻',
    queries: ['flamenco', 'celtic', 'french', 'italian', 'balkan', 'klezmer', 'chanson', 'gypsy', 'euro']
  },
  asia: {
    label: 'Asia',
    emoji: '🌸',
    queries: ['japanese', 'indian', 'sitar', 'gamelan', 'chinese', 'koto', 'bollywood', 'asian', 'raga']
  },
  africa: {
    label: 'África',
    emoji: '🥁',
    queries: ['afrobeat', 'african', 'highlife', 'kora', 'ethiopian', 'soukous', 'mbira', 'gnawa']
  },
  northamerica: {
    label: 'Norteamérica',
    emoji: '🎸',
    queries: ['blues', 'jazz', 'bluegrass', 'funk', 'soul', 'indie', 'hiphop', 'country']
  },
  middleeast: {
    label: 'Medio Oriente',
    emoji: '🌙',
    queries: ['arabic', 'oud', 'persian', 'turkish', 'middle eastern', 'maqam', 'darbuka']
  },
  caribbean: {
    label: 'Caribe',
    emoji: '🌴',
    queries: ['reggae', 'dub', 'ska', 'calypso', 'merengue', 'bachata', 'dancehall', 'caribbean']
  }
};

const GENRES = {
  all: { label: 'Todos los Géneros', query: '' },
  electronic: { label: 'Electrónica', query: 'electronic OR techno OR house OR synth' },
  jazz: { label: 'Jazz & Blues', query: 'jazz OR blues OR swing' },
  folk: { label: 'Folk & Tradicional', query: 'folk OR traditional OR acoustic' },
  rock: { label: 'Rock & Indie', query: 'rock OR indie OR alternative' },
  classical: { label: 'Clásica', query: 'classical OR orchestra OR piano' },
  ambient: { label: 'Lo-Fi & Ambient', query: 'ambient OR lofi OR chillout OR downtempo' },
  reggae: { label: 'Reggae & Dub', query: 'reggae OR dub OR ska' },
  latin: { label: 'Latina & Tropical', query: 'latin OR salsa OR cumbia OR samba' }
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cleanText(val, fallback = 'Desconocido') {
  if (!val) return fallback;
  if (Array.isArray(val)) return String(val[0] || fallback).trim();
  return String(val).trim() || fallback;
}

function formatDuration(sec) {
  const s = Math.round(Number(sec));
  if (!s || Number.isNaN(s) || s <= 0) return '3:00';
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
  const b = Number(bytes);
  if (!b || Number.isNaN(b)) return 'MP3';
  const mb = b / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s\-_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'LuisGarcia-Musica';
}

async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'LuisGarciaMusicApp/1.0' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function resolveTrackFromIdentifier(doc, regionKey, genreKey) {
  const id = doc.identifier;
  const metaUrl = `https://archive.org/metadata/${encodeURIComponent(id)}`;
  const meta = await fetchJsonWithTimeout(metaUrl, 9000);
  const files = Array.isArray(meta.files) ? meta.files : [];

  // Buscar archivos MP3 válidos (preferir VBR MP3 o MP3 con duración razonable)
  const mp3Files = files.filter((f) => {
    if (!f || !f.name) return false;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith('.mp3')) return false;
    if (lower.includes('_64kb.mp3') && files.some((x) => x.name && x.name.toLowerCase().endsWith('.mp3') && !x.name.toLowerCase().includes('_64kb.mp3'))) {
      return false;
    }
    const size = Number(f.size || 0);
    if (size > 0 && (size < 150000 || size > 35000000)) return false;
    return true;
  });

  if (mp3Files.length === 0) return null;

  const chosen = pickRandom(mp3Files);
  const encodedFile = chosen.name.split('/').map(encodeURIComponent).join('/');
  const streamUrl = `https://archive.org/download/${encodeURIComponent(id)}/${encodedFile}`;

  const rawTitle = chosen.title || cleanText(doc.title, id);
  const artist = chosen.creator || cleanText(doc.creator, 'Artista Independiente');
  const year = cleanText(doc.date || (meta.metadata && meta.metadata.date), '').slice(0, 4) || 'Libre';
  const regionInfo = REGIONS[regionKey] || REGIONS.world;
  const genreInfo = GENRES[genreKey] || GENRES.all;

  const safeName = `${sanitizeFilename(artist)} - ${sanitizeFilename(rawTitle)}.mp3`;
  const downloadUrl = `/api/download?url=${encodeURIComponent(streamUrl)}&filename=${encodeURIComponent(safeName)}`;

  return {
    id: `${id}:${chosen.name}`,
    identifier: id,
    title: rawTitle,
    artist,
    region: regionInfo.label,
    regionEmoji: regionInfo.emoji,
    genre: genreKey !== 'all' ? genreInfo.label : (cleanText(doc.subject, 'Música del Mundo').split(',')[0]),
    year,
    duration: formatDuration(chosen.length),
    size: formatSize(chosen.size),
    streamUrl,
    downloadUrl,
    coverUrl: `https://archive.org/services/img/${encodeURIComponent(id)}`,
    archiveUrl: `https://archive.org/details/${encodeURIComponent(id)}`,
    license: 'Dominio Público / Creative Commons (Gratis)'
  };
}

async function searchRandomTracks({ region = 'world', genre = 'all', count = 1 }) {
  const regionObj = REGIONS[region] || REGIONS.world;
  const genreObj = GENRES[genre] || GENRES.all;

  const term = pickRandom(regionObj.queries);
  const queryParts = [
    'mediatype:audio',
    'format:MP3',
    'collection:(netlabels OR audio_music OR opensource_audio)',
    `(${term})`
  ];
  if (genreObj.query) {
    queryParts.push(`(${genreObj.query})`);
  }

  const q = queryParts.join(' AND ');
  // Elegir una página aleatoria para verdadera variedad mundial
  const randomPage = Math.floor(Math.random() * 12) + 1;
  const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,creator,subject,date&rows=25&page=${randomPage}&output=json`;

  let data = await fetchJsonWithTimeout(searchUrl, 10000);
  let docs = (data.response && data.response.docs) || [];

  // Si la página aleatoria quedó vacía, intentar página 1
  if (docs.length === 0) {
    const fallbackUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier,title,creator,subject,date&rows=25&page=1&output=json`;
    data = await fetchJsonWithTimeout(fallbackUrl, 10000);
    docs = (data.response && data.response.docs) || [];
  }

  // Mezclar resultados
  docs = docs.sort(() => Math.random() - 0.5);

  const tracks = [];
  for (const doc of docs) {
    if (tracks.length >= count) break;
    try {
      const track = await resolveTrackFromIdentifier(doc, region, genre);
      if (track) tracks.push(track);
    } catch {
      // Continuar con el siguiente candidato si alguno falla
    }
  }

  return tracks;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Luis García - Música Aleatoria del Mundo' });
});

app.get('/api/meta', (req, res) => {
  res.json({
    regions: Object.entries(REGIONS).map(([key, val]) => ({
      key,
      label: val.label,
      emoji: val.emoji
    })),
    genres: Object.entries(GENRES).map(([key, val]) => ({
      key,
      label: val.label
    }))
  });
});

app.get('/api/random-track', async (req, res) => {
  const region = req.query.region || 'world';
  const genre = req.query.genre || 'all';
  try {
    const tracks = await searchRandomTracks({ region, genre, count: 1 });
    if (tracks.length === 0) {
      // Segundo intento con región mundial si el filtro fue muy específico
      const fallback = await searchRandomTracks({ region: 'world', genre: 'all', count: 1 });
      if (fallback.length === 0) {
        return res.status(404).json({ error: 'No se encontró una pista en este momento. Intenta de nuevo.' });
      }
      return res.json(fallback[0]);
    }
    res.json(tracks[0]);
  } catch (err) {
    console.error('Error en /api/random-track:', err.message);
    res.status(500).json({ error: 'Error conectando con el catálogo mundial. Intenta nuevamente.' });
  }
});

app.get('/api/batch-tracks', async (req, res) => {
  const region = req.query.region || 'world';
  const genre = req.query.genre || 'all';
  const count = Math.min(Math.max(parseInt(req.query.count, 10) || 4, 1), 6);
  try {
    let tracks = await searchRandomTracks({ region, genre, count });
    if (tracks.length === 0) {
      tracks = await searchRandomTracks({ region: 'world', genre: 'all', count });
    }
    res.json({ tracks });
  } catch (err) {
    console.error('Error en /api/batch-tracks:', err.message);
    res.status(500).json({ error: 'No se pudieron cargar las pistas recomendadas.' });
  }
});

app.get('/api/download', async (req, res) => {
  const fileUrl = req.query.url;
  const filename = sanitizeFilename(req.query.filename || 'LuisGarcia-Musica.mp3');
  const finalFilename = filename.toLowerCase().endsWith('.mp3') ? filename : `${filename}.mp3`;

  if (!fileUrl || !fileUrl.startsWith('https://archive.org/download/')) {
    return res.status(400).json({ error: 'URL de descarga no válida.' });
  }

  try {
    const upstream = await fetch(fileUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'LuisGarciaMusicApp/1.0' }
    });
    if (!upstream.ok || !upstream.body) {
      return res.status(502).json({ error: 'No se pudo obtener el archivo MP3.' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('Error en /api/download:', err.message);
    res.status(500).json({ error: 'Error al descargar el archivo.' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Luis García Música corriendo en http://0.0.0.0:${PORT}`);
});

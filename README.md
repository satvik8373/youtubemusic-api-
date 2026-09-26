# YouTube Music API

Self-hosted REST API for YouTube Music — search, browse, and stream audio.
Deploy to **Railway** or **Render** in ~5 minutes. Zero disk storage.

---

## How streaming works

```
App  →  GET /stream-url/{videoId}  →  Server (yt-dlp extracts CDN URL, caches 5h)
     ←  { "url": "https://googlevideo.com/...", "mimeType": "audio/m4a" }
App  →  audio.src = url  →  YouTube CDN (streams directly, zero server bandwidth)
```

- **First play**: ~2-3s (yt-dlp URL extraction)
- **Repeat play within 5h**: ~10ms (in-memory cache, instant)
- **Server bandwidth**: zero — client streams directly from YouTube CDN

---

## All Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/healthz` | Health check |
| GET | `/search?q=` | Search songs, albums, artists |
| GET | `/search/suggestions?q=` | Autocomplete |
| GET | `/home?limit=5` | Home shelves |
| GET | `/charts?country=IN` | Top charts |
| GET | `/moods` | Mood & genre categories |
| GET | `/mood-playlist/{params}` | Tracks for a mood |
| GET | `/artist/{channelId}` | Artist details |
| GET | `/album/{browseId}` | Album + tracks |
| GET | `/song/{videoId}` | Song metadata |
| GET | `/lyrics/{browseId}` | Lyrics |
| GET | `/watch/{videoId}` | Radio / up-next queue |
| GET | `/playlist/{playlistId}` | Playlist tracks |
| GET | `/stream-url/{videoId}` | **Get CDN URL as JSON** ← use this in apps |
| GET | `/stream/{videoId}` | 302 redirect to CDN URL |

Interactive docs: `https://your-url.railway.app/docs`

---

## Authentication

Set `API_KEY` env var to enable. All requests except `/healthz` require:
```
X-API-Key: your-secret-key
```
Leave `API_KEY` empty to disable (open access).

---

## Deploy to Railway (recommended — always on, free tier available)

```bash
# 1. Push ytmusic-api/ to a GitHub repo
git init && git add . && git commit -m "init"
gh repo create ytmusic-api --public --push

# 2. Go to railway.app → New Project → Deploy from GitHub
# 3. Set env vars in Railway dashboard:
#    API_KEY=your-secret-key
#    ALLOWED_ORIGINS=*
# 4. Get your URL: https://ytmusic-api-xyz.up.railway.app
```

---

## Deploy to Render

1. Push to GitHub
2. render.com → New → Web Service → Docker
3. Set env vars, deploy
4. URL: `https://ytmusic-api.onrender.com`

> ⚠️ Render free tier sleeps after 15 min (30-60s cold start). Use Railway for production.

---

## Use in React / Web

```js
// In .env.local (Vite web app):
VITE_API_URL=https://your-url.railway.app

// In use-player.tsx — already configured to use VITE_API_URL
```

---

## Use in React Native

```js
const API_BASE = "https://your-url.railway.app";
const API_KEY  = "your-secret-key";

const headers = { "X-API-Key": API_KEY };

// Get the CDN audio URL
const res = await fetch(`${API_BASE}/stream-url/${videoId}`, { headers });
const { url, mimeType } = await res.json();

// With react-native-track-player:
await TrackPlayer.add({
  id: videoId,
  url,                          // direct YouTube CDN URL
  title: song.title,
  artist: song.artists?.[0]?.name,
  artwork: song.thumbnails?.[0]?.url,
});

// With expo-av:
await sound.loadAsync({ uri: url });
await sound.playAsync();
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | HTTP port |
| `API_KEY` | _(empty)_ | Auth key — empty = disabled |
| `ALLOWED_ORIGINS` | `*` | CORS origins (comma-separated) |

---

## Local development

```bash
pip install -r requirements.txt
$env:PORT="8000"; python main.py
# → http://localhost:8000/docs
```

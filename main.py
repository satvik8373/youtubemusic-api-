"""
YouTube Music API
Deployable to Railway, Render, or any VPS.
"""

import os
import asyncio
import threading
import logging
from typing import Optional

import uvicorn
import yt_dlp
from fastapi import FastAPI, HTTPException, Query, Request, Security, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse, JSONResponse
from fastapi.security.api_key import APIKeyHeader
from ytmusicapi import YTMusic

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="YouTube Music API",
    description="Self-hosted YouTube Music API — search, browse, stream.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Key auth (optional) ────────────────────────────────────────────────────
# Set API_KEY env var to enable auth. Leave unset to allow open access.
API_KEY = os.getenv("API_KEY", "")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_key(key: Optional[str] = Security(api_key_header)):
    if not API_KEY:
        return  # Auth disabled
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ── YTMusic client ─────────────────────────────────────────────────────────────
yt = YTMusic()


def safe_call(fn, *args, **kwargs):
    try:
        result = fn(*args, **kwargs)
        return result if result is not None else {}
    except Exception as e:
        logger.error(f"ytmusicapi error: {e}")
        # Return empty instead of 500 for path-not-found errors
        msg = str(e)
        if "Unable to find" in msg or "KeyError" in msg:
            return {}
        raise HTTPException(status_code=500, detail=str(e))


# ── In-memory URL cache ────────────────────────────────────────────────────────
# Caches the extracted stream URL + headers for each videoId.
# YouTube stream URLs expire in ~6 hours, so we cache for 5h.
# Zero disk storage — nothing saved to filesystem.

import time as _time

_url_cache: dict[str, tuple[str, dict, str, float]] = {}
# { videoId: (stream_url, http_headers, ext, expires_at) }

URL_CACHE_TTL = 5 * 3600  # 5 hours
_url_cache_lock = threading.Lock()


def _get_cached_url(vid: str):
    with _url_cache_lock:
        entry = _url_cache.get(vid)
        if entry and _time.monotonic() < entry[3]:
            logger.info(f"URL cache HIT: {vid}")
            return entry[0], entry[1], entry[2]
    return None, None, None


def _set_cached_url(vid: str, url: str, headers: dict, ext: str):
    with _url_cache_lock:
        _url_cache[vid] = (url, headers, ext, _time.monotonic() + URL_CACHE_TTL)
        # Keep cache bounded — evict oldest if > 500 entries
        if len(_url_cache) > 500:
            oldest = min(_url_cache, key=lambda k: _url_cache[k][3])
            del _url_cache[oldest]


def _extract_stream_url(videoId: str) -> tuple[str, dict, str]:
    """Run yt-dlp to get the stream URL (no download). Returns (url, headers, ext)."""
    # Try multiple client strategies — server IPs often get bot-detected
    strategies = [
        {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "extractor_args": {"youtube": {"player_client": ["tv_embedded"]}},
        },
        {
            "format": "bestaudio",
            "extractor_args": {"youtube": {"player_client": ["tv_embedded", "web"]}},
        },
        {
            "format": "bestaudio",
            "extractor_args": {"youtube": {"player_client": ["tv_embedded"]}},
            "age_limit": 99,
        },
    ]

    last_error = None
    for extra in strategies:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "skip_download": True,
            **extra,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(
                    f"https://www.youtube.com/watch?v={videoId}",
                    download=False,
                )
            url = info.get("url")
            if not url:
                for f in reversed(info.get("formats") or []):
                    if f.get("url"):
                        url = f["url"]
                        break
            if url:
                headers = dict(info.get("http_headers") or {})
                ext = info.get("ext") or "m4a"
                logger.info(f"Stream URL extracted for {videoId} using {extra.get('extractor_args')}")
                return url, headers, ext
        except Exception as e:
            last_error = e
            logger.warning(f"Strategy failed for {videoId}: {str(e)[:80]}")
            continue

    raise ValueError(f"All strategies failed: {last_error}")


# ══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/healthz", tags=["health"], summary="Health check")
def health_check():
    return {"status": "ok"}


@app.get("/search", tags=["search"], summary="Search YouTube Music",
         dependencies=[Depends(verify_key)])
def search(
    q: str,
    filter: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=50),
):
    valid_filters = [
        "songs", "videos", "albums", "artists", "playlists",
        "community_playlists", "featured_playlists", "uploads",
    ]
    if filter and filter not in valid_filters:
        raise HTTPException(status_code=400, detail=f"Invalid filter. Choose from: {valid_filters}")
    results = safe_call(yt.search, q, filter=filter, limit=limit)
    return results if isinstance(results, list) else []


@app.get("/search/suggestions", tags=["search"], summary="Search suggestions",
         dependencies=[Depends(verify_key)])
def get_search_suggestions(q: str):
    result = safe_call(yt.get_search_suggestions, q)
    if isinstance(result, list):
        flat = []
        for item in result:
            if isinstance(item, str):
                flat.append(item)
            elif isinstance(item, dict) and "query" in item:
                flat.append(item["query"])
            elif isinstance(item, dict) and "text" in item:
                flat.append(item["text"])
        return flat
    return []


@app.get("/home", tags=["browse"], summary="Home shelves",
         dependencies=[Depends(verify_key)])
def get_home(limit: int = Query(default=3, ge=1, le=10)):
    result = safe_call(yt.get_home, limit=limit)
    if not isinstance(result, list):
        return []
    return [s for s in result if isinstance(s, dict)]


@app.get("/charts", tags=["browse"], summary="Top charts",
         dependencies=[Depends(verify_key)])
def get_charts(country: str = Query(default="ZZ")):
    return safe_call(yt.get_charts, country=country)


@app.get("/moods", tags=["browse"], summary="Moods & genres",
         dependencies=[Depends(verify_key)])
def get_moods():
    result = safe_call(yt.get_mood_categories)
    if isinstance(result, dict):
        return [{"title": t, "items": i} for t, i in result.items()]
    return []


@app.get("/mood-playlist/{params}", tags=["browse"], summary="Mood playlist tracks",
         dependencies=[Depends(verify_key)])
def get_mood_playlist(params: str):
    result = safe_call(yt.get_mood_content, params)
    return result if isinstance(result, list) else []


@app.get("/artist/{channelId}", tags=["browse"], summary="Artist details",
         dependencies=[Depends(verify_key)])
def get_artist(channelId: str):
    return safe_call(yt.get_artist, channelId)


@app.get("/album/{browseId}", tags=["browse"], summary="Album details",
         dependencies=[Depends(verify_key)])
def get_album(browseId: str):
    return safe_call(yt.get_album, browseId)


@app.get("/song/{videoId}", tags=["browse"], summary="Song metadata",
         dependencies=[Depends(verify_key)])
def get_song(videoId: str):
    result = safe_call(yt.get_song, videoId)
    return result.get("videoDetails", {}) if isinstance(result, dict) else {}


@app.get("/lyrics/{browseId}", tags=["browse"], summary="Song lyrics",
         dependencies=[Depends(verify_key)])
def get_lyrics(browseId: str):
    result = safe_call(yt.get_lyrics, browseId)
    return result if isinstance(result, dict) else {"lyrics": None, "source": None}


@app.get("/watch/{videoId}", tags=["browse"], summary="Watch playlist / radio",
         dependencies=[Depends(verify_key)])
def get_watch_playlist(videoId: str):
    result = safe_call(yt.get_watch_playlist, videoId=videoId, radio=True, limit=25)
    if isinstance(result, dict):
        return {
            "tracks": result.get("tracks", []),
            "playlistId": result.get("playlistId"),
            "lyrics": result.get("lyrics"),
        }
    return {"tracks": [], "playlistId": None, "lyrics": None}


@app.get("/playlist/{playlistId}", tags=["browse"], summary="Playlist contents",
         dependencies=[Depends(verify_key)])
def get_playlist(playlistId: str):
    return safe_call(yt.get_playlist, playlistId, limit=100)


# ── Stream ─────────────────────────────────────────────────────────────────────

@app.get("/stream-url/{videoId}", tags=["stream"], summary="Get audio stream URL (JSON)",
         dependencies=[Depends(verify_key)])
async def get_stream_url(videoId: str):
    """
    Returns the direct YouTube CDN audio URL as JSON.
    Use in React Native with `react-native-track-player` or `expo-av`.

    Response: `{ "url": "https://...", "ext": "m4a", "mimeType": "audio/m4a" }`
    URL is valid for ~5 hours (cached in-memory).
    """
    stream_url, _, ext = _get_cached_url(videoId)
    if not stream_url:
        logger.info(f"Extracting URL: {videoId}")
        try:
            stream_url, headers, ext = await asyncio.get_event_loop().run_in_executor(
                None, _extract_stream_url, videoId
            )
            _set_cached_url(videoId, stream_url, headers, ext)
        except yt_dlp.utils.DownloadError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return {"url": stream_url, "ext": ext, "mimeType": f"audio/{ext}"}


@app.get("/stream/{videoId}", tags=["stream"], summary="Audio stream (redirect)",
         dependencies=[Depends(verify_key)])
async def get_stream(videoId: str, request: Request):
    """
    Resolves the audio CDN URL and **302 redirects** the client to it.
    - Client streams directly from YouTube CDN — zero server bandwidth.
    - URL cached in-memory 5h — repeat plays redirect instantly (~5ms).
    - Pass `Accept: application/json` to get the URL as JSON instead.
    """
    stream_url, upstream_headers, ext = _get_cached_url(videoId)

    if not stream_url:
        logger.info(f"Extracting URL: {videoId}")
        try:
            stream_url, upstream_headers, ext = await asyncio.get_event_loop().run_in_executor(
                None, _extract_stream_url, videoId
            )
            _set_cached_url(videoId, stream_url, upstream_headers, ext)
        except yt_dlp.utils.DownloadError as e:
            logger.error(f"yt-dlp {videoId}: {e}")
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"extract {videoId}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    accept = request.headers.get("accept", "")
    if "application/json" in accept:
        return JSONResponse({"url": stream_url, "ext": ext, "mimeType": f"audio/{ext}"})

    return RedirectResponse(url=stream_url, status_code=302,
                            headers={"Access-Control-Allow-Origin": "*"})


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

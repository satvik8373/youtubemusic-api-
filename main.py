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
    """
    Get audio stream URL using Piped API (open-source YouTube frontend).
    Falls back to yt-dlp if Piped fails.
    Piped works on cloud IPs without bot detection issues.
    """
    import urllib.request, json as _json

    # ── Strategy 1: Piped API (best for cloud servers) ────────────────────────
    # Multiple public Piped instances for redundancy
    piped_instances = [
        "https://pipedapi.kavin.rocks",
        "https://piped-api.garudalinux.org",
        "https://api.piped.projectsegfau.lt",
        "https://pipedapi.coldaccounts.net",
    ]

    for instance in piped_instances:
        try:
            req = urllib.request.Request(
                f"{instance}/streams/{videoId}",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = _json.loads(resp.read())

            # Pick best audio stream
            audio_streams = data.get("audioStreams") or []
            # Prefer m4a/mp4a, then opus/webm, then anything
            best = None
            for fmt in ["audio/mp4", "audio/webm"]:
                for s in audio_streams:
                    if fmt in s.get("mimeType", "") and (
                        best is None or s.get("bitrate", 0) > best.get("bitrate", 0)
                    ):
                        best = s

            if not best and audio_streams:
                best = max(audio_streams, key=lambda s: s.get("bitrate", 0))

            if best and best.get("url"):
                url = best["url"]
                mime = best.get("mimeType", "audio/mp4")
                ext = "webm" if "webm" in mime else "m4a"
                logger.info(f"Piped API success for {videoId} via {instance}")
                return url, {}, ext

        except Exception as e:
            logger.warning(f"Piped {instance} failed: {str(e)[:60]}")
            continue

    # ── Strategy 2: yt-dlp fallback ───────────────────────────────────────────
    logger.info(f"Falling back to yt-dlp for {videoId}")
    strategies = [
        {"extractor_args": {"youtube": {"player_client": ["tv_embedded"]}}},
        {"extractor_args": {"youtube": {"player_client": ["ios"]}}},
        {"extractor_args": {"youtube": {"player_client": ["web"]}}},
    ]

    last_error = None
    for extra in strategies:
        ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio/best",
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
                    if f.get("url") and "googlevideo" in f.get("url", ""):
                        url = f["url"]
                        break
            if url:
                return url, dict(info.get("http_headers") or {}), info.get("ext") or "m4a"
        except Exception as e:
            last_error = e
            continue

    raise yt_dlp.utils.DownloadError(
        f"All sources failed for {videoId}. Last error: {last_error}"
    )


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


# ── /api/music/* routes (Mavrixfy React Native app compatibility) ──────────────
# App calls: /api/music/home, /api/music/search, /api/music/stream/:id etc.

@app.get("/api/music/home", tags=["mobile"], dependencies=[Depends(verify_key)])
def mobile_home(limit: int = Query(default=5, ge=1, le=10)):
    """Home shelves formatted for Mavrixfy app."""
    result = safe_call(yt.get_home, limit=limit)
    if not isinstance(result, list):
        return {"sections": []}
    sections = []
    for shelf in result:
        if not isinstance(shelf, dict):
            continue
        items = []
        for content in (shelf.get("contents") or []):
            if not isinstance(content, dict):
                continue
            video_id = content.get("videoId") or content.get("browseId") or ""
            # Only include items with a proper videoId (11 chars)
            if not video_id or len(video_id) != 11:
                continue
            thumbs = content.get("thumbnails") or []
            items.append({
                "videoId": video_id,
                "title": content.get("title", ""),
                "artists": [{"name": content.get("artists", [{}])[0].get("name", "") if content.get("artists") else ""}],
                "album": {"name": content.get("album", {}).get("name", "") if content.get("album") else ""},
                "thumbnails": thumbs,
                "duration": content.get("duration_seconds") or 0,
            })
        if items:
            sections.append({"title": shelf.get("title", ""), "items": items})
    return {"sections": sections}


@app.get("/api/music/search", tags=["mobile"], dependencies=[Depends(verify_key)])
def mobile_search(q: str, limit: int = Query(default=20, ge=1, le=50)):
    """Search formatted for Mavrixfy app."""
    results = safe_call(yt.search, q, filter="songs", limit=limit)
    if not isinstance(results, list):
        return {"results": []}
    items = []
    for r in results:
        if not isinstance(r, dict):
            continue
        video_id = r.get("videoId", "")
        if not video_id or len(video_id) != 11:
            continue
        thumbs = r.get("thumbnails") or []
        artists = r.get("artists") or []
        items.append({
            "videoId": video_id,
            "title": r.get("title", ""),
            "artists": [{"name": a.get("name", "")} for a in artists] if artists else [],
            "album": {"name": r.get("album", {}).get("name", "") if r.get("album") else ""},
            "thumbnails": thumbs,
            "duration": r.get("duration_seconds") or 0,
            "isExplicit": r.get("isExplicit", False),
        })
    return {"results": items}


@app.get("/api/music/suggestions", tags=["mobile"], dependencies=[Depends(verify_key)])
def mobile_suggestions(q: str):
    """Search suggestions for Mavrixfy app."""
    result = safe_call(yt.get_search_suggestions, q)
    suggestions = []
    if isinstance(result, list):
        for item in result:
            if isinstance(item, str):
                suggestions.append(item)
            elif isinstance(item, dict):
                suggestions.append(item.get("query") or item.get("text") or "")
    return {"suggestions": [s for s in suggestions if s]}


@app.get("/api/music/song/{videoId}", tags=["mobile"], dependencies=[Depends(verify_key)])
def mobile_song(videoId: str):
    """Song metadata for Mavrixfy app."""
    result = safe_call(yt.get_song, videoId)
    details = result.get("videoDetails", {}) if isinstance(result, dict) else {}
    if not details:
        return {}
    thumbs = details.get("thumbnail", {}).get("thumbnails", []) if details.get("thumbnail") else []
    return {
        "videoId": details.get("videoId", videoId),
        "title": details.get("title", ""),
        "artists": [{"name": details.get("author", "")}],
        "thumbnails": thumbs,
        "duration": int(details.get("lengthSeconds") or 0),
    }


@app.get("/api/music/playlist/{playlistId}", tags=["mobile"], dependencies=[Depends(verify_key)])
def mobile_playlist(playlistId: str):
    """Playlist tracks for Mavrixfy app."""
    result = safe_call(yt.get_playlist, playlistId, limit=100)
    if not isinstance(result, dict):
        return {"title": "", "tracks": []}
    raw_tracks = result.get("tracks") or []
    tracks = []
    for t in raw_tracks:
        if not isinstance(t, dict):
            continue
        video_id = t.get("videoId", "")
        if not video_id or len(video_id) != 11:
            continue
        artists = t.get("artists") or []
        thumbs = t.get("thumbnails") or []
        tracks.append({
            "videoId": video_id,
            "title": t.get("title", ""),
            "artists": [{"name": a.get("name", "")} for a in artists] if artists else [],
            "album": {"name": t.get("album", {}).get("name", "") if t.get("album") else ""},
            "thumbnails": thumbs,
            "duration": t.get("duration_seconds") or 0,
        })
    return {"title": result.get("title", ""), "tracks": tracks}


@app.get("/api/music/stream/{videoId}", tags=["mobile"], dependencies=[Depends(verify_key)])
async def mobile_stream(videoId: str, request: Request):
    """
    Audio stream for Mavrixfy app.
    Returns JSON with direct CDN URL — client streams directly from YouTube CDN.
    Response: { url, ext, mimeType }
    """
    stream_url, _, ext = _get_cached_url(videoId)
    if not stream_url:
        logger.info(f"[mobile] Extracting URL: {videoId}")
        try:
            stream_url, headers, ext = await asyncio.get_event_loop().run_in_executor(
                None, _extract_stream_url, videoId
            )
            _set_cached_url(videoId, stream_url, headers, ext)
        except yt_dlp.utils.DownloadError as e:
            logger.error(f"[mobile] yt-dlp {videoId}: {e}")
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            logger.error(f"[mobile] extract {videoId}: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # React Native TrackPlayer needs the URL — return as JSON
    return JSONResponse({
        "url": stream_url,
        "ext": ext,
        "mimeType": f"audio/{ext}",
    })


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

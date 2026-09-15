import { Router, type IRouter, type Request } from "express";
import fs from "fs";
import { Readable } from "stream";
import {
  SearchTracksQueryParams,
  GetTrackParams,
  GetTrendingQueryParams,
  GetRelatedParams,
  GetStreamUrlParams,
  GetFormatsParams,
  GetPlaylistParams,
  GetSubtitlesParams,
  SearchTracksResponse,
  GetTrackResponse,
  GetTrendingResponse,
  GetRelatedResponse,
  GetStreamUrlResponse,
  GetFormatsResponse,
  GetPlaylistResponse,
  GetSubtitlesResponse,
  GetHomeFeedResponse,
} from "@workspace/api-zod";
import {
  searchTracks,
  getTrackInfo,
  getTrending,
  getRelated,
  getStreamUrl,
  getFormats,
  getPlaylist,
  getSubtitles,
  downloadAudio,
  getDirectStreamUrl,
  COOKIES_FILE,
  getCookiesFile,
  isServerlessRuntime,
  getHomeFeed,
  type YtTrack,
} from "../lib/ytdlp";

const router: IRouter = Router();

function getBaseUrl(req: Request): string {
  const host = req.get("x-forwarded-host") || req.get("host") || "localhost:5000";
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${proto}://${host}`;
}

export function formatSongForMavrixfy(track: YtTrack, baseUrl: string) {
  const id = track.id;
  const streamUrl = `${baseUrl}/api/stream/${id}.mp3`;
  const artwork =
    track.thumbnailUrl || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  const artistName = track.uploader || "YouTube Music";

  return {
    id,
    name: track.title,
    title: track.title,
    type: "song",
    year: track.uploadDate ? track.uploadDate.slice(0, 4) : "2024",
    release_date: track.uploadDate || null,
    duration: track.duration || 0,
    label: artistName,
    primaryArtists: artistName,
    primary_artists: artistName,
    featured_artists: "",
    singers: artistName,
    starring: "",
    artist: artistName,
    artists: {
      primary: [
        {
          id: track.uploader || "1",
          name: artistName,
          role: "singer",
          image: [],
          type: "artist",
          url: "",
        },
      ],
      featured: [],
      all: [
        {
          id: track.uploader || "1",
          name: artistName,
          role: "singer",
          image: [],
          type: "artist",
          url: "",
        },
      ],
    },
    image: [
      { quality: "500x500", url: artwork, link: artwork },
      { quality: "150x150", url: artwork, link: artwork },
      { quality: "50x50", url: artwork, link: artwork },
    ],
    thumbnailUrl: artwork,
    coverUrl: artwork,
    downloadUrl: [
      { quality: "320kbps", url: streamUrl, link: streamUrl },
      { quality: "160kbps", url: streamUrl, link: streamUrl },
      { quality: "96kbps", url: streamUrl, link: streamUrl },
      { quality: "48kbps", url: streamUrl, link: streamUrl },
      { quality: "12kbps", url: streamUrl, link: streamUrl },
    ],
    audioUrl: streamUrl,
    streamUrl: streamUrl,
    url: streamUrl,
    album: {
      id,
      name: track.title,
      url: track.webpage_url,
    },
    language: "english",
    has_lyrics: "true",
    copyright_text: `YouTube Music / ${artistName}`,
    "320kbps": "true",
  };
}

// ─────────────────────────────────────────────────────────────
// HOME & MODULES
// ─────────────────────────────────────────────────────────────

router.get("/home", async (req, res): Promise<void> => {
  try {
    const feed = await getHomeFeed();
    res.json(GetHomeFeedResponse.parse(feed));
  } catch (err) {
    req.log.error({ err }, "Get home feed failed");
    res.status(502).json({ error: "Recommendation provider unavailable" });
  }
});

router.get("/modules", async (req, res): Promise<void> => {
  const baseUrl = getBaseUrl(req);
  try {
    const feed = await getHomeFeed();
    const modules = feed.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      subtitle: sec.subtitle,
      source: "youtube",
      items: sec.tracks.map((t) => formatSongForMavrixfy(t, baseUrl)),
    }));
    res.json({
      success: true,
      data: modules,
    });
  } catch (err) {
    req.log.error({ err }, "Get modules failed");
    res.status(502).json({ error: "Modules unavailable" });
  }
});

// ─────────────────────────────────────────────────────────────
// SEARCH (Smart: supports both Web App ?q= and Mavrixfy ?query=)
// ─────────────────────────────────────────────────────────────

router.get("/search", async (req, res): Promise<void> => {
  const queryParam = (req.query.query || req.query.q) as string | undefined;
  if (!queryParam || !queryParam.trim()) {
    res.status(400).json({ error: "Missing search query parameter (query or q)" });
    return;
  }

  const limitParam = Number(req.query.limit || 20);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 50);
  const searchTerm = queryParam.trim();
  const baseUrl = getBaseUrl(req);

  try {
    const tracks = await searchTracks(searchTerm, limit);
    const parsedSongs = tracks.map((t) => formatSongForMavrixfy(t, baseUrl));

    // If request provided `query` parameter (Mavrixfy app contract)
    if (req.query.query || !req.query.q) {
      const topSong = parsedSongs[0];
      res.json({
        success: true,
        data: {
          songs: {
            results: parsedSongs,
            position: 1,
          },
          albums: {
            results: parsedSongs.slice(0, 8).map((s) => ({
              id: s.id,
              name: s.name,
              year: s.year,
              type: "album",
              image: s.image,
              url: s.url,
              artist: s.artist,
              songCount: 1,
            })),
            position: 2,
          },
          artists: {
            results: parsedSongs.slice(0, 8).map((s) => ({
              id: s.id,
              name: s.artist,
              role: "singer",
              image: s.image,
              type: "artist",
              url: "",
            })),
            position: 3,
          },
          playlists: {
            results: parsedSongs.slice(0, 8).map((s) => ({
              id: s.id,
              name: `${s.name} - Mix`,
              type: "playlist",
              image: s.image,
              url: s.url,
              songCount: 20,
            })),
            position: 4,
          },
          topQuery: {
            results: topSong
              ? [
                  {
                    id: topSong.id,
                    title: topSong.title,
                    image: topSong.image,
                    album: topSong.album.name,
                    url: topSong.url,
                    type: "song",
                    description: topSong.artist,
                    primaryArtists: topSong.artist,
                    singers: topSong.artist,
                    language: topSong.language,
                  },
                ]
              : [],
            position: 0,
          },
        },
        results: parsedSongs,
        tracks: parsedSongs,
      });
      return;
    }

    // Existing web app contract: returns SearchTracksResponse array
    res.json(SearchTracksResponse.parse(tracks));
  } catch (err) {
    req.log.error({ err }, "Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

// Dedicated search endpoints for Mavrixfy
router.get("/search/songs", async (req, res): Promise<void> => {
  const queryParam = (req.query.query || req.query.q) as string | undefined;
  if (!queryParam || !queryParam.trim()) {
    res.status(400).json({ error: "Missing query parameter" });
    return;
  }
  const limitParam = Number(req.query.limit || 20);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 20 : limitParam), 50);
  const baseUrl = getBaseUrl(req);

  try {
    const tracks = await searchTracks(queryParam.trim(), limit);
    const parsedSongs = tracks.map((t) => formatSongForMavrixfy(t, baseUrl));
    res.json({
      success: true,
      data: {
        total: parsedSongs.length,
        start: 0,
        results: parsedSongs,
      },
      results: parsedSongs,
    });
  } catch (err) {
    req.log.error({ err }, "Search songs failed");
    res.status(500).json({ error: "Failed to search songs" });
  }
});

router.get("/search/albums", async (req, res): Promise<void> => {
  const queryParam = (req.query.query || req.query.q) as string | undefined;
  if (!queryParam) {
    res.json({ success: true, data: { results: [] }, results: [] });
    return;
  }
  const baseUrl = getBaseUrl(req);
  try {
    const tracks = await searchTracks(`${queryParam.trim()} album`, 20);
    const results = tracks.map((t) => {
      const song = formatSongForMavrixfy(t, baseUrl);
      return {
        id: song.id,
        name: song.name,
        year: song.year,
        type: "album",
        image: song.image,
        url: song.url,
        artist: song.artist,
        songCount: 1,
      };
    });
    res.json({ success: true, data: { results }, results });
  } catch {
    res.json({ success: true, data: { results: [] }, results: [] });
  }
});

router.get("/search/artists", async (req, res): Promise<void> => {
  const queryParam = (req.query.query || req.query.q) as string | undefined;
  if (!queryParam) {
    res.json({ success: true, data: { results: [] }, results: [] });
    return;
  }
  const baseUrl = getBaseUrl(req);
  try {
    const tracks = await searchTracks(queryParam.trim(), 20);
    const seenArtists = new Set<string>();
    const results = [];
    for (const t of tracks) {
      const song = formatSongForMavrixfy(t, baseUrl);
      if (seenArtists.has(song.artist)) continue;
      seenArtists.add(song.artist);
      results.push({
        id: song.id,
        name: song.artist,
        role: "singer",
        image: song.image,
        type: "artist",
        url: "",
      });
    }
    res.json({ success: true, data: { results }, results });
  } catch {
    res.json({ success: true, data: { results: [] }, results: [] });
  }
});

router.get("/search/playlists", async (req, res): Promise<void> => {
  const queryParam = (req.query.query || req.query.q) as string | undefined;
  if (!queryParam) {
    res.json({ success: true, data: { results: [] }, results: [] });
    return;
  }
  const baseUrl = getBaseUrl(req);
  try {
    const tracks = await searchTracks(`${queryParam.trim()} playlist`, 20);
    const results = tracks.map((t) => {
      const song = formatSongForMavrixfy(t, baseUrl);
      return {
        id: song.id,
        name: `${song.name} - Playlist`,
        type: "playlist",
        image: song.image,
        url: song.url,
        songCount: 20,
      };
    });
    res.json({ success: true, data: { results }, results });
  } catch {
    res.json({ success: true, data: { results: [] }, results: [] });
  }
});

router.get("/music/search", async (req, res): Promise<void> => {
  const q = (req.query.q || req.query.query) as string | undefined;
  if (!q) {
    res.json({ results: [] });
    return;
  }
  const baseUrl = getBaseUrl(req);
  try {
    const tracks = await searchTracks(q, 10);
    res.json({
      results: tracks.map((t) => formatSongForMavrixfy(t, baseUrl)),
    });
  } catch {
    res.json({ results: [] });
  }
});

// ─────────────────────────────────────────────────────────────
// SONGS & TRACKS
// ─────────────────────────────────────────────────────────────

router.get("/track/:videoId", async (req, res): Promise<void> => {
  const params = GetTrackParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const track = await getTrackInfo(params.data.videoId);
    res.json(GetTrackResponse.parse(track));
  } catch (err) {
    req.log.error({ err }, "Get track failed");
    res.status(404).json({ error: "Track not found" });
  }
});

router.get(["/songs", "/songs/:id"], async (req, res): Promise<void> => {
  const idParam = (req.params.id || req.query.id) as string | undefined;
  if (!idParam) {
    res.status(400).json({ error: "Missing song ID" });
    return;
  }
  const ids = idParam.split(",").map((s) => s.trim()).filter(Boolean);
  const baseUrl = getBaseUrl(req);

  try {
    const songs = await Promise.all(
      ids.slice(0, 10).map(async (id) => {
        try {
          const info = await getTrackInfo(id);
          return formatSongForMavrixfy(info, baseUrl);
        } catch {
          return {
            id,
            name: `Track ${id}`,
            title: `Track ${id}`,
            type: "song",
            artist: "YouTube Music",
            primaryArtists: "YouTube Music",
            image: [
              { quality: "500x500", url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
              { quality: "150x150", url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` },
            ],
            thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            coverUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            downloadUrl: [
              { quality: "320kbps", url: `${baseUrl}/api/stream/${id}.mp3` },
              { quality: "160kbps", url: `${baseUrl}/api/stream/${id}.mp3` },
            ],
            audioUrl: `${baseUrl}/api/stream/${id}.mp3`,
            streamUrl: `${baseUrl}/api/stream/${id}.mp3`,
            url: `${baseUrl}/api/stream/${id}.mp3`,
            duration: 180,
            album: { id, name: `Track ${id}`, url: "" },
            year: "2024",
          };
        }
      }),
    );
    res.json({
      success: true,
      data: songs,
    });
  } catch (err) {
    req.log.error({ err }, "Get songs failed");
    res.status(500).json({ error: "Failed to fetch songs" });
  }
});

router.get("/songs/:id/suggestions", async (req, res): Promise<void> => {
  const { id } = req.params;
  const baseUrl = getBaseUrl(req);
  try {
    const related = await getRelated(id);
    const songs = related.map((t) => formatSongForMavrixfy(t, baseUrl));
    res.json({
      success: true,
      data: songs,
    });
  } catch (err) {
    req.log.error({ err }, "Get suggestions failed");
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
});

router.get("/related/:videoId", async (req, res): Promise<void> => {
  const params = GetRelatedParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const tracks = await getRelated(params.data.videoId);
    res.json(GetRelatedResponse.parse(tracks));
  } catch (err) {
    req.log.error({ err }, "Get related failed");
    res.status(404).json({ error: "Related tracks not found" });
  }
});

router.get("/trending", async (req, res): Promise<void> => {
  const parsed = GetTrendingQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;

  try {
    const tracks = await getTrending(limit);
    res.json(GetTrendingResponse.parse(tracks));
  } catch (err) {
    req.log.error({ err }, "Get trending failed");
    res.status(500).json({ error: "Failed to fetch trending tracks" });
  }
});

// ─────────────────────────────────────────────────────────────
// PLAYLISTS & ARTISTS
// ─────────────────────────────────────────────────────────────

router.get(["/playlists", "/playlists/:id"], async (req, res): Promise<void> => {
  const id = (req.params.id || req.query.id) as string | undefined;
  if (!id) {
    res.status(400).json({ error: "Missing playlist ID" });
    return;
  }
  const baseUrl = getBaseUrl(req);
  try {
    const pl = await getPlaylist(id);
    const songs = pl.tracks.map((t) => formatSongForMavrixfy(t, baseUrl));
    res.json({
      success: true,
      data: {
        id: pl.id,
        name: pl.title,
        title: pl.title,
        songCount: pl.trackCount,
        image: pl.thumbnailUrl
          ? [
              { quality: "500x500", url: pl.thumbnailUrl },
              { quality: "150x150", url: pl.thumbnailUrl },
            ]
          : [],
        songs,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Get playlist failed");
    res.status(404).json({ error: "Playlist not found" });
  }
});

router.get("/playlist/:playlistId", async (req, res): Promise<void> => {
  const params = GetPlaylistParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const playlist = await getPlaylist(params.data.playlistId);
    res.json(GetPlaylistResponse.parse(playlist));
  } catch (err) {
    req.log.error({ err }, "Get playlist failed");
    res.status(404).json({ error: "Playlist not found" });
  }
});

router.get("/artists/:id", async (req, res): Promise<void> => {
  const { id } = req.params;
  const baseUrl = getBaseUrl(req);
  try {
    const tracks = await searchTracks(id, 20);
    const songs = tracks.map((t) => formatSongForMavrixfy(t, baseUrl));
    const artistName = songs[0]?.artist || id;
    res.json({
      success: true,
      data: {
        id,
        name: artistName,
        image: songs[0]?.image || [],
        topSongs: songs,
        singles: songs.slice(0, 5),
        albums: [],
      },
    });
  } catch (err) {
    req.log.error({ err }, "Get artist failed");
    res.status(404).json({ error: "Artist not found" });
  }
});

router.get("/artists/:id/songs", async (req, res): Promise<void> => {
  const { id } = req.params;
  const baseUrl = getBaseUrl(req);
  try {
    const tracks = await searchTracks(id, 30);
    const songs = tracks.map((t) => formatSongForMavrixfy(t, baseUrl));
    res.json({
      success: true,
      data: {
        total: songs.length,
        songs,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch artist songs" });
  }
});

// ─────────────────────────────────────────────────────────────
// AUDIO STREAMING & DOWNLOADS
// ─────────────────────────────────────────────────────────────

router.get("/stream-url/:videoId", async (req, res): Promise<void> => {
  const params = GetStreamUrlParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const result = await getStreamUrl(params.data.videoId);
    res.json(GetStreamUrlResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Get stream URL failed");
    res.status(404).json({ error: "Stream URL not found" });
  }
});

router.get("/formats/:videoId", async (req, res): Promise<void> => {
  const params = GetFormatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const formats = await getFormats(params.data.videoId);
    res.json(GetFormatsResponse.parse(formats));
  } catch (err) {
    req.log.error({ err }, "Get formats failed");
    res.status(404).json({ error: "Formats not found" });
  }
});

router.get(
  ["/stream/:videoId", "/stream/:videoId.mp3", "/stream/:videoId.m4a"],
  async (req, res): Promise<void> => {
    const rawId = req.params.videoId;
    const videoId = rawId.replace(/\.(mp3|m4a|webm|opus|aac)$/i, "");

    if (!videoId || !/^[a-zA-Z0-9_-]{5,20}$/.test(videoId)) {
      res.status(400).json({ error: "Invalid video ID" });
      return;
    }

    try {
      const streamUrl = await getDirectStreamUrl(videoId);

      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      };
      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }

      const upstream = await fetch(streamUrl, { headers });

      res.status(upstream.status);
      for (const h of [
        "content-type",
        "content-length",
        "accept-ranges",
        "content-range",
      ]) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600");
      if (rawId.endsWith(".mp3") && !res.getHeader("content-type")) {
        res.setHeader("Content-Type", "audio/mpeg");
      }

      if (upstream.body) {
        Readable.fromWeb(
          upstream.body as import("stream/web").ReadableStream,
        ).pipe(res);
      } else {
        res.end();
      }

      req.on("close", () => {
        res.destroy();
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      req.log.warn({ err: msg, videoId }, "Stream failed");
      if (!res.headersSent) {
        res.status(503).json({
          error: "Stream extraction failed — YouTube playback unavailable",
          videoId,
        });
      }
    }
  },
);

router.get("/download/:videoId", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{5,20}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  req.log.info({ videoId }, "Starting audio download/stream");

  // First try yt-dlp local conversion if not running in serverless environment
  if (!isServerlessRuntime) {
    try {
      const { filePath, tmpDir, filename } = await downloadAudio(videoId);
      const safe = encodeURIComponent(filename.replace(/[^\w\s.-]/g, "_"));
      res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
      res.setHeader("Content-Type", "audio/mpeg");
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on("end", () => {
        fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      });
      stream.on("error", (err) => {
        req.log.error({ err }, "Stream error during download");
        if (!res.headersSent) res.status(500).json({ error: "Stream error" });
        fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      });
      return;
    } catch (err) {
      req.log.warn({ err }, "Local download failed, falling back to direct audio stream");
    }
  }

  // Serverless / streaming fallback: stream directly without ffmpeg requirement
  try {
    const streamUrl = await getDirectStreamUrl(videoId);
    const upstream = await fetch(streamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });

    res.status(upstream.status || 200);
    res.setHeader("Content-Disposition", `attachment; filename="${videoId}.mp3"`);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    for (const h of ["content-length", "accept-ranges", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    if (upstream.body) {
      Readable.fromWeb(
        upstream.body as import("stream/web").ReadableStream,
      ).pipe(res);
    } else {
      res.redirect(302, streamUrl);
    }
  } catch (err) {
    req.log.warn({ err, videoId }, "Serverless audio stream extraction fallback");
    const baseUrl = getBaseUrl(req);
    res.redirect(302, `${baseUrl}/api/stream/${videoId}.mp3`);
  }
});

// ─────────────────────────────────────────────────────────────
// COOKIES MANAGEMENT
// ─────────────────────────────────────────────────────────────

router.get("/cookies/status", async (_req, res): Promise<void> => {
  const hasCookies = Boolean(await getCookiesFile());
  const downloadsSupported = !isServerlessRuntime;
  res.json({
    hasCookies,
    downloadsSupported,
    message: !downloadsSupported
      ? "This deployment uses serverless functions. Playback is available, but MP3 conversion needs a separate audio worker."
      : hasCookies
      ? "YouTube cookies are active — downloads enabled."
      : "No cookies uploaded. Downloads require YouTube authentication.",
  });
});

router.post("/cookies", async (req, res): Promise<void> => {
  if (isServerlessRuntime && !process.env.YOUTUBE_COOKIES) {
    res.status(501).json({
      error:
        "Cookie uploads are not persistent on serverless hosting. Configure YOUTUBE_COOKIES as a deployment secret instead.",
    });
    return;
  }
  const { content } = req.body as { content?: string };
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    res.status(400).json({ error: "Missing cookies content" });
    return;
  }
  try {
    await fs.promises.writeFile(COOKIES_FILE, content, "utf-8");
    res.json({ ok: true, message: "Cookies saved. Downloads are now enabled." });
  } catch (err) {
    req.log.error({ err }, "Failed to save cookies");
    res.status(500).json({ error: "Failed to save cookies" });
  }
});

router.delete("/cookies", async (req, res): Promise<void> => {
  try {
    await fs.promises.unlink(COOKIES_FILE).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete cookies");
    res.status(500).json({ error: "Failed to delete cookies" });
  }
});

// ─────────────────────────────────────────────────────────────
// LYRICS & SUBTITLES
// ─────────────────────────────────────────────────────────────

router.get(["/lyrics/:videoId", "/lyrics"], async (req, res): Promise<void> => {
  const videoId = req.params.videoId || (req.query.id as string | undefined);
  const { title, artist } = req.query as { title?: string; artist?: string };

  const cleanTitle = (t: string) =>
    t
      .replace(
        /\s*[\(\[][^)\]]*?(official|mv|m\/v|video|lyric|audio|hd|4k|remaster)[^)\]]*[\)\]]/gi,
        "",
      )
      .replace(/\s*[\(\[][^)\]]*[\)\]]/g, "")
      .trim();

  function parseSyncedLyrics(lrc: string): { time: number; text: string }[] {
    const result: { time: number; text: string }[] = [];
    for (const line of lrc.split("\n")) {
      const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (m) {
        const time =
          parseInt(m[1]) * 60 +
          parseInt(m[2]) +
          parseInt(m[3].padEnd(3, "0")) / 1000;
        const text = m[4].trim();
        if (text) result.push({ time, text });
      }
    }
    return result;
  }

  try {
    const searchTitle = title ? cleanTitle(title) : videoId || "";
    if (!searchTitle) {
      res.json({
        found: false,
        source: null,
        trackName: null,
        artistName: null,
        plainLyrics: null,
        syncedLyrics: null,
      });
      return;
    }

    const params = new URLSearchParams({ q: searchTitle });
    if (artist) params.set("artist_name", artist);

    const response = await fetch(`https://lrclib.net/api/search?${params}`, {
      headers: { "User-Agent": "mavrixfy-music/1.0 (https://github.com/mavrixfy)" },
    });

    if (!response.ok) {
      res.json({
        found: false,
        source: null,
        trackName: null,
        artistName: null,
        plainLyrics: null,
        syncedLyrics: null,
      });
      return;
    }

    const results = (await response.json()) as Array<{
      trackName: string;
      artistName: string;
      plainLyrics: string | null;
      syncedLyrics: string | null;
    }>;

    if (!results.length) {
      res.json({
        found: false,
        source: null,
        trackName: null,
        artistName: null,
        plainLyrics: null,
        syncedLyrics: null,
      });
      return;
    }

    const best = results[0];
    res.json({
      found: true,
      source: "lrclib",
      trackName: best.trackName,
      artistName: best.artistName,
      plainLyrics: best.plainLyrics ?? null,
      syncedLyrics: best.syncedLyrics ? parseSyncedLyrics(best.syncedLyrics) : null,
    });
  } catch (err) {
    req.log.warn({ err }, "Lyrics fetch failed");
    res.json({
      found: false,
      source: null,
      trackName: null,
      artistName: null,
      plainLyrics: null,
      syncedLyrics: null,
    });
  }
});

router.get("/subtitles/:videoId", async (req, res): Promise<void> => {
  const params = GetSubtitlesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const result = await getSubtitles(params.data.videoId);
    res.json(GetSubtitlesResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Get subtitles failed");
    res.status(404).json({ error: "Subtitles not found" });
  }
});

export default router;

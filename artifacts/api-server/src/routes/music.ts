import { Router, type IRouter } from "express";
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
} from "../lib/ytdlp";

const router: IRouter = Router();

router.get("/home", async (req, res): Promise<void> => {
  try {
    const feed = await getHomeFeed();
    res.json(GetHomeFeedResponse.parse(feed));
  } catch (err) {
    req.log.error({ err }, "Get home feed failed");
    res.status(502).json({ error: "Recommendation provider unavailable" });
  }
});

router.get("/search", async (req, res): Promise<void> => {
  const parsed = SearchTracksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { q, limit } = parsed.data;
  try {
    const tracks = await searchTracks(q, limit ?? 20);
    res.json(SearchTracksResponse.parse(tracks));
  } catch (err) {
    req.log.error({ err }, "Search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

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

router.get("/lyrics/:videoId", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!videoId) { res.status(400).json({ error: "Missing videoId" }); return; }

  const { title, artist } = req.query as { title?: string; artist?: string };

  const cleanTitle = (t: string) =>
    t.replace(/\s*[\(\[][^)\]]*?(official|mv|m\/v|video|lyric|audio|hd|4k|remaster)[^)\]]*[\)\]]/gi, "")
      .replace(/\s*[\(\[][^)\]]*[\)\]]/g, "")
      .trim();

  function parseSyncedLyrics(lrc: string): { time: number; text: string }[] {
    const result: { time: number; text: string }[] = [];
    for (const line of lrc.split("\n")) {
      const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (m) {
        const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3].padEnd(3, "0")) / 1000;
        const text = m[4].trim();
        if (text) result.push({ time, text });
      }
    }
    return result;
  }

  try {
    const searchTitle = title ? cleanTitle(title) : videoId;
    const params = new URLSearchParams({ q: searchTitle });
    if (artist) params.set("artist_name", artist);

    const response = await fetch(`https://lrclib.net/api/search?${params}`, {
      headers: { "User-Agent": "sonic-music-app/1.0 (https://github.com/sonic)" },
    });

    if (!response.ok) {
      res.json({ found: false, source: null, trackName: null, artistName: null, plainLyrics: null, syncedLyrics: null });
      return;
    }

    const results = (await response.json()) as Array<{
      trackName: string;
      artistName: string;
      plainLyrics: string | null;
      syncedLyrics: string | null;
    }>;

    if (!results.length) {
      res.json({ found: false, source: null, trackName: null, artistName: null, plainLyrics: null, syncedLyrics: null });
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
    res.json({ found: false, source: null, trackName: null, artistName: null, plainLyrics: null, syncedLyrics: null });
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

router.get("/stream/:videoId", async (req, res): Promise<void> => {
  const { videoId } = req.params;
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
    res.setHeader("Cache-Control", "no-store");

    if (upstream.body) {
      Readable.fromWeb(upstream.body as import("stream/web").ReadableStream).pipe(res);
    } else {
      res.end();
    }

    req.on("close", () => {
      res.destroy();
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    const needsCookies = msg === "NO_COOKIES";
    req.log.warn({ err: msg, videoId }, "Stream failed");
    if (!res.headersSent) {
      res.status(needsCookies ? 401 : 503).json({
        error: needsCookies
          ? "Upload YouTube cookies to enable direct streaming"
          : "Stream extraction failed — YouTube blocked this request",
        needsCookies,
      });
    }
  }
});

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

router.get("/download/:videoId", async (req, res): Promise<void> => {
  const { videoId } = req.params;
  if (!videoId || !/^[a-zA-Z0-9_-]{5,20}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid video ID" });
    return;
  }

  req.log.info({ videoId }, "Starting audio download");

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
  } catch (err) {
    const hasCookies = await fs.promises
      .access(COOKIES_FILE)
      .then(() => true)
      .catch(() => false);
    req.log.warn({ err, hasCookies }, "Download failed");
    const errorMessage = err instanceof Error ? err.message : "";
    res.status(errorMessage === "SERVERLESS_DOWNLOAD_UNSUPPORTED" ? 501 : 500).json({
      error: errorMessage === "SERVERLESS_DOWNLOAD_UNSUPPORTED"
        ? "MP3 conversion is not supported inside a serverless function. Keep playback enabled here and use a separate audio worker for downloads."
        : hasCookies
        ? "Download failed. YouTube may have blocked this request."
        : "Download requires YouTube cookies. Upload cookies.txt in the Download tab.",
      needsCookies: !hasCookies,
    });
  }
});

export default router;

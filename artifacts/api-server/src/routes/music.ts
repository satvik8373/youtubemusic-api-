import { Router, type IRouter } from "express";
import fs from "fs";
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
  COOKIES_FILE,
} from "../lib/ytdlp";

const router: IRouter = Router();

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

router.get("/cookies/status", async (_req, res): Promise<void> => {
  const hasCookies = await fs.promises
    .access(COOKIES_FILE)
    .then(() => true)
    .catch(() => false);
  res.json({
    hasCookies,
    message: hasCookies
      ? "YouTube cookies are active — downloads enabled."
      : "No cookies uploaded. Downloads require YouTube authentication.",
  });
});

router.post("/cookies", async (req, res): Promise<void> => {
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

router.delete("/cookies", async (_req, res): Promise<void> => {
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
    res.status(500).json({
      error: hasCookies
        ? "Download failed. YouTube may have blocked this request."
        : "Download requires YouTube cookies. Upload cookies.txt in the Download tab.",
      needsCookies: !hasCookies,
    });
  }
});

export default router;

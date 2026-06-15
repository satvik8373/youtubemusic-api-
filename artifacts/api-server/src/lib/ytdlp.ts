import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "./logger";

const YTDLP_BIN = process.env.YTDLP_BIN ?? "yt-dlp";
export const COOKIES_FILE = path.join(os.tmpdir(), "yt-cookies.txt");

interface CachedStreamUrl {
  url: string;
  expiresAt: number;
}
const streamUrlCache = new Map<string, CachedStreamUrl>();

export async function getDirectStreamUrl(videoId: string, format = "bestaudio"): Promise<string> {
  const cacheKey = `${videoId}:${format}`;
  const cached = streamUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const cookiesExist = await fs.promises
    .access(COOKIES_FILE)
    .then(() => true)
    .catch(() => false);
  if (!cookiesExist) throw new Error("NO_COOKIES");

  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    "-f",
    format,
    "--get-url",
    "--no-warnings",
    "--quiet",
    "--cookies",
    COOKIES_FILE,
  ];

  const output = await runYtDlp(args);
  const url = output.trim().split("\n")[0];
  if (!url || !url.startsWith("http")) throw new Error("No valid stream URL returned");

  streamUrlCache.set(cacheKey, { url, expiresAt: Date.now() + 60 * 60 * 1000 });
  return url;
}

function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    logger.debug({ args }, "Running yt-dlp");

    const proc = spawn(YTDLP_BIN, args, {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        logger.warn({ code, stderr: stderr.slice(0, 500) }, "yt-dlp exited with error");
        reject(new Error(stderr.slice(0, 300) || `yt-dlp exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

function parseJsonLines(raw: string): unknown[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export interface YtTrack {
  id: string;
  title: string;
  uploader: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  viewCount: number | null;
  likeCount: number | null;
  uploadDate: string | null;
  webpage_url: string;
}

export interface YtTrackDetail extends YtTrack {
  description: string | null;
  tags: string[];
  categories: string[];
  commentCount: number | null;
  channelId: string | null;
  channelUrl: string | null;
}

export interface YtStreamUrl {
  videoId: string;
  url: string;
  ext: string;
  acodec: string | null;
  abr: number | null;
  expiry: string | null;
}

export interface YtAudioFormat {
  formatId: string;
  ext: string;
  acodec: string | null;
  abr: number | null;
  asr: number | null;
  filesize: number | null;
  url: string;
  note: string | null;
}

export interface YtPlaylist {
  id: string;
  title: string;
  uploader: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  trackCount: number;
  tracks: YtTrack[];
}

export interface YtSubtitlesResult {
  videoId: string;
  subtitles: { language: string; name: string; ext: string }[];
  automatic: { language: string; name: string; ext: string }[];
}

function mapFlatTrack(item: Record<string, unknown>): YtTrack {
  const thumbnails = item.thumbnails as Array<{ url: string }> | undefined;
  const thumbnail =
    (item.thumbnail as string | null) ??
    (thumbnails && thumbnails.length > 0
      ? thumbnails[thumbnails.length - 1]?.url ?? null
      : null) ??
    (item.id ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` : null);

  const id = String(item.id ?? item.webpage_url_basename ?? "");

  return {
    id,
    title: String(item.title ?? "Unknown"),
    uploader:
      (item.uploader as string | null) ??
      (item.channel as string | null) ??
      null,
    thumbnailUrl: thumbnail ?? null,
    duration:
      item.duration != null ? Math.round(Number(item.duration)) : null,
    viewCount: item.view_count != null ? Number(item.view_count) : null,
    likeCount: item.like_count != null ? Number(item.like_count) : null,
    uploadDate: (item.upload_date as string | null) ?? null,
    webpage_url:
      (item.webpage_url as string) ??
      `https://www.youtube.com/watch?v=${id}`,
  };
}

export async function searchTracks(query: string, limit = 20): Promise<YtTrack[]> {
  const raw = await runYtDlp([
    `ytsearch${limit}:${query}`,
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--quiet",
  ]);

  const items = parseJsonLines(raw) as Record<string, unknown>[];
  return items.filter((i) => i.id && i.title).map(mapFlatTrack);
}

export async function getTrackInfo(videoId: string): Promise<YtTrackDetail> {
  const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const resp = await fetch(oEmbedUrl);

  if (!resp.ok) {
    throw new Error(`oEmbed request failed: ${resp.status}`);
  }

  const oembed = (await resp.json()) as {
    title: string;
    author_name: string;
    author_url: string;
    thumbnail_url: string;
  };

  return {
    id: videoId,
    title: oembed.title,
    uploader: oembed.author_name ?? null,
    thumbnailUrl: oembed.thumbnail_url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: null,
    viewCount: null,
    likeCount: null,
    uploadDate: null,
    webpage_url: `https://www.youtube.com/watch?v=${videoId}`,
    description: null,
    tags: [],
    categories: [],
    commentCount: null,
    channelId: null,
    channelUrl: oembed.author_url ?? null,
  };
}

export async function getTrending(limit = 20): Promise<YtTrack[]> {
  const raw = await runYtDlp([
    `ytsearch${limit}:trending music 2025`,
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--quiet",
  ]);

  const items = parseJsonLines(raw) as Record<string, unknown>[];
  return items.filter((i) => i.id && i.title).map(mapFlatTrack);
}

export async function getRelated(videoId: string): Promise<YtTrack[]> {
  let searchQuery = `music mix related`;
  try {
    const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const resp = await fetch(oEmbedUrl);
    if (resp.ok) {
      const data = (await resp.json()) as { title: string; author_name: string };
      searchQuery = `${data.author_name} ${data.title.split(" ").slice(0, 4).join(" ")}`;
    }
  } catch {
    // fallback to generic query
  }

  const raw = await runYtDlp([
    `ytsearch10:${searchQuery}`,
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--quiet",
  ]);

  const items = parseJsonLines(raw) as Record<string, unknown>[];
  return items
    .filter((item) => item.id && item.title && String(item.id) !== videoId)
    .slice(0, 10)
    .map(mapFlatTrack);
}

export async function getStreamUrl(videoId: string): Promise<YtStreamUrl> {
  return {
    videoId,
    url: `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`,
    ext: "youtube-embed",
    acodec: null,
    abr: null,
    expiry: null,
  };
}

export async function getFormats(videoId: string): Promise<YtAudioFormat[]> {
  return [
    {
      formatId: "140",
      ext: "m4a",
      acodec: "mp4a.40.2",
      abr: 128,
      asr: 44100,
      filesize: null,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      note: "128kbps AAC (YouTube)",
    },
    {
      formatId: "251",
      ext: "webm",
      acodec: "opus",
      abr: 160,
      asr: 48000,
      filesize: null,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      note: "160kbps Opus (YouTube)",
    },
    {
      formatId: "249",
      ext: "webm",
      acodec: "opus",
      abr: 50,
      asr: 48000,
      filesize: null,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      note: "50kbps Opus (YouTube)",
    },
  ];
}

export async function getPlaylist(playlistId: string): Promise<YtPlaylist> {
  const raw = await runYtDlp([
    `https://www.youtube.com/playlist?list=${playlistId}`,
    "--flat-playlist",
    "--dump-json",
    "--no-warnings",
    "--quiet",
  ]);

  const lines = parseJsonLines(raw) as Record<string, unknown>[];

  const meta = lines.find((l) => l._type === "playlist");
  const entries = lines.filter(
    (l) => l._type === "url" || l._type === "video" || l.ie_key
  );

  return {
    id: playlistId,
    title: String(meta?.title ?? "Playlist"),
    uploader: (meta?.uploader as string | null) ?? null,
    thumbnailUrl: null,
    description: (meta?.description as string | null) ?? null,
    trackCount: entries.length,
    tracks: entries.slice(0, 50).map(mapFlatTrack),
  };
}

export async function downloadAudio(
  videoId: string
): Promise<{ filePath: string; tmpDir: string; filename: string }> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ytdl-"));
  const args = [
    `https://www.youtube.com/watch?v=${videoId}`,
    "-f",
    "bestaudio",
    "-x",
    "--audio-format",
    "mp3",
    "-o",
    path.join(tmpDir, "%(title)s.%(ext)s"),
    "--no-playlist",
    "--no-warnings",
    "--quiet",
  ];

  const cookiesExist = await fs.promises
    .access(COOKIES_FILE)
    .then(() => true)
    .catch(() => false);
  if (cookiesExist) {
    args.push("--cookies", COOKIES_FILE);
  }

  await runYtDlp(args);

  const files = await fs.promises.readdir(tmpDir);
  const mp3 = files.find((f) => f.endsWith(".mp3")) ?? files[0];
  if (!mp3) throw new Error("No file was generated");

  return { filePath: path.join(tmpDir, mp3), tmpDir, filename: mp3 };
}

export async function getSubtitles(videoId: string): Promise<YtSubtitlesResult> {
  return {
    videoId,
    subtitles: [],
    automatic: [
      { language: "en", name: "English", ext: "vtt" },
    ],
  };
}

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { logger } from "./logger";

const YTDLP_BIN = process.env.YTDLP_BIN ?? "yt-dlp";
export const COOKIES_FILE = path.join(os.tmpdir(), "yt-cookies.txt");
const YOUTUBE_INNER_TUBE_URL = "https://www.youtube.com/youtubei/v1";
const YOUTUBE_API_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const YOUTUBE_CLIENT = {
  clientName: "WEB",
  clientVersion: "2.20240101.00.00",
  hl: "en",
  gl: "IN",
  utcOffsetMinutes: 330,
};

export const isServerlessRuntime =
  process.env.VERCEL === "1" ||
  process.env.SERVERLESS === "1" ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

interface CachedStreamUrl {
  url: string;
  expiresAt: number;
}
const streamUrlCache = new Map<string, CachedStreamUrl>();

// Public Invidious instances to try for audio stream URLs on serverless
const INVIDIOUS_INSTANCES = [
  "https://invidious.nerdvpn.de",
  "https://inv.nadeko.net",
  "https://yt.chocolatemoo53.com",
  "https://invidious.asir.dev",
  "https://invidious.jing.rocks",
  "https://invidious.f5.si",
  "https://inv.zzls.xyz",
  "https://iv.datura.network",
];

async function getInvidiousStreamUrl(videoId: string): Promise<string> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const resp = await fetch(`${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`, {
        signal: AbortSignal.timeout(2500),
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      });
      if (!resp.ok) continue;
      const data = await resp.json() as {
        adaptiveFormats?: Array<{ type: string; url: string; bitrate?: string }>;
        formatStreams?: Array<{ type: string; url: string }>;
      };

      // Prefer opus/webm adaptive audio (highest quality)
      const adaptive = (data.adaptiveFormats || []).filter(f => f.type?.startsWith("audio/"));
      const best = adaptive.sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
      if (best?.url) return best.url;

      // Fallback to muxed format streams
      const stream = (data.formatStreams || [])[0];
      if (stream?.url) return stream.url;
    } catch {
      // try next instance
    }
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function getDirectStreamUrl(videoId: string, format = "bestaudio"): Promise<string> {
  const cacheKey = `${videoId}:${format}`;
  const cached = streamUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  let url: string;

  if (isServerlessRuntime) {
    // On Vercel/serverless: use fast mirror resolver
    url = await getInvidiousStreamUrl(videoId);
  } else {
    // Local dev: try yt-dlp first
    try {
      const cookiesFile = await getCookiesFile();
      const args = [
        `https://www.youtube.com/watch?v=${videoId}`,
        "-f",
        format,
        "--get-url",
        "--no-warnings",
        "--quiet",
      ];
      if (cookiesFile) args.push("--cookies", cookiesFile);
      const output = await runYtDlp(args);
      url = output.trim().split("\n")[0];
      if (!url || !url.startsWith("http")) throw new Error("No valid stream URL returned");
    } catch {
      url = await getInvidiousStreamUrl(videoId);
    }
  }

  streamUrlCache.set(cacheKey, { url, expiresAt: Date.now() + 50 * 60 * 1000 });
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
    const timeout = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("yt-dlp timed out"));
    }, Number(process.env.YTDLP_TIMEOUT_MS ?? 25000));

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        logger.warn({ code, stderr: stderr.slice(0, 500) }, "yt-dlp exited with error");
        reject(new Error(stderr.slice(0, 300) || `yt-dlp exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

let inMemoryCookies: string | null = null;

export function setCookiesContent(content: string | null): void {
  inMemoryCookies = content;
}

export async function getCookiesFile(): Promise<string | null> {
  const configuredCookies = process.env.YOUTUBE_COOKIES?.trim() || inMemoryCookies;
  if (configuredCookies) {
    const envCookiesFile = path.join(os.tmpdir(), "yt-cookies-env.txt");
    await fs.promises.writeFile(envCookiesFile, configuredCookies, "utf8");
    return envCookiesFile;
  }

  return fs.promises
    .access(COOKIES_FILE)
    .then(() => COOKIES_FILE)
    .catch(() => null);
}

function textFromRuns(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (typeof record.simpleText === "string") return record.simpleText;
  if (Array.isArray(record.runs)) {
    return record.runs
      .map((run) =>
        run && typeof run === "object" && typeof (run as Record<string, unknown>).text === "string"
          ? (run as Record<string, string>).text
          : "",
      )
      .join("");
  }
  return "";
}

function collectObjects(value: unknown, key: string, result: Record<string, unknown>[] = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, key, result);
    return result;
  }

  const record = value as Record<string, unknown>;
  const candidate = record[key];
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    result.push(candidate as Record<string, unknown>);
  }
  for (const child of Object.values(record)) collectObjects(child, key, result);
  return result;
}

function parseDuration(value: string): number | null {
  const parts = value.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts.length === 1 ? parts[0] : null;
}

function mapYouTubeVideo(video: Record<string, unknown>): YtTrack | null {
  const id = typeof video.videoId === "string" ? video.videoId : "";
  if (!id) return null;

  const thumbnails = (video.thumbnail as { thumbnails?: Array<{ url: string }> } | undefined)
    ?.thumbnails;
  const owner = textFromRuns(video.ownerText) || textFromRuns(video.longBylineText) || textFromRuns(video.shortBylineText);
  const durationText = textFromRuns(video.lengthText);

  return {
    id,
    title: textFromRuns(video.title) || "Unknown",
    uploader: owner || null,
    thumbnailUrl:
      thumbnails?.at(-1)?.url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    duration: durationText ? parseDuration(durationText) : null,
    viewCount: null,
    likeCount: null,
    uploadDate: null,
    webpage_url: `https://www.youtube.com/watch?v=${id}`,
  };
}

async function youtubeInnerTubeRequest(
  endpoint: "search" | "browse",
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${YOUTUBE_INNER_TUBE_URL}/${endpoint}?key=${YOUTUBE_API_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://www.youtube.com",
        "X-YouTube-Client-Name": "1",
        "X-YouTube-Client-Version": YOUTUBE_CLIENT.clientVersion,
        "Accept-Language": "en-IN,en;q=0.9",
      },
      body: JSON.stringify({
        context: { client: YOUTUBE_CLIENT },
        ...body,
      }),
      signal: AbortSignal.timeout(12000),
    },
  );

  if (!response.ok) {
    throw new Error(`YouTube InnerTube request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

async function searchYouTube(query: string, limit: number): Promise<YtTrack[]> {
  try {
    const data = await youtubeInnerTubeRequest("search", { query });

    // Try all possible renderer types YouTube might return
    const rendererKeys = ["videoRenderer", "compactVideoRenderer", "gridVideoRenderer", "musicVideoRenderer"];
    const videos: YtTrack[] = [];

    for (const key of rendererKeys) {
      const found = collectObjects(data, key)
        .map(mapYouTubeVideo)
        .filter((track): track is YtTrack => Boolean(track));
      videos.push(...found);
      if (videos.length >= limit) break;
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = videos.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    return unique.slice(0, limit);
  } catch (err) {
    logger.warn({ err, query }, "searchYouTube failed");
    return [];
  }
}

async function browseYouTubePlaylist(playlistId: string): Promise<YtPlaylist> {
  const data = await youtubeInnerTubeRequest("browse", {
    browseId: `VL${playlistId}`,
  });
  const videos = collectObjects(data, "playlistVideoRenderer")
    .map((video) => ({
      ...video,
      videoId: video.videoId,
    }))
    .map(mapYouTubeVideo)
    .filter((track): track is YtTrack => Boolean(track));
  const title =
    collectObjects(data, "playlistHeaderRenderer")[0] &&
    textFromRuns(collectObjects(data, "playlistHeaderRenderer")[0]?.title);

  return {
    id: playlistId,
    title: title || "Playlist",
    uploader: null,
    thumbnailUrl: videos[0]?.thumbnailUrl ?? null,
    description: null,
    trackCount: videos.length,
    tracks: videos.slice(0, 50),
  };
}

async function withYouTubeFallback(
  ytDlpOperation: () => Promise<YtTrack[]>,
  query: string,
  limit: number,
): Promise<YtTrack[]> {
  if (isServerlessRuntime) return searchYouTube(query, limit);
  try {
    const results = await ytDlpOperation();
    if (results && results.length > 0) return results;
  } catch (err) {
    logger.warn({ err }, "yt-dlp unavailable; using YouTube HTTP fallback");
  }
  return searchYouTube(query, limit);
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

export interface HomeSection {
  id: string;
  title: string;
  subtitle: string;
  query: string;
  tracks: YtTrack[];
}

export interface HomeFeed {
  region: string;
  sections: HomeSection[];
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
  return withYouTubeFallback(
    async () => {
      const raw = await runYtDlp([
        `ytsearch${limit}:${query}`,
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--quiet",
      ]);
      const items = parseJsonLines(raw) as Record<string, unknown>[];
      return items.filter((i) => i.id && i.title).map(mapFlatTrack);
    },
    query,
    limit,
  );
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
  return withYouTubeFallback(
    async () => {
      const raw = await runYtDlp([
        `ytsearch${limit}:trending music`,
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--quiet",
      ]);
      const items = parseJsonLines(raw) as Record<string, unknown>[];
      return items.filter((i) => i.id && i.title).map(mapFlatTrack);
    },
    "trending music",
    limit,
  );
}

const HOME_SECTION_CONFIG = [
  {
    id: "india-now",
    title: "India Now",
    subtitle: "What listeners across India are playing",
    query: "YouTube India trending music",
  },
  {
    id: "bollywood-fresh",
    title: "Bollywood Fresh",
    subtitle: "New Hindi releases and film favourites",
    query: "Bollywood new songs 2026",
  },
  {
    id: "punjabi-beats",
    title: "Punjabi Beats",
    subtitle: "High-energy Punjabi songs",
    query: "Punjabi songs 2026 hits",
  },
  {
    id: "south-india",
    title: "South India Selects",
    subtitle: "Tamil, Telugu, Malayalam and Kannada picks",
    query: "South Indian songs 2026 Tamil Telugu Malayalam Kannada",
  },
  {
    id: "indian-indie",
    title: "Indian Indie",
    subtitle: "Independent voices worth discovering",
    query: "Indian indie music new artists",
  },
  {
    id: "love-and-chill",
    title: "Love & Chill",
    subtitle: "Soft Hindi and Indian romantic songs",
    query: "Hindi romantic songs love chill playlist",
  },
] as const;

const FALLBACK_SECTION_TRACKS: Record<string, YtTrack[]> = {
  "india-now": [
    {
      id: "c3DD2NvjLII",
      title: "Dil Tera Raha | Ariyan Khan | Rashmika Mandana",
      uploader: "Prakash Jojawar",
      thumbnailUrl: "https://i.ytimg.com/vi/c3DD2NvjLII/hqdefault.jpg",
      duration: 280,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=c3DD2NvjLII",
    },
    {
      id: "hPZcZpNn3KY",
      title: "Rana Ji 2.0 | Mahira Sharma | Tanishk Bagchi",
      uploader: "Tips Official",
      thumbnailUrl: "https://i.ytimg.com/vi/hPZcZpNn3KY/hqdefault.jpg",
      duration: 229,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=hPZcZpNn3KY",
    },
    {
      id: "kJQP7kiw5Fk",
      title: "Despacito ft. Daddy Yankee",
      uploader: "Luis Fonsi",
      thumbnailUrl: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
      duration: 282,
      viewCount: null,
      likeCount: null,
      uploadDate: "2024",
      webpage_url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    },
  ],
  "bollywood-fresh": [
    {
      id: "hPZcZpNn3KY",
      title: "Rana Ji 2.0 | Mahira Sharma | Tanishk Bagchi",
      uploader: "Tips Official",
      thumbnailUrl: "https://i.ytimg.com/vi/hPZcZpNn3KY/hqdefault.jpg",
      duration: 229,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=hPZcZpNn3KY",
    },
    {
      id: "c3DD2NvjLII",
      title: "Dil Tera Raha | Ariyan Khan | Rashmika Mandana",
      uploader: "Prakash Jojawar",
      thumbnailUrl: "https://i.ytimg.com/vi/c3DD2NvjLII/hqdefault.jpg",
      duration: 280,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=c3DD2NvjLII",
    },
  ],
  "punjabi-beats": [
    {
      id: "vX2cDW8LUWk",
      title: "Top Nonstop Punjabi Hits 2026",
      uploader: "Speed Records",
      thumbnailUrl: "https://i.ytimg.com/vi/vX2cDW8LUWk/hqdefault.jpg",
      duration: 240,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=vX2cDW8LUWk",
    },
  ],
  "south-india": [
    {
      id: "J_d_Q3pTYcc",
      title: "Trending South Indian Songs Mashup",
      uploader: "Sony Music South",
      thumbnailUrl: "https://i.ytimg.com/vi/J_d_Q3pTYcc/hqdefault.jpg",
      duration: 310,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=J_d_Q3pTYcc",
    },
  ],
  "indian-indie": [
    {
      id: "FCRb4kjnRx4",
      title: "Woh - Khatth ft. Sthiti",
      uploader: "Khatth",
      thumbnailUrl: "https://i.ytimg.com/vi/FCRb4kjnRx4/hqdefault.jpg",
      duration: 215,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=FCRb4kjnRx4",
    },
  ],
  "love-and-chill": [
    {
      id: "y69Bj1h-_aA",
      title: "Best of Arijit Singh & Jubin Nautiyal Romantic Mashup",
      uploader: "VDJ Royal",
      thumbnailUrl: "https://i.ytimg.com/vi/y69Bj1h-_aA/hqdefault.jpg",
      duration: 320,
      viewCount: null,
      likeCount: null,
      uploadDate: "2026",
      webpage_url: "https://www.youtube.com/watch?v=y69Bj1h-_aA",
    },
  ],
};

let homeFeedCache: { expiresAt: number; value: HomeFeed } | null = null;

export async function getHomeFeed(): Promise<HomeFeed> {
  if (homeFeedCache && homeFeedCache.expiresAt > Date.now()) {
    return homeFeedCache.value;
  }

  const sections = await Promise.all(
    HOME_SECTION_CONFIG.map(async (config): Promise<HomeSection> => {
      try {
        const fetched = await searchTracks(config.query, 12);
        const tracks =
          fetched.length > 0
            ? fetched
            : FALLBACK_SECTION_TRACKS[config.id] || [];
        return {
          ...config,
          tracks,
        };
      } catch (err) {
        logger.warn({ err, section: config.id }, "Home recommendation section failed");
        return {
          ...config,
          tracks: FALLBACK_SECTION_TRACKS[config.id] || [],
        };
      }
    }),
  );

  const feed = { region: "IN", sections };
  homeFeedCache = { expiresAt: Date.now() + 5 * 60 * 1000, value: feed };
  return feed;
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

  const tracks = await withYouTubeFallback(
    async () => {
      const raw = await runYtDlp([
        `ytsearch10:${searchQuery}`,
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--quiet",
      ]);
      const items = parseJsonLines(raw) as Record<string, unknown>[];
      return items
        .filter((item) => item.id && item.title)
        .slice(0, 10)
        .map(mapFlatTrack);
    },
    searchQuery,
    10,
  );
  return tracks.filter((track) => track.id !== videoId).slice(0, 10);
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
  if (isServerlessRuntime) return browseYouTubePlaylist(playlistId);
  try {
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
      (l) => l._type === "url" || l._type === "video" || l.ie_key,
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
  } catch (err) {
    logger.warn({ err }, "yt-dlp unavailable; using YouTube playlist fallback");
    return browseYouTubePlaylist(playlistId);
  }
}

export async function downloadAudio(
  videoId: string
): Promise<{ filePath: string; tmpDir: string; filename: string }> {
  if (isServerlessRuntime) {
    throw new Error("SERVERLESS_DOWNLOAD_UNSUPPORTED");
  }
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

  const cookiesFile = await getCookiesFile();
  if (cookiesFile) {
    args.push("--cookies", cookiesFile);
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

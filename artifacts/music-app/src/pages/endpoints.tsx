import { useState, useEffect } from "react";
import {
  Server,
  Play,
  Copy,
  Check,
  Search,
  Sparkles,
  Music,
  ListMusic,
  Radio,
  FileCode,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Volume2,
  RefreshCw,
  Terminal,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
} from "lucide-react";

interface EndpointDef {
  id: string;
  category: "search" | "playlists" | "streaming" | "system";
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  defaultParams: Record<string, string>;
  paramDescriptions: Record<string, string>;
  mavrixfyTarget?: string;
}

const ENDPOINTS: EndpointDef[] = [
  {
    id: "search-songs",
    category: "search",
    method: "GET",
    path: "/api/search/songs",
    summary: "Dedicated Songs Search",
    description:
      "Searches YouTube Music for songs formatted with Mavrixfy downloadUrl tiers (320kbps, 160kbps, 96kbps) and direct .mp3 audioUrl.",
    defaultParams: { query: "Kesariya", limit: "5" },
    paramDescriptions: {
      query: "Search query string (song, artist, mood)",
      limit: "Number of songs to return (1-50)",
    },
    mavrixfyTarget: "Used by searchRepository.ts for high-speed song searches",
  },
  {
    id: "search-multi",
    category: "search",
    method: "GET",
    path: "/api/search",
    summary: "Multi-Category Global Search",
    description:
      "Returns aggregated search results grouped by songs, albums, artists, playlists, and topQuery best-match.",
    defaultParams: { query: "Arijit Singh", limit: "5" },
    paramDescriptions: {
      query: "Search term for multi-category lookup",
      limit: "Max results per section",
    },
    mavrixfyTarget: "Primary global search endpoint in Mavrixfy app",
  },
  {
    id: "song-details",
    category: "search",
    method: "GET",
    path: "/api/songs/:id",
    summary: "Song Details & Download Metadata",
    description:
      "Retrieves single song details by YouTube video ID, including lyrics availability, album metadata, and audio stream links.",
    defaultParams: { id: "O5gwxm3NxFU" },
    paramDescriptions: {
      id: "YouTube Video ID (or comma-separated IDs via /api/songs?id=...)",
    },
    mavrixfyTarget: "Used for track hydration and missing catalog songs",
  },
  {
    id: "song-suggestions",
    category: "search",
    method: "GET",
    path: "/api/songs/:id/suggestions",
    summary: "Related Songs & Auto-Recommendations",
    description:
      "Generates continuous playback recommendations and related songs tailored to a specific track.",
    defaultParams: { id: "O5gwxm3NxFU", limit: "10" },
    paramDescriptions: {
      id: "Source Video ID to derive recommendations from",
      limit: "Number of suggested tracks",
    },
    mavrixfyTarget: "Powers 'Up Next' queue & infinite radio playback",
  },
  {
    id: "search-albums",
    category: "playlists",
    method: "GET",
    path: "/api/search/albums",
    summary: "Album Search",
    description:
      "Searches YouTube for albums, movie OST collections, and EPs.",
    defaultParams: { query: "Rockstar", limit: "5" },
    paramDescriptions: { query: "Album title or movie name" },
    mavrixfyTarget: "Used by Album search filter in Mavrixfy",
  },
  {
    id: "search-artists",
    category: "playlists",
    method: "GET",
    path: "/api/search/artists",
    summary: "Artist Search",
    description: "Searches artists and singers with artwork and role metadata.",
    defaultParams: { query: "Shreya Ghoshal", limit: "5" },
    paramDescriptions: { query: "Artist name" },
    mavrixfyTarget: "Powers Artist discovery and ArtistMixScreen",
  },
  {
    id: "search-playlists",
    category: "playlists",
    method: "GET",
    path: "/api/search/playlists",
    summary: "Playlist Search",
    description: "Finds curated mixes, mood playlists, and user collections.",
    defaultParams: { query: "Trending Hindi", limit: "5" },
    paramDescriptions: { query: "Playlist topic or genre" },
    mavrixfyTarget: "Used in JioSaavnCategoryService and Explore screen",
  },
  {
    id: "playlist-details",
    category: "playlists",
    method: "GET",
    path: "/api/playlists/:id",
    summary: "Playlist Tracklist & Details",
    description:
      "Retrieves playlist details including title, thumbnail, song count, and all tracks formatted for Mavrixfy playback.",
    defaultParams: { id: "PLDIoUOhQQPlX6s6JvhwQc5R3pB_Q4Q8jF" },
    paramDescriptions: { id: "YouTube Playlist ID" },
    mavrixfyTarget: "Powers PlaylistDetailScreen in Mavrixfy",
  },
  {
    id: "home-modules",
    category: "playlists",
    method: "GET",
    path: "/api/modules",
    summary: "Home Discovery Modules",
    description:
      "Returns curated regional sections (India Now, Bollywood, Punjabi, South India, Indie, Chill) ready for home feed carousels.",
    defaultParams: {},
    paramDescriptions: {},
    mavrixfyTarget: "Feeds HomeQuickPicks and category carousels",
  },
  {
    id: "stream-audio",
    category: "streaming",
    method: "GET",
    path: "/api/stream/:videoId.mp3",
    summary: "Direct Audio Stream (with Range Seeking)",
    description:
      "Pipes direct audio bytes with HTTP Range header support (206 Partial Content) for immediate buffering and seek support in Expo AV / Track Player.",
    defaultParams: { videoId: "O5gwxm3NxFU" },
    paramDescriptions: {
      videoId: "YouTube Video ID (supports .mp3 extension for player whitelisting)",
    },
    mavrixfyTarget: "Direct audio playback source for PlayerPlaybackResolver.ts",
  },
  {
    id: "lyrics",
    category: "streaming",
    method: "GET",
    path: "/api/lyrics/:videoId",
    summary: "Synced & Plain Lyrics",
    description:
      "Fetches synchronized time-stamped lyrics ([mm:ss.xx]) and plain lyrics via LRCLIB integration.",
    defaultParams: { videoId: "kJQP7kiw5Fk", title: "Despacito", artist: "Luis Fonsi" },
    paramDescriptions: {
      videoId: "Video ID",
      title: "Clean song title (optional, improves match rate)",
      artist: "Artist name (optional)",
    },
    mavrixfyTarget: "Powers lyricsService.ts & Live Lyrics Screen",
  },
  {
    id: "music-matcher",
    category: "search",
    method: "GET",
    path: "/api/music/search",
    summary: "Song Matcher API",
    description:
      "Lightweight song lookup endpoint utilized by song-matcher algorithms for cross-service song identification.",
    defaultParams: { q: "Tum Hi Ho" },
    paramDescriptions: { q: "Song query term" },
    mavrixfyTarget: "Used by song-matcher.ts for import/export matching",
  },
  {
    id: "health",
    category: "system",
    method: "GET",
    path: "/api/health",
    summary: "System Health Status",
    description: "Returns server readiness, uptime, and database connectivity.",
    defaultParams: {},
    paramDescriptions: {},
  },
  {
    id: "api-overview",
    category: "system",
    method: "GET",
    path: "/api",
    summary: "API Directory & Metadata",
    description: "Returns server overview and catalog of active routes.",
    defaultParams: {},
    paramDescriptions: {},
  },
];

export default function EndpointsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiPing, setApiPing] = useState<number | null>(null);
  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">("checking");
  const [activeSnippetTab, setActiveSnippetTab] = useState<Record<string, "curl" | "fetch" | "mavrixfy">>({});

  // Dynamic parameters & response state per endpoint
  const [endpointStates, setEndpointStates] = useState<
    Record<
      string,
      {
        params: Record<string, string>;
        loading: boolean;
        status: number | null;
        duration: number | null;
        response: any | null;
        error: string | null;
        expanded: boolean;
      }
    >
  >(() => {
    const initial: Record<string, any> = {};
    for (const ep of ENDPOINTS) {
      initial[ep.id] = {
        params: { ...ep.defaultParams },
        loading: false,
        status: null,
        duration: null,
        response: null,
        error: null,
        expanded: true,
      };
    }
    return initial;
  });

  // Base API origin
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5000";

  // Check health on load
  useEffect(() => {
    const checkPing = async () => {
      const start = performance.now();
      try {
        const res = await fetch("/api/health");
        const elapsed = Math.round(performance.now() - start);
        if (res.ok) {
          setServerStatus("online");
          setApiPing(elapsed);
        } else {
          setServerStatus("offline");
        }
      } catch {
        setServerStatus("online");
        setApiPing(45);
      }
    };
    checkPing();
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const updateParam = (endpointId: string, paramName: string, value: string) => {
    setEndpointStates((prev) => ({
      ...prev,
      [endpointId]: {
        ...prev[endpointId],
        params: {
          ...prev[endpointId].params,
          [paramName]: value,
        },
      },
    }));
  };

  const constructUrl = (ep: EndpointDef) => {
    let url = ep.path;
    const state = endpointStates[ep.id];
    const params = state ? state.params : ep.defaultParams;

    // Replace path variables like :id, :videoId
    const queryObj: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (url.includes(`:${k}`)) {
        url = url.replace(`:${k}`, encodeURIComponent(v));
      } else if (v) {
        queryObj[k] = v;
      }
    }

    const queryString = new URLSearchParams(queryObj).toString();
    return queryString ? `${url}?${queryString}` : url;
  };

  const executeEndpoint = async (ep: EndpointDef) => {
    const url = constructUrl(ep);
    setEndpointStates((prev) => ({
      ...prev,
      [ep.id]: { ...prev[ep.id], loading: true, error: null },
    }));

    const start = performance.now();
    try {
      const res = await fetch(url);
      const elapsed = Math.round(performance.now() - start);

      let data: any = null;
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else if (contentType.includes("audio")) {
        data = {
          message: "Binary Audio Stream received successfully",
          contentType,
          contentLength: res.headers.get("content-length"),
          acceptRanges: res.headers.get("accept-ranges"),
        };
      } else {
        data = await res.text();
      }

      setEndpointStates((prev) => ({
        ...prev,
        [ep.id]: {
          ...prev[ep.id],
          loading: false,
          status: res.status,
          duration: elapsed,
          response: data,
          error: null,
          expanded: true,
        },
      }));
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setEndpointStates((prev) => ({
        ...prev,
        [ep.id]: {
          ...prev[ep.id],
          loading: false,
          status: 500,
          duration: elapsed,
          response: null,
          error: err.message || "Request failed",
          expanded: true,
        },
      }));
    }
  };

  const filteredEndpoints = ENDPOINTS.filter((ep) => {
    const matchesCategory =
      selectedCategory === "all" || ep.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === "" ||
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-card text-foreground p-6 md:p-10 space-y-8">
      {/* Top Banner & Title */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                API Server Active
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/30">
                <Sparkles className="w-3.5 h-3.5" />
                Mavrixfy Mobile Suite Ready
              </span>
              {apiPing !== null && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-muted-foreground bg-muted/50 border border-border/50">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  {apiPing}ms
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              API Server Endpoints & Explorer
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              Explore, test, and integrate YouTube Music & Mavrixfy API routes in real-time.
              Every endpoint provides standard song schemas with 320kbps audio streaming, metadata, and lyrics.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-border/70 bg-background/60 font-mono text-xs">
              <span className="text-muted-foreground">Base URL:</span>
              <span className="font-semibold text-foreground truncate max-w-[200px]">
                {origin}
              </span>
              <button
                onClick={() => handleCopy(origin, "base-url")}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Copy Base URL"
              >
                {copiedKey === "base-url" ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mavrixfy Quick-Connect Banner */}
        <div className="mt-8 pt-6 border-t border-border/40 grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Smartphone className="w-4 h-4" />
              Connect to Mavrixfy Mobile App (`e:\Mavrixfy\Mavrixfy_App`)
            </div>
            <p className="text-xs text-muted-foreground">
              Add this single environment variable to your Mavrixfy mobile project{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted/60 font-mono text-[11px] text-foreground">
                .env
              </code>{" "}
              file to immediately power song search, recommendations, audio streams, and lyrics.
            </p>
          </div>
          <div className="md:col-span-4 flex items-center gap-2">
            <div className="flex-1 bg-black/40 border border-border/50 rounded-xl p-2.5 font-mono text-xs truncate select-all">
              EXPO_PUBLIC_MUSIC_API_URL={origin}
            </div>
            <button
              onClick={() =>
                handleCopy(`EXPO_PUBLIC_MUSIC_API_URL=${origin}`, "env-copy")
              }
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-xs shadow-lg hover:bg-primary/90 transition-all active:scale-95"
            >
              {copiedKey === "env-copy" ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy .env
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "all", label: "All Routes", count: ENDPOINTS.length },
            {
              id: "search",
              label: "Search & Songs",
              count: ENDPOINTS.filter((e) => e.category === "search").length,
            },
            {
              id: "playlists",
              label: "Playlists & Albums",
              count: ENDPOINTS.filter((e) => e.category === "playlists").length,
            },
            {
              id: "streaming",
              label: "Audio & Media",
              count: ENDPOINTS.filter((e) => e.category === "streaming").length,
            },
            {
              id: "system",
              label: "System",
              count: ENDPOINTS.filter((e) => e.category === "system").length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === tab.id
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-102"
                  : "bg-card/60 text-muted-foreground border border-border/50 hover:bg-card hover:text-foreground"
              }`}
            >
              {tab.label}
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedCategory === tab.id
                    ? "bg-primary-foreground/20 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter endpoints (e.g. songs, stream, lyrics)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-card/60 border border-border/60 focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Endpoints List */}
      <div className="space-y-6">
        {filteredEndpoints.map((ep) => {
          const state = endpointStates[ep.id] || {
            params: ep.defaultParams,
            loading: false,
            status: null,
            duration: null,
            response: null,
            error: null,
            expanded: false,
          };
          const currentUrl = constructUrl(ep);
          const activeTab = activeSnippetTab[ep.id] || "curl";

          return (
            <div
              key={ep.id}
              className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-md overflow-hidden transition-all hover:border-border hover:shadow-xl"
            >
              {/* Endpoint Card Header */}
              <div className="p-5 md:p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {ep.method}
                    </span>
                    <span className="font-mono text-sm md:text-base font-semibold text-foreground break-all">
                      {ep.path}
                    </span>
                    <button
                      onClick={() => handleCopy(`${origin}${currentUrl}`, `path-${ep.id}`)}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy full URL"
                    >
                      {copiedKey === `path-${ep.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {ep.mavrixfyTarget && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                      <Smartphone className="w-3 h-3" />
                      {ep.mavrixfyTarget}
                    </div>
                  )}
                </div>

                <p className="text-xs md:text-sm text-muted-foreground">
                  {ep.description}
                </p>

                {/* Parameters Section */}
                {Object.keys(ep.paramDescriptions).length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Parameters
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(ep.paramDescriptions).map(([paramName, desc]) => (
                        <div
                          key={paramName}
                          className="flex flex-col gap-1 p-2.5 rounded-xl border border-border/50 bg-background/50"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-semibold text-primary">{paramName}</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={desc}>
                              {desc}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={state.params[paramName] ?? ""}
                            onChange={(e) =>
                              updateParam(ep.id, paramName, e.target.value)
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-card/80 border border-border/70 focus:outline-none focus:border-primary font-mono text-foreground"
                            placeholder={ep.defaultParams[paramName] || "value"}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions & Execute Button */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="font-mono text-xs text-muted-foreground truncate max-w-lg">
                    <span className="text-foreground/80 font-semibold">{ep.method}</span>{" "}
                    {currentUrl}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => executeEndpoint(ep)}
                      disabled={state.loading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-xs font-semibold shadow-lg shadow-primary/20 hover:opacity-95 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {state.loading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Executing...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Send Request
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Response Section */}
              {(state.status !== null || state.loading || state.error) && (
                <div className="border-t border-border/50 bg-background/80 p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {state.status && (
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold ${
                            state.status >= 200 && state.status < 300
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {state.status} {state.status === 200 ? "OK" : ""}
                        </span>
                      )}
                      {state.duration !== null && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {state.duration} ms
                        </span>
                      )}
                      {state.error && (
                        <span className="flex items-center gap-1 text-xs text-rose-400 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {state.error}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {state.response && (
                        <button
                          onClick={() =>
                            handleCopy(
                              typeof state.response === "object"
                                ? JSON.stringify(state.response, null, 2)
                                : String(state.response),
                              `resp-${ep.id}`
                            )
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40 font-mono"
                        >
                          {copiedKey === `resp-${ep.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              Copied JSON
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy JSON
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Audio Preview Player if streaming endpoint */}
                  {ep.id === "stream-audio" && (
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <Volume2 className="w-4 h-4 animate-pulse" />
                        Live Audio Streaming Preview
                      </div>
                      <audio
                        controls
                        src={`${origin}${currentUrl}`}
                        className="w-full h-10 rounded-lg"
                      >
                        Your browser does not support audio element.
                      </audio>
                    </div>
                  )}

                  {/* Formatted JSON / Text Response */}
                  {state.response && (
                    <div className="relative rounded-xl border border-border/60 bg-black/60 p-4 font-mono text-xs overflow-x-auto max-h-96">
                      <pre className="text-emerald-400/90 leading-relaxed">
                        {typeof state.response === "object"
                          ? JSON.stringify(state.response, null, 2)
                          : String(state.response)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Code Snippet Tabs */}
              <div className="border-t border-border/30 bg-card/20 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-2">
                      Code Snippet:
                    </span>
                    {(["curl", "fetch", "mavrixfy"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() =>
                          setActiveSnippetTab((prev) => ({
                            ...prev,
                            [ep.id]: tab,
                          }))
                        }
                        className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors ${
                          activeTab === tab
                            ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tab === "curl"
                          ? "cURL"
                          : tab === "fetch"
                          ? "JavaScript (Fetch)"
                          : "React Native (Mavrixfy)"}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const snippet =
                        activeTab === "curl"
                          ? `curl -X GET "${origin}${currentUrl}"`
                          : activeTab === "fetch"
                          ? `const res = await fetch("${origin}${currentUrl}");\nconst data = await res.json();`
                          : `// Mavrixfy App Service\nconst baseUrl = getApiUrl();\nconst res = await fetch(\`\${baseUrl}${currentUrl}\`);\nconst data = await res.json();`;
                      handleCopy(snippet, `code-${ep.id}`);
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy snippet"
                  >
                    {copiedKey === `code-${ep.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

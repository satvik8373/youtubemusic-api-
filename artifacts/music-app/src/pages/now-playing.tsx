import { useParams } from "wouter";
import {
  useGetTrack,
  useGetRelated,
  useGetSubtitles,
  useGetLyrics,
} from "@workspace/api-client-react";
import {
  Play, Pause, Volume2, VolumeX, SkipBack, SkipForward,
  Loader2, ListVideo, Download, Captions, ExternalLink, Copy, Check,
  Cookie, Trash2, AlertCircle, CheckCircle2, Music2,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { formatDuration, formatNumber } from "@/lib/format";
import { TrackCard } from "@/components/TrackCard";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/context/player-context";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CookiesSection({ onSaved }: { onSaved?: () => void }) {
  const [cookiesText, setCookiesText] = useState("");
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasCookies, setHasCookies] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/cookies/status")
      .then((r) => r.json())
      .then((d: { hasCookies: boolean }) => setHasCookies(d.hasCookies))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!cookiesText.trim()) return;
    setUploading(true);
    setMsg(null);
    try {
      const r = await fetch("/api/cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: cookiesText }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (r.ok) {
        setMsg("✓ Cookies saved — downloads now enabled!");
        setHasCookies(true);
        setCookiesText("");
        setOpen(false);
        onSaved?.();
      } else {
        setMsg(`Error: ${d.error ?? "Unknown"}`);
      }
    } catch {
      setMsg("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    await fetch("/api/cookies", { method: "DELETE" });
    setHasCookies(false);
    setMsg(null);
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${hasCookies ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"}`}>
        {hasCookies ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <div className="flex-1">
          <p className="font-semibold">{hasCookies ? "Downloads enabled" : "Upload cookies to enable downloads"}</p>
          <p className="text-xs mt-0.5 opacity-80">
            {hasCookies ? "yt-dlp can download MP3 files for offline use." : "Required for MP3 downloads via yt-dlp."}
          </p>
        </div>
        {hasCookies && (
          <button onClick={handleDelete} className="text-red-400 hover:text-red-300 p-0.5 flex-shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Cookie className="w-3.5 h-3.5" />
        {hasCookies ? "Update YouTube cookies" : "Upload YouTube cookies (cookies.txt)"}
      </button>
      {open && (
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1.5">How to export cookies.txt:</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li>Install <b>"Get cookies.txt LOCALLY"</b> Chrome extension</li>
              <li>Sign into YouTube in your browser</li>
              <li>Visit youtube.com → click extension → Export</li>
              <li>Paste the file content below</li>
            </ol>
          </div>
          <textarea
            value={cookiesText}
            onChange={(e) => setCookiesText(e.target.value)}
            placeholder={"# Netscape HTTP Cookie File\n.youtube.com TRUE / FALSE ..."}
            className="w-full h-28 bg-black/40 border border-border rounded-lg p-2.5 text-xs font-mono text-green-400 placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
          />
          {msg && <p className={`text-xs ${msg.startsWith("✓") ? "text-green-400" : "text-destructive"}`}>{msg}</p>}
          <button
            onClick={handleSave}
            disabled={uploading || !cookiesText.trim()}
            className="w-full py-2 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-sm font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? "Saving…" : "Save Cookies"}
          </button>
        </div>
      )}
    </div>
  );
}

function DownloadSection({ videoId, trackTitle }: { videoId: string; trackTitle: string }) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const ytdlpCmd = `yt-dlp -x --audio-format mp3 "${videoUrl}"`;
  const [downloading, setDownloading] = useState(false);
  const [downloadErr, setDownloadErr] = useState<string | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadErr(null);
    try {
      const r = await fetch(`/api/download/${videoId}`);
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        setDownloadErr(d.error ?? "Download failed.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${trackTitle.replace(/[^\w\s-]/g, "")}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadErr("Network error during download.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-semibold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {downloading ? <><Loader2 className="w-4 h-4 animate-spin" /> Downloading… (~60s)</> : <><Download className="w-4 h-4" /> Download MP3</>}
      </button>
      {downloadErr && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">{downloadErr}</div>
      )}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">📺 Video URL</h4>
        <div className="bg-secondary/40 border border-border rounded-xl p-3 flex items-center gap-2">
          <code className="flex-1 text-xs text-accent font-mono break-all line-clamp-2">{videoUrl}</code>
          <div className="flex gap-1 flex-shrink-0">
            <CopyButton text={videoUrl} />
            <a href={videoUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">💻 Local download</h4>
        <div className="bg-black/40 border border-border rounded-xl p-3 flex items-start gap-2">
          <code className="flex-1 text-xs text-green-400 font-mono break-all">{ytdlpCmd}</code>
          <CopyButton text={ytdlpCmd} />
        </div>
      </div>
    </div>
  );
}

function LyricsTab({
  videoId,
  title,
  artist,
  currentTime,
}: {
  videoId: string;
  title?: string;
  artist?: string;
  currentTime: number;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lyricsData, isLoading } = useGetLyrics(videoId, { title, artist }, {
    query: { enabled: !!videoId, staleTime: 10 * 60 * 1000 } as any,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const activeIndex = useMemo(() => {
    if (!lyricsData?.syncedLyrics?.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyricsData.syncedLyrics.length; i++) {
      if ((lyricsData.syncedLyrics[i]?.time ?? Infinity) <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [lyricsData?.syncedLyrics, currentTime]);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeIndex]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Searching for lyrics…</p>
      </div>
    );
  }

  if (!lyricsData?.found) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 gap-3 text-muted-foreground">
        <Music2 className="w-8 h-8 opacity-40" />
        <p className="text-sm">No lyrics found</p>
        <p className="text-xs opacity-60">LRCLib couldn't match this track</p>
      </div>
    );
  }

  if (lyricsData.syncedLyrics?.length) {
    return (
      <div ref={containerRef} className="py-6 px-4 space-y-0.5 select-none">
        {lyricsData.trackName && (
          <div className="mb-5 pb-4 border-b border-border/40">
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{lyricsData.trackName}</span>
              {lyricsData.artistName && <> · {lyricsData.artistName}</>}
            </p>
          </div>
        )}
        {lyricsData.syncedLyrics.map((line, i) => {
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={`py-1.5 px-2 rounded-lg text-sm leading-snug transition-all duration-300 ${
                isActive
                  ? "text-white font-bold text-base scale-105 origin-left bg-primary/10 text-primary drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"
                  : isPast
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground/80 hover:text-muted-foreground"
              }`}
            >
              {line.text}
            </div>
          );
        })}
        <div className="h-16" />
      </div>
    );
  }

  if (lyricsData.plainLyrics) {
    return (
      <div className="py-6 px-4">
        {lyricsData.trackName && (
          <div className="mb-5 pb-4 border-b border-border/40">
            <p className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{lyricsData.trackName}</span>
              {lyricsData.artistName && <> · {lyricsData.artistName}</>}
            </p>
          </div>
        )}
        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {lyricsData.plainLyrics}
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center pt-16 gap-3 text-muted-foreground">
      <Music2 className="w-8 h-8 opacity-40" />
      <p className="text-sm">Lyrics unavailable</p>
    </div>
  );
}

export default function NowPlayingPage() {
  const { videoId } = useParams();
  const {
    currentTrack, isPlaying, isBuffering, isReady, currentTime, duration,
    volume, isMuted, togglePlay, seekTo, changeVolume, toggleMute,
    playNext, playPrev, playTrack, queue, queueIndex,
  } = usePlayer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trackMeta, isLoading: trackLoading } = useGetTrack(videoId ?? "", {
    query: { enabled: !!videoId } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: related } = useGetRelated(videoId ?? "", {
    query: { enabled: !!videoId } as any,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subtitles } = useGetSubtitles(videoId ?? "", {
    query: { enabled: !!videoId } as any,
  });
  const lyricsTitle = trackMeta?.title;
  const lyricsArtist = trackMeta?.uploader ?? undefined;

  useEffect(() => {
    if (videoId && trackMeta && (!currentTrack || currentTrack.id !== videoId)) {
      playTrack({
        id: videoId,
        title: trackMeta.title,
        uploader: trackMeta.uploader ?? null,
        thumbnailUrl: trackMeta.thumbnailUrl ?? null,
        duration: trackMeta.duration ?? null,
        viewCount: trackMeta.viewCount ?? null,
      });
    }
  }, [videoId, trackMeta]);

  if (!videoId) return null;

  const track = trackMeta;
  const displayDuration = duration || track?.duration || 0;
  const hasPrev = queueIndex > 0;
  const hasNext = queueIndex < queue.length - 1;
  const isCurrentTrack = currentTrack?.id === videoId;

  const bgVideoSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&showinfo=0`;

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-background">
      {/* ── Main Player Panel ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden h-full">

        {/* ── Background: blurred YouTube video (Spotify canvas style) ── */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <iframe
            key={videoId}
            src={bgVideoSrc}
            allow="autoplay; encrypted-media"
            className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
            style={{
              filter: "blur(50px) brightness(0.35) saturate(2)",
              border: "none",
            }}
            tabIndex={-1}
          />
          {/* Gradient overlay so text stays readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/30 to-transparent" />
        </div>

        {/* ── Content ── */}
        <div className="flex-1 p-6 lg:p-10 z-10 flex flex-col justify-center items-center overflow-y-auto relative">
          {trackLoading && !track ? (
            <div className="flex flex-col items-center animate-pulse">
              <div className="w-64 h-64 md:w-80 md:h-80 bg-secondary rounded-2xl mb-8 shadow-2xl" />
              <div className="w-64 h-8 bg-secondary rounded mb-4" />
              <div className="w-48 h-4 bg-secondary rounded" />
            </div>
          ) : track ? (
            <div className="w-full max-w-lg mx-auto flex flex-col items-center">

              {/* Album Art */}
              <div className="relative w-full max-w-[300px] aspect-square bg-secondary rounded-2xl overflow-hidden mb-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)] border border-white/10 group">
                <img
                  src={track.thumbnailUrl ?? ""}
                  alt={track.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {(isBuffering && isCurrentTrack && !isReady) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="text-center mb-6 w-full px-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-md line-clamp-2">
                  {track.title}
                </h1>
                <p className="text-lg text-primary font-medium tracking-wide">{track.uploader}</p>
                <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground font-mono">
                  {track.viewCount != null && <span>{formatNumber(track.viewCount)} plays</span>}
                  {track.uploadDate && <span>• {track.uploadDate.substring(0, 4)}</span>}
                </div>
              </div>

              {/* Player Card */}
              <div className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
                {/* Seek Bar */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xs font-mono text-muted-foreground w-10 text-right tabular-nums">
                    {formatDuration(currentTime)}
                  </span>
                  <Slider
                    value={[currentTime]}
                    max={displayDuration || 1}
                    step={1}
                    onValueChange={(v) => v[0] !== undefined && seekTo(v[0])}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted-foreground w-10 tabular-nums">
                    {formatDuration(displayDuration)}
                  </span>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 w-1/3">
                    <button onClick={toggleMute} className="text-muted-foreground hover:text-white transition-colors">
                      {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      step={1}
                      onValueChange={(v) => v[0] !== undefined && changeVolume(v[0])}
                      className="w-20 hidden md:flex cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-5 w-1/3">
                    <button onClick={playPrev} disabled={!hasPrev} className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30">
                      <SkipBack className="w-7 h-7 fill-current" />
                    </button>
                    <button
                      onClick={togglePlay}
                      disabled={!isReady && !isBuffering}
                      className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all shadow-[0_0_30px_rgba(236,72,153,0.5)] hover:shadow-[0_0_45px_rgba(236,72,153,0.7)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                    >
                      {isBuffering && isCurrentTrack && !isReady ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : isPlaying && isCurrentTrack ? (
                        <Pause className="w-7 h-7 fill-current" />
                      ) : (
                        <Play className="w-7 h-7 fill-current ml-1" />
                      )}
                    </button>
                    <button onClick={playNext} disabled={!hasNext} className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30">
                      <SkipForward className="w-7 h-7 fill-current" />
                    </button>
                  </div>

                  <div className="w-1/3" />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-center">
              <p className="text-2xl font-bold mb-2">Track not found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div className="w-full lg:w-[380px] bg-sidebar border-l border-sidebar-border flex flex-col h-full z-20">
        <Tabs defaultValue="related" className="flex-1 flex flex-col w-full h-full">
          <TabsList className="w-full justify-start rounded-none border-b border-sidebar-border bg-transparent p-0 h-12 flex-shrink-0">
            <TabsTrigger value="related" className="flex-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary text-xs">
              <ListVideo className="w-3.5 h-3.5 mr-1.5" /> Related
            </TabsTrigger>
            <TabsTrigger value="lyrics" className="flex-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary text-xs">
              <Music2 className="w-3.5 h-3.5 mr-1.5" /> Lyrics
            </TabsTrigger>
            <TabsTrigger value="download" className="flex-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download
            </TabsTrigger>
            <TabsTrigger value="subs" className="flex-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary text-xs">
              <Captions className="w-3.5 h-3.5 mr-1.5" /> Subs
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="related" className="m-0 outline-none">
              {related && related.length > 0 ? (
                <div className="py-2">
                  {related.map((t, i) => (
                    <TrackCard key={t.id} track={t} variant="row" index={i} queue={related} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center pt-12">No related tracks found.</p>
              )}
            </TabsContent>

            <TabsContent value="lyrics" className="m-0 outline-none h-full">
              <LyricsTab
                videoId={videoId}
                title={lyricsTitle}
                artist={lyricsArtist}
                currentTime={currentTime}
              />
            </TabsContent>

            <TabsContent value="download" className="m-0 p-4 outline-none space-y-6">
              <CookiesSection />
              <div className="border-t border-border pt-5">
                <DownloadSection videoId={videoId} trackTitle={track?.title ?? videoId} />
              </div>
            </TabsContent>

            <TabsContent value="subs" className="m-0 p-4 outline-none">
              <div className="space-y-5">
                {subtitles?.subtitles && subtitles.subtitles.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Manual</h4>
                    <div className="space-y-2">
                      {subtitles.subtitles.map((sub) => (
                        <div key={`${sub.language}-${sub.ext}`} className="flex justify-between items-center p-2.5 bg-secondary/30 rounded-lg border border-border/50">
                          <span className="text-sm">{sub.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{sub.ext}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {subtitles?.automatic && subtitles.automatic.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Auto-generated</h4>
                    <div className="space-y-2">
                      {subtitles.automatic.map((sub) => (
                        <div key={`${sub.language}-${sub.ext}`} className="flex justify-between items-center p-2.5 bg-secondary/30 rounded-lg border border-border/50">
                          <span className="text-sm">{sub.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{sub.ext}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!subtitles?.subtitles?.length && !subtitles?.automatic?.length) && (
                  <p className="text-muted-foreground text-sm text-center pt-8">No subtitles available.</p>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

import { useParams } from "wouter";
import {
  useGetTrack,
  useGetRelated,
  useGetFormats,
  useGetSubtitles,
} from "@workspace/api-client-react";
import {
  Play, Pause, Volume2, VolumeX, SkipBack, SkipForward,
  Loader2, ListVideo, Download, Captions, ExternalLink, Copy, Check,
} from "lucide-react";
import { useState, useEffect } from "react";
import { formatDuration, formatNumber } from "@/lib/format";
import { TrackCard } from "@/components/TrackCard";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePlayer } from "@/context/player-context";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function NowPlayingPage() {
  const { videoId } = useParams();
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    isReady,
    currentTime,
    duration,
    volume,
    isMuted,
    togglePlay,
    seekTo,
    changeVolume,
    toggleMute,
    playNext,
    playPrev,
    playTrack,
    queue,
    queueIndex,
  } = usePlayer();

  const { data: trackMeta, isLoading: trackLoading } = useGetTrack(videoId ?? "", {
    query: { enabled: !!videoId },
  });
  const { data: related } = useGetRelated(videoId ?? "", {
    query: { enabled: !!videoId },
  });
  const { data: formats } = useGetFormats(videoId ?? "", {
    query: { enabled: !!videoId },
  });
  const { data: subtitles } = useGetSubtitles(videoId ?? "", {
    query: { enabled: !!videoId },
  });

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
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const ytdlpCmd = `yt-dlp -x --audio-format mp3 "${videoUrl}"`;
  const hasPrev = queueIndex > 0;
  const hasNext = queueIndex < queue.length - 1;
  const displayDuration = duration || track?.duration || 0;

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-background">
      {/* Main Player Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {track?.thumbnailUrl && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-15">
            <img
              src={track.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover blur-[120px] scale-150 saturate-200"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          </div>
        )}

        <div className="flex-1 p-6 lg:p-10 z-10 flex flex-col justify-center items-center overflow-y-auto">
          {trackLoading && !track ? (
            <div className="flex flex-col items-center animate-pulse">
              <div className="w-64 h-64 md:w-80 md:h-80 bg-secondary rounded-2xl mb-8 shadow-2xl" />
              <div className="w-64 h-8 bg-secondary rounded mb-4" />
              <div className="w-48 h-4 bg-secondary rounded" />
            </div>
          ) : track ? (
            <div className="w-full max-w-lg mx-auto flex flex-col items-center">
              {/* Album Art */}
              <div className="w-full max-w-[320px] aspect-square bg-secondary rounded-2xl overflow-hidden mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-white/10 relative group">
                <img
                  src={track.thumbnailUrl ?? ""}
                  alt={track.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                {(isBuffering || (!isReady && currentTrack?.id === videoId)) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
                <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground font-mono">
                  {track.viewCount != null && <span>{formatNumber(track.viewCount)} plays</span>}
                  {track.likeCount != null && <span>• {formatNumber(track.likeCount)} likes</span>}
                  {track.uploadDate && <span>• {track.uploadDate.substring(0, 4)}</span>}
                </div>
              </div>

              {/* Player Card */}
              <div className="w-full bg-secondary/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
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
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
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
                    <button
                      onClick={playPrev}
                      disabled={!hasPrev}
                      className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30"
                    >
                      <SkipBack className="w-7 h-7 fill-current" />
                    </button>

                    <button
                      onClick={togglePlay}
                      disabled={!isReady && !isBuffering}
                      className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                    >
                      {isBuffering && !isReady ? (
                        <Loader2 className="w-7 h-7 animate-spin" />
                      ) : isPlaying && currentTrack?.id === videoId ? (
                        <Pause className="w-7 h-7 fill-current" />
                      ) : (
                        <Play className="w-7 h-7 fill-current ml-1" />
                      )}
                    </button>

                    <button
                      onClick={playNext}
                      disabled={!hasNext}
                      className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30"
                    >
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
              <p className="text-sm">The video may be unavailable or restricted.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-[380px] bg-sidebar border-l border-sidebar-border flex flex-col h-full z-20">
        <Tabs defaultValue="related" className="flex-1 flex flex-col w-full h-full">
          <TabsList className="w-full justify-start rounded-none border-b border-sidebar-border bg-transparent p-0 h-12 flex-shrink-0">
            <TabsTrigger value="related" className="flex-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary text-xs">
              <ListVideo className="w-3.5 h-3.5 mr-1.5" /> Related
            </TabsTrigger>
            <TabsTrigger value="download" className="flex-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download
            </TabsTrigger>
            <TabsTrigger value="subs" className="flex-1 h-full rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary text-xs">
              <Captions className="w-3.5 h-3.5 mr-1.5" /> Subs
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            {/* Related Tab */}
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

            {/* Download Tab */}
            <TabsContent value="download" className="m-0 p-4 outline-none space-y-5">
              {/* Video URL */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  📺 Video URL
                </h4>
                <div className="bg-secondary/40 border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs text-accent font-mono break-all line-clamp-2">
                      {videoUrl}
                    </code>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <CopyButton text={videoUrl} />
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded text-muted-foreground hover:text-primary transition-colors"
                        title="Open in YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audio Formats */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  🎵 Audio Formats
                </h4>
                <div className="space-y-2">
                  {formats?.map((fmt) => (
                    <a
                      key={fmt.formatId}
                      href={videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border hover:border-primary/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-primary font-mono">
                            {fmt.ext.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">
                            {fmt.note ?? `${fmt.ext.toUpperCase()} Audio`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {fmt.acodec && fmt.acodec !== "none" && (
                              <Badge variant="outline" className="font-mono text-[9px] h-4 px-1">
                                {fmt.acodec}
                              </Badge>
                            )}
                            {fmt.abr != null && (
                              <span className="text-xs text-muted-foreground font-mono">{fmt.abr}kbps</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              {/* yt-dlp command */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  💻 Download with yt-dlp
                </h4>
                <div className="bg-black/40 border border-border rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <code className="flex-1 text-xs text-green-400 font-mono break-all">
                      {ytdlpCmd}
                    </code>
                    <CopyButton text={ytdlpCmd} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Run this command locally to download the audio as MP3.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Subtitles Tab */}
            <TabsContent value="subs" className="m-0 p-4 outline-none">
              <div className="space-y-5">
                {subtitles?.subtitles && subtitles.subtitles.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                      Manual
                    </h4>
                    <div className="space-y-2">
                      {subtitles.subtitles.map((sub) => (
                        <div
                          key={`${sub.language}-${sub.ext}`}
                          className="flex justify-between items-center p-2.5 bg-secondary/30 rounded-lg border border-border/50"
                        >
                          <span className="text-sm">{sub.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{sub.ext}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {subtitles?.automatic && subtitles.automatic.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                      Auto-generated
                    </h4>
                    <div className="space-y-2">
                      {subtitles.automatic.map((sub) => (
                        <div
                          key={`${sub.language}-${sub.ext}`}
                          className="flex justify-between items-center p-2.5 bg-secondary/30 rounded-lg border border-border/50"
                        >
                          <span className="text-sm">{sub.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{sub.ext}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!subtitles?.subtitles?.length && !subtitles?.automatic?.length) && (
                  <p className="text-muted-foreground text-sm text-center pt-8">
                    No subtitles available for this track.
                  </p>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

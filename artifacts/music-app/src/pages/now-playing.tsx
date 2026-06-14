import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";
import { 
  useGetTrack, 
  useGetStreamUrl, 
  useGetRelated,
  useGetFormats,
  useGetSubtitles
} from "@workspace/api-client-react";
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Loader2, ListVideo, Download, Captions } from "lucide-react";
import { formatDuration, formatNumber, formatBytes } from "@/lib/format";
import { TrackCard } from "@/components/TrackCard";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

declare namespace YT {
  class Player {
    constructor(elementId: string, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    getVolume(): number;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    destroy(): void;
  }
  interface PlayerOptions {
    videoId: string;
    height?: string | number;
    width?: string | number;
    playerVars?: Record<string, unknown>;
    events?: {
      onReady?: () => void;
      onStateChange?: (e: { data: number }) => void;
      onError?: (e: { data: number }) => void;
    };
  }
  const PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
}

export default function NowPlayingPage() {
  const { videoId } = useParams();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const playerRef = useRef<YT.Player | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: track, isLoading: trackLoading } = useGetTrack(videoId ?? "", {
    query: { enabled: !!videoId },
  });
  const { data: streamUrl, isLoading: streamLoading } = useGetStreamUrl(videoId ?? "", {
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

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (playerRef.current) {
        setCurrentTime(playerRef.current.getCurrentTime());
        const d = playerRef.current.getDuration();
        if (d > 0) setDuration(d);
      }
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const initPlayer = useCallback(() => {
    if (!videoId || !containerRef.current) return;
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    stopTimer();

    playerRef.current = new window.YT.Player("yt-player-container", {
      videoId,
      height: "1",
      width: "1",
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          setIsReady(true);
          setDuration(playerRef.current?.getDuration() ?? 0);
          setVolume(playerRef.current?.getVolume() ?? 100);
        },
        onStateChange: (e) => {
          const s = e.data;
          if (s === 1) {
            setIsPlaying(true);
            setIsBuffering(false);
            startTimer();
          } else if (s === 2) {
            setIsPlaying(false);
            stopTimer();
          } else if (s === 0) {
            setIsPlaying(false);
            stopTimer();
            setCurrentTime(0);
          } else if (s === 3) {
            setIsBuffering(true);
          }
        },
      },
    });
  }, [videoId, startTimer, stopTimer]);

  useEffect(() => {
    if (!videoId) return;

    const loadApi = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
        if (!document.getElementById("yt-iframe-api")) {
          const tag = document.createElement("script");
          tag.id = "yt-iframe-api";
          tag.src = "https://www.youtube.com/iframe_api";
          document.body.appendChild(tag);
        }
      }
    };
    loadApi();

    return () => {
      stopTimer();
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, initPlayer, stopTimer]);

  const togglePlay = () => {
    if (!playerRef.current || !isReady) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (value: number[]) => {
    if (playerRef.current && isReady && value[0] !== undefined) {
      playerRef.current.seekTo(value[0], true);
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    if (playerRef.current && isReady && value[0] !== undefined) {
      playerRef.current.setVolume(value[0]);
      setVolume(value[0]);
      if (value[0] === 0) {
        playerRef.current.mute();
        setIsMuted(true);
      } else {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    if (!playerRef.current || !isReady) return;
    if (isMuted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume || 50);
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  if (!videoId) return null;

  const isLoading = trackLoading || streamLoading;

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-background">
      {/* Hidden YouTube Player */}
      <div className="absolute opacity-0 pointer-events-none overflow-hidden w-px h-px">
        <div id="yt-player-container" ref={containerRef} />
      </div>

      {/* Main Player Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {track?.thumbnailUrl && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
            <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover blur-[100px] scale-150 saturate-200" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          </div>
        )}

        <div className="flex-1 p-8 lg:p-12 z-10 flex flex-col justify-center items-center overflow-y-auto">
          {trackLoading ? (
            <div className="flex flex-col items-center animate-pulse">
              <div className="w-64 h-64 md:w-96 md:h-96 bg-secondary rounded-2xl mb-8 shadow-2xl" />
              <div className="w-64 h-8 bg-secondary rounded mb-4" />
              <div className="w-48 h-4 bg-secondary rounded" />
            </div>
          ) : track ? (
            <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
              <div className="w-full aspect-video md:aspect-square max-w-[500px] bg-secondary rounded-2xl overflow-hidden mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 relative group">
                <img
                  src={track.thumbnailUrl ?? ""}
                  alt={track.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>

              <div className="text-center mb-10 w-full px-4">
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-white drop-shadow-md">
                  {track.title}
                </h1>
                <p className="text-xl text-primary font-medium tracking-wide">
                  {track.uploader}
                </p>
                <div className="flex items-center justify-center gap-4 mt-6 text-sm text-muted-foreground font-mono">
                  {track.viewCount != null && <span>{formatNumber(track.viewCount)} plays</span>}
                  {track.viewCount != null && track.likeCount != null && <span>•</span>}
                  {track.likeCount != null && <span>{formatNumber(track.likeCount)} likes</span>}
                  {track.uploadDate && <span>•</span>}
                  {track.uploadDate && <span>{track.uploadDate.substring(0, 4)}</span>}
                </div>
              </div>

              {/* Player Controls */}
              <div className="w-full max-w-3xl bg-secondary/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">

                {/* Seek Bar */}
                <div className="flex items-center gap-4 mb-8">
                  <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                    {formatDuration(currentTime)}
                  </span>
                  <Slider
                    value={[currentTime]}
                    max={duration || (track.duration ?? 100)}
                    step={1}
                    onValueChange={handleSeek}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted-foreground w-12">
                    {formatDuration(duration || (track.duration ?? 0))}
                  </span>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 w-1/3">
                    <button onClick={toggleMute} className="text-muted-foreground hover:text-white transition-colors">
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      step={1}
                      onValueChange={handleVolumeChange}
                      className="w-24 hidden md:flex cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-center gap-6 w-1/3">
                    <button className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30" disabled>
                      <SkipBack className="w-8 h-8 fill-current" />
                    </button>

                    <button
                      onClick={togglePlay}
                      disabled={isLoading || !isReady}
                      className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:shadow-[0_0_40px_rgba(236,72,153,0.6)] hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                    >
                      {isLoading || isBuffering || (!isReady && !!streamUrl) ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="w-8 h-8 fill-current" />
                      ) : (
                        <Play className="w-8 h-8 fill-current ml-1" />
                      )}
                    </button>

                    <button className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30" disabled>
                      <SkipForward className="w-8 h-8 fill-current" />
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-4 w-1/3" />
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
      <div className="w-full lg:w-96 bg-sidebar border-l border-sidebar-border flex flex-col h-full z-20">
        <Tabs defaultValue="related" className="flex-1 flex flex-col w-full h-full">
          <TabsList className="w-full justify-start rounded-none border-b border-sidebar-border bg-transparent p-0 h-14">
            <TabsTrigger value="related" className="flex-1 h-full rounded-none data-[state=active]:bg-sidebar-accent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary">
              <ListVideo className="w-4 h-4 mr-2" /> Related
            </TabsTrigger>
            <TabsTrigger value="formats" className="flex-1 h-full rounded-none data-[state=active]:bg-sidebar-accent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary">
              <Download className="w-4 h-4 mr-2" /> Formats
            </TabsTrigger>
            <TabsTrigger value="subs" className="flex-1 h-full rounded-none data-[state=active]:bg-sidebar-accent data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary">
              <Captions className="w-4 h-4 mr-2" /> Subs
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="related" className="m-0 p-4 space-y-4 outline-none">
              {related && related.length > 0 ? (
                related.map((t) => <TrackCard key={t.id} track={t} />)
              ) : (
                <p className="text-muted-foreground text-sm text-center pt-8">No related tracks found.</p>
              )}
            </TabsContent>

            <TabsContent value="formats" className="m-0 p-4 space-y-3 outline-none">
              {formats && formats.length > 0 ? (
                formats.map((format) => (
                  <a
                    key={format.formatId}
                    href={format.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col p-3 rounded-xl bg-secondary/50 border border-border hover:border-primary/50 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-primary font-bold">{format.ext.toUpperCase()}</span>
                      {format.filesize && (
                        <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                          {formatBytes(format.filesize)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {format.acodec && format.acodec !== "none" && (
                        <Badge variant="outline" className="font-mono text-[10px]">{format.acodec}</Badge>
                      )}
                      {format.abr != null && <span>{format.abr}kbps</span>}
                      {format.note && <span className="text-muted-foreground/70">{format.note}</span>}
                    </div>
                  </a>
                ))
              ) : (
                <p className="text-muted-foreground text-sm text-center pt-8">No formats available.</p>
              )}
            </TabsContent>

            <TabsContent value="subs" className="m-0 p-4 outline-none">
              <div className="space-y-6">
                {subtitles?.subtitles && subtitles.subtitles.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Manual</h4>
                    <div className="space-y-2">
                      {subtitles.subtitles.map((sub) => (
                        <div key={`${sub.language}-${sub.ext}`} className="flex justify-between items-center p-2 bg-secondary/30 rounded border border-border/50">
                          <span className="text-sm">{sub.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{sub.ext}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {subtitles?.automatic && subtitles.automatic.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Auto-generated</h4>
                    <div className="space-y-2">
                      {subtitles.automatic.map((sub) => (
                        <div key={`${sub.language}-${sub.ext}`} className="flex justify-between items-center p-2 bg-secondary/30 rounded border border-border/50">
                          <span className="text-sm">{sub.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px]">{sub.ext}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!subtitles?.subtitles?.length && !subtitles?.automatic?.length) && (
                  <p className="text-muted-foreground text-sm text-center pt-8">No subtitles available for this track.</p>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

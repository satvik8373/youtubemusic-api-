import { usePlayer } from "@/context/player-context";
import { useLocation } from "wouter";
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Loader2, ListMusic, WifiOff,
} from "lucide-react";
import { formatDuration } from "@/lib/format";
import { Slider } from "@/components/ui/slider";

export function BottomPlayer() {
  const [, setLocation] = useLocation();
  const {
    currentTrack,
    isPlaying,
    isBuffering,
    isReady,
    currentTime,
    duration,
    volume,
    isMuted,
    queue,
    queueIndex,
    togglePlay,
    seekTo,
    changeVolume,
    toggleMute,
    playNext,
    playPrev,
  } = usePlayer();

  if (!currentTrack) return null;

  const hasPrev = queueIndex > 0;
  const hasNext = queueIndex < queue.length - 1;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-sidebar/95 backdrop-blur-xl border-t border-sidebar-border flex items-center px-4 gap-4 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]">
      {/* Progress bar at very top of player */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 bg-border cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          seekTo(pct * (duration || 1));
        }}
      >
        <div
          className="h-full bg-primary transition-all duration-200 group-hover:bg-primary/80 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 shadow-[0_0_8px_rgba(236,72,153,0.8)] transition-opacity" />
        </div>
      </div>

      {/* Track info */}
      <div
        className="flex items-center gap-3 min-w-0 w-64 flex-shrink-0 cursor-pointer group"
        onClick={() => setLocation(`/track/${currentTrack.id}`)}
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-border shadow-md">
          {currentTrack.thumbnailUrl ? (
            <img
              src={currentTrack.thumbnailUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <ListMusic className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {currentTrack.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {currentTrack.uploader ?? "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 flex flex-col items-center gap-1 max-w-xl mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={playPrev}
            disabled={!hasPrev}
            className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!isReady && !isBuffering}
            className="w-10 h-10 rounded-full bg-white hover:bg-white/90 text-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-md"
          >
            {isBuffering && !isReady ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={playNext}
            disabled={!hasNext}
            className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        <div className="flex items-center gap-2 w-full text-xs text-muted-foreground font-mono">
          <span className="w-8 text-right">{formatDuration(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration || 1}
            step={0.5}
            onValueChange={(v) => v[0] !== undefined && seekTo(v[0])}
            className="flex-1 cursor-pointer h-1"
          />
          <span className="w-8">{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="hidden md:flex items-center gap-2 w-36 flex-shrink-0">
        <button onClick={toggleMute} className="text-muted-foreground hover:text-white transition-colors">
          {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={100}
          step={1}
          onValueChange={(v) => v[0] !== undefined && changeVolume(v[0])}
          className="flex-1 cursor-pointer"
        />
      </div>
    </div>
  );
}

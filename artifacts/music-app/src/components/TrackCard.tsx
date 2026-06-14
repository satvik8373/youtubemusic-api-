import { useLocation } from "wouter";
import { formatDuration, formatNumber } from "@/lib/format";
import { Track } from "@workspace/api-client-react";
import { usePlayer } from "@/context/player-context";
import { Play, Pause, PlusCircle } from "lucide-react";

interface TrackCardProps {
  track: Track;
  variant?: "card" | "row";
  index?: number;
  queue?: Track[];
}

export function TrackCard({ track, variant = "card", index, queue }: TrackCardProps) {
  const [, setLocation] = useLocation();
  const { playTrack, addToQueue, currentTrack, isPlaying } = usePlayer();

  const isCurrentTrack = currentTrack?.id === track.id;

  const asPlayerTrack = (t: Track) => ({
    id: t.id,
    title: t.title,
    uploader: t.uploader ?? null,
    thumbnailUrl: t.thumbnailUrl ?? null,
    duration: t.duration ?? null,
    viewCount: t.viewCount ?? null,
  });

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const q = queue ? queue.map(asPlayerTrack) : [asPlayerTrack(track)];
    playTrack(asPlayerTrack(track), q);
    setLocation(`/track/${track.id}`);
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToQueue(asPlayerTrack(track));
  };

  if (variant === "row") {
    return (
      <div
        className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all cursor-pointer hover:bg-secondary/60 ${isCurrentTrack ? "bg-secondary/40" : ""}`}
        onClick={handlePlay}
      >
        <div className="w-6 text-center flex-shrink-0">
          {isCurrentTrack ? (
            isPlaying ? (
              <div className="flex items-end justify-center gap-px h-4">
                <span className="w-0.5 bg-primary rounded-full animate-bounce" style={{ height: "60%", animationDelay: "0ms" }} />
                <span className="w-0.5 bg-primary rounded-full animate-bounce" style={{ height: "100%", animationDelay: "150ms" }} />
                <span className="w-0.5 bg-primary rounded-full animate-bounce" style={{ height: "70%", animationDelay: "300ms" }} />
              </div>
            ) : (
              <Pause className="w-3.5 h-3.5 text-primary fill-current mx-auto" />
            )
          ) : (
            <>
              <span className="text-sm text-muted-foreground font-mono group-hover:hidden">
                {index != null ? index + 1 : ""}
              </span>
              <Play className="w-3.5 h-3.5 text-foreground fill-current mx-auto hidden group-hover:block" />
            </>
          )}
        </div>

        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 border border-border">
          <img
            src={track.thumbnailUrl ?? ""}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium line-clamp-1 ${isCurrentTrack ? "text-primary" : "text-foreground"}`}>
            {track.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{track.uploader}</p>
        </div>

        <span className="hidden md:block text-xs text-muted-foreground font-mono w-16 text-right flex-shrink-0">
          {formatNumber(track.viewCount)}
        </span>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleAddToQueue}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
            title="Add to queue"
          >
            <PlusCircle className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground font-mono w-10 text-right">
            {formatDuration(track.duration)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group cursor-pointer"
      onClick={handlePlay}
      data-testid={`link-track-${track.id}`}
    >
      <div className={`bg-card hover:bg-secondary/80 rounded-xl overflow-hidden transition-all duration-300 border hover:border-primary/50 relative ${isCurrentTrack ? "border-primary/40" : "border-border"}`}>
        <div className="relative aspect-video overflow-hidden">
          <img
            src={track.thumbnailUrl ?? ""}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-[0_0_20px_rgba(255,0,128,0.5)] transform scale-90 group-hover:scale-100 transition-transform">
              {isCurrentTrack && isPlaying ? (
                <Pause className="h-6 w-6 fill-current" />
              ) : (
                <Play className="h-6 w-6 ml-1 fill-current" />
              )}
            </div>
          </div>
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs font-mono rounded backdrop-blur-md">
            {formatDuration(track.duration)}
          </div>
          {isCurrentTrack && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded uppercase tracking-wide">
              Playing
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className={`font-bold line-clamp-1 transition-colors text-base ${isCurrentTrack ? "text-primary" : "text-foreground group-hover:text-primary"}`}>
            {track.title}
          </h3>
          <p className="text-muted-foreground text-sm mt-1 line-clamp-1">{track.uploader}</p>
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground font-mono">
            <span>{formatNumber(track.viewCount)} plays</span>
            {track.uploadDate && <span>{track.uploadDate.substring(0, 4)}</span>}
          </div>
        </div>
        <div className="absolute -inset-px bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-10 blur-md transition-opacity -z-10 rounded-xl" />
      </div>
    </div>
  );
}

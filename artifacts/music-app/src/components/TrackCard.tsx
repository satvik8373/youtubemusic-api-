import { Link } from "wouter";
import { formatDuration, formatNumber } from "@/lib/format";
import { Track } from "@workspace/api-client-react";
import { Play } from "lucide-react";

interface TrackCardProps {
  track: Track;
  featured?: boolean;
}

export function TrackCard({ track, featured = false }: TrackCardProps) {
  return (
    <Link href={`/track/${track.id}`} className="group block" data-testid={`link-track-${track.id}`}>
      <div className="bg-card hover:bg-secondary/80 rounded-xl overflow-hidden transition-all duration-300 border border-border hover:border-primary/50 relative">
        <div className="relative aspect-video overflow-hidden">
          <img 
            src={track.thumbnailUrl || ""} 
            alt={track.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-[0_0_20px_rgba(255,0,128,0.5)] transform scale-90 group-hover:scale-100 transition-transform">
              <Play className="h-6 w-6 ml-1" />
            </div>
          </div>
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs font-mono rounded backdrop-blur-md">
            {formatDuration(track.duration)}
          </div>
        </div>
        <div className="p-4">
          <h3 className={`font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors ${featured ? 'text-xl' : 'text-base'}`}>
            {track.title}
          </h3>
          <p className="text-muted-foreground text-sm mt-1 line-clamp-1">
            {track.uploader}
          </p>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-mono">
            <span>{formatNumber(track.viewCount)} plays</span>
            {track.uploadDate && <span>• {track.uploadDate.substring(0,4)}</span>}
          </div>
        </div>
        
        {/* Glow effect on hover */}
        <div className="absolute -inset-px bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-10 blur-md transition-opacity -z-10 rounded-xl"></div>
      </div>
    </Link>
  );
}

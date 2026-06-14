import { useParams } from "wouter";
import { useGetPlaylist } from "@workspace/api-client-react";
import { TrackCard } from "@/components/TrackCard";
import { Loader2, Play, ListMusic } from "lucide-react";

export default function PlaylistPage() {
  const { playlistId } = useParams();

  const { data: playlist, isLoading, error } = useGetPlaylist(
    playlistId || "",
    { query: { enabled: !!playlistId, queryKey: ["playlist", playlistId] } }
  );

  if (!playlistId) return null;

  return (
    <div className="min-h-full">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading playlist...</p>
        </div>
      ) : error ? (
        <div className="p-8 m-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20 max-w-2xl mx-auto">
          Failed to load playlist.
        </div>
      ) : !playlist ? (
        <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
          <ListMusic className="w-16 h-16 opacity-20 mb-4" />
          <h3 className="text-xl font-medium text-foreground">Playlist not found</h3>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="relative pt-24 pb-16 px-8 overflow-hidden bg-secondary/30 border-b border-border">
            {playlist.thumbnailUrl && (
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20 blur-3xl scale-150">
                <img src={playlist.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-end">
              <div className="w-48 h-48 md:w-64 md:h-64 flex-shrink-0 bg-background rounded-xl overflow-hidden shadow-2xl border border-border">
                {playlist.thumbnailUrl ? (
                  <img src={playlist.thumbnailUrl} alt={playlist.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <ListMusic className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 pb-2">
                <div className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Playlist</div>
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">{playlist.title}</h1>
                <p className="text-xl text-muted-foreground mb-4">{playlist.uploader}</p>
                
                <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
                  <span>{playlist.trackCount} tracks</span>
                </div>
              </div>
              
              <div className="flex-shrink-0 pb-4">
                <button className="flex items-center gap-3 px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold transition-all shadow-[0_0_30px_rgba(320,100%,55%,0.3)] hover:shadow-[0_0_40px_rgba(320,100%,55%,0.5)] hover:scale-105 active:scale-95">
                  <Play className="w-6 h-6 fill-current" />
                  Play All
                </button>
              </div>
            </div>
          </div>

          {/* Track List */}
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {playlist.tracks?.map((track) => (
                <TrackCard key={track.id} track={track} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import { useParams } from "wouter";
import { useGetPlaylist } from "@workspace/api-client-react";
import { TrackCard } from "@/components/TrackCard";
import { usePlayer } from "@/context/player-context";
import { Loader2, Play, ListMusic } from "lucide-react";

export default function PlaylistPage() {
  const { playlistId } = useParams();
  const { playTrack } = usePlayer();

  const { data: playlist, isLoading, error } = useGetPlaylist(
    playlistId ?? "",
    { query: { enabled: !!playlistId, queryKey: ["playlist", playlistId] } }
  );

  if (!playlistId) return null;

  const handlePlayAll = () => {
    if (!playlist?.tracks || playlist.tracks.length === 0) return;
    const q = playlist.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      uploader: t.uploader ?? null,
      thumbnailUrl: t.thumbnailUrl ?? null,
      duration: t.duration ?? null,
    }));
    playTrack(q[0]!, q);
  };

  return (
    <div className="min-h-full">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading playlist…</p>
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
          <div className="relative pt-20 pb-12 px-8 overflow-hidden bg-gradient-to-b from-primary/10 to-background border-b border-border">
            {playlist.thumbnailUrl && (
              <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20 blur-3xl scale-150">
                <img src={playlist.thumbnailUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="relative z-10 max-w-5xl mx-auto flex flex-col md:flex-row gap-8 items-end">
              <div className="w-44 h-44 md:w-56 md:h-56 flex-shrink-0 bg-background rounded-xl overflow-hidden shadow-2xl border border-border">
                {playlist.thumbnailUrl ? (
                  <img
                    src={playlist.thumbnailUrl}
                    alt={playlist.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <ListMusic className="w-14 h-14 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 pb-2">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Playlist</div>
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">{playlist.title}</h1>
                {playlist.uploader && (
                  <p className="text-lg text-muted-foreground mb-3">{playlist.uploader}</p>
                )}
                <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
                  <span>{playlist.trackCount} tracks</span>
                </div>
              </div>

              <div className="flex-shrink-0 pb-2">
                <button
                  onClick={handlePlayAll}
                  disabled={!playlist.tracks || playlist.tracks.length === 0}
                  className="flex items-center gap-3 px-7 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-bold transition-all shadow-[0_0_30px_rgba(236,72,153,0.3)] hover:shadow-[0_0_40px_rgba(236,72,153,0.5)] hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Play All
                </button>
              </div>
            </div>
          </div>

          {/* Track List */}
          <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="bg-secondary/20 border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                <span className="w-6 text-center">#</span>
                <span className="w-10" />
                <span className="flex-1">Title</span>
                <span className="hidden md:block w-16 text-right">Plays</span>
                <span className="w-10 text-right">Time</span>
              </div>
              {playlist.tracks?.map((track, i) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  variant="row"
                  index={i}
                  queue={playlist.tracks}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

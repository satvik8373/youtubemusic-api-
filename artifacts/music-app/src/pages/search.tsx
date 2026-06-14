import { useSearchTracks } from "@workspace/api-client-react";
import { TrackCard } from "@/components/TrackCard";
import { SearchBar } from "@/components/SearchBar";
import { Loader2, Music, LayoutGrid, List } from "lucide-react";
import { useState } from "react";

export default function SearchPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const searchParams = new URLSearchParams(window.location.search);
  const q = searchParams.get("q") ?? "";

  const { data: results, isLoading, error } = useSearchTracks(
    { q, limit: 30 },
    { query: { enabled: !!q, queryKey: ["search", q] } }
  );

  return (
    <div className="min-h-full p-6 max-w-5xl mx-auto">
      <div className="max-w-2xl mb-8 mt-6">
        <h1 className="text-3xl font-bold mb-6">Search</h1>
        <SearchBar autoFocus={!q} />
      </div>

      {!q ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-5">
            <Music className="w-9 h-9 opacity-20" />
          </div>
          <h3 className="text-xl font-medium text-foreground">What do you want to listen to?</h3>
          <p className="mt-2 text-sm">Search for artists, songs, or playlists.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
          Search failed. Please try again.
        </div>
      ) : !results || results.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-muted-foreground">
          <h3 className="text-xl font-medium text-foreground">No results for "{q}"</h3>
          <p className="mt-2 text-sm">Try different keywords.</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">
              Results for <span className="text-primary">"{q}"</span>
              <span className="ml-2 text-sm font-normal text-muted-foreground">{results.length} tracks</span>
            </h2>
            <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-1 border border-border">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
              {results.map((track) => (
                <TrackCard key={track.id} track={track} queue={results} />
              ))}
            </div>
          ) : (
            <div className="bg-secondary/20 border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2 border-b border-border text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                <span className="w-6 text-center">#</span>
                <span className="w-10" />
                <span className="flex-1">Title</span>
                <span className="hidden md:block w-16 text-right">Plays</span>
                <span className="w-10 text-right">Time</span>
              </div>
              {results.map((track, i) => (
                <TrackCard key={track.id} track={track} variant="row" index={i} queue={results} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

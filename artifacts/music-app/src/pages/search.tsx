import { useSearchTracks } from "@workspace/api-client-react";
import { TrackCard } from "@/components/TrackCard";
import { SearchBar } from "@/components/SearchBar";
import { useLocation } from "wouter";
import { Loader2, Music } from "lucide-react";

export default function SearchPage() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const q = searchParams.get("q") || "";

  const { data: results, isLoading, error } = useSearchTracks(
    { q, limit: 30 },
    { query: { enabled: !!q, queryKey: ["search", q] } }
  );

  return (
    <div className="min-h-full p-8 max-w-7xl mx-auto">
      <div className="max-w-2xl mb-12 mt-8">
        <h1 className="text-4xl font-bold mb-8">Search</h1>
        <SearchBar />
      </div>

      {!q ? (
        <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
          <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center mb-6">
            <Music className="w-10 h-10 opacity-20" />
          </div>
          <h3 className="text-xl font-medium text-foreground">What do you want to listen to?</h3>
          <p className="mt-2">Search for artists, songs, or podcasts.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
          Failed to load search results.
        </div>
      ) : !results || results.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center text-muted-foreground">
          <h3 className="text-xl font-medium text-foreground">No results found for "{q}"</h3>
          <p className="mt-2">Try searching for something else.</p>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold mb-6">Top Results for "{q}"</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {results.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

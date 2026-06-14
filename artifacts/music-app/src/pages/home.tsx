import { useGetTrending } from "@workspace/api-client-react";
import { TrackCard } from "@/components/TrackCard";
import { SearchBar } from "@/components/SearchBar";
import { Loader2 } from "lucide-react";

export default function HomePage() {
  const { data: trendingTracks, isLoading, error } = useGetTrending({ limit: 24 }, { query: { queryKey: ["trending"] } });

  return (
    <div className="min-h-full">
      {/* Hero Section */}
      <div className="relative pt-20 pb-32 px-8 overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614149162883-504ce4d1ed38?q=80&w=2000')] opacity-5 bg-cover bg-center mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
        
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
            Find <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Any Sound</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mb-12">
            The deepest catalog in the universe. Live streamed directly to your browser.
          </p>
          <SearchBar />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Trending Now</h2>
            <p className="text-muted-foreground mt-1">The pulse of the planet.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-8 text-center bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
            Failed to load trending tracks.
          </div>
        ) : !trendingTracks || trendingTracks.length === 0 ? (
          <div className="p-16 text-center text-muted-foreground bg-secondary/30 rounded-xl border border-border">
            No trending tracks available right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {trendingTracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

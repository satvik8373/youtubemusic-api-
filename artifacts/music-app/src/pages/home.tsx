import { useGetTrending } from "@workspace/api-client-react";
import { TrackCard } from "@/components/TrackCard";
import { SearchBar } from "@/components/SearchBar";
import { Loader2, LayoutGrid, List } from "lucide-react";
import { useState } from "react";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { data: trendingTracks, isLoading, error } = useGetTrending(
    { limit: 24 },
    { query: { queryKey: ["trending"] } }
  );

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative pt-16 pb-28 px-8 overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614149162883-504ce4d1ed38?q=80&w=2000')] opacity-5 bg-cover bg-center mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-5">
            Find{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Any Sound
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mb-10">
            Stream millions of tracks. Powered by yt-dlp.
          </p>
          <SearchBar size="large" />
        </div>
      </div>

      {/* Trending */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Trending Now</h2>
            <p className="text-muted-foreground text-sm mt-0.5">The pulse of the planet.</p>
          </div>
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

        {isLoading ? (
          <div className="flex justify-center py-24">
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
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {trendingTracks.map((track) => (
              <TrackCard key={track.id} track={track} queue={trendingTracks} />
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
            {trendingTracks.map((track, i) => (
              <TrackCard key={track.id} track={track} variant="row" index={i} queue={trendingTracks} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

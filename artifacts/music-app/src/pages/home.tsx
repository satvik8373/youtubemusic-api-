import { useGetHomeFeed, type HomeSection } from "@workspace/api-client-react";
import { TrackCard } from "@/components/TrackCard";
import { SearchBar } from "@/components/SearchBar";
import { ArrowDown, ArrowUpRight, Compass, LayoutGrid, List, RefreshCw, Sparkles, Server } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";

function FeedSkeleton() {
  return (
    <div className="space-y-12" aria-label="Loading music rooms" data-testid="status-home-loading">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-7 w-60 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-80 max-w-[70vw] animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="hidden h-8 w-24 animate-pulse rounded-full bg-muted sm:block" />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((__, cardIndex) => (
              <div key={cardIndex} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="aspect-video animate-pulse bg-muted" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyRoom({ section }: { section: HomeSection }) {
  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 text-center"
      data-testid={`empty-section-${section.id}`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-secondary-foreground">
        <Compass className="h-4 w-4" />
      </div>
      <p className="font-display text-lg font-semibold text-foreground">This room is between songs.</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Nothing landed for this mood just yet. Try another room while the feed catches up.
      </p>
    </div>
  );
}

function SectionHeading({ section, index }: { section: HomeSection; index: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span data-testid={`text-section-kicker-${section.id}`}>Room {String(index + 1).padStart(2, "0")}</span>
          <span className="text-muted-foreground">/</span>
          <span className="truncate text-muted-foreground">{section.query}</span>
        </div>
        <h2
          className="font-display text-2xl font-semibold tracking-[-0.035em] text-foreground sm:text-3xl"
          data-testid={`text-section-title-${section.id}`}
        >
          {section.title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground" data-testid={`text-section-subtitle-${section.id}`}>
          {section.subtitle}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground sm:self-auto">
        <span className="font-mono text-foreground">{section.tracks.length}</span>
        <span>{section.tracks.length === 1 ? "track" : "tracks"}</span>
        <ArrowUpRight className="ml-1 h-3.5 w-3.5 text-primary" />
      </div>
    </div>
  );
}

function SectionTracks({ section, viewMode }: { section: HomeSection; viewMode: "grid" | "list" }) {
  if (section.tracks.length === 0) return <EmptyRoom section={section} />;

  if (viewMode === "list") {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card/50" data-testid={`list-section-${section.id}`}>
        <div className="hidden items-center gap-3 border-b border-border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:flex">
          <span className="w-6 text-center">No.</span>
          <span className="w-10" />
          <span className="flex-1">Track</span>
          <span className="hidden w-16 text-right md:block">Plays</span>
          <span className="w-10 text-right">Time</span>
        </div>
        {section.tracks.map((track, trackIndex) => (
          <TrackCard
            key={`${section.id}-${track.id}`}
            track={track}
            variant="row"
            index={trackIndex}
            queue={section.tracks}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" data-testid={`grid-section-${section.id}`}>
      {section.tracks.map((track) => (
        <TrackCard key={`${section.id}-${track.id}`} track={track} queue={section.tracks} />
      ))}
    </div>
  );
}

export default function HomePage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { data: feed, isLoading, isFetching, error, refetch } = useGetHomeFeed({
    query: { queryKey: ["home-feed"] },
  });

  const totalTracks = useMemo(
    () => feed?.sections.reduce((total, section) => total + section.tracks.length, 0) ?? 0,
    [feed?.sections],
  );
  const roomsWithTracks = useMemo(
    () => feed?.sections.filter((section) => section.tracks.length > 0).length ?? 0,
    [feed?.sections],
  );

  const scrollToRoom = (id: string) => {
    document.getElementById(`room-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background">
      <section className="home-grain relative isolate overflow-hidden border-b border-border bg-[#f4e8d3]">
        <div className="absolute -right-24 -top-32 -z-10 h-80 w-80 rounded-full bg-secondary/70 blur-3xl" />
        <div className="absolute -bottom-40 left-[32%] -z-10 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[15%] top-20 -z-10 hidden h-40 w-40 rounded-full border border-primary/20 md:block" />
        <div className="absolute right-[18.5%] top-24 -z-10 hidden h-32 w-32 rounded-full border border-primary/15 md:block" />

        <div className="mx-auto max-w-7xl px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14 lg:px-10 lg:pt-16">
          <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
            <div className="home-rise">
              <div className="mb-6 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/50 px-3 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  Live listening room
                </span>
                <span className="text-muted-foreground">India / {feed?.region ?? "everywhere"}</span>
                <Link href="/endpoints">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer shadow-sm">
                    <Server className="h-3 w-3" />
                    <span>API Server Endpoints</span>
                  </span>
                </Link>
              </div>
              <h1 className="max-w-4xl font-display text-[3.5rem] font-semibold leading-[0.9] tracking-[-0.065em] text-foreground sm:text-7xl lg:text-[6.6rem]">
                Sound moves
                <span className="block text-primary">in many directions.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                A daily mix of the songs, scenes, and moods making noise across India. Start with a language, a feeling, or the song you cannot stop replaying.
              </p>
              <div className="mt-8">
                <SearchBar size="large" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2" data-testid="home-room-shortcuts">
                {(feed?.sections ?? []).slice(0, 4).map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToRoom(section.id)}
                    className="rounded-full border border-border/80 bg-background/45 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    data-testid={`button-shortcut-${section.id}`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="home-rise home-rise-delay-2 relative hidden min-h-[270px] lg:block" aria-hidden="true">
              <div className="absolute inset-x-2 bottom-0 top-5 rounded-[2rem] border border-foreground/10 bg-foreground/[0.04] p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  <span>Today&apos;s signal</span>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="absolute inset-x-5 bottom-9 flex h-36 items-end gap-1.5">
                  {[38, 66, 48, 88, 57, 100, 72, 44, 80, 54, 92, 62, 76, 42, 68, 50, 84, 60, 96, 46].map((height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t-full bg-primary/80 transition-transform duration-500 hover:-translate-y-2"
                      style={{ height: `${height}%`, opacity: 0.35 + (index % 4) * 0.15 }}
                    />
                  ))}
                </div>
                <div className="absolute inset-x-5 bottom-5 flex items-center justify-between border-t border-foreground/10 pt-3 font-mono text-[9px] text-muted-foreground">
                  <span>08:17</span>
                  <span>24 rooms in rotation</span>
                </div>
              </div>
              <div className="absolute -right-3 top-0 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg shadow-primary/20">
                New sounds, daily
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 pb-28 pt-10 sm:px-8 sm:pt-14 lg:px-10">
        <div className="mb-10 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="home-rise home-rise-delay-1">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Your discovery board</p>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.045em] sm:text-4xl" data-testid="text-feed-heading">
              Pick a room. Press play.
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {feed ? `${roomsWithTracks} rooms are humming with ${totalTracks} tracks from ${feed.region}.` : "Loading the rooms that are moving today."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:block">
              {isFetching && !isLoading ? "Tuning the feed…" : "Browse by room"}
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1" aria-label="Choose track view">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-lg p-2 transition-colors ${viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Show track cards"
                aria-pressed={viewMode === "grid"}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-lg p-2 transition-colors ${viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                aria-label="Show track list"
                aria-pressed={viewMode === "list"}
                data-testid="button-view-list"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <FeedSkeleton />
        ) : error ? (
          <div className="relative overflow-hidden rounded-3xl border border-destructive/20 bg-destructive/5 px-6 py-14 text-center" data-testid="status-home-error">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <RefreshCw className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-semibold text-foreground">The room went quiet.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              We could not tune into the home feed right now. Give it another try; your saved listening experience is still here.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
              data-testid="button-retry-home"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : !feed || feed.sections.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-16 text-center" data-testid="status-home-empty">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <ArrowDown className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-semibold">No rooms are open yet.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              The discovery board is waiting for its first signal. Refresh in a moment to hear what is moving across India.
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50 hover:text-primary"
              data-testid="button-refresh-empty-home"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh board
            </button>
          </div>
        ) : (
          <div className="space-y-14">
            {feed.sections.map((section, index) => (
              <section
                key={section.id}
                id={`room-${section.id}`}
                className="home-rise scroll-mt-8 space-y-5"
                style={{ animationDelay: `${Math.min(index * 0.07, 0.35)}s` }}
                data-testid={`section-home-${section.id}`}
              >
                <SectionHeading section={section} index={index} />
                <SectionTracks section={section} viewMode={viewMode} />
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
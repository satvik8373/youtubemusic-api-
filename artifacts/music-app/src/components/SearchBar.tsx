import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, X, Loader2 } from "lucide-react";
import { useSearchTracks } from "@workspace/api-client-react";
import { usePlayer } from "@/context/player-context";
import { useDebounce } from "@/lib/use-debounce";
import { formatDuration } from "@/lib/format";

interface SearchBarProps {
  autoFocus?: boolean;
  size?: "default" | "large";
}

export function SearchBar({ autoFocus = false, size = "default" }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { playTrack } = usePlayer();

  const debouncedQuery = useDebounce(query, 300);

  const { data: suggestions, isLoading } = useSearchTracks(
    { q: debouncedQuery, limit: 6 },
    { query: { enabled: debouncedQuery.length >= 2, queryKey: ["suggestions", debouncedQuery] } }
  );

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setOpen(false);
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelect = (track: NonNullable<typeof suggestions>[number]) => {
    setOpen(false);
    setQuery("");
    playTrack({
      id: track.id,
      title: track.title,
      uploader: track.uploader ?? null,
      thumbnailUrl: track.thumbnailUrl ?? null,
      duration: track.duration ?? null,
      viewCount: track.viewCount ?? null,
    });
    setLocation(`/track/${track.id}`);
  };

  const showDropdown = open && debouncedQuery.length >= 2;
  const isLarge = size === "large";

  return (
    <div ref={wrapperRef} className={`relative w-full ${isLarge ? "max-w-2xl" : "max-w-xl"}`}>
      <form onSubmit={handleSubmit} className="group relative">
        <div className={`absolute inset-y-0 left-0 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors ${isLarge ? "pl-5" : "pl-4"}`}>
          {isLoading && debouncedQuery.length >= 2 ? (
            <Loader2 className={`animate-spin ${isLarge ? "h-5 w-5" : "h-4 w-4"}`} />
          ) : (
            <Search className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tracks, artists…"
          className={`block w-full bg-secondary/60 border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all backdrop-blur-md ${
            isLarge ? "pl-12 pr-12 py-4 text-base" : "pl-10 pr-10 py-2.5 text-sm"
          } ${showDropdown ? "rounded-t-full rounded-b-none border-b-transparent rounded-bl-none rounded-br-none" : "rounded-full"}`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          data-testid="input-search"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            className={`absolute inset-y-0 right-0 flex items-center text-muted-foreground hover:text-foreground transition-colors ${isLarge ? "pr-5" : "pr-4"}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 z-50 bg-popover border border-border border-t-0 rounded-b-2xl shadow-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          ) : !suggestions || suggestions.length === 0 ? (
            <div className="py-4 px-4 text-sm text-muted-foreground text-center">
              No results for "{debouncedQuery}"
            </div>
          ) : (
            <ul>
              {suggestions.map((track) => (
                <li key={track.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/70 transition-colors text-left group/item"
                    onClick={() => handleSelect(track)}
                  >
                    <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0 border border-border">
                      <img src={track.thumbnailUrl ?? ""} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1 group-hover/item:text-primary transition-colors">
                        {track.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{track.uploader}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                      {formatDuration(track.duration)}
                    </span>
                  </button>
                </li>
              ))}
              <li className="border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setLocation(`/search?q=${encodeURIComponent(debouncedQuery)}`);
                  }}
                  className="w-full px-4 py-2.5 text-sm text-primary hover:bg-secondary/50 transition-colors text-left flex items-center gap-2"
                >
                  <Search className="w-3.5 h-3.5" />
                  See all results for "{debouncedQuery}"
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

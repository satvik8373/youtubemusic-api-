import { Link } from "wouter";
import { Search } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setLocation(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-xl group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
        <Search className="h-5 w-5" />
      </div>
      <input
        type="search"
        placeholder="Search for tracks, artists..."
        className="block w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border rounded-full text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all backdrop-blur-md"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-testid="input-search"
      />
    </form>
  );
}

import { Link, useLocation } from "wouter";
import { Home, Search, Disc3, ListMusic, Server } from "lucide-react";
import { BottomPlayer } from "./BottomPlayer";
import { usePlayer } from "@/context/player-context";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { currentTrack, queue } = usePlayer();

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/search", label: "Search", icon: Search },
    { href: "/endpoints", label: "API Endpoints", icon: Server },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground selection:bg-primary/30">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar/95 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_12px_rgba(236,72,153,0.5)]">
            <Disc3 className="text-white h-4 w-4 animate-spin-slow" />
          </div>
          <span className="font-bold tracking-tight text-lg bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            SONIC
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  location === item.href
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </header>

      {/* Desktop Sidebar */}
      <aside
        className="w-60 flex-shrink-0 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col"
        style={{ paddingBottom: currentTrack ? 80 : 0 }}
      >
        <div className="p-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.5)]">
            <Disc3 className="text-white h-5 w-5" />
          </div>
          <h1 className="font-bold tracking-tight text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            SONIC
          </h1>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
            Discover
          </p>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  location === item.href
                    ? "bg-sidebar-accent text-primary shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

        {queue.length > 0 && (
          <div className="px-3 mt-4 flex-1 overflow-hidden flex flex-col min-h-0 border-t border-sidebar-border pt-4">
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 flex items-center gap-2">
              <ListMusic className="w-3.5 h-3.5" />
              Queue ({queue.length})
            </p>
            <div className="overflow-y-auto flex-1 space-y-0.5 pr-1">
              {queue.map((t, i) => (
                <div
                  key={`${t.id}-${i}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sidebar-accent cursor-pointer transition-colors group"
                >
                  <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0 border border-border/50">
                    <img src={t.thumbnailUrl ?? ""} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium line-clamp-1 text-sidebar-foreground group-hover:text-primary transition-colors">
                      {t.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{t.uploader}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden">
        <div
          className="flex-1 overflow-y-auto"
          style={{ paddingBottom: currentTrack ? 80 : 0 }}
        >
          {children}
        </div>
      </main>

      <BottomPlayer />
    </div>
  );
}

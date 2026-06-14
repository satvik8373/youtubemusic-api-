import { Link, useLocation } from "wouter";
import { Home, Search, Library, Disc3, Settings } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/search", label: "Search", icon: Search },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_15px_rgba(320,100%,55%,0.5)]">
            <Disc3 className="text-white h-5 w-5" />
          </div>
          <h1 className="font-bold tracking-tight text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            SONIC
          </h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          <div className="mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Discover</div>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div 
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  location === item.href 
                    ? "bg-sidebar-primary/10 text-sidebar-primary shadow-[inset_2px_0_0_0_hsl(var(--sidebar-primary))]" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 max-h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

import { useLocation, Link } from "wouter";
import {
  Home,
  MessageSquare,
  Newspaper,
  ClipboardList,
  BarChart3,
  Shield,
  Settings,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

const navItems = [
  { path: "/", label: "首页", icon: Home },
  { path: "/chat", label: "AI对话", icon: MessageSquare },
  { path: "/news", label: "新闻", icon: Newspaper },
  { path: "/plan", label: "计划", icon: ClipboardList },
  { path: "/chart", label: "图表", icon: BarChart3 },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();

  // Admin and Risk pages don't show bottom nav
  const isFullPage = location === "/admin";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
              <span className="text-primary text-xs font-bold">Au</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              XAUUSD <span className="text-primary">Agent</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/risk">
              <button className={`p-2 rounded-lg transition-colors ${
                location === "/risk" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}>
                <Shield className="w-4 h-4" />
              </button>
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin">
                <button className={`p-2 rounded-lg transition-colors ${
                  location === "/admin" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`}>
                  <Settings className="w-4 h-4" />
                </button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16">
        {children}
      </main>

      {/* Bottom Navigation - Mobile App Style */}
      {!isFullPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-sm safe-area-bottom">
          <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <button className="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors">
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

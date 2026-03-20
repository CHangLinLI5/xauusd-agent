import { useLocation, Link } from "wouter";
import {
  Home,
  MessageSquare,
  Newspaper,
  ClipboardList,
  BarChart3,
  Shield,
  Settings,
  Activity,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { motion, AnimatePresence } from "framer-motion";

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
  const { data: quote } = trpc.market.quote.useQuery(undefined, {
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10000,
  });

  const isFullPage = location === "/admin";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header - Professional Trading Terminal Style */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center justify-between px-4 h-13">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center border border-gold/20">
              <span className="text-gradient-gold text-[11px] font-bold tracking-tight">Au</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold tracking-tight leading-tight">
                XAUUSD <span className="text-gold">Agent</span>
              </span>
              <span className="text-[9px] text-muted-foreground leading-tight tracking-wider uppercase">
                Gold Trading System
              </span>
            </div>
          </div>

          {/* Live Price Ticker in Header */}
          <div className="flex items-center gap-3">
            {quote && quote.price > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface/50 border border-border/30">
                <div className="status-dot status-dot-green" />
                <span className="text-xs font-mono font-medium">
                  {quote.price.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono font-medium ${
                  quote.change >= 0 ? "text-green" : "text-red"
                }`}>
                  {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Link href="/risk">
                <button className={`p-2 rounded-lg transition-all duration-200 ${
                  location === "/risk"
                    ? "text-gold bg-gold/10 shadow-[0_0_12px_oklch(0.78_0.14_80/0.15)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                }`}>
                  <Shield className="w-[18px] h-[18px]" />
                </button>
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin">
                  <button className={`p-2 rounded-lg transition-all duration-200 ${
                    location === "/admin"
                      ? "text-gold bg-gold/10 shadow-[0_0_12px_oklch(0.78_0.14_80/0.15)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                  }`}>
                    <Settings className="w-[18px] h-[18px]" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-18">
        {children}
      </main>

      {/* Bottom Navigation - Premium App Style */}
      {!isFullPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border/20 safe-area-bottom">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <button className="relative flex flex-col items-center gap-1 px-4 py-1.5 transition-all duration-200">
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-gradient-to-r from-gold/0 via-gold to-gold/0"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <div className={`relative p-1 rounded-lg transition-all duration-200 ${
                      isActive ? "text-gold" : "text-muted-foreground"
                    }`}>
                      <Icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.2 : 1.8} />
                      {isActive && (
                        <div className="absolute inset-0 rounded-lg bg-gold/8 blur-sm" />
                      )}
                    </div>
                    <span className={`text-[10px] font-medium transition-all duration-200 ${
                      isActive ? "text-gold" : "text-muted-foreground"
                    }`}>
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

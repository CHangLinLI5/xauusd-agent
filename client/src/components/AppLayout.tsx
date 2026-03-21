import { useLocation, Link } from "wouter";
import {
  Home,
  MessageSquare,
  Newspaper,
  ClipboardList,
  BarChart3,
  Shield,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";

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
  const isMobile = useIsMobile();

  // WebSocket realtime quote (primary)
  const ws = useMarketSocket();

  // tRPC fallback only when WebSocket is not connected and no data
  const shouldFallback = !ws.isConnected && !ws.quote;
  const { data: fallbackQuote } = trpc.market.quote.useQuery(undefined, {
    enabled: shouldFallback,
    refetchInterval: shouldFallback ? 15000 : false,
    staleTime: 10000,
  });

  const quote = ws.quote ?? fallbackQuote;

  const isFullPage = location === "/admin";

  // ===== Desktop Layout =====
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Desktop Sidebar */}
        <aside className="sticky top-0 h-screen w-56 flex flex-col border-r border-border/40 bg-card/60 backdrop-blur-sm shrink-0">
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border/30">
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

          {/* Live Price in Sidebar */}
          {quote && quote.price > 0 && (
            <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-surface/60 border border-border/30">
              <div className="flex items-center gap-1.5 mb-1">
                {ws.isConnected ? (
                  <Wifi className="w-3 h-3 text-green/70" />
                ) : (
                  <WifiOff className="w-3 h-3 text-gold/70" />
                )}
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {ws.isConnected ? "实时" : "延迟"}
                </span>
              </div>
              <div className="text-lg font-mono font-bold tracking-tight">
                {quote.price.toFixed(2)}
              </div>
              <span className={`text-xs font-mono font-medium ${
                quote.change >= 0 ? "text-green" : "text-red"
              }`}>
                {quote.change >= 0 ? "+" : ""}{quote.change.toFixed(2)} ({quote.changePercent?.toFixed(2) ?? "0.00"}%)
              </span>
            </div>
          )}

          {/* Nav Items */}
          <nav className="flex-1 mt-3 px-2 space-y-0.5">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-gold/12 text-gold border border-gold/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                  }`}>
                    <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="px-2 pb-3 space-y-0.5">
            <Link href="/risk">
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                location === "/risk"
                  ? "bg-gold/12 text-gold border border-gold/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
              }`}>
                <Shield className="w-[18px] h-[18px]" />
                风控中心
              </div>
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin">
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  location === "/admin"
                    ? "bg-gold/12 text-gold border border-gold/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                }`}>
                  <Settings className="w-[18px] h-[18px]" />
                  后台配置
                </div>
              </Link>
            )}
          </div>
        </aside>

        {/* Desktop Main Content */}
        <main className="flex-1 overflow-y-auto min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  // ===== Mobile Layout =====
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header - Mobile */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/30">
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
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-surface/50 border border-border/30">
                {ws.isConnected ? (
                  <Wifi className="w-3 h-3 text-green/70" />
                ) : (
                  <WifiOff className="w-3 h-3 text-gold/70" />
                )}
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
                    ? "text-gold bg-gold/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                }`}>
                  <Shield className="w-[18px] h-[18px]" />
                </button>
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin">
                  <button className={`p-2 rounded-lg transition-all duration-200 ${
                    location === "/admin"
                      ? "text-gold bg-gold/10"
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

      {/* Bottom Navigation - Mobile Only */}
      {!isFullPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-t border-border/20 safe-area-bottom">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <button className="relative flex flex-col items-center gap-1 px-4 py-1.5 transition-all duration-200">
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-gold" />
                    )}
                    <div className={`relative p-1 rounded-lg transition-all duration-200 ${
                      isActive ? "text-gold" : "text-muted-foreground"
                    }`}>
                      <Icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.2 : 1.8} />
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

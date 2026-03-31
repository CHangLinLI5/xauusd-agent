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
  User,
  TrendingUp,
  TrendingDown,
  Info,
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
    refetchInterval: shouldFallback ? 5000 : false,
    staleTime: 3000,
  });

  const quote = ws.quote ?? fallbackQuote;
  const priceUp = (quote?.change ?? 0) >= 0;

  const isFullPage = location === "/admin";

  // ===== Desktop Layout =====
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Desktop Sidebar */}
        <aside className="sticky top-0 h-screen w-[220px] flex flex-col border-r border-border/30 bg-sidebar shrink-0">
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-5 h-16 border-b border-border/20">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold/30 via-gold/20 to-gold/5 flex items-center justify-center border border-gold/25 shadow-[0_0_10px_rgba(240,192,64,0.08)]">
              <img src="/logo.png" alt="GoldBias" className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold tracking-tight leading-tight">
                Gold<span className="text-gold">Bias</span>
              </span>
              <span className="text-[9px] text-muted-foreground/60 leading-tight tracking-[0.12em]">
                结构化交易助手
              </span>
            </div>
          </div>

          {/* Live Price Widget */}
          {quote && quote.price > 0 && (
            <div className="mx-3 mt-4 px-3.5 py-3 rounded-xl bg-surface/70 border border-border/25 breathing-glow">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  {ws.isConnected ? (
                    <div className="status-dot status-dot-green" />
                  ) : (
                    <div className="status-dot status-dot-gold animate-pulse" />
                  )}
                  <span className="text-[10px] text-muted-foreground/70 uppercase tracking-[0.15em] font-medium">
                    XAU/USD
                  </span>
                </div>
                <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-gold/8 text-gold/60 font-semibold tracking-wider">
                  SPOT
                </span>
              </div>
              <div className="text-xl font-mono font-bold tracking-tight leading-none">
                {quote.price.toFixed(2)}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                {priceUp ? (
                  <TrendingUp className="w-3 h-3 text-green" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red" />
                )}
                <span className={`text-[11px] font-mono font-semibold ${priceUp ? "text-green" : "text-red"}`}>
                  {priceUp ? "+" : ""}{quote.change.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${priceUp ? "bg-green/10 text-green" : "bg-red/10 text-red"}`}>
                  {priceUp ? "+" : ""}{quote.changePercent?.toFixed(2) ?? "0.00"}%
                </span>
              </div>
            </div>
          )}

          {/* Nav Items */}
          <nav className="flex-1 mt-4 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-250 press-scale ${
                    isActive
                      ? "bg-gold/10 text-gold border border-gold/15 shadow-[0_0_12px_rgba(240,192,64,0.05)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface/70 border border-transparent"
                  }`}>
                    <Icon className="w-[18px] h-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                    {item.label}
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_6px_rgba(240,192,64,0.4)]" />
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="px-3 pb-4 space-y-1 border-t border-border/15 pt-3 mt-2">
            <Link href="/risk">
              <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-250 press-scale ${
                location === "/risk"
                  ? "bg-gold/10 text-gold border border-gold/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/70 border border-transparent"
              }`}>
                <Shield className="w-[18px] h-[18px]" />
                风控中心
              </div>
            </Link>
            {user?.role === "admin" && (
              <Link href="/admin">
                <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-250 press-scale ${
                  location === "/admin"
                    ? "bg-gold/10 text-gold border border-gold/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/70 border border-transparent"
                }`}>
                  <Settings className="w-[18px] h-[18px]" />
                  后台配置
                </div>
              </Link>
            )}

            <Link href="/about">
              <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-250 press-scale ${
                location === "/about"
                  ? "bg-gold/10 text-gold border border-gold/15"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface/70 border border-transparent"
              }`}>
                <Info className="w-[18px] h-[18px]" />
                关于
              </div>
            </Link>

            {/* User Profile */}
            {user ? (
              <Link href="/profile">
                <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-250 press-scale ${
                  location === "/profile"
                    ? "bg-gold/10 text-gold border border-gold/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/70 border border-transparent"
                }`}>
                  <div className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-gold/40 to-gold/15 flex items-center justify-center text-[8px] font-bold text-gold">
                    {(user.name || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="truncate">{user.name || "个人中心"}</span>
                </div>
              </Link>
            ) : (
              <Link href="/login">
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface/70 transition-all duration-250 press-scale border border-transparent">
                  <User className="w-[18px] h-[18px]" />
                  登录
                </div>
              </Link>
            )}
          </div>
        </aside>

        {/* Desktop Main Content */}
        <main className="flex-1 overflow-y-auto min-h-screen">
          <div className="page-enter">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // ===== Mobile Layout =====
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header - Mobile */}
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-lg border-b border-border/20">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-gold/30 via-gold/20 to-gold/5 flex items-center justify-center border border-gold/25 shadow-[0_0_10px_rgba(240,192,64,0.06)]">
              <img src="/logo.png" alt="GoldBias" className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[13px] font-bold tracking-tight leading-tight">
                Gold<span className="text-gold">Bias</span>
              </span>
              <span className="text-[8px] text-muted-foreground/50 leading-tight tracking-[0.12em]">
                结构化交易助手
              </span>
            </div>
          </div>

          {/* Live Price + Actions */}
          <div className="flex items-center gap-2.5">
            {quote && quote.price > 0 && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface/60 border border-border/25">
                {ws.isConnected ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-green shadow-[0_0_4px_rgba(0,200,100,0.4)]" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                )}
                <span className="text-xs font-mono font-bold tracking-tight">
                  {quote.price.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono font-semibold ${priceUp ? "text-green" : "text-red"}`}>
                  {priceUp ? "+" : ""}{quote.change.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-0.5">
              <Link href="/risk">
                <button className={`p-2 rounded-lg transition-all duration-200 press-scale ${
                  location === "/risk"
                    ? "text-gold bg-gold/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                }`}>
                  <Shield className="w-[18px] h-[18px]" />
                </button>
              </Link>
              {user?.role === "admin" && (
                <Link href="/admin">
                  <button className={`p-2 rounded-lg transition-all duration-200 press-scale ${
                    location === "/admin"
                      ? "text-gold bg-gold/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                  }`}>
                    <Settings className="w-[18px] h-[18px]" />
                  </button>
                </Link>
              )}
              {user ? (
                <Link href="/profile">
                  <button className={`p-1.5 rounded-lg transition-all duration-200 ${
                    location === "/profile" ? "ring-2 ring-gold/30" : ""
                  }`}>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold/40 to-gold/15 flex items-center justify-center text-[9px] font-bold text-gold border border-gold/20">
                      {(user.name || "U").slice(0, 1).toUpperCase()}
                    </div>
                  </button>
                </Link>
              ) : (
                <Link href="/login">
                  <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-all duration-200 press-scale">
                    <User className="w-[18px] h-[18px]" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="page-enter">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile */}
      {!isFullPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-t border-border/15 safe-area-bottom">
          <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
            {navItems.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link key={item.path} href={item.path}>
                  <button className="relative flex flex-col items-center gap-0.5 px-4 py-1.5 transition-all duration-250 press-scale">
                    {/* Active indicator line */}
                    <div className={`absolute -top-[1px] left-1/2 -translate-x-1/2 h-[2px] rounded-full bg-gold transition-all duration-300 ${
                      isActive ? "w-8 opacity-100" : "w-0 opacity-0"
                    }`} />
                    <div className={`relative p-1.5 rounded-xl transition-all duration-250 ${
                      isActive ? "text-gold bg-gold/8" : "text-muted-foreground"
                    }`}>
                      <Icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2.2 : 1.8} />
                    </div>
                    <span className={`text-[10px] font-medium transition-all duration-250 ${
                      isActive ? "text-gold" : "text-muted-foreground/70"
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

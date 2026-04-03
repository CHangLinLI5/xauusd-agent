import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Streamdown } from "streamdown";
import { useIsMobile } from "@/hooks/useMobile";
import { formatTimeShortCN } from "@/lib/timeUtils";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Radio,
  Globe,
} from "lucide-react";

const CATEGORIES = [
  { key: "全部", icon: Globe },
  { key: "美联储", icon: Radio },
  { key: "CPI", icon: TrendingUp },
  { key: "非农", icon: Zap },
  { key: "央行购金", icon: TrendingUp },
  { key: "地缘政治", icon: Globe },
  { key: "美元指数", icon: TrendingDown },
  { key: "美债", icon: Minus },
  { key: "机构观点", icon: Zap },
];

export default function News() {
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { data: news, isLoading } = trpc.market.news.useQuery();

  const filteredNews = news?.filter(
    (item) => selectedCategory === "全部" || item.category === selectedCategory
  );

  const containerClass = isMobile
    ? "px-4 py-5 max-w-lg mx-auto space-y-5"
    : "px-6 py-6 max-w-5xl mx-auto space-y-5";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red/15 to-red/5 flex items-center justify-center shrink-0">
            <Newspaper className="w-4 h-4 text-red" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">新闻中心</h1>
            <p className="text-[10px] text-muted-foreground">黄金相关财经资讯</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/50 border border-border/20 shrink-0">
          <div className="status-dot status-dot-green" style={{ width: 4, height: 4 }} />
          <span className="text-[10px] text-muted-foreground">实时更新</span>
        </div>
      </div>

      {/* Category Filter */}
      <div className="relative -mx-4">
        <div className="flex gap-3 overflow-x-auto pb-2 pt-2 scrollbar-none px-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                selectedCategory === cat.key
                  ? "bg-gold/15 text-gold border border-gold/20"
                  : "bg-surface/50 text-muted-foreground hover:text-foreground border border-border/10 hover:border-border/30"
              }`}
            >
              {cat.key}
            </button>
          ))}
          {/* Right spacer for scroll padding */}
          <div className="shrink-0 w-4" aria-hidden />
        </div>
        {/* Fade hint on right edge */}
        {isMobile && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        )}
      </div>

      {/* News List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold mb-3" />
          <span className="text-xs text-muted-foreground">加载新闻中...</span>
        </div>
      ) : (
        <div className={isMobile ? "space-y-2.5" : "grid grid-cols-2 gap-4"}>
          {filteredNews?.map((item) => (
            <div
              key={item.id}
              className="card-base rounded-xl overflow-hidden"
            >
              <div className="p-3.5">
                {/* Header Row */}
                <div className="flex items-start gap-3">
                  {/* Impact indicator bar */}
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${
                    item.impact === "bullish" ? "bg-green" :
                    item.impact === "bearish" ? "bg-red" : "bg-gold"
                  }`} />

                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className="text-[13px] font-semibold leading-snug mb-1.5">{item.title}</h3>

                    {/* Meta */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <span className="font-medium">{item.source}</span>
                      <span className="opacity-40">|</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {formatTimeShortCN(item.publishedAt)}
                      </span>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-foreground/70 leading-relaxed mb-2.5 line-clamp-2">
                      {item.summary}
                    </p>

                    {/* Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        item.impact === "bullish" ? "bg-green/10 text-green" :
                        item.impact === "bearish" ? "bg-red/10 text-red" : "bg-gold/10 text-gold"
                      }`}>
                        {item.impact === "bullish" ? <TrendingUp className="w-3 h-3" /> :
                         item.impact === "bearish" ? <TrendingDown className="w-3 h-3" /> :
                         <Minus className="w-3 h-3" />}
                        {item.impactLabel}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-elevated text-muted-foreground">
                        {item.category}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-md bg-cyan/8 text-cyan">
                        <Zap className="w-3 h-3" />
                        {item.rhythm}
                      </span>
                    </div>

                    {/* Expand Toggle */}
                    <button
                      className="flex items-center gap-1 text-[11px] text-gold/70 hover:text-gold mt-2.5 transition-colors"
                      onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    >
                      {expandedId === item.id ? (
                        <>收起详情 <ChevronUp className="w-3 h-3" /></>
                      ) : (
                        <>展开详情 <ChevronDown className="w-3 h-3" /></>
                      )}
                    </button>

                    {/* Expanded Content */}
                    {expandedId === item.id && (
                      <div className="mt-3 pt-3 border-t border-border/20">
                        <div className="text-xs leading-relaxed text-foreground/70 prose prose-invert prose-sm max-w-none [&_strong]:text-gold/80">
                          <Streamdown>{item.content}</Streamdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredNews?.length === 0 && (
            <div className={`text-center py-16 ${isMobile ? "" : "col-span-2"}`}>
              <Newspaper className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">暂无相关新闻</p>
              <p className="text-xs text-muted-foreground/60 mt-1">尝试切换其他分类</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

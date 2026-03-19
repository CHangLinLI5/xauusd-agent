import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
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
} from "lucide-react";

const CATEGORIES = ["全部", "美联储", "CPI", "非农", "地缘政治", "美元指数", "美债"];

export default function News() {
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: news, isLoading } = trpc.market.news.useQuery();

  const filteredNews = news?.filter(
    (item) => selectedCategory === "全部" || item.category === selectedCategory
  );

  const impactIcon = {
    bullish: <TrendingUp className="w-3.5 h-3.5" />,
    bearish: <TrendingDown className="w-3.5 h-3.5" />,
    neutral: <Minus className="w-3.5 h-3.5" />,
  };

  const impactColor = {
    bullish: "text-green border-green/30 bg-green/5",
    bearish: "text-red border-red/30 bg-red/5",
    neutral: "text-gold border-gold/30 bg-gold/5",
  };

  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Newspaper className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">新闻中心</h1>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* News List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNews?.map((item) => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="p-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium leading-tight mb-1">{item.title}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{item.source}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(item.publishedAt).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${impactColor[item.impact]}`}>
                    <span className="flex items-center gap-1 text-[10px]">
                      {impactIcon[item.impact]}
                      {item.impactLabel}
                    </span>
                  </Badge>
                </div>

                {/* Summary */}
                <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                  {item.summary}
                </p>

                {/* Impact Tags */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    <Zap className="w-3 h-3 mr-0.5" />
                    {item.rhythm}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {item.category}
                  </Badge>
                </div>

                {/* Expand/Collapse */}
                <button
                  className="flex items-center gap-1 text-[10px] text-primary mt-2"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  {expandedId === item.id ? (
                    <>
                      收起 <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      查看详情 <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>

                {expandedId === item.id && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="text-xs leading-relaxed text-muted-foreground">
                      <Streamdown>{item.content}</Streamdown>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {filteredNews?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无相关新闻</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

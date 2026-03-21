import {
  Shield,
  Ban,
  CheckCircle2,
  XCircle,
  Crosshair,
  Flame,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";

const FORBIDDEN_RULES = [
  { rule: "逆势加仓", desc: "趋势确认后不得在反方向加仓，亏损单不加仓", icon: "🚫" },
  { rule: "马丁策略", desc: "禁止使用任何形式的马丁格尔策略", icon: "⛔" },
  { rule: "锁仓", desc: "禁止锁仓操作，出现亏损应止损而非锁仓", icon: "🔒" },
  { rule: "扛单", desc: "到达止损位必须执行，不允许移动止损或扛单", icon: "❌" },
  { rule: "无止损交易", desc: "每笔交易必须设置止损，无止损不入场", icon: "🛑" },
  { rule: "随意放大杠杆", desc: "严格按照仓位管理规则，不得随意加大手数", icon: "⚠️" },
];

const ALLOWED_RULES = [
  { rule: "推保本", desc: "盈利达到一定点数后，将止损移至保本位" },
  { rule: "分批入场", desc: "在优质报价区可分批建仓，但总仓位不超过上限" },
  { rule: "提前减仓", desc: "接近目标位或重要数据前可提前减仓锁利" },
];

const CORE_PRINCIPLES = [
  { text: "所有技术分析服务于止损", highlight: true },
  { text: "不做也是交易", highlight: true },
  { text: "基本面 > 多周期 > 关键位 > 图形", highlight: false },
  { text: "数据前半小时不参与，整点最后10分钟不参与", highlight: false },
  { text: "亚盘定方向，欧盘确认，美盘执行", highlight: false },
  { text: "每日最大亏损不超过账户2%", highlight: false },
  { text: "单笔风险不超过账户1%", highlight: false },
  { text: "连续亏损3笔后强制休息", highlight: true },
];

const ACTION_LEVELS = [
  { level: "观望", color: "text-muted-foreground", bg: "bg-surface-elevated", border: "border-border/20", desc: "市场条件不满足系统要求" },
  { level: "等价格到位", color: "text-gold", bg: "bg-gold/8", border: "border-gold/15", desc: "方向明确但价格未到优质报价区" },
  { level: "等形态确认", color: "text-cyan", bg: "bg-cyan/8", border: "border-cyan/15", desc: "价格到位但尚未出现确认形态" },
  { level: "可轻仓尝试", color: "text-green", bg: "bg-green/8", border: "border-green/15", desc: "条件基本满足，可小仓位试单" },
];

export default function RiskControl() {
  const isMobile = useIsMobile();

  const containerClass = isMobile
    ? "px-4 py-5 max-w-lg mx-auto space-y-4"
    : "px-6 py-6 max-w-5xl mx-auto space-y-5";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red/15 to-red/5 flex items-center justify-center">
          <Shield className="w-4 h-4 text-red" />
        </div>
        <div>
          <h1 className="text-lg font-bold">风控中心</h1>
          <p className="text-[10px] text-muted-foreground">交易铁律 · 不可违背</p>
        </div>
      </div>

      {/* Core Warning */}
      <div className="card-base rounded-2xl p-4 border-red/15 relative overflow-hidden">
        <div className="relative">
          <div className="flex items-center gap-2 text-red mb-2.5">
            <Flame className="w-4 h-4" />
            <span className="text-sm font-bold">铁律提醒</span>
          </div>
          <p className="text-[13px] leading-relaxed text-foreground/80">
            风控是交易系统的<span className="text-red font-semibold">生命线</span>。所有技术分析、形态识别、关键位判断，最终都服务于一个目标：
            <span className="text-gold font-semibold">确定止损位置</span>。
            没有止损的交易等于赌博。
          </p>
        </div>
      </div>

      {/* Desktop: two-column layout */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-5"}>
        {/* Forbidden Rules */}
        <div className="card-base rounded-2xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
            <Ban className="w-4 h-4 text-red" />
            <span className="text-sm font-semibold">禁止行为</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red/10 text-red font-semibold ml-auto">
              绝对禁止
            </span>
          </div>
          <div className="px-3 pb-3.5 space-y-1.5">
            {FORBIDDEN_RULES.map((item) => (
              <div
                key={item.rule}
                className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-red/3 hover:bg-red/5 transition-colors"
              >
                <XCircle className="w-4 h-4 text-red/70 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{item.rule}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Allowed Rules */}
        <div className="card-base rounded-2xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green" />
            <span className="text-sm font-semibold">允许操作</span>
          </div>
          <div className="px-3 pb-3.5 space-y-1.5">
            {ALLOWED_RULES.map((item) => (
              <div
                key={item.rule}
                className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-green/3 hover:bg-green/5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-green/70 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] font-semibold text-foreground">{item.rule}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: two-column for action levels + principles */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-5"}>
        {/* Action Levels */}
        <div className="card-base rounded-2xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold">行动建议级别</span>
          </div>
          <div className="px-3 pb-3.5 space-y-1.5">
            {ACTION_LEVELS.map((item) => (
              <div
                key={item.level}
                className={`flex items-center gap-3 py-2.5 px-3 rounded-lg ${item.bg} border ${item.border}`}
              >
                <span className={`text-[12px] font-bold ${item.color} whitespace-nowrap`}>
                  {item.level}
                </span>
                <span className="text-[11px] text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Core Principles */}
        <div className="card-base rounded-2xl overflow-hidden border-gold/10">
          <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold">核心原则</span>
          </div>
          <div className="px-3 pb-3.5 space-y-1">
            {CORE_PRINCIPLES.map((p, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors ${
                  p.highlight ? "bg-gold/5" : "hover:bg-surface/50"
                }`}
              >
                <span className="text-gold/60 text-[11px] font-mono font-bold mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`text-[13px] leading-snug ${
                  p.highlight ? "font-semibold text-gold" : "text-foreground/80"
                }`}>
                  {p.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Spacer */}
      <div className="h-2" />
    </div>
  );
}

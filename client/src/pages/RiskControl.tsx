import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  AlertTriangle,
  Ban,
  CheckCircle2,
  XCircle,
  Info,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const FORBIDDEN_RULES = [
  { rule: "逆势加仓", desc: "趋势确认后不得在反方向加仓，亏损单不加仓" },
  { rule: "马丁策略", desc: "禁止使用任何形式的马丁格尔策略" },
  { rule: "锁仓", desc: "禁止锁仓操作，出现亏损应止损而非锁仓" },
  { rule: "扛单", desc: "到达止损位必须执行，不允许移动止损或扛单" },
  { rule: "无止损交易", desc: "每笔交易必须设置止损，无止损不入场" },
  { rule: "随意放大杠杆", desc: "严格按照仓位管理规则，不得随意加大手数" },
];

const ALLOWED_RULES = [
  { rule: "推保本", desc: "盈利达到一定点数后，将止损移至保本位" },
  { rule: "分批入场", desc: "在优质报价区可分批建仓，但总仓位不超过上限" },
  { rule: "提前减仓", desc: "接近目标位或重要数据前可提前减仓锁利" },
];

const CORE_PRINCIPLES = [
  "所有技术分析服务于止损",
  "不做也是交易",
  "基本面 > 多周期 > 关键位 > 图形",
  "数据前半小时不参与，整点最后10分钟不参与",
  "亚盘定方向，欧盘确认，美盘执行",
  "每日最大亏损不超过账户2%",
  "单笔风险不超过账户1%",
  "连续亏损3笔后强制休息",
];

const ACTION_LEVELS = [
  { level: "观望", color: "text-muted-foreground", bg: "bg-secondary/50", desc: "市场条件不满足系统要求" },
  { level: "等价格到位", color: "text-gold", bg: "bg-gold/10", desc: "方向明确但价格未到优质报价区" },
  { level: "等形态确认", color: "text-primary", bg: "bg-primary/10", desc: "价格到位但尚未出现确认形态" },
  { level: "可轻仓尝试", color: "text-green", bg: "bg-green/10", desc: "条件基本满足，可小仓位试单" },
];

export default function RiskControl() {
  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">风控中心</h1>
      </div>

      {/* Core Warning */}
      <Card className="border-red/20 bg-red/5">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-red mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-bold">铁律提醒</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            风控是交易系统的生命线。所有技术分析、形态识别、关键位判断，最终都服务于一个目标：<span className="text-foreground font-medium">确定止损位置</span>。
            没有止损的交易等于赌博。
          </p>
        </CardContent>
      </Card>

      {/* Forbidden Rules */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Ban className="w-4 h-4 text-red" />
            禁止行为
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            {FORBIDDEN_RULES.map((item) => (
              <div key={item.rule} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                <XCircle className="w-4 h-4 text-red shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{item.rule}</div>
                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Allowed Rules */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green" />
            允许操作
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            {ALLOWED_RULES.map((item) => (
              <div key={item.rule} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                <CheckCircle2 className="w-4 h-4 text-green shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-medium">{item.rule}</div>
                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Levels */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Info className="w-4 h-4 text-primary" />
            行动建议级别
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            {ACTION_LEVELS.map((item) => (
              <div key={item.level} className="flex items-center gap-2 py-1.5">
                <Badge className={`${item.bg} ${item.color} border-0 text-xs`}>
                  {item.level}
                </Badge>
                <span className="text-xs text-muted-foreground">{item.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Core Principles */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-primary" />
            核心原则
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-1.5">
            {CORE_PRINCIPLES.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-primary text-xs font-mono mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm">{p}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

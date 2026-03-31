import { Link } from "wouter";
import {
  ArrowLeft,
  Shield,
  Target,
  Layers,
  AlertTriangle,
  TrendingUp,
  Eye,
  Clock,
  Ban,
  Scale,
  Zap,
  User,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-lg border-b border-border/20">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center gap-3">
          <Link href="/">
            <button className="p-1.5 rounded-lg hover:bg-surface/60 transition-colors">
              <ArrowLeft className="w-4.5 h-4.5 text-muted-foreground" />
            </button>
          </Link>
          <h1 className="text-sm font-semibold">关于 GoldBias</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <section className="text-center py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gold/25 via-gold/15 to-gold/5 border border-gold/20 shadow-[0_0_30px_rgba(240,192,64,0.1)] mb-5">
            <img src="/logo.png" alt="GoldBias" className="w-14 h-14 rounded-lg" />
          </div>
          <h2 className="text-2xl font-bold mb-2">
            Gold<span className="text-gold">Bias</span>
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            现货黄金结构化交易助手
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/8 border border-gold/15">
            <Zap className="w-3.5 h-3.5 text-gold" />
            <span className="text-xs text-gold font-medium">
              先判环境，再等位置，所有技术服务于止损
            </span>
          </div>
        </section>

        {/* What is GoldBias */}
        <section className="card-base rounded-2xl p-5 border border-border/30">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
              <Target className="w-4 h-4 text-gold" />
            </div>
            <h3 className="text-base font-bold">GoldBias 是什么</h3>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              GoldBias 是一个专注于<span className="text-foreground font-medium">现货黄金（XAU/USD）日内交易</span>的结构化交易决策辅助系统。
              它不是一个自动交易机器人，而是帮助交易者<span className="text-foreground font-medium">建立纪律、过滤噪音、聚焦关键信息</span>的专业工具。
            </p>
            <p>
              系统整合了实时行情、AI 多因子分析、经济日历、新闻情绪、关键价位计算和风控状态监控，
              将分散的市场信息<span className="text-foreground font-medium">结构化呈现</span>，让每一笔交易决策都有据可依。
            </p>
            <p>
              核心理念：<span className="text-gold font-semibold">交易不是预测涨跌，而是在正确的环境中，等待正确的位置，用最小的止损去验证判断。</span>
            </p>
          </div>
        </section>

        {/* Trading System - Four Layer Filter */}
        <section className="card-base rounded-2xl p-5 border border-border/30">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan/20 to-cyan/5 flex items-center justify-center">
              <Layers className="w-4 h-4 text-cyan" />
            </div>
            <h3 className="text-base font-bold">四层过滤交易体系</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            GoldBias 的核心是一套严格的四层过滤体系，每一层都是下一层的前提条件。只有当四层全部满足时，才会产生交易信号。
          </p>

          <div className="space-y-3">
            {/* Layer 1 */}
            <div className="rounded-xl bg-surface/50 border border-border/20 p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gold/15 flex items-center justify-center text-[10px] font-bold text-gold">1</div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-gold" />
                  环境判断（Daily Bias）
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-8.5">
                先看日线级别的方向偏向（偏多/偏空/震荡），确定今天的主基调。
                不与大趋势作对，不在无方向的市场里强行交易。
                系统综合价格结构、均线排列、前日收盘位置等多因子自动判定。
              </p>
            </div>

            {/* Layer 2 */}
            <div className="rounded-xl bg-surface/50 border border-border/20 p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gold/15 flex items-center justify-center text-[10px] font-bold text-gold">2</div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gold" />
                  盘口时段（Session Filter）
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-8.5">
                不同时段有不同的波动特征。亚盘多为蓄势，欧盘启动方向，美盘放量冲刺。
                重大数据发布前后有禁入窗口，避免在流动性真空中被扫损。
                系统实时标注当前盘口状态和风险等级。
              </p>
            </div>

            {/* Layer 3 */}
            <div className="rounded-xl bg-surface/50 border border-border/20 p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gold/15 flex items-center justify-center text-[10px] font-bold text-gold">3</div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-gold" />
                  关键位等待（Key Level）
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-8.5">
                不追价，只在关键位附近等待。支撑/阻力、箱体边沿、Pivot 点位都是系统自动计算的关键位。
                价格到位不代表入场，还需要观察价格行为（Pin Bar、吞没、假突破等）确认信号。
              </p>
            </div>

            {/* Layer 4 */}
            <div className="rounded-xl bg-surface/50 border border-border/20 p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-6 h-6 rounded-lg bg-gold/15 flex items-center justify-center text-[10px] font-bold text-gold">4</div>
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-gold" />
                  止损定义（Risk Definition）
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-8.5">
                每一笔交易必须在入场前就明确止损位。止损不是"大概在那里"，而是精确到点位。
                所有的技术分析最终都服务于一个目标：找到一个合理的、可接受的止损位置。
                如果找不到清晰的止损位，就不入场。
              </p>
            </div>
          </div>
        </section>

        {/* Risk Control Iron Rules */}
        <section className="card-base rounded-2xl p-5 border border-border/30">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red/20 to-red/5 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red" />
            </div>
            <h3 className="text-base font-bold">风控铁律</h3>
          </div>

          <div className="space-y-2.5">
            {[
              { icon: Ban, text: "单笔亏损不超过账户净值的 1-2%", color: "text-red" },
              { icon: Shield, text: "每日最大亏损不超过 3 笔或 5% 净值", color: "text-red" },
              { icon: Clock, text: "重大数据前后 15 分钟禁止开新仓", color: "text-gold" },
              { icon: Scale, text: "盈亏比低于 1.5:1 的机会不做", color: "text-gold" },
              { icon: AlertTriangle, text: "连续止损 2 次后强制休息，重新评估", color: "text-red" },
              { icon: Eye, text: "不在亚盘低波动期追单，等欧美盘方向确认", color: "text-cyan" },
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl bg-surface/40 border border-border/15">
                <rule.icon className={`w-4 h-4 ${rule.color} mt-0.5 shrink-0`} />
                <span className="text-xs text-foreground/80 leading-relaxed">{rule.text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="card-base rounded-2xl p-5 border border-gold/15 bg-gold/[0.02]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-gold" />
            </div>
            <h3 className="text-base font-bold">免责声明</h3>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              GoldBias 提供的所有分析、信号和建议<span className="text-gold font-medium">仅供参考</span>，不构成任何投资建议或交易指导。
            </p>
            <p>
              现货黄金交易具有高风险性，杠杆交易可能导致本金全部亏损。过往表现不代表未来收益。
              请根据自身风险承受能力谨慎决策，并在必要时咨询专业金融顾问。
            </p>
            <p>
              使用本系统即表示您已理解并接受上述风险，开发者对因使用本系统产生的任何直接或间接损失不承担责任。
            </p>
          </div>
        </section>

        {/* Developer Info */}
        <section className="card-base rounded-2xl p-5 border border-border/30">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center">
              <User className="w-4 h-4 text-purple-400" />
            </div>
            <h3 className="text-base font-bold">开发者</h3>
          </div>
          <div className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-surface/50 border border-border/20">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center border border-gold/20">
              <span className="text-lg font-bold text-gold">T</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-foreground">Traderynn</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                独立交易者 / GoldBias 创建者
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                专注黄金日内结构化交易，追求纪律与一致性
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-6 space-y-2">
          <p className="text-xs text-muted-foreground/50">
            GoldBias v1.0 &middot; Built with discipline
          </p>
          <p className="text-[10px] text-muted-foreground/30">
            &copy; {new Date().getFullYear()} Traderynn. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

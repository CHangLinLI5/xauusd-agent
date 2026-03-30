import { useState, useCallback } from "react";
import { formatDateCN, formatDateTimeCN } from "@/lib/timeUtils";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  User,
  Mail,
  Shield,
  Clock,
  LogOut,
  Edit3,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  MessageSquare,
  BarChart3,
  ClipboardList,
  Settings2,
  ChevronRight,
  TrendingUp,
  Target,
  AlertTriangle,
} from "lucide-react";

export default function Profile() {
  const { user, loading, isAuthenticated, logout } = useAuth({ redirectOnUnauthenticated: true });

  // ===== Edit Name State =====
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // ===== Change Password State =====
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // ===== Trading Preferences State =====
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    defaultLotSize: "0.1",
    maxDailyLoss: "2",
    riskRewardRatio: "1:2",
    maxOpenPositions: "3",
    preferredSession: "us",
    stopLossPoints: "100",
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ===== Usage Stats =====
  const { data: chatSessions } = trpc.chat.sessions.useQuery(undefined, { enabled: isAuthenticated });
  const { data: chartAnalyses } = trpc.chart.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: tradingPlans } = trpc.plan.list.useQuery(undefined, { enabled: isAuthenticated });

  // ===== Handlers =====
  const handleStartEditName = useCallback(() => {
    setNewName(user?.name || "");
    setIsEditingName(true);
  }, [user?.name]);

  const handleSaveName = useCallback(async () => {
    if (!newName.trim()) {
      toast.error("昵称不能为空");
      return;
    }
    setSavingName(true);
    try {
      const res = await fetch("/api/email-auth/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("昵称已更新");
        setIsEditingName(false);
        // Refresh user data
        window.location.reload();
      } else {
        toast.error(data.error || "更新失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSavingName(false);
    }
  }, [newName]);

  const handleChangePassword = useCallback(async () => {
    if (!oldPassword) {
      toast.error("请输入当前密码");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/email-auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("密码已更新");
        setShowPasswordSection(false);
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "修改失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSavingPassword(false);
    }
  }, [oldPassword, newPassword, confirmPassword]);

  const handleSavePreferences = useCallback(async () => {
    setSavingPrefs(true);
    try {
      const res = await fetch("/api/email-auth/update-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("交易偏好已保存");
      } else {
        toast.error(data.error || "保存失败");
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSavingPrefs(false);
    }
  }, [preferences]);

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = "/login";
  }, [logout]);

  // ===== Loading State =====
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">加载中...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const initials = (user.name || "U").slice(0, 2).toUpperCase();
  const memberSince = user.createdAt ? formatDateCN(user.createdAt, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }) : "未知";
  const lastLogin = user.lastSignedIn ? formatDateTimeCN(user.lastSignedIn) : "未知";

  const sessionOptions = [
    { value: "asia", label: "亚盘 (08:00-16:00 北京)" },
    { value: "europe", label: "欧盘 (15:00-00:00 北京)" },
    { value: "us", label: "美盘 (21:00-06:00 北京)" },
    { value: "all", label: "全时段" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center border border-gold/20">
          <User className="w-5 h-5 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">个人中心</h1>
          <p className="text-sm text-muted-foreground">管理您的账户信息和交易偏好</p>
        </div>
      </div>

      {/* ===== User Profile Card ===== */}
      <div className="rounded-2xl bg-card/80 border border-border/40 overflow-hidden">
        {/* Profile Header */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-gold/8 via-transparent to-transparent">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold/40 to-gold/15 flex items-center justify-center border-2 border-gold/25 shadow-lg shadow-gold/5">
              <span className="text-2xl font-bold text-gold">{initials}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Name (editable) */}
              <div className="flex items-center gap-2 mb-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="px-3 py-1.5 bg-surface border border-gold/30 rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-gold/30 w-48"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="p-1.5 rounded-lg bg-gold/15 text-gold hover:bg-gold/25 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1.5 rounded-lg bg-surface text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold truncate">{user.name || "未设置昵称"}</h2>
                    <button
                      onClick={handleStartEditName}
                      className="p-1 rounded-md text-muted-foreground hover:text-gold transition-colors"
                      title="修改昵称"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Mail className="w-3.5 h-3.5" />
                <span>{user.email || "未绑定邮箱"}</span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                  user.role === "admin"
                    ? "bg-gold/15 text-gold border border-gold/20"
                    : "bg-surface text-muted-foreground border border-border/30"
                }`}>
                  <Shield className="w-3 h-3" />
                  {user.role === "admin" ? "管理员" : "普通用户"}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface text-muted-foreground border border-border/30">
                  <Clock className="w-3 h-3" />
                  注册于 {memberSince}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="px-6 py-4 border-t border-border/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold font-mono">{chatSessions?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <MessageSquare className="w-3 h-3" />
                AI 对话
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono">{chartAnalyses?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <BarChart3 className="w-3 h-3" />
                图表分析
              </div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold font-mono">{tradingPlans?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <ClipboardList className="w-3 h-3" />
                交易计划
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium truncate">{lastLogin}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                上次登录
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Settings Sections ===== */}
      <div className="space-y-3">
        {/* Change Password */}
        <div className="rounded-2xl bg-card/80 border border-border/40 overflow-hidden">
          <button
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Lock className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">修改密码</div>
                <div className="text-xs text-muted-foreground">更新您的登录密码</div>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showPasswordSection ? "rotate-90" : ""}`} />
          </button>

          {showPasswordSection && (
            <div className="px-6 pb-5 space-y-4 border-t border-border/30 pt-4">
              {/* Old Password */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">当前密码</label>
                <div className="relative">
                  <input
                    type={showOldPw ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="输入当前密码"
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPw(!showOldPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showOldPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">新密码</label>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">确认新密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/30"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={savingPassword}
                className="w-full py-2.5 rounded-xl bg-gold/15 text-gold font-medium text-sm hover:bg-gold/25 transition-colors disabled:opacity-50"
              >
                {savingPassword ? "保存中..." : "确认修改密码"}
              </button>
            </div>
          )}
        </div>

        {/* Trading Preferences */}
        <div className="rounded-2xl bg-card/80 border border-border/40 overflow-hidden">
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gold/10 flex items-center justify-center">
                <Settings2 className="w-4.5 h-4.5 text-gold" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">交易偏好</div>
                <div className="text-xs text-muted-foreground">设置默认仓位、风控参数</div>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showPreferences ? "rotate-90" : ""}`} />
          </button>

          {showPreferences && (
            <div className="px-6 pb-5 space-y-4 border-t border-border/30 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Default Lot Size */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    默认手数
                  </label>
                  <input
                    type="text"
                    value={preferences.defaultLotSize}
                    onChange={(e) => setPreferences({ ...preferences, defaultLotSize: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                  />
                </div>

                {/* Max Daily Loss */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    日最大亏损 (%)
                  </label>
                  <input
                    type="text"
                    value={preferences.maxDailyLoss}
                    onChange={(e) => setPreferences({ ...preferences, maxDailyLoss: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                  />
                </div>

                {/* Risk Reward Ratio */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    风险回报比
                  </label>
                  <select
                    value={preferences.riskRewardRatio}
                    onChange={(e) => setPreferences({ ...preferences, riskRewardRatio: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 appearance-none"
                  >
                    <option value="1:1.5">1:1.5</option>
                    <option value="1:2">1:2</option>
                    <option value="1:2.5">1:2.5</option>
                    <option value="1:3">1:3</option>
                    <option value="1:4">1:4</option>
                    <option value="1:5">1:5</option>
                  </select>
                </div>

                {/* Max Open Positions */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <ClipboardList className="w-3 h-3" />
                    最大持仓数
                  </label>
                  <input
                    type="text"
                    value={preferences.maxOpenPositions}
                    onChange={(e) => setPreferences({ ...preferences, maxOpenPositions: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                  />
                </div>

                {/* Stop Loss Points */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    默认止损 (点)
                  </label>
                  <input
                    type="text"
                    value={preferences.stopLossPoints}
                    onChange={(e) => setPreferences({ ...preferences, stopLossPoints: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                  />
                </div>

                {/* Preferred Session */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    偏好交易时段
                  </label>
                  <select
                    value={preferences.preferredSession}
                    onChange={(e) => setPreferences({ ...preferences, preferredSession: e.target.value })}
                    className="w-full px-4 py-2.5 bg-surface border border-border/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 appearance-none"
                  >
                    {sessionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="w-full py-2.5 rounded-xl bg-gold/15 text-gold font-medium text-sm hover:bg-gold/25 transition-colors disabled:opacity-50"
              >
                {savingPrefs ? "保存中..." : "保存交易偏好"}
              </button>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl bg-card/80 border border-border/40 hover:bg-red-500/5 hover:border-red-500/20 transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/15 transition-colors">
            <LogOut className="w-4.5 h-4.5 text-red-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-red-400">退出登录</div>
            <div className="text-xs text-muted-foreground">退出当前账户</div>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground/50 py-4">
        XAUUSD Agent v1.0 &middot; 现货黄金智能交易系统
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Shield, Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const endpoint =
          mode === "register"
            ? "/api/email-auth/register"
            : "/api/email-auth/login";

        const body: Record<string, string> = { email, password };
        if (mode === "register" && name.trim()) {
          body.name = name.trim();
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          setError(data.error || "操作失败，请重试");
          return;
        }

        // Success - redirect to home and force full reload to pick up new session
        window.location.href = "/";
      } catch {
        setError("网络错误，请检查连接后重试");
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, name]
  );

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 mb-4">
            <Shield className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">XAUUSD Agent</h1>
          <p className="text-sm text-muted-foreground mt-1">
            现货黄金智能交易系统
          </p>
        </div>

        {/* Form Card */}
        <div className="card-base rounded-2xl p-6 border border-border/50">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {mode === "login" ? "登录账户" : "注册账户"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "login"
              ? "使用邮箱和密码登录"
              : "创建新账户以使用 AI 分析功能"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field (register only) */}
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  昵称
                  <span className="text-muted-foreground text-xs">(选填)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="您的昵称"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 transition-all text-sm"
                  autoComplete="name"
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 transition-all text-sm"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "register" ? "至少 6 位密码" : "输入密码"
                  }
                  required
                  minLength={6}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-surface/50 border border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold/50 transition-all text-sm"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-red/10 border border-red/20 text-red text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-background font-semibold text-sm hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "登录" : "注册"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 pt-4 border-t border-border/30 text-center">
            <p className="text-sm text-muted-foreground">
              {mode === "login" ? "还没有账户？" : "已有账户？"}
              <button
                onClick={toggleMode}
                className="ml-1 text-gold hover:text-gold/80 font-medium transition-colors"
              >
                {mode === "login" ? "立即注册" : "去登录"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          登录即表示您同意使用本系统进行交易辅助分析
        </p>
      </div>
    </div>
  );
}

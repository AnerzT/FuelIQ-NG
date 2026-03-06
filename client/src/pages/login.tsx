import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { Flame, Loader2, Shield, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (attempts >= 5) {
      toast({
        title: "Too many attempts",
        description: "Please wait a moment before trying again.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      setAttempts(0);
      setLocation("/dashboard");
    } catch (err: any) {
      setAttempts((prev) => prev + 1);
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" data-testid="page-login">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-6" data-testid="link-login-home">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
              <Flame className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">FuelIQ NG</span>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-login-title">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <Card data-testid="card-login-form">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-password"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || attempts >= 5} data-testid="button-submit-login">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                {attempts >= 5 ? "Too Many Attempts" : "Sign In Securely"}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  256-bit SSL
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  Encrypted
                </span>
                <span className="flex items-center gap-1" data-testid="text-rate-limited">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  Rate Limited
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-medium" data-testid="link-register">
              Create one
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground/60">
            By signing in, you agree to our{" "}
            <Link href="/privacy" className="underline hover:text-muted-foreground transition-colors" data-testid="link-privacy-from-login">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

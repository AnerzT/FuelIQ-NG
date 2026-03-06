import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { Flame, Loader2, Shield, Lock, Eye, EyeOff, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains number", met: /[0-9]/.test(password) },
    { label: "Contains special character", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.met).length;
  const colors = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-500"];
  const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];

  if (!password) return null;

  return (
    <div className="space-y-2 pt-1" data-testid="password-strength">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : "bg-muted"}`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${score >= 3 ? "text-emerald-500" : score >= 2 ? "text-amber-500" : "text-red-500"}`}>
        {labels[score]}
      </p>
      <div className="space-y-1">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            {check.met ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <X className="w-3 h-3 text-muted-foreground/50" />
            )}
            <span className={check.met ? "text-emerald-500/80" : "text-muted-foreground/50"}>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register(form);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" data-testid="page-register">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-6" data-testid="link-register-home">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
              <Flame className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">FuelIQ NG</span>
          </Link>
          <h1 className="text-2xl font-bold" data-testid="text-register-title">Create your account</h1>
          <p className="text-muted-foreground">Start your free 7-day trial</p>
        </div>

        <Card data-testid="card-register-form">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="Adebayo Johnson"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                  autoComplete="name"
                  data-testid="input-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
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
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
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
                <PasswordStrength password={form.password} />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-register">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                Create Secure Account
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
                  bcrypt Encrypted
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium" data-testid="link-login">
              Sign in
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground/60">
            By creating an account, you agree to our{" "}
            <Link href="/privacy" className="underline hover:text-muted-foreground transition-colors" data-testid="link-privacy-from-register">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import { useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
    company: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="Adebayo Johnson"
                  value={form.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  required
                  data-testid="input-fullname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="adebayo"
                  value={form.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  required
                  data-testid="input-username"
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
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company (Optional)</Label>
                <Input
                  id="company"
                  placeholder="Your company name"
                  value={form.company}
                  onChange={(e) => updateField("company", e.target.value)}
                  data-testid="input-company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit-register">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium" data-testid="link-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

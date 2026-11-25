import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LockKeyhole } from "lucide-react";

export default function PasswordRecovery() {
  const { toast } = useToast();
  const [contact, setContact] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, channel }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not request recovery code.");
      setSent(true);
      toast({ title: "Check your messages", description: result.message });
    } catch (error) {
      toast({ title: "Recovery unavailable", description: error instanceof Error ? error.message : "Could not request a code.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, code, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not reset password.");
      setComplete(true);
    } catch (error) {
      toast({ title: "Password reset failed", description: error instanceof Error ? error.message : "Check the code and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-6">
          <div className="text-center space-y-2">
            <LockKeyhole className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-2xl font-bold">Reset your password</h1>
            <p className="text-sm text-muted-foreground">Recover access using the email address or phone number on your account.</p>
          </div>
          {complete ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-emerald-600">Password updated successfully.</p>
              <Button asChild className="w-full"><Link href="/login">Sign in</Link></Button>
            </div>
          ) : !sent ? (
            <form className="space-y-4" onSubmit={requestCode}>
              <div className="space-y-2">
                <Label htmlFor="contact">Email or phone</Label>
                <Input id="contact" autoComplete="username" value={contact} onChange={(event) => setContact(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Send code by</Label>
                <select id="channel" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={channel} onChange={(event) => setChannel(event.target.value as "email" | "sms")}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <Button className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send recovery code
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={resetPassword}>
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Six-digit code</Label>
                <Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <Button className="w-full" disabled={loading || code.length !== 6 || password.length < 8}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
          <p className="text-center text-sm text-muted-foreground"><Link className="underline" href="/login">Back to sign in</Link></p>
        </CardContent>
      </Card>
    </main>
  );
}

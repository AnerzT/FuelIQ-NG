import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, ShieldCheck } from "lucide-react";

export default function VerifyAccount() {
  const { token, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const query = new URLSearchParams(window.location.search);
  const [channel, setChannel] = useState<"email" | "sms">(query.get("channel") === "sms" ? "sms" : "email");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  const sendCode = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ channel }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not send verification code.");
      toast({ title: "Code sent", description: `Check your ${channel === "email" ? "email" : "phone"} for the code.` });
    } catch (error) {
      toast({ title: "Delivery unavailable", description: error instanceof Error ? error.message : "Could not send code.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verification/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Verification failed.");
      setVerified(true);
      await refreshUser();
    } catch (error) {
      toast({ title: "Verification failed", description: error instanceof Error ? error.message : "Check the code and try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 p-6">
          <div className="text-center space-y-2">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-2xl font-bold">Verify your account</h1>
            <p className="text-sm text-muted-foreground">
              Verify either your email address or phone number to submit community reports.
            </p>
          </div>
          {query.get("delivery") === "unavailable" && (
            <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
              A code could not be sent during registration. Configure the server email or SMS provider, then request a new code here.
            </p>
          )}
          {verified ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-emerald-600">Your contact method is verified. Your account is waiting for administrator approval before community reporting is enabled.</p>
              <Button className="w-full" onClick={() => setLocation("/dashboard")}>Continue to dashboard</Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="verification-channel">Send code to</Label>
                <select
                  id="verification-channel"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={channel}
                  onChange={(event) => setChannel(event.target.value as "email" | "sms")}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <Button type="button" className="w-full" variant="outline" disabled={loading} onClick={() => void sendCode()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send verification code
              </Button>
              <form className="space-y-3" onSubmit={confirmCode}>
                <div className="space-y-2">
                  <Label htmlFor="code">Six-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                </div>
                <Button className="w-full" type="submit" disabled={loading || code.length !== 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify contact
                </Button>
              </form>
            </>
          )}
          <p className="text-center text-sm text-muted-foreground"><Link className="underline" href="/dashboard">Back to dashboard</Link></p>
        </CardContent>
      </Card>
    </main>
  );
}

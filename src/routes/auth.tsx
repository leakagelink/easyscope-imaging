import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — EasyScope" },
      { name: "description", content: "Sign in to your EasyScope clinical imaging and reporting workspace." },
      { property: "og:title", content: "Sign in — EasyScope" },
      { property: "og:description", content: "Secure doctor sign-in for EasyScope." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/dashboard" }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => s && navigate({ to: "/dashboard" }));
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (!data.session) toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo tagline className="mb-8 justify-center" />
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <h1 className="text-xl font-semibold">{mode === "in" ? "Doctor sign in" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Access your patients, reports and clinical images.</p>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" autoComplete="email" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" autoComplete={mode === "in" ? "current-password" : "new-password"} />
            </div>
            <Button type="submit" className="h-11" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</Button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
          <Button variant="outline" className="h-11 w-full" onClick={google}>Continue with Google</Button>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "in" ? "New to EasyScope?" : "Already have an account?"}{" "}
            <button className="font-semibold text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Create account" : "Sign in"}
            </button>
          </p>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Your patient data is private to your account.
        </p>
      </div>
    </div>
  );
}

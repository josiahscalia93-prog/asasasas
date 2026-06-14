import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, ArrowRight, Check } from "lucide-react";

const perks = ["Unlimited conversions on Free", "React, Vue, Next.js & HTML output", "Live preview + one-click download"];

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await register(name, email, password);
    setLoading(false);
    if (res.ok) navigate("/dashboard");
    else setError(res.error);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex w-1/2 relative bg-[#0b0b0d] border-r border-zinc-800 p-12 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <Logo />
        <div className="relative">
          <h2 className="font-heading text-4xl font-black tracking-tighter leading-tight max-w-md">
            Start shipping <span className="text-signal">faster</span>.
          </h2>
          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-center gap-3 text-zinc-400 text-sm">
                <span className="w-5 h-5 rounded-sm bg-signal/15 flex items-center justify-center"><Check className="w-3 h-3 text-signal" /></span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-zinc-600">Powered by Claude Sonnet 4.6</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden mb-8"><Logo /></div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Create account</h1>
          <p className="text-zinc-500 text-sm mt-2">Free forever. No credit card.</p>

          {error && (
            <div data-testid="signup-error" className="mt-6 flex items-start gap-2 border border-destructive/40 bg-destructive/10 text-destructive rounded-sm px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs uppercase tracking-[0.15em] text-zinc-500">Name</Label>
              <Input id="name" data-testid="signup-name" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Jane Dev"
                className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-[0.15em] text-zinc-500">Email</Label>
              <Input id="email" data-testid="signup-email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
                className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-[0.15em] text-zinc-500">Password</Label>
              <Input id="password" data-testid="signup-password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters"
                className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm h-11" />
            </div>
            <Button data-testid="signup-submit" type="submit" disabled={loading}
              className="w-full bg-signal hover:bg-signal-hover text-white rounded-sm h-11 font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4 ml-2" /></>}
            </Button>
          </form>

          <p className="mt-6 text-sm text-zinc-500 text-center">
            Already have an account? <Link to="/login" data-testid="goto-login" className="text-white hover:text-signal transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

import { Logo } from "@/components/Logo";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-background">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 flex flex-col md:flex-row justify-between gap-8">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm text-zinc-500 leading-relaxed">
            Turn any design into production-ready code. Powered by Claude Sonnet 4.6 vision.
          </p>
        </div>
        <div className="flex gap-16 text-sm">
          <div className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 font-bold">Product</span>
            <a href="/#features" className="text-zinc-400 hover:text-white transition-colors">Features</a>
            <Link to="/pricing" className="text-zinc-400 hover:text-white transition-colors">Pricing</Link>
            <Link to="/convert" className="text-zinc-400 hover:text-white transition-colors">Converter</Link>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 font-bold">Account</span>
            <Link to="/login" className="text-zinc-400 hover:text-white transition-colors">Sign in</Link>
            <Link to="/signup" className="text-zinc-400 hover:text-white transition-colors">Sign up</Link>
            <Link to="/dashboard" className="text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} UI2Code. Built for developers.
      </div>
    </footer>
  );
}

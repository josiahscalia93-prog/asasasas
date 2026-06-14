import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

export default function MarketingNav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-black/60 border-b border-white/10">
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Logo />
        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="/#features" className="hover:text-white transition-colors duration-150" data-testid="nav-features">Features</a>
          <a href="/#how" className="hover:text-white transition-colors duration-150" data-testid="nav-how">How it works</a>
          <Link to="/pricing" className="hover:text-white transition-colors duration-150" data-testid="nav-pricing">Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <Button data-testid="nav-dashboard-btn" onClick={() => navigate("/dashboard")}
              className="bg-white text-black hover:bg-zinc-200 rounded-sm h-9 px-4 text-sm font-semibold">
              Dashboard
            </Button>
          ) : (
            <>
              <Link to="/login" className="text-sm text-zinc-300 hover:text-white transition-colors duration-150 hidden sm:block" data-testid="nav-signin">
                Sign in
              </Link>
              <Button data-testid="nav-getstarted-btn" onClick={() => navigate("/signup")}
                className="bg-white text-black hover:bg-zinc-200 rounded-sm h-9 px-4 text-sm font-semibold">
                Get started
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

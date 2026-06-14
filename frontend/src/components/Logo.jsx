import { Link } from "react-router-dom";
import { Square } from "lucide-react";

export const Logo = ({ className = "" }) => (
  <Link to="/" className={`flex items-center gap-2 group ${className}`} data-testid="logo-home-link">
    <div className="relative w-7 h-7 flex items-center justify-center bg-signal rounded-sm">
      <Square className="w-3.5 h-3.5 text-white" strokeWidth={3} />
    </div>
    <span className="font-heading font-extrabold text-lg tracking-tight text-white">
      UI2Code
    </span>
  </Link>
);

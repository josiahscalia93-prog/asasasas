import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Wand2, FolderGit2, Settings as SettingsIcon, LogOut,
} from "lucide-react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "side-dashboard" },
  { to: "/convert", label: "Converter", icon: Wand2, testid: "side-convert" },
  { to: "/projects", label: "Projects", icon: FolderGit2, testid: "side-projects" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "side-settings" },
];

export default function DashboardLayout({ children, title }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-zinc-800 bg-[#0b0b0d] fixed inset-y-0">
        <div className="h-16 flex items-center px-5 border-b border-zinc-800">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                data-testid={item.testid}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors duration-150 ${
                  active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-zinc-800">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm text-white truncate">{user?.name || "User"}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
          <button
            data-testid="logout-btn"
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <header className="h-16 border-b border-zinc-800 bg-background/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-5 sm:px-8">
          <h1 className="font-heading text-xl font-bold tracking-tight">{title}</h1>
          <div className="md:hidden">
            <Logo />
          </div>
        </header>
        {/* mobile nav */}
        <div className="md:hidden flex gap-1 px-3 py-2 border-b border-zinc-800 overflow-x-auto">
          {nav.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} data-testid={`m-${item.testid}`}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs whitespace-nowrap ${active ? "bg-zinc-800 text-white" : "text-zinc-400"}`}>
                <item.icon className="w-3.5 h-3.5" /> {item.label}
              </Link>
            );
          })}
        </div>
        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

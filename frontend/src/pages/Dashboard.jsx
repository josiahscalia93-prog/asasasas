import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Wand2, FolderGit2, Layers, ArrowRight, Clock, Plus } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, by_framework: {} });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/stats"), api.get("/projects")])
      .then(([s, p]) => {
        setStats(s.data);
        setRecent(p.data.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  const topFw = Object.entries(stats.by_framework || {}).sort((a, b) => b[1] - a[1])[0];

  const cards = [
    { label: "Total conversions", value: stats.total, icon: FolderGit2, testid: "stat-total" },
    { label: "Frameworks used", value: Object.keys(stats.by_framework || {}).length, icon: Layers, testid: "stat-frameworks" },
    { label: "Top framework", value: topFw ? topFw[0] : "—", icon: Wand2, testid: "stat-top" },
  ];

  return (
    <DashboardLayout title="Dashboard">
      <div className="max-w-6xl">
        {/* Welcome + CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-heading text-2xl font-bold tracking-tight">
              Welcome back, {user?.name?.split(" ")[0] || "there"}.
            </h2>
            <p className="text-zinc-500 text-sm mt-1">Turn your next design into code.</p>
          </div>
          <Link to="/convert">
            <Button data-testid="dash-new-convert" className="bg-signal hover:bg-signal-hover text-white rounded-sm h-11 px-5 font-bold">
              <Plus className="w-4 h-4 mr-2" /> New conversion
            </Button>
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {cards.map((c) => (
            <div key={c.label} data-testid={c.testid} className="bg-card border border-zinc-800 rounded-md p-6">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.15em] text-zinc-500 font-bold">{c.label}</span>
                <c.icon className="w-4 h-4 text-signal" />
              </div>
              <p className="font-heading text-3xl font-black mt-4 tracking-tight">{loading ? "—" : c.value}</p>
            </div>
          ))}
        </div>

        {/* Recent */}
        <div className="bg-card border border-zinc-800 rounded-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <h3 className="font-semibold">Recent projects</h3>
            <Link to="/projects" className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-zinc-500">Loading…</div>
          ) : recent.length === 0 ? (
            <div className="p-10 text-center">
              <Wand2 className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-zinc-400 mt-4">No conversions yet.</p>
              <Link to="/convert">
                <Button data-testid="empty-convert-btn" className="mt-5 bg-white text-black hover:bg-zinc-200 rounded-sm h-10 px-4 font-bold">
                  Convert your first design
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {recent.map((p) => (
                <li key={p.id} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-900/50 transition-colors">
                  <div className="w-12 h-12 rounded-sm border border-zinc-800 overflow-hidden bg-[#0c0c0e] shrink-0">
                    <img src={`data:image/jpeg;base64,${p.thumbnail}`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{p.name}</p>
                    <p className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span>{p.framework}</span> · <span>{p.styling}</span>
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600 hidden sm:flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

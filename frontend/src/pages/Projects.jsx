import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LivePreview from "@/components/LivePreview";
import { copyToClipboard } from "@/lib/clipboard";
import {
  Trash2, Copy, Check, Download, Code2, Eye, ImageIcon, Plus, Wand2,
} from "lucide-react";
import { toast } from "sonner";

const EXT = { React: "jsx", "Vue 3": "vue", "Next.js": "jsx", "HTML/CSS": "html" };

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/projects").then((r) => setProjects(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openProject = async (p) => {
    setActive({ ...p, code: "", _loading: true });
    try {
      const { data } = await api.get(`/projects/${p.id}`);
      setActive(data);
    } catch {
      toast.error("Could not load project");
      setActive(null);
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/projects/${id}`);
    setProjects((p) => p.filter((x) => x.id !== id));
    toast.success("Project deleted");
  };

  const copyCode = async () => {
    const ok = await copyToClipboard(active.code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Couldn't copy — select the code and copy manually.");
    }
  };

  const downloadCode = () => {
    const ext = EXT[active.framework] || "txt";
    const blob = new Blob([active.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(active.name || "component").replace(/[^a-z0-9]/gi, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout title="Projects">
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-zinc-500">{projects.length} conversion{projects.length !== 1 ? "s" : ""}</p>
          <Link to="/convert">
            <Button data-testid="projects-new-btn" className="bg-signal hover:bg-signal-hover text-white rounded-sm h-10 px-4 font-bold">
              <Plus className="w-4 h-4 mr-2" /> New
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card border border-zinc-800 rounded-md h-56 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-card border border-zinc-800 rounded-md p-16 text-center">
            <Wand2 className="w-8 h-8 text-zinc-700 mx-auto" />
            <p className="text-zinc-400 mt-4">No projects yet.</p>
            <Link to="/convert">
              <Button data-testid="projects-empty-btn" className="mt-5 bg-white text-black hover:bg-zinc-200 rounded-sm h-10 px-4 font-bold">
                Start converting
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.id} data-testid={`project-card-${p.id}`} onClick={() => openProject(p)}
                className="group bg-card border border-zinc-800 rounded-md overflow-hidden cursor-pointer hover:border-zinc-600 transition-colors">
                <div className="aspect-video bg-[#0c0c0e] overflow-hidden border-b border-zinc-800">
                  <img src={`data:image/jpeg;base64,${p.thumbnail}`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate font-medium">{p.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{p.framework} · {p.styling}</p>
                    </div>
                    <button data-testid={`delete-${p.id}`} onClick={(e) => remove(p.id, e)}
                      className="text-zinc-600 hover:text-destructive transition-colors p-1 opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 mt-2">{new Date(p.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-4xl bg-card border-zinc-800 max-h-[90vh] overflow-hidden flex flex-col">
          {active && (
            <>
              <DialogHeader>
                <DialogDescription className="sr-only">Project details: code, live preview and original design.</DialogDescription>
                <DialogTitle className="font-heading flex items-center justify-between pr-8">
                  <span>{active.name}</span>
                  <div className="flex gap-2">
                    <Button onClick={copyCode} variant="outline" size="sm"
                      className="border-zinc-700 bg-transparent hover:bg-zinc-900 text-white rounded-sm">
                      {copied ? <Check className="w-4 h-4 text-signal" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <Button onClick={downloadCode} variant="outline" size="sm"
                      className="border-zinc-700 bg-transparent hover:bg-zinc-900 text-white rounded-sm">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="code" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="bg-[#0c0c0e] border border-zinc-800 rounded-sm w-full justify-start">
                  <TabsTrigger value="code"><Code2 className="w-4 h-4 mr-2" /> Code</TabsTrigger>
                  <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-2" /> Preview</TabsTrigger>
                  <TabsTrigger value="original"><ImageIcon className="w-4 h-4 mr-2" /> Original</TabsTrigger>
                </TabsList>
                <TabsContent value="code" className="overflow-auto flex-1 m-0 mt-3">
                  <pre className="p-4 text-sm font-mono text-zinc-300 leading-relaxed"><code>{active._loading ? "Loading…" : active.code}</code></pre>
                </TabsContent>
                <TabsContent value="preview" className="overflow-auto flex-1 m-0 mt-3">
                  {active._loading ? (
                    <div className="p-12 text-center text-zinc-500">Loading…</div>
                  ) : (
                    <div className="h-[440px] rounded-sm overflow-hidden border border-zinc-800">
                      <LivePreview framework={active.framework} code={active.code} />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="original" className="overflow-auto flex-1 m-0 mt-3">
                  <img src={`data:image/${active.image_base64 ? "png" : "jpeg"};base64,${active.image_base64 || active.thumbnail}`} alt="" className="w-full object-contain rounded-sm" />
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { useEffect, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CodeEditor from "@/components/CodeEditor";
import LivePreview from "@/components/LivePreview";
import { copyToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";
import {
  Upload, Link2, ImageIcon, X, Wand2, ArrowLeft, RotateCcw, Copy, Check,
  Download, AlertCircle, Code2, Eye, Loader2, Undo2, Redo2, Send, Braces, Sparkles,
} from "lucide-react";

const FRAMEWORKS = ["React", "Vue 3", "Next.js", "HTML/CSS"];
const STYLES = ["Tailwind CSS", "CSS Modules", "Styled Components", "Plain CSS"];
const MODELS = ["Claude Sonnet 4.6", "Gemini 3.1 Pro", "GPT-4o"];
const EXT = { React: "jsx", "Vue 3": "vue", "Next.js": "jsx", "HTML/CSS": "html" };

const STEPS = ["Upload", "Configure", "Result"];
const GEN_STAGES = ["Analyzing design", "Generating code", "Finalizing"];

function Stepper({ step }) {
  return (
    <div className="flex items-center gap-3 mb-8" data-testid="stepper">
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <div key={s} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs font-bold border ${
                done ? "bg-signal border-signal text-white" : active ? "bg-white border-white text-black" : "border-zinc-700 text-zinc-600"
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={`text-sm ${active || done ? "text-white" : "text-zinc-600"}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <span className="w-8 h-px bg-zinc-800" />}
          </div>
        );
      })}
    </div>
  );
}

export default function Converter() {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("upload"); // upload | url
  const [imageB64, setImageB64] = useState(null); // pure base64 (no prefix)
  const [imagePreview, setImagePreview] = useState(null); // data url for <img>
  const [imageUrl, setImageUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [framework, setFramework] = useState("React");
  const [styling, setStyling] = useState("Tailwind CSS");
  const [model, setModel] = useState("Claude Sonnet 4.6");
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");

  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // IDE / refinement state
  const [editorCode, setEditorCode] = useState("");
  const [versions, setVersions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [refining, setRefining] = useState(false);

  const fileRef = useRef(null);
  const stageTimer = useRef(null);

  useEffect(() => () => clearInterval(stageTimer.current), []);

  const handleFile = (file) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setError("Please upload a PNG, JPG or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setImagePreview(dataUrl);
      setImageB64(String(dataUrl).split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const clearImage = () => {
    setImageB64(null);
    setImagePreview(null);
    setImageUrl("");
  };

  const goConfigure = () => {
    if (mode === "upload" && !imageB64) { setError("Please upload an image first."); return; }
    if (mode === "url" && !imageUrl.trim()) { setError("Please paste an image URL."); return; }
    setError("");
    setStep(1);
  };

  const generate = async () => {
    setError("");
    setGenerating(true);
    setGenStage(0);
    stageTimer.current = setInterval(() => {
      setGenStage((s) => (s < GEN_STAGES.length - 1 ? s + 1 : s));
    }, 4000);
    try {
      const payload = {
        framework, styling, prompt, model,
        name: name || `Untitled • ${framework}`,
        ...(mode === "upload" ? { image_base64: imageB64 } : { image_url: imageUrl.trim() }),
      };
      const { data } = await api.post("/generate", payload);
      setResult(data);
      setEditorCode(data.code);
      setVersions(data.versions || [{ code: data.code, label: "Initial generation" }]);
      setCurrentIndex(data.current_index ?? 0);
      setChatMessages([]);
      if (!imagePreview && imageUrl) setImagePreview(imageUrl);
      setStep(2);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      clearInterval(stageTimer.current);
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    const ok = await copyToClipboard(editorCode);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Couldn't copy — select the code and copy manually.");
    }
  };

  const downloadCode = () => {
    const ext = EXT[result.framework] || "txt";
    const blob = new Blob([editorCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(result.name || "component").replace(/[^a-z0-9]/gi, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendRefine = async () => {
    const instruction = chatInput.trim();
    if (!instruction || refining) return;
    setChatInput("");
    setChatMessages((m) => [...m, { role: "user", text: instruction }]);
    setRefining(true);
    try {
      const { data } = await api.post(`/projects/${result.id}/refine`, { instruction, model });
      setEditorCode(data.code);
      setVersions(data.versions);
      setCurrentIndex(data.current_index);
      setChatMessages((m) => [...m, { role: "assistant", text: "Done — preview & code updated." }]);
    } catch (e) {
      setChatMessages((m) => [...m, { role: "assistant", text: formatApiError(e.response?.data?.detail) || "Refine failed." }]);
    } finally {
      setRefining(false);
    }
  };

  const restore = async (index) => {
    if (index < 0 || index >= versions.length || refining) return;
    try {
      const { data } = await api.post(`/projects/${result.id}/restore`, { index });
      setEditorCode(data.code);
      setCurrentIndex(data.current_index);
    } catch {}
  };

  const reset = () => {
    setStep(0); setMode("upload"); clearImage(); setFramework("React");
    setStyling("Tailwind CSS"); setModel("Claude Sonnet 4.6"); setPrompt(""); setName("");
    setResult(null); setError(""); setEditorCode(""); setVersions([]); setCurrentIndex(0); setChatMessages([]);
  };

  return (
    <DashboardLayout title="Converter">
      <div className={step === 2 ? "max-w-7xl" : "max-w-6xl"}>
        <Stepper step={step} />

        {error && (
          <div data-testid="convert-error" className="mb-5 flex items-start gap-2 border border-destructive/40 bg-destructive/10 text-destructive rounded-sm px-3 py-2.5 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}

        {/* GENERATING OVERLAY */}
        {generating && (
          <div data-testid="generating-state" className="bg-card border border-zinc-800 rounded-md p-16 flex flex-col items-center justify-center min-h-[400px]">
            <div className="relative">
              <Loader2 className="w-10 h-10 text-signal animate-spin" />
            </div>
            <div className="mt-8 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-signal dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-signal dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-signal dot-3" />
            </div>
            <p className="mt-6 font-heading text-lg font-bold">{GEN_STAGES[genStage]}…</p>
            <p className="text-sm text-zinc-500 mt-1">Claude is reading your design pixel by pixel.</p>
          </div>
        )}

        {/* STEP 0 — UPLOAD */}
        {!generating && step === 0 && (
          <div className="bg-card border border-zinc-800 rounded-md p-6 sm:p-8 animate-fade-up">
            <div className="flex gap-2 mb-6">
              <button data-testid="mode-upload" onClick={() => setMode("upload")}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm text-sm border transition-colors ${mode === "upload" ? "border-white bg-white text-black font-semibold" : "border-zinc-700 text-zinc-400 hover:text-white"}`}>
                <Upload className="w-4 h-4" /> Upload
              </button>
              <button data-testid="mode-url" onClick={() => setMode("url")}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm text-sm border transition-colors ${mode === "url" ? "border-white bg-white text-black font-semibold" : "border-zinc-700 text-zinc-400 hover:text-white"}`}>
                <Link2 className="w-4 h-4" /> URL
              </button>
            </div>

            {mode === "upload" ? (
              imagePreview ? (
                <div className="relative border border-zinc-800 rounded-md overflow-hidden bg-[#0c0c0e]">
                  <img src={imagePreview} alt="preview" className="w-full max-h-[420px] object-contain" data-testid="image-preview" />
                  <button data-testid="clear-image" onClick={clearImage}
                    className="absolute top-3 right-3 bg-black/70 border border-white/20 rounded-sm p-1.5 hover:bg-black transition-colors">
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => fileRef.current?.click()}
                    className="absolute bottom-3 right-3 bg-black/70 border border-white/20 rounded-sm px-3 py-1.5 text-xs text-white hover:bg-black transition-colors">
                    Change
                  </button>
                </div>
              ) : (
                <div data-testid="upload-dropzone"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`border-2 border-dashed rounded-md p-16 flex flex-col items-center justify-center cursor-pointer transition-colors ${dragOver ? "border-signal bg-signal/5" : "border-zinc-700 hover:border-zinc-500"}`}>
                  <div className="w-14 h-14 rounded-md border border-zinc-700 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-zinc-400" />
                  </div>
                  <p className="mt-5 text-white font-medium">Drop your design here</p>
                  <p className="text-sm text-zinc-500 mt-1">PNG, JPG or WEBP · up to 10MB</p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Image URL</Label>
                <Input data-testid="image-url-input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…/design.png"
                  className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm h-11" />
                {imageUrl && (
                  <div className="border border-zinc-800 rounded-md overflow-hidden bg-[#0c0c0e] mt-3">
                    <img src={imageUrl} alt="" className="w-full max-h-[360px] object-contain" onError={(e) => (e.target.style.display = "none")} />
                  </div>
                )}
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])} data-testid="file-input" />

            <div className="flex justify-end mt-6">
              <Button data-testid="to-configure-btn" onClick={goConfigure}
                className="bg-white text-black hover:bg-zinc-200 rounded-sm h-11 px-6 font-bold">
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* STEP 1 — CONFIGURE */}
        {!generating && step === 1 && (
          <div className="bg-card border border-zinc-800 rounded-md p-6 sm:p-8 animate-fade-up">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Project name</Label>
                <Input data-testid="project-name" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Landing hero" className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Framework</Label>
                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger data-testid="framework-select" className="bg-[#0c0c0e] border-zinc-800 rounded-sm h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRAMEWORKS.map((f) => <SelectItem key={f} value={f} data-testid={`fw-${f}`}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Styling</Label>
                <Select value={styling} onValueChange={setStyling}>
                  <SelectTrigger data-testid="styling-select" className="bg-[#0c0c0e] border-zinc-800 rounded-sm h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((s) => <SelectItem key={s} value={s} data-testid={`st-${s}`}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">AI model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger data-testid="model-select" className="bg-[#0c0c0e] border-zinc-800 rounded-sm h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => <SelectItem key={m} value={m} data-testid={`md-${m}`}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Extra context (optional)</Label>
                <Textarea data-testid="prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. dark mode, mobile-first, add hover animations…"
                  className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm min-h-[96px]" />
              </div>
            </div>

            {imagePreview && (
              <div className="mt-6 border border-zinc-800 rounded-md overflow-hidden bg-[#0c0c0e] max-w-xs">
                <img src={imagePreview} alt="" className="w-full max-h-40 object-contain" />
              </div>
            )}

            <div className="flex justify-between mt-8">
              <Button data-testid="back-btn" variant="outline" onClick={() => setStep(0)}
                className="border-zinc-700 bg-transparent hover:bg-zinc-900 text-white rounded-sm h-11 px-5">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button data-testid="generate-code-button" onClick={generate}
                className="bg-signal hover:bg-signal-hover text-white rounded-sm h-11 px-6 font-bold">
                <Wand2 className="w-4 h-4 mr-2" /> Generate code
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — PLAYGROUND IDE */}
        {!generating && step === 2 && result && (
          <div className="animate-fade-up">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-heading text-xl font-bold tracking-tight">{result.name}</h2>
                <p className="text-sm text-zinc-500">{result.framework} · {result.styling} · {result.model}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center border border-zinc-800 rounded-sm">
                  <button data-testid="undo-btn" onClick={() => restore(currentIndex - 1)} disabled={currentIndex <= 0}
                    title="Undo" className="px-2.5 h-10 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors">
                    <Undo2 className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-zinc-500 px-2 border-x border-zinc-800 h-10 flex items-center" data-testid="version-indicator">
                    v{currentIndex + 1}/{versions.length}
                  </span>
                  <button data-testid="redo-btn" onClick={() => restore(currentIndex + 1)} disabled={currentIndex >= versions.length - 1}
                    title="Redo" className="px-2.5 h-10 text-zinc-300 hover:text-white disabled:opacity-30 transition-colors">
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>
                <Button data-testid="copy-code-btn" onClick={copyCode} variant="outline"
                  className="border-zinc-700 bg-transparent hover:bg-zinc-900 text-white rounded-sm h-10">
                  {copied ? <><Check className="w-4 h-4 mr-2 text-signal" /> Copied</> : <><Copy className="w-4 h-4 mr-2" /> Copy</>}
                </Button>
                <Button data-testid="download-code-btn" onClick={downloadCode} variant="outline"
                  className="border-zinc-700 bg-transparent hover:bg-zinc-900 text-white rounded-sm h-10">
                  <Download className="w-4 h-4 mr-2" /> Download
                </Button>
                <Button data-testid="new-project-btn" onClick={reset}
                  className="bg-white text-black hover:bg-zinc-200 rounded-sm h-10 font-bold">
                  <RotateCcw className="w-4 h-4 mr-2" /> New
                </Button>
              </div>
            </div>

            {/* IDE split: editor + preview */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Monaco editor */}
              <div className="bg-card border border-zinc-800 rounded-md overflow-hidden flex flex-col h-[560px]">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-[#0c0c0e]">
                  <Code2 className="w-4 h-4 text-signal" />
                  <span className="text-xs text-zinc-400 uppercase tracking-wider font-mono">{result.language}</span>
                </div>
                <div className="flex-1" data-testid="code-output">
                  <CodeEditor language={result.language} value={editorCode} onChange={setEditorCode} />
                </div>
              </div>

              {/* Preview / Original / DSL */}
              <Tabs defaultValue="preview" className="bg-card border border-zinc-800 rounded-md overflow-hidden flex flex-col h-[560px]">
                <TabsList className="bg-[#0c0c0e] border-b border-zinc-800 rounded-none w-full justify-start h-11 p-0 shrink-0">
                  <TabsTrigger value="preview" data-testid="tab-preview" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-white h-11 px-5">
                    <Eye className="w-4 h-4 mr-2" /> Preview
                  </TabsTrigger>
                  <TabsTrigger value="original" data-testid="tab-original" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-white h-11 px-5">
                    <ImageIcon className="w-4 h-4 mr-2" /> Original
                  </TabsTrigger>
                  <TabsTrigger value="dsl" data-testid="tab-dsl" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-white h-11 px-5">
                    <Braces className="w-4 h-4 mr-2" /> Tree
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="m-0 flex-1 overflow-hidden">
                  <LivePreview framework={result.framework} code={editorCode} />
                </TabsContent>
                <TabsContent value="original" className="m-0 flex-1 overflow-auto p-5 bg-[#0c0c0e]">
                  <img src={imagePreview} alt="original design" className="w-full object-contain mx-auto" />
                </TabsContent>
                <TabsContent value="dsl" className="m-0 flex-1 overflow-auto p-4 bg-[#0c0c0e]">
                  <pre data-testid="dsl-output" className="text-xs font-mono text-zinc-400 leading-relaxed">
                    {JSON.stringify(result.dsl, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>

            {/* Chat refinement dock */}
            <div className="mt-4 bg-card border border-zinc-800 rounded-md">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800">
                <Sparkles className="w-4 h-4 text-signal" />
                <span className="text-sm font-semibold">Refine with AI</span>
                <span className="text-xs text-zinc-500">— describe a change in plain English</span>
              </div>

              {chatMessages.length > 0 && (
                <div className="max-h-52 overflow-auto p-4 space-y-3" data-testid="chat-messages">
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                        m.role === "user" ? "bg-signal text-white" : "bg-[#0c0c0e] border border-zinc-800 text-zinc-300"
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {refining && (
                    <div className="flex justify-start">
                      <div className="bg-[#0c0c0e] border border-zinc-800 rounded-md px-3 py-2 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-signal dot-1" />
                        <span className="w-1.5 h-1.5 rounded-full bg-signal dot-2" />
                        <span className="w-1.5 h-1.5 rounded-full bg-signal dot-3" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 flex gap-2 border-t border-zinc-800">
                <Input
                  data-testid="chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendRefine(); }}
                  disabled={refining}
                  placeholder='e.g. "Make the primary button a gradient from indigo to purple"'
                  className="bg-[#0c0c0e] border-zinc-800 focus:border-zinc-500 rounded-sm h-11"
                />
                <Button data-testid="chat-send-btn" onClick={sendRefine} disabled={refining || !chatInput.trim()}
                  className="bg-signal hover:bg-signal-hover text-white rounded-sm h-11 px-5 font-bold shrink-0">
                  {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              <div className="px-3 pb-3 flex flex-wrap gap-2">
                {["Convert to a 3-column grid", "Add a dark mode card style", "Make it more spacious"].map((s) => (
                  <button key={s} data-testid={`chat-suggestion`} onClick={() => setChatInput(s)} disabled={refining}
                    className="text-xs border border-zinc-800 rounded-full px-3 py-1 text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

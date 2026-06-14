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
import {
  Upload, Link2, ImageIcon, X, Wand2, ArrowLeft, RotateCcw, Copy, Check,
  Download, AlertCircle, Code2, Eye, Loader2,
} from "lucide-react";

const FRAMEWORKS = ["React", "Vue 3", "Next.js", "HTML/CSS"];
const STYLES = ["Tailwind CSS", "CSS Modules", "Styled Components", "Plain CSS"];
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
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");

  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
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
        framework, styling, prompt,
        name: name || `Untitled • ${framework}`,
        ...(mode === "upload" ? { image_base64: imageB64 } : { image_url: imageUrl.trim() }),
      };
      const { data } = await api.post("/generate", payload);
      setResult(data);
      if (!imagePreview) setImagePreview(`data:image/png;base64,${data.image_base64}`);
      setStep(2);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      clearInterval(stageTimer.current);
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadCode = () => {
    const ext = EXT[result.framework] || "txt";
    const blob = new Blob([result.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(result.name || "component").replace(/[^a-z0-9]/gi, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep(0); setMode("upload"); clearImage(); setFramework("React");
    setStyling("Tailwind CSS"); setPrompt(""); setName(""); setResult(null); setError("");
  };

  const isHtml = result?.framework === "HTML/CSS";

  return (
    <DashboardLayout title="Converter">
      <div className="max-w-6xl">
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

        {/* STEP 2 — RESULT */}
        {!generating && step === 2 && result && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-heading text-xl font-bold tracking-tight">{result.name}</h2>
                <p className="text-sm text-zinc-500">{result.framework} · {result.styling}</p>
              </div>
              <div className="flex gap-2">
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

            <Tabs defaultValue="code" className="bg-card border border-zinc-800 rounded-md overflow-hidden">
              <TabsList className="bg-[#0c0c0e] border-b border-zinc-800 rounded-none w-full justify-start h-11 p-0">
                <TabsTrigger value="code" data-testid="tab-code" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-white h-11 px-5">
                  <Code2 className="w-4 h-4 mr-2" /> Code
                </TabsTrigger>
                <TabsTrigger value="preview" data-testid="tab-preview" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-white h-11 px-5">
                  <Eye className="w-4 h-4 mr-2" /> Preview
                </TabsTrigger>
                <TabsTrigger value="original" data-testid="tab-original" className="rounded-none data-[state=active]:bg-card data-[state=active]:text-white h-11 px-5">
                  <ImageIcon className="w-4 h-4 mr-2" /> Original
                </TabsTrigger>
              </TabsList>

              <TabsContent value="code" className="m-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-[#0c0c0e]">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">{result.language}</span>
                </div>
                <pre data-testid="code-output" className="p-5 overflow-auto max-h-[560px] text-sm font-mono text-zinc-300 leading-relaxed">
                  <code>{result.code}</code>
                </pre>
              </TabsContent>

              <TabsContent value="preview" className="m-0">
                {isHtml ? (
                  <iframe data-testid="preview-iframe" title="preview" srcDoc={result.code}
                    sandbox="allow-scripts" className="w-full h-[560px] bg-white" />
                ) : (
                  <div className="p-16 text-center text-zinc-500">
                    <Eye className="w-8 h-8 mx-auto text-zinc-700" />
                    <p className="mt-4">Live preview is available for HTML/CSS output.</p>
                    <p className="text-sm mt-1">Copy the {result.framework} code into your project to run it.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="original" className="m-0 p-5 bg-[#0c0c0e]">
                <img src={imagePreview} alt="original design" className="w-full max-h-[560px] object-contain mx-auto" />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

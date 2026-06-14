import { Link } from "react-router-dom";
import MarketingNav from "@/components/MarketingNav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Upload, Code2, Eye, Download, Copy, Zap, Layers, Palette,
  ArrowRight, MousePointerClick, Link2, FileCode2, Sparkles,
} from "lucide-react";

const frameworks = ["React", "Vue 3", "Next.js", "HTML/CSS"];
const styles = ["Tailwind CSS", "CSS Modules", "Styled Components", "Plain CSS"];

const features = [
  { icon: Upload, title: "Drag & drop upload", desc: "Drop a PNG or JPG onto the zone, up to 10MB. Instant preview." },
  { icon: Link2, title: "Paste a URL", desc: "Switch to URL mode and paste a direct image or Figma export link." },
  { icon: Layers, title: "4 frameworks", desc: "React, Vue 3, Next.js or plain HTML/CSS — your call." },
  { icon: Palette, title: "Your styling", desc: "Tailwind, CSS Modules, Styled Components or Plain CSS." },
  { icon: Eye, title: "Live preview", desc: "HTML output renders in a sandboxed iframe right next to the code." },
  { icon: Download, title: "Copy & download", desc: "One-click copy, or download as .jsx / .vue / .html." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-white">
      <MarketingNav />

      {/* HERO */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 border border-white/15 rounded-full px-3 py-1 text-xs text-zinc-400 mb-8">
              <Sparkles className="w-3 h-3 text-signal" />
              Powered by Claude Sonnet 4.6 Vision
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter leading-[0.92]">
              Screenshot in.
              <br />
              <span className="text-signal">Production code</span> out.
            </h1>
            <p className="mt-7 text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed">
              Upload any UI design and UI2Code returns clean, responsive components
              in the framework and styling library you actually use.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Link to="/signup">
                <Button data-testid="hero-start-btn" className="bg-signal hover:bg-signal-hover text-white rounded-sm h-12 px-7 text-sm font-bold w-full sm:w-auto">
                  Start converting <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button data-testid="hero-pricing-btn" variant="outline" className="border-white/20 bg-transparent hover:bg-white/5 text-white rounded-sm h-12 px-7 text-sm font-bold w-full sm:w-auto">
                  View pricing
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm text-zinc-500">
              <span><span className="text-white font-bold">4</span> frameworks</span>
              <span><span className="text-white font-bold">4</span> styling libraries</span>
              <span><span className="text-white font-bold">~15s</span> avg generation</span>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO FEATURES */}
      <section id="features" className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 font-bold">Everything you need</span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mt-2">Built for shipping fast.</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(0,1fr)]">
          {/* Big tile */}
          <div className="md:col-span-2 md:row-span-2 bg-card border border-zinc-800 rounded-md p-8 flex flex-col justify-between min-h-[320px] relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-30" />
            <div className="relative">
              <Code2 className="w-8 h-8 text-signal mb-5" />
              <h3 className="font-heading text-2xl font-bold tracking-tight">AI code generation</h3>
              <p className="text-zinc-400 mt-3 max-w-md leading-relaxed">
                Claude analyzes your design pixel by pixel and returns a complete,
                production-ready component — semantic, responsive, accessible.
              </p>
            </div>
            <div className="relative mt-8 bg-[#0c0c0e] border border-zinc-800 rounded-sm p-4 font-mono text-xs text-zinc-400 leading-relaxed">
              <span className="text-signal">{"<"}</span>
              <span className="text-zinc-200">Hero</span> className=<span className="text-emerald-400">"flex flex-col"</span>
              <span className="text-signal">{">"}</span>
              <br />
              &nbsp;&nbsp;<span className="text-zinc-600">// generated in 14s</span>
            </div>
          </div>

          {features.slice(0, 4).map((f) => (
            <div key={f.title} className="bg-card border border-zinc-800 rounded-md p-6 hover:border-zinc-600 transition-colors duration-150">
              <f.icon className="w-6 h-6 text-white mb-4" />
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
          {features.slice(4).map((f) => (
            <div key={f.title} className="bg-card border border-zinc-800 rounded-md p-6 hover:border-zinc-600 transition-colors duration-150">
              <f.icon className="w-6 h-6 text-white mb-4" />
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-7xl mx-auto px-5 sm:px-8 py-20">
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 font-bold">3 steps</span>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mt-2 mb-12">How it works.</h2>
        <div className="grid md:grid-cols-3 gap-px bg-zinc-800 border border-zinc-800 rounded-md overflow-hidden">
          {[
            { n: "01", icon: MousePointerClick, t: "Upload your design", d: "Drag in a screenshot or paste an image URL." },
            { n: "02", icon: Zap, t: "Pick your stack", d: "Choose a framework, styling library, and add any context." },
            { n: "03", icon: FileCode2, t: "Get your code", d: "Copy, preview live, or download the file. Done." },
          ].map((s) => (
            <div key={s.n} className="bg-card p-8">
              <div className="flex items-center justify-between">
                <span className="font-heading text-4xl font-black text-zinc-800">{s.n}</span>
                <s.icon className="w-6 h-6 text-signal" />
              </div>
              <h3 className="font-semibold text-white mt-6">{s.t}</h3>
              <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* STACK STRIP */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-20">
        <div className="bg-card border border-zinc-800 rounded-md p-8 grid md:grid-cols-2 gap-8">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 font-bold">Frameworks</span>
            <div className="flex flex-wrap gap-2 mt-4">
              {frameworks.map((f) => (
                <span key={f} className="border border-zinc-700 rounded-sm px-3 py-1.5 text-sm text-zinc-300">{f}</span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 font-bold">Styling</span>
            <div className="flex flex-wrap gap-2 mt-4">
              {styles.map((s) => (
                <span key={s} className="border border-zinc-700 rounded-sm px-3 py-1.5 text-sm text-zinc-300">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-24">
        <div className="relative bg-signal rounded-md p-10 sm:p-16 overflow-hidden">
          <div className="relative">
            <h2 className="font-heading text-3xl sm:text-5xl font-black tracking-tighter text-white max-w-2xl leading-[0.95]">
              Stop rebuilding designs by hand.
            </h2>
            <p className="text-white/80 mt-4 max-w-md">Sign up free and convert your first design in under a minute.</p>
            <Link to="/signup">
              <Button data-testid="cta-signup-btn" className="mt-8 bg-black text-white hover:bg-zinc-900 rounded-sm h-12 px-8 font-bold">
                Get started free <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

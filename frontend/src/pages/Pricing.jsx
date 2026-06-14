import { Link } from "react-router-dom";
import MarketingNav from "@/components/MarketingNav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Free", price: "$0", period: "/forever", testid: "plan-free",
    desc: "For trying it out and small projects.",
    features: ["20 conversions / month", "React, Vue, Next.js, HTML", "Live preview", "Copy & download"],
    cta: "Get started", accent: false,
  },
  {
    name: "Pro", price: "$19", period: "/month", testid: "plan-pro",
    desc: "For developers shipping every day.",
    features: ["Unlimited conversions", "Priority generation", "All frameworks & styling", "Project history", "Download as files"],
    cta: "Go Pro", accent: true,
  },
  {
    name: "Team", price: "$59", period: "/month", testid: "plan-team",
    desc: "For teams building products together.",
    features: ["Everything in Pro", "5 team seats", "Shared project library", "Priority support"],
    cta: "Start team trial", accent: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background text-white">
      <MarketingNav />
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-36 pb-24">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-[0.2em] text-zinc-600 font-bold">Pricing</span>
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tighter mt-3">Simple, honest pricing.</h1>
          <p className="text-zinc-400 mt-4">Start free. Upgrade when you're shipping more.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-14">
          {plans.map((p) => (
            <div key={p.name} data-testid={p.testid}
              className={`rounded-md p-8 flex flex-col ${p.accent ? "bg-card border-2 border-signal" : "bg-card border border-zinc-800"}`}>
              {p.accent && <span className="self-start text-xs font-bold uppercase tracking-wider bg-signal text-white px-2 py-1 rounded-sm mb-4">Most popular</span>}
              <h3 className="font-heading text-xl font-bold">{p.name}</h3>
              <p className="text-sm text-zinc-500 mt-1">{p.desc}</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="font-heading text-5xl font-black tracking-tighter">{p.price}</span>
                <span className="text-zinc-500 mb-1.5 text-sm">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-signal shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="mt-8">
                <Button data-testid={`${p.testid}-cta`}
                  className={`w-full rounded-sm h-11 font-bold ${p.accent ? "bg-signal hover:bg-signal-hover text-white" : "bg-white text-black hover:bg-zinc-200"}`}>
                  {p.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}

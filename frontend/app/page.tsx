import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingDemo } from "@/components/landing-demo";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber" />
          </span>
          <span className="font-display italic text-xl text-amber">HeyYou</span>
        </div>
        <Button asChild size="sm" className="rounded-full px-5">
          <Link href="/create">Create Greeter</Link>
        </Button>
      </nav>

      {/* ── HERO ── */}
      <section className="min-h-screen flex items-center justify-center px-6 pt-20 pb-16 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(251,146,60,0.08)_0%,transparent_70%)] pointer-events-none" />

        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — Copy */}
          <div className="flex flex-col items-start">
            <Badge variant="outline" className="mb-6 py-1 px-3 text-xs">
              <span className="text-amber mr-1">✦</span> Powered by vision AI
            </Badge>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[0.95] tracking-tight">
              Every visitor gets a{" "}
              <span className="text-amber italic">standing ovation.</span>
            </h1>

            <p className="mt-6 text-muted-foreground text-lg leading-relaxed max-w-lg">
              Mount a screen at your entrance. HeyYou sees who walks in and
              delivers a real-time, personalized spoken compliment — powered by
              AI vision. No faces saved. Just vibes.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <Button asChild size="lg" className="rounded-full px-7 font-semibold">
                <Link href="/create">Create Your Own</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-7">
                <Link href="/greeter/demo">Try Demo</Link>
              </Button>
            </div>
          </div>

          {/* Right — Fake Demo */}
          <div className="flex justify-center lg:justify-end">
            <LandingDemo />
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber text-center mb-3">
            Why it&apos;s different
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-center mb-14 tracking-tight">
            Not a chatbot. A vibe machine.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card"
              >
                <div className="shrink-0 w-7 h-7 rounded-full bg-amber/10 text-amber flex items-center justify-center text-xs font-bold mt-0.5">
                  ✓
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-6 text-center relative">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(251,146,60,0.06)_0%,transparent_70%)] pointer-events-none" />
        <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-4">
          Make your entrance<br />unforgettable.
        </h2>
        <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
          Open source. Free to deploy. Ready in minutes.
        </p>
        <Button asChild size="lg" className="rounded-full px-8 font-semibold">
          <Link href="/create">Create Your Own</Link>
        </Button>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" />
            <span className="font-display italic text-sm text-amber">HeyYou</span>
          </div>
          <span>Built with Stream Vision Agents · Gemini · YOLO</span>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    title: "Real-time vision AI",
    description:
      "Sees outfits, accessories, colors, group size — and crafts a compliment in 2–4 seconds.",
  },
  {
    title: "Speaks out loud",
    description:
      "No text-only chatbots. HeyYou talks through the device speakers with natural voice.",
  },
  {
    title: "Privacy-first, always",
    description:
      "Zero faces saved. Zero personal data stored. The camera feed is processed in real-time and discarded.",
  },
  {
    title: "Works in a browser",
    description:
      "No app install. No special hardware. Just open a URL on any screen with a camera.",
  },
];

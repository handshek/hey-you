import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(251,146,60,0.06) 0%, transparent 60%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center max-w-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          {/* Bot face mini icon */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center border border-amber/20"
            style={{
              background:
                "radial-gradient(circle at 40% 35%, #292524 0%, #1c1917 60%, #0C0A09 100%)",
              boxShadow: "0 0 30px rgba(251,146,60,0.1)",
            }}
          >
            <svg viewBox="0 0 100 100" fill="none" className="w-10 h-10">
              <ellipse cx="38" cy="40" rx="5" ry="6" fill="#FB923C" />
              <ellipse cx="62" cy="40" rx="5" ry="6" fill="#FB923C" />
              <path
                d="M 35 55 Q 50 62 65 55"
                stroke="#FB923C"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="font-display text-6xl md:text-7xl italic text-foreground tracking-tight">
            HeyYou
          </h1>
        </div>

        {/* Tagline */}
        <p className="text-lg md:text-xl text-muted-foreground font-light leading-relaxed max-w-md">
          AI-powered greetings for every entrance
        </p>

        {/* Separator line */}
        <div className="w-12 h-px bg-amber/30" />

        {/* Description */}
        <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-sm">
          Mount a device at your door. Configure the vibe. Let your AI greeter
          deliver personalized compliments to every person who walks in.
        </p>

        {/* CTA */}
        <Link
          href="/spaces/new"
          className="group relative mt-4 inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-amber text-[#0C0A09] font-medium text-sm transition-all duration-300 hover:shadow-[0_0_30px_rgba(251,146,60,0.3)] hover:scale-105 active:scale-100"
          id="get-started-button"
        >
          Get Started
          <svg
            className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {/* Bottom fade text */}
      <div className="absolute bottom-8 text-center">
        <p className="text-xs text-muted-foreground/40 tracking-widest uppercase">
          Retail · Cafés · Hotels · Gyms · Events
        </p>
      </div>
    </main>
  );
}

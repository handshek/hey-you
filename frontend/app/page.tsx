import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0C0A09] text-foreground flex items-center justify-center px-6">
      <section className="w-full max-w-xl text-center">
        <h1 className="font-display text-6xl md:text-7xl italic text-amber">
          HeyYou
        </h1>
        <p className="mt-4 text-muted-foreground text-lg">
          AI greeter setup starts here.
        </p>
        <p className="mt-2 text-sm text-muted-foreground/70">
          Create your greeter configuration, then launch a live session.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center justify-center mt-8 px-7 py-3 rounded-full bg-amber text-[#0C0A09] font-medium hover:bg-amber/90 transition-colors"
          id="get-started-button"
        >
          Create Greeter
        </Link>
      </section>
    </main>
  );
}

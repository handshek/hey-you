import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0C0A09] text-foreground flex items-center justify-center px-6">
      <section className="text-center">
        <p className="text-muted-foreground text-sm tracking-widest uppercase">
          404
        </p>
        <h1 className="mt-3 font-display italic text-5xl text-amber">
          Page not found
        </h1>
        <p className="mt-3 text-muted-foreground">
          This route does not exist in the simplified app.
        </p>
        <Link
          href="/"
          className="inline-flex mt-8 px-6 py-2.5 rounded-full bg-amber text-[#0C0A09] font-medium hover:bg-amber/90 transition-colors"
        >
          Go Home
        </Link>
      </section>
    </main>
  );
}

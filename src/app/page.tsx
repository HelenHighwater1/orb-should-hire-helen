import { Sandbox } from "@/components/Sandbox";

export default function Home() {
  return (
    <main className="flex flex-col h-screen max-h-screen px-4 py-6 md:px-6 md:py-8">
      <header className="mb-6 text-center shrink-0">
        <p className="text-base md:text-lg text-muted italic max-w-2xl mx-auto leading-relaxed">
          &ldquo;You&rsquo;re a SaaS founder. You just launched an API. Watch
          what happens when customers start using it.&rdquo;
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 flex-1 min-h-0">
        <Sandbox />
      </div>
    </main>
  );
}

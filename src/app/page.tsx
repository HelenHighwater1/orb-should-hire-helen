import { Sandbox } from "@/components/Sandbox";

export default function Home() {
  return (
    <main className="flex h-screen max-h-screen flex-col px-4 pb-6 pt-14 md:px-6 md:py-8">
      <header className="mb-6 shrink-0 text-center md:mb-6">
        <p className="mx-auto max-w-2xl text-base italic leading-relaxed text-muted md:text-lg">
          &ldquo;You&rsquo;re a SaaS founder. You just launched an API. Watch
          what happens when customers start using it.&rdquo;
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-0 md:grid md:grid-cols-3 md:gap-6">
        <Sandbox />
      </div>
    </main>
  );
}

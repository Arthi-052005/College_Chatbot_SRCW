import { useEffect, useState } from "react";
import { ExternalLink, Library, Mail, MapPin, Phone, WifiOff } from "lucide-react";
import Chat from "@/components/Chat";
import { getHealth } from "@/lib/api";

const LINKS = [
  { label: "Admission enquiry", href: "https://srcw.ac.in/admissionenquiry" },
  { label: "Programmes offered", href: "https://srcw.ac.in/programmesoffered" },
  { label: "Placement cell", href: "https://srcw.ac.in/placement" },
  { label: "Online fee payment", href: "https://srcw.ac.in/onlinepayment" },
  { label: "College website", href: "https://srcw.ac.in/" },
];

export default function App() {
  const [health, setHealth] = useState(null); // null = checking, false = backend down

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(false));
  }, []);

  const ready = !!health && health.chunks > 0;

  return (
    <div className="grid h-screen grid-cols-1 md:grid-cols-[310px_1fr]">
      {/* ── Sidebar ── */}
      <aside className="brand-sidebar hidden flex-col gap-6 overflow-y-auto p-6 md:flex">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-xl shadow-black/20 ring-4 ring-gold/40">
            <img src="/logo.png" alt="SRCW logo" className="h-[4.4rem] w-auto" />
          </div>
          <h1 className="mt-4 text-lg font-semibold leading-snug">
            Sri Ramakrishna College of Arts &amp; Science for Women
          </h1>
          <p className="mt-1 text-xs tracking-wide text-gold">EDUCATE TO EMPOWER</p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[10px] font-medium">
            <span className="rounded-full bg-white/15 px-2.5 py-1">NAAC A+</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">Autonomous</span>
            <span className="rounded-full bg-white/15 px-2.5 py-1">Bharathiar Univ.</span>
          </div>
        </div>

        <nav className="space-y-1.5">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-white/60">Quick links</p>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white/90 transition hover:bg-white/10"
            >
              {l.label}
              <ExternalLink className="size-3.5 text-white/50" />
            </a>
          ))}
        </nav>

        <div className="space-y-2 text-xs text-white/80">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-white/60">Contact</p>
          <p className="flex gap-2 px-1"><MapPin className="mt-0.5 size-3.5 shrink-0 text-gold" />395, Sarojini Naidu Road, New Siddhapudur, Coimbatore - 641044</p>
          <a href="tel:+917373144766" className="flex gap-2 px-1 hover:text-white"><Phone className="mt-0.5 size-3.5 shrink-0 text-gold" />+91 7373144766</a>
          <a href="mailto:enquiry@srcw.ac.in" className="flex gap-2 px-1 hover:text-white"><Mail className="mt-0.5 size-3.5 shrink-0 text-gold" />enquiry@srcw.ac.in</a>
        </div>

        <div className="mt-auto space-y-2 text-xs">
          {health === null && (
            <p className="flex items-center gap-2 text-white/70 animate-fade-in">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white/60" /> Checking backend…
            </p>
          )}
          {health === false && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-500/20 p-3 text-red-100 animate-fade-in">
              <WifiOff className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">Backend not reachable</p>
                <p className="mt-0.5 opacity-80">Run: uvicorn app.main:app --reload</p>
              </div>
            </div>
          )}
          {health && !ready && (
            <div role="alert" className="rounded-lg bg-red-500/20 p-3 text-red-100 animate-fade-in">
              Knowledge base is empty. Add files to backend/knowledge/ and restart the backend.
            </div>
          )}
          {ready && (
            <p className="flex items-center gap-2 text-white/70 animate-fade-in" title={`${health.provider} · ${health.model}`}>
              <Library className="size-3.5 text-gold" />
              {health.files} documents · {health.chunks} passages loaded
            </p>
          )}
        </div>
      </aside>

      {/* ── Mobile header (sidebar is hidden on small screens) ── */}
      <main className="chat-bg relative flex min-h-0 flex-col">
        <header className="brand-sidebar flex items-center gap-3 px-4 py-3 md:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
            <img src="/logo.png" alt="SRCW" className="h-8 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">SRCW Assistant</p>
            <p className="text-[11px] text-gold">Educate to Empower</p>
          </div>
        </header>
        <div className="min-h-0 flex-1">
          <Chat ready={ready} />
        </div>
        {health === false && (
          <div className="absolute inset-x-4 bottom-24 rounded-lg bg-destructive px-3 py-2 text-xs text-white md:hidden">
            Backend not reachable. Start it with uvicorn.
          </div>
        )}
      </main>
    </div>
  );
}

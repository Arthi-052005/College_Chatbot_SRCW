import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  BookOpen, Briefcase, Building2, ClipboardList, ExternalLink, FileText,
  GraduationCap, Loader2, MessageSquarePlus, SendHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { askQuestion } from "@/lib/api";

const STARTERS = [
  { icon: BookOpen, title: "Courses offered", sub: "UG, PG and Ph.D. programmes", q: "What courses does the college offer?" },
  { icon: ClipboardList, title: "Admission", sub: "Eligibility and how to apply", q: "How do I apply for admission and what is the eligibility?" },
  { icon: Briefcase, title: "Placements", sub: "Training, recruiters, statistics", q: "Tell me about the placement cell" },
  { icon: Building2, title: "Campus facilities", sub: "Library, hostel, transport", q: "What facilities are available on campus?" },
];

/* Short label for a source: a URL path, a file name, plus page number for PDFs */
function sourceLabel(s) {
  let name = s.source || "document";
  if (/^https?:/.test(name)) {
    try {
      const u = new URL(name);
      const last = u.pathname.replace(/\/$/, "").split("/").pop();
      name = last ? last.replace(/[-_]/g, " ") : u.hostname;
    } catch { /* keep as is */ }
  } else {
    name = name.split("/").pop().replace(/\.(pdf|txt|md)$/i, "").replace(/[-_]/g, " ");
  }
  return s.page ? `${name} p.${s.page}` : name;
}

/* College logo used as the assistant's avatar */
function BotAvatar({ size = 32 }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-gold/50 bg-white shadow-sm"
      style={{ width: size, height: size }}
    >
      <img src="/logo.png" alt="SRCW" className="object-contain" style={{ width: size * 0.62, height: size * 0.62 }} />
    </div>
  );
}

/* Typing indicator shown while the answer is being generated */
function Typing() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <BotAvatar />
      <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
        <div className="thinking-dots flex items-center gap-1.5">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

/* Clickable source badges under an answer */
function CitationBadges({ sources, onCitationClick }) {
  if (!sources?.length) return null;
  const map = new Map();
  for (const s of sources) {
    const key = sourceLabel(s);
    const prev = map.get(key);
    if (!prev || s.score > prev.score) map.set(key, s);
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Source</span>
      {[...map.entries()].map(([label, src]) => (
        <Badge
          key={label}
          variant="citation"
          role="button"
          tabIndex={0}
          title={`Show source (match ${src.score})`}
          onClick={() => onCitationClick(label)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onCitationClick(label); }}
        >
          <FileText className="size-3" />
          {label}
        </Badge>
      ))}
    </div>
  );
}

/* Expanded source passages */
function Sources({ sources, highlightPage }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 space-y-2 animate-fade-in">
      <p className="text-xs font-medium text-muted-foreground">Passages used ({sources.length})</p>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {sources.map((s, i) => (
          <div
            key={i}
            data-page={sourceLabel(s)}
            className={`rounded-lg border p-3 text-sm transition-all duration-300 ${
              highlightPage === sourceLabel(s)
                ? "border-gold bg-gold/10 ring-1 ring-gold/30"
                : "border-border bg-background/60"
            }`}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{sourceLabel(s)}</Badge>
              {/^https?:/.test(s.source || "") && (
                <a href={s.source} target="_blank" rel="noreferrer" className="text-primary" title="Open page">
                  <ExternalLink className="size-3" />
                </a>
              )}
              <span className="text-[10px] text-muted-foreground">match {s.score}</span>
            </div>
            <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">{s.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Chat Component ── */
export default function Chat({ ready }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  function onCitation(msgIndex, label) {
    setExpanded(msgIndex);
    setHighlight(label);
    requestAnimationFrame(() => {
      const el = [...document.querySelectorAll("[data-page]")].find((n) => n.dataset.page === label);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setTimeout(() => setHighlight(null), 2000);
  }

  async function send(question) {
    const q = question.trim();
    if (!q || busy || !ready) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    setExpanded(null);
    try {
      const res = await askQuestion(q);
      setMessages((m) => [...m, { role: "assistant", content: res.answer, sources: res.sources }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${ready ? "animate-ping bg-primary" : "bg-destructive"}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ready ? "bg-primary" : "bg-destructive"}`} />
          </span>
          <span className="text-sm font-semibold text-foreground">SRCW Assistant</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">· Ask me anything about the college</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setExpanded(null); }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-muted"
          >
            <MessageSquarePlus className="size-3.5" /> New chat
          </button>
        )}
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-6">

          {/* Welcome */}
          {messages.length === 0 && (
            <div className="animate-fade-in pt-4 text-center sm:pt-10">
              <img src="/logo.png" alt="SRCW logo" className="mx-auto h-24 w-auto drop-shadow-md sm:h-28" />
              <h2 className="mt-5 font-serif text-3xl font-medium tracking-tight sm:text-4xl">
                Welcome to <span className="gold-text">SRCW</span>
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Sri Ramakrishna College of Arts &amp; Science for Women, Coimbatore. Ask about courses,
                admissions, placements and campus life.
              </p>

              <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
                {STARTERS.map(({ icon: Icon, title, sub, q }) => (
                  <button
                    key={title}
                    disabled={!ready}
                    onClick={() => send(q)}
                    className="group flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-foreground">{title}</span>
                      <span className="block text-xs text-muted-foreground">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end animate-message-in">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-[#0a5a3a] px-4 py-2.5 text-sm text-white shadow-md shadow-primary/20">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-3 animate-message-in">
                <BotAvatar />
                <div className="min-w-0 max-w-[88%]">
                  <div
                    className={`rounded-2xl rounded-tl-md border bg-card px-5 py-4 shadow-sm ${
                      m.error ? "border-destructive/40" : "border-border border-l-[3px] border-l-gold"
                    }`}
                  >
                    {m.error ? (
                      <p className="text-sm text-destructive">{m.content}</p>
                    ) : (
                      <div className="answer text-[15px] leading-relaxed text-foreground">
                        <ReactMarkdown
                          components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {!m.error && <CitationBadges sources={m.sources} onCitationClick={(l) => onCitation(i, l)} />}
                    {!m.error && expanded === i && <Sources sources={m.sources} highlightPage={highlight} />}
                  </div>
                </div>
              </div>
            )
          )}

          {busy && <Typing />}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-border bg-card/80 px-4 py-4 backdrop-blur">
        <form
          className="mx-auto flex max-w-3xl items-center gap-2 rounded-full border border-border bg-white py-1.5 pl-5 pr-1.5 shadow-sm transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20"
          onSubmit={(e) => { e.preventDefault(); send(input); }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!ready || busy}
            placeholder={ready ? "Ask about SRCW…" : "Knowledge base not loaded"}
            aria-label="Your question"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!ready || busy || !input.trim()}
            aria-label="Send question"
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/30 transition hover:bg-[#0a5a3a] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Answers come from the college&apos;s documents. For fees and dates, please confirm with the college office.
        </p>
      </div>
    </div>
  );
}

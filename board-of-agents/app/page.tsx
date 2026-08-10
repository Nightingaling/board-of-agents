"use client";

import { FormEvent, useState } from "react";

type Bubble = { id: string; label: string; role: string; text: string; status: "waiting" | "streaming" | "done" | "unavailable"; startedAt: number | null; durationMs: number | null };

const initialBubbles: Bubble[] = [
  { id: "cfo", label: "CFO", role: "Finance", text: "", status: "waiting", startedAt: null, durationMs: null },
  { id: "cmo", label: "CMO", role: "Marketing", text: "", status: "waiting", startedAt: null, durationMs: null },
  { id: "coo", label: "COO", role: "Operations", text: "", status: "waiting", startedAt: null, durationMs: null },
  { id: "strategy", label: "Strategy", role: "Growth strategy", text: "", status: "waiting", startedAt: null, durationMs: null },
  { id: "synthesis", label: "Final brief", role: "Chief of Staff", text: "", status: "waiting", startedAt: null, durationMs: null },
];

const demoMetrics = `Brand: Kaya Skin Co. - 8-month-old Singapore DTC skincare brand.
Tagline: Southeast Asian botanicals, modern formulas.
Team: 4 (founder, two part-time ops, one freelance video editor).
Channels: Shopify, TikTok Shop, Meta, Google.

Last week (week ending Sunday):
- Revenue: S$52,400 (prior week S$48,100, +9%)
- Orders: 487 (prior week 461)
- AOV: S$107.60 (prior week S$104.30)
- Refund rate: 4.8% (prior week 3.1%, trending up)
- Meta ads: S$18,200 spend (up from S$14,900), ROAS 1.37x (down from 1.62x)
- Google ads: S$5,800 spend, S$8,400 revenue, ROAS 1.45x (steady)
- TikTok Shop: S$11,500 (prior week S$9,200, +25%)
- Email/WhatsApp repeat buyers: S$5,600 (steady)
- New customers: 387 (prior week 351)
- Repeat customers: 100 (prior week 110, trending down)
- Blended CAC: S$62.10 (prior week S$54.80, up)
- Top SKU: Vitamin C Serum "Glow 15" - 38% of revenue
- Glow 15 stock on hand: 11 days; restock waitlist: 240 customers
- Glow 15 refund reasons: "broke me out" 12, "didn't see results" 8, "changed mind" 3

Customer voice (Instagram DM):
"I love the Glow 15 serum, the texture is amazing. But after 4 days I broke out badly on my cheeks. My skin is sensitive. I still want to use it but I'm scared now."

Decisions on the table:
1. Shift S$8,000 from Meta ads into a TikTok creator campaign with 10 micro-influencers in SG/MY.
2. Reformulate Glow 15 or ride the waitlist and relaunch fresh in 60 days.
3. Hire a part-time customer-success contractor for about S$1,800/month.
4. Raise Glow 15 price by 8% based on inelastic waitlist demand.

Board question: Is the rising refund rate a product problem, a customer-success problem, or a normal scale-up cost? Where should the next marketing dollar go?`;

const examples = [
  { label: "DTC brand", industry: "DTC skincare in Singapore", metrics: demoMetrics },
  { label: "B2B SaaS", industry: "B2B workflow software for mid-market finance teams", metrics: "Revenue: $184,000 MRR (+6% MoM)\nNew logos: 9 (down from 13)\nNet revenue retention: 108%\nGross margin: 76%\nCAC: $18,400\nCAC payback: 14 months\nTrial-to-paid: 8.2%\nChurn: 1.9% monthly\nSales cycle: 74 days\nSupport backlog: 42 tickets, oldest 11 days\nExpansion pipeline: $310,000\nThe founder wants to double paid acquisition before the next quarter." },
  { label: "Local cafe", industry: "Independent neighbourhood cafe in Melbourne", metrics: "Weekly revenue: A$31,800 (+4%)\nAverage ticket: A$14.20\nTransactions: 2,239\nGross margin: 64%\nLabour: 38% of revenue\nFood waste: A$1,460\nDelivery platforms: 17% of revenue at 29% commission\nSaturday sell-through: 96% by 1pm\nWeekday afternoon traffic: down 18%\nRepeat customers: 42%\nTeam: 7 staff, 2 casuals\nThe owner is considering a second location and a loyalty app." },
];

function TypingIndicator() {
  return <span className="typing" aria-label="Typing"><i /><i /><i /></span>;
}

export default function Home() {
  const [industry, setIndustry] = useState("DTC skincare in Singapore");
  const [metrics, setMetrics] = useState(demoMetrics);
  const [bubbles, setBubbles] = useState(initialBubbles);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const [showDissent, setShowDissent] = useState(false);

  async function runBoard(industryValue: string, metricsValue: string) {
    setRunning(true);
    setHasRun(true);
    setError("");
    setBubbles(initialBubbles);
    try {
      const response = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: industryValue, metrics: metricsValue }),
      });
      if (!response.ok || !response.body) throw new Error("We couldn't start the board. Please check the brief and try again.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let message: { type: string; [key: string]: unknown };
          try {
            message = JSON.parse(line);
          } catch {
            continue;
          }
          if (message.type === "error") throw new Error(String(message.message || "We couldn't finish the board. Please try again."));
          if (message.type === "start") setBubbles((current) => current.map((bubble) => bubble.id === message.id ? { ...bubble, label: String(message.label), role: String(message.role), status: "streaming", startedAt: Date.now(), durationMs: null } : bubble));
          if (message.type === "delta") setBubbles((current) => current.map((bubble) => bubble.id === message.id ? { ...bubble, text: bubble.text + message.text, status: "streaming" } : bubble));
          if (message.type === "unavailable") setBubbles((current) => current.map((bubble) => bubble.id === message.id ? { ...bubble, status: "unavailable", text: String(message.message), durationMs: bubble.startedAt ? Date.now() - bubble.startedAt : null } : bubble));
          if (message.type === "done") setBubbles((current) => current.map((bubble) => bubble.id === message.id && bubble.status !== "unavailable" ? { ...bubble, status: "done", durationMs: bubble.startedAt ? Date.now() - bubble.startedAt : null } : bubble));
        }
        if (done) break;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't finish the board. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="board-shell">
      <header className="board-header"><div><p className="eyebrow">BOARD / 01</p><h1>Four views. One clear move.</h1></div><p className="header-note">A live leadership room for the week ahead.</p></header>
      <section className="board-grid">
        <form className="brief-panel" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void runBoard(industry, metrics); }}>
          <div><p className="eyebrow">Brief the room</p><h2>What should the board know?</h2></div>
          <div className="example-picker"><span className="field-label">Start with an example</span><div className="example-chips">{examples.map((example) => <button className="example-chip" key={example.label} type="button" disabled={running} onClick={() => { setIndustry(example.industry); setMetrics(example.metrics); void runBoard(example.industry, example.metrics); }}>{example.label}<span aria-hidden="true">↗</span></button>)}</div></div>
          <label>Industry<input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="e.g. DTC skincare in Singapore" /></label>
          <label>Last week’s metrics<textarea value={metrics} onChange={(event) => setMetrics(event.target.value)} placeholder="Revenue, CAC, retention, ROAS..." rows={8} required /></label>
          <button type="submit" disabled={running}>{running ? "Board is thinking..." : "Run the board"}<span aria-hidden="true">→</span></button>{error && <p className="error-message">{error}</p>}<p className="panel-footnote">Four agents run in parallel. The Chief of Staff waits for all four before writing the brief.</p>
        </form>
        <section className="conversation" aria-live="polite">
          <div className="conversation-heading"><div><p className="eyebrow">Live conversation</p><div className="advisors-strip"><span className="advisors-label">Advisors</span><span className="advisor-name advisor-cfo">CFO</span><span className="advisor-name advisor-cmo">CMO</span><span className="advisor-name advisor-coo">COO</span><span className="advisor-name advisor-strategy">Strategy</span></div></div><div className="conversation-tools"><label className="toggle-label"><input type="checkbox" checked={showDissent} onChange={(event) => setShowDissent(event.target.checked)} /> <span>Show dissent</span></label><span>{running ? "Streaming" : "Ready"}</span></div></div>
          {showDissent && hasRun && <DissentPanel bubbles={bubbles} />}
          {!hasRun && !running ? <div className="empty-state"><span className="empty-mark">+</span><strong>The room is waiting for a brief.</strong><p>Choose an example above or add your own metrics to convene the advisors.</p></div> : <div className="bubble-list">{bubbles.map((bubble) => bubble.id === "synthesis" ? <div className="synthesis-wrap" key={bubble.id}><div className={`synthesis-divider ${bubble.status === "waiting" ? "synthesis-divider-pending" : "synthesis-divider-landed"}`}><span>Final Brief for the Founder</span></div><article className="bubble bubble-synthesis" aria-label="Final brief"><BubbleContent bubble={bubble} /></article></div> : <article className={`bubble bubble-${bubble.id} ${bubbleColorClasses[bubble.id]}`} key={bubble.id}><BubbleContent bubble={bubble} /></article>)}</div>}
          {error && <div className="retry-panel" role="alert"><span>{error}</span><button type="button" onClick={() => void runBoard(industry, metrics)} disabled={running}>Retry <span aria-hidden="true">↗</span></button></div>}
        </section>
      </section>
    </main>
  );
}

const bubbleColorClasses: Record<string, string> = { cfo: "bg-amber-100 border-amber-300", cmo: "bg-blue-100 border-blue-300", coo: "bg-emerald-100 border-emerald-300", strategy: "bg-purple-100 border-purple-300" };

function BubbleContent({ bubble }: { bubble: Bubble }) {
  const showStats = Boolean(bubble.text) && (bubble.status === "done" || bubble.status === "unavailable");
  return <><div className="bubble-meta"><div><strong>{bubble.label}</strong><span>{bubble.role}</span></div><span className={`status status-${bubble.status}`}>{bubble.status === "streaming" ? "Live" : bubble.status === "done" ? "Done" : bubble.status === "unavailable" ? "Unavailable" : "Queued"}</span></div><div className="bubble-copy">{bubble.text || (bubble.status === "streaming" ? <TypingIndicator /> : <span className="placeholder">Waiting for the room to open</span>)}</div>{showStats && <div className="bubble-stats">{wordCount(bubble.text)} words · {Math.max(1, Math.round((bubble.durationMs ?? 0) / 1000))}s</div>}</>;
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function DissentPanel({ bubbles }: { bubbles: Bubble[] }) {
  const available = new Map(bubbles.map((bubble) => [bubble.id, bubble]));
  const pairs = [
    ["cfo", "cmo", "Cash efficiency vs. bold distribution"],
    ["coo", "strategy", "Operational capacity vs. the 12-36 month bet"],
    ["cmo", "coo", "Bold distribution vs. operational caution"],
  ] as const;
  const visiblePairs = pairs.filter(([left, right]) => available.get(left)?.status === "done" && available.get(right)?.status === "done");
  if (!visiblePairs.length) return <div className="dissent-panel dissent-empty">Dissent will surface as advisors complete their views.</div>;
  return <div className="dissent-panel"><div className="dissent-heading"><span aria-hidden="true">!</span><strong>Preserved disagreement</strong></div>{visiblePairs.map(([left, right, label]) => <div className="dissent-item" key={label}><strong>{label}</strong><p><span>{summarize(available.get(left)?.text ?? "")}</span><span>{summarize(available.get(right)?.text ?? "")}</span></p></div>)}</div>;
}

function summarize(text: string) {
  const sentence = text.split(/[.!?]\s/)[0] ?? text;
  return sentence.length > 130 ? `${sentence.slice(0, 127)}...` : sentence;
}

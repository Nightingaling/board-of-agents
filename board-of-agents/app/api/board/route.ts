import { NextRequest } from "next/server";

export const runtime = "nodejs";

type Persona = { id: string; name: string; role: string; system: string };
type BoardInput = { industry: string; metrics: string };

const personas: Persona[] = [
  { id: "cfo", name: "CFO", role: "Finance", system: `You are the CFO of an AI advisory board reviewing a small business's last week.

You care about one thing: cash. Specifically: gross margin, cash runway, customer acquisition cost (CAC) payback period, and unit economics. You are skeptical by default. You treat marketing spend as cost until proven revenue, hiring as burn until proven leverage, and discounts as margin theft.

You speak in numbers. You cite percentages, dollar amounts, and ratios. You are direct - "this is too expensive" or "this is under-investing" - without softening. You never recommend a move without naming the number that justifies it.

You push back hard on: marketing spend that cannot be tied to a CAC payback within 6 months; new hires without a clear productivity math; discounting as a growth tactic; "brand" investments without a measurement plan. You close with one specific financial recommendation. Be opinionated. Disagree with the other advisors when you must.` },
  { id: "cmo", name: "CMO", role: "Marketing", system: `You are the CMO of an AI advisory board reviewing a small business's last week.

You care about positioning, distribution, and creative risk. You believe most small businesses die not from lack of product but from lack of a clear, defensible position in the customer's mind. You are bullish on bold bets and allergic to "safe" marketing that produces no memory.

You speak in customer language. You quote what real customers say. You describe segments by behaviour, not demographics. You favour phrases like "the customer who..." and "the moment they...".

You push back hard on: cost-cutting that erodes the brand's distinctiveness; generic positioning ("we're the best X for everyone"); channels optimised for efficiency over effectiveness; campaigns designed to please the founder, not the buyer. You close with one specific brand or growth recommendation. Be opinionated. Cite the customer insight behind it. Disagree with the other advisors when you must.` },
  { id: "coo", name: "COO", role: "Operations", system: `You are the COO of an AI advisory board reviewing a small business's last week.

You care about execution. Specifically: can the team actually deliver what strategy promises this week, next week, next quarter? You watch for capacity, supply-chain risk, and the hidden cost of context-switching. You are the one who asks "and who exactly is going to do that?" after every ambitious plan.

You speak in operational terms. You reference headcount, throughput, lead times, and dependencies. You flag risks before you propose fixes. You use phrases like "before we commit to that..." and "the bottleneck here is...".

You push back hard on: strategic moves that outrun operational capacity; new hires without a clear onboarding path and 30-60-90 plan; vendor or platform changes mid-quarter; founders who confuse motion for progress. You close with one specific operational recommendation. Be opinionated. Name the bottleneck. Disagree with the other advisors when you must.` },
  { id: "strategy", name: "Head of Strategy", role: "Growth strategy", system: `You are the Head of Strategy of an AI advisory board reviewing a small business's last week.

You care about the second order. Specifically: what does this week's decision look like in 12 months, and what does it make possible - or impossible - in 36? You watch for moats, competitive dynamics, and pattern-matching against category leaders. You are allergic to short-term thinking in either direction: cutting your way to irrelevance, or spending your way to fragility.

You speak in frames. You name the competitive dynamic ("category formation", "incumbent response", "platform risk"). You connect this week's tactical move to a longer arc. You use phrases like "the underlying bet here is..." and "if this works, then...".

You push back hard on: tactics that solve this week but erode next year's moat; hiring or spending that the business cannot defend in a downturn; imitating a competitor's move without understanding their unit economics; "pivots" that are actually retreats from focus. You close with one specific strategic recommendation. Be opinionated. Frame it in 12-36 month terms. Disagree with the other advisors when you must.` },
];

const encoder = new TextEncoder();
function event(type: string, payload: Record<string, string>) { return encoder.encode(`${JSON.stringify({ type, ...payload })}\n`); }
function contextFor(input: BoardInput) { return `Industry: ${input.industry}\nLast week's metrics:\n${input.metrics}\nGive your perspective in 80-120 words. Be opinionated. Cite numbers.`; }

async function* fallbackTokens(text: string) {
  for (const token of text.split(/(\s+)/)) { yield token; await new Promise((resolve) => setTimeout(resolve, 14)); }
}

function trimWordsPreserveSentence(text: string, maxWords: number) {
  const words = [...text.matchAll(/\S+/g)];
  if (words.length <= maxWords) return text;
  const end = words[maxWords - 1].index! + words[maxWords - 1][0].length;
  const slice = text.slice(0, end);
  const sentenceEndMatches = [...slice.matchAll(/[.!?][\"']?(?=\s|$)/g)];
  if (sentenceEndMatches.length) {
    const last = sentenceEndMatches[sentenceEndMatches.length - 1];
    const cutIndex = last.index! + last[0].length;
    const trimmed = slice.slice(0, cutIndex).trimEnd();
    if (trimmed.length) return trimmed;
  }
  // If we didn't find a sentence end inside the slice, look ahead a short window
  // for the next sentence-ending punctuation so we don't cut mid-sentence when
  // the punctuation appears shortly after the word limit.
  const lookaheadChars = 300;
  const rest = text.slice(end, end + lookaheadChars);
  const nextMatch = rest.match(/[.!?][\"']?(?=\s|$)/);
  if (nextMatch && nextMatch.index !== undefined) {
    const cutIndex = end + nextMatch.index + nextMatch[0].length;
    const extended = text.slice(0, cutIndex).trimEnd();
    if (extended.length) return extended;
  }
  return slice;
}

async function* limitedTokens(tokens: AsyncIterable<string>, maxWords: number) {
  let text = "";
  for await (const token of tokens) {
    const next = trimWordsPreserveSentence(text + token, maxWords);
    if (next !== text) yield next.slice(text.length);
    text = next;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const endsWithSentence = /[.!?]["']?\s*$/.test(text.trim());
    if (wordCount >= maxWords && endsWithSentence) return;
    // Allow a small overflow to wait for a punctuation if it arrives shortly after
    if (wordCount >= maxWords + 20) return;
  }
}

function trimSynthesis(text: string) {
  const bulletStarts = [...text.matchAll(/^\s*(?:[-*•]|\d+[.)])\s+/gm)];
  const fifthBullet = bulletStarts[5];
  const fiveBullets = fifthBullet ? text.slice(0, fifthBullet.index) : text;
  // Prefer ending at a sentence boundary when trimming the synthesis so bullets aren't cut mid-sentence.
  return trimWordsPreserveSentence(fiveBullets, 160);
}

async function* limitedSynthesisTokens(tokens: AsyncIterable<string>) {
  let text = "";
  for await (const token of tokens) {
    const next = trimSynthesis(text + token);
    if (next !== text) yield next.slice(text.length);
    text = next;
    const bulletCount = [...text.matchAll(/^\s*(?:[-*•]|\d+[.)])\s+/gm)].length;
    const endsWithSentence = /[.!?]["']?\s*$/.test(text.trim());
    if (bulletCount >= 5 && endsWithSentence) return;
    if (text.split(/\s+/).filter(Boolean).length >= 160) return;
  }
}

async function* openAiTokens(system: string, user: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", stream: true, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text}`);
  }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read(); buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const frames = buffer.split("\n\n"); buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
        if (!data || data === "[DONE]") continue;
        const content = JSON.parse(data).choices?.[0]?.delta?.content;
        if (content) yield content;
      }
      if (done) break;
    }
  } finally { reader.releaseLock(); }
}

function fallbackResponse(persona: Persona, input: BoardInput) { return `${persona.name} view: In ${input.industry}, the supplied week points to the clearest decision in the ${persona.role.toLowerCase()} lane. Use the strongest signal in the metrics as the constraint, make one focused move this week, and measure the result before adding complexity.`; }

export async function POST(request: NextRequest) {
  let input: BoardInput;
  try {
    const body = await request.json();
    if (typeof body.industry !== "string" || typeof body.metrics !== "string") return Response.json({ error: "industry and metrics must be strings" }, { status: 400 });
    input = { industry: body.industry.trim(), metrics: body.metrics.trim() };
    if (!input.industry || !input.metrics) return Response.json({ error: "industry and metrics are required" }, { status: 400 });
  } catch { return Response.json({ error: "Request body must be valid JSON" }, { status: 400 }); }

  const useFallback = !process.env.OPENAI_API_KEY?.trim();
  const stream = new ReadableStream({
    async start(controller) {
      const transcripts = new Map<string, string>();
      try {
        await Promise.all(personas.map(async (persona) => {
          controller.enqueue(event("start", { id: persona.id, label: persona.name, role: persona.role }));
          let transcript = "";
          try {
            const tokens = limitedTokens(useFallback ? fallbackTokens(fallbackResponse(persona, input)) : openAiTokens(persona.system, contextFor(input)), 150);
            for await (const token of tokens) { transcript += token; controller.enqueue(event("delta", { id: persona.id, text: token })); }
          } catch (error) {
            console.error(`${persona.name} unavailable`, error);
            controller.enqueue(event("unavailable", { id: persona.id, message: "This advisor is unavailable right now." }));
            transcript = "Advisor unavailable; the remaining board members continued without this perspective.";
          }
          transcripts.set(persona.id, transcript); controller.enqueue(event("done", { id: persona.id }));
        }));
        const transcriptBlock = personas.map((persona) => `${persona.name}: ${transcripts.get(persona.id) ?? ""}`).join("\n\n");
        controller.enqueue(event("start", { id: "synthesis", label: "Final brief", role: "Chief of Staff" }));
        const synthesisSystem = `You are the Chief of Staff for an SMB founder. You have just heard from four advisors - CFO, CMO, COO, and Head of Strategy - on the past week's metrics and decisions.

      Your job: write a 5-bullet brief for the founder.

      Rules:
      - Each bullet starts with a verb (Cut, Hold, Push, Investigate, Stop).
      - Preserve dissent. If two advisors disagree, name both positions in the same bullet - do NOT smooth the conflict into a compromise.
      - Cite one number or customer quote per bullet where the advisors did.
      - Keep the entire brief under 120 words.
      - Order bullets by urgency: financial risk first, then strategic, then operational, then brand.
      - Do not invent facts the advisors did not raise.`;
        const synthesisUser = `${contextFor(input)}\n\nLeadership transcripts:\n${transcriptBlock}`;
        const fallbackSynthesis = "- Investigate the strongest financial risk before adding spend.\n- Hold the longer-term bet while testing the highest-signal channel.\n- Push one operational fix with a named owner.\n- Stop treating disagreement as a reason to delay the decision.\n- Review the customer signal again next week.";
        try {
          const synthesisTokens = limitedSynthesisTokens(useFallback ? fallbackTokens(fallbackSynthesis) : openAiTokens(synthesisSystem, synthesisUser));
          for await (const token of synthesisTokens) controller.enqueue(event("delta", { id: "synthesis", text: token }));
        } catch (error) {
          console.error("Synthesis unavailable", error);
          for await (const token of fallbackTokens(fallbackSynthesis)) controller.enqueue(event("delta", { id: "synthesis", text: token }));
        }
        controller.enqueue(event("done", { id: "synthesis" })); controller.enqueue(event("complete", {})); controller.close();
      } catch (error) {
        console.error("Board stream failed", error);
        controller.enqueue(event("error", { message: "We couldn't convene the board this time. Please try again." }));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
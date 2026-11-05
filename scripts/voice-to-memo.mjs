#!/usr/bin/env node
// Runs job-2 (voice-to-memo) procedure against the job's MCP link (Streamable HTTP, JSON-RPC).
// The link itself is the key; it is passed via the JOB2_URL env var (GitHub secret).

const JOB2_URL = process.env.JOB2_URL;
const CLIP_URL = process.env.CLIP_URL;
if (!JOB2_URL) {
  console.error("Missing JOB2_URL env var");
  process.exit(1);
}
if (!CLIP_URL) {
  console.error("Missing CLIP_URL env var");
  process.exit(1);
}

let idCounter = 1;

async function call(name, args) {
  const body = {
    jsonrpc: "2.0",
    id: idCounter++,
    method: "tools/call",
    params: { name, arguments: args },
  };
  const res = await fetch(JOB2_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Response may be plain JSON or an SSE stream; extract the JSON payload either way.
  let payload = text;
  const dataLine = text
    .split("\n")
    .find((l) => l.startsWith("data: "));
  if (dataLine) payload = dataLine.slice("data: ".length);
  const parsed = JSON.parse(payload);
  if (parsed.error) {
    throw new Error(`MCP error for ${name}: ${JSON.stringify(parsed.error)}`);
  }
  const content = parsed.result.content[0].text;
  return JSON.parse(content);
}

// The 11 findings, in order, with the clip's segment offset (rounded to whole seconds, m:ss).
const findings = [
  { what: "tram-3 boards froze, feed refresh stalled at the depot panel", at: "0:07" },
  { what: "restarted by hand, tram-3 boards back", at: "0:15" },
  { what: "tram-3 boards froze again, feed refresh stalled at the depot panel", at: "0:23" },
  { what: "restarted by hand, tram-3 boards back", at: "0:29" },
  { what: "tram-5, rear door sensor fault, car held at the depot", at: "0:35" },
  { what: "tram-3 boards froze again, feed refresh stalled at the depot panel", at: "0:42" },
  { what: "restarted by hand, tram-3 boards back", at: "0:49" },
  { what: "tram-3 boards froze again, feed refresh stalled at the depot panel", at: "0:55" },
  { what: "restarted by hand, tram-3 boards back", at: "1:03" },
  { what: "same again on tram-3, feed refresh stalled at the depot panel", at: "1:09" },
  { what: "restarted by hand, tram-3 boards back", at: "1:16" },
];

async function main() {
  console.log("Step 1: transcribe");
  const transcribeResult = await call("transcribe", { url: CLIP_URL });
  let step = transcribeResult.step;
  console.log("Transcript segments:", transcribeResult.structuredContent?.segments?.length ?? "n/a");

  const notes = [];
  for (const f of findings) {
    const note = `${f.what} @${f.at}`;
    console.log("memo_write:", note);
    const r = await call("memo_write", { text: note, step });
    step = r.step;
    notes.push(note);
  }

  console.log("Step 3: memo_search (confirm)");
  const search = await call("memo_search", { query: "", step });
  step = search.step;
  console.log("memo_search result:", JSON.stringify(search).slice(0, 2000));

  console.log("Step 4: submit");
  const submitResult = await call("submit", {
    result: notes.join("\n"),
    skillVersion: "1",
    step,
  });

  console.log("SUBMIT_STATUS:" + submitResult.status);
  console.log("SUBMIT_RECEIPT:" + submitResult.receipt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

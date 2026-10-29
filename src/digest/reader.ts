// Plan: morning-digest, issue #2 (source: plan.md § 1).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest } from './types.js';

type LogLine = {
  at: string;
  job: string;
  status: 'ok' | 'retry' | 'fail';
  owner: string | null;
  error?: string;
};

function isLogLine(v: unknown): v is LogLine {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.at === 'string' &&
    typeof r.job === 'string' &&
    (r.status === 'ok' || r.status === 'retry' || r.status === 'fail') &&
    (r.owner === null || typeof r.owner === 'string' || r.owner === undefined) &&
    (r.error === undefined || typeof r.error === 'string')
  );
}

// Reads runs/<night>.jsonl into one row per job. A line that doesn't parse (bad JSON, or JSON
// missing the shape above) is counted, never thrown: the night still renders.
export function readNight(runsDir: string, night: string): NightDigest | null {
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n').filter((l) => l.trim().length > 0);

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }
    if (!isLogLine(parsed)) {
      badLines++;
      continue;
    }

    const owner = parsed.owner ?? null;
    const existing = byJob.get(parsed.job);
    if (!existing) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        first: parsed.at,
        last: parsed.at,
      });
      continue;
    }

    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    // Lines are append-only within a night, so the latest line seen is the latest in time.
    existing.lastStatus = parsed.status;
    existing.lastError = parsed.error ?? null;
    existing.last = parsed.at;
    if (owner) existing.owner = owner;
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { night, rows, badLines };
}

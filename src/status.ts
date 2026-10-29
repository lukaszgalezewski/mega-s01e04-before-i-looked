import { readdirSync } from 'node:fs';
import { readNight } from './digest/reader.js';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightSummary = { night: string; ok: number; retry: number; fail: number };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  nightSummaries: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function summarize(runsDir: string, night: string): NightSummary {
  const digest = readNight(runsDir, night);
  const rows = digest?.rows ?? [];
  return {
    night,
    ok: rows.filter((r) => r.lastStatus === 'ok').length,
    retry: rows.filter((r) => r.lastStatus === 'retry').length,
    fail: rows.filter((r) => r.lastStatus === 'fail').length,
  };
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightSummaries: nights.map((n) => summarize(config.runsDir, n)),
  };
}

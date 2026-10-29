// Plan: morning-digest, issue #1 (source: plan.md § 1).
// One row per job, as the digest page and its JSON both read.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: 'ok' | 'retry' | 'fail';
  lastError: string | null;
  first: string;
  last: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// Reads runs/<night>.jsonl into one row per job. A line that doesn't parse is counted in
// `badLines`, never thrown: the night still renders. Returns null when the file is missing.
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;

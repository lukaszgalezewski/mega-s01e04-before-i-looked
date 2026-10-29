import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

describe('readNight', () => {
  it('reads runs/2026-10-28.jsonl into 5 jobs, counting 1 bad line', () => {
    const digest = readNight('runs', '2026-10-28');
    expect(digest).not.toBeNull();
    expect(digest!.rows).toHaveLength(5);
    expect(digest!.badLines).toBe(1);
  });

  it('keeps a row whose owner is null, shown as — by the view, kept as null in data', () => {
    const digest = readNight('runs', '2026-10-28')!;
    const row = digest.rows.find((r) => r.job === 'digest/render');
    expect(row?.owner).toBeNull();
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });
});

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function runsDirWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(dir, name), contents);
  }
  return dir;
}

const baseConfig = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

describe('GET /digest/:night', () => {
  it('200s and renders a night with rows', async () => {
    const runsDir = runsDirWith({
      '2026-10-28.jsonl': '{"at":"2026-10-28T23:00:02+01:00","job":"a","status":"ok","owner":"rook"}\n',
    });
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('2026-10-28');
    expect(html).toContain('>a<');
  });

  it('404s for a night with no file', async () => {
    const runsDir = runsDirWith({});
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2026-10-28');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty file', async () => {
    const runsDir = runsDirWith({ '2026-10-28.jsonl': '' });
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line, and counts it', async () => {
    const runsDir = runsDirWith({
      '2026-10-28.jsonl':
        '{"at":"2026-10-28T23:00:02+01:00","job":"a","status":"ok","owner":"rook"}\n{not json\n',
    });
    const res = await createApp({ ...baseConfig, runsDir }).request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('>a<');
    expect(html).toContain("1 line in this night");
    expect(html).toContain("didn&#39;t parse");
  });
});

describe('GET /api/digest/:night', () => {
  it('200s with the same jobs, in the same order, as the page', async () => {
    const runsDir = runsDirWith({
      '2026-10-28.jsonl':
        '{"at":"2026-10-28T23:00:02+01:00","job":"b","status":"ok","owner":"rook"}\n' +
        '{"at":"2026-10-28T23:00:03+01:00","job":"a","status":"ok","owner":"rook"}\n',
    });
    const app = createApp({ ...baseConfig, runsDir });

    const jsonRes = await app.request('/api/digest/2026-10-28');
    expect(jsonRes.status).toBe(200);
    const body = (await jsonRes.json()) as { rows: { job: string }[] };
    const jsonJobs = body.rows.map((r) => r.job);

    const pageRes = await app.request('/digest/2026-10-28');
    const html = await pageRes.text();
    const pageJobs = [...html.matchAll(/<td>([ab])<\/td>/g)].map((m) => m[1]);

    expect(jsonJobs).toEqual(['a', 'b']);
    expect(pageJobs).toEqual(jsonJobs);
  });

  it('404s for a night with no file', async () => {
    const runsDir = runsDirWith({});
    const res = await createApp({ ...baseConfig, runsDir }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(404);
  });

  it('returns an empty row list for an empty night', async () => {
    const runsDir = runsDirWith({ '2026-10-28.jsonl': '' });
    const res = await createApp({ ...baseConfig, runsDir }).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ rows: [] });
  });
});

import { describe, expect, it } from 'vitest';
import { tools } from '../../src/tools/index.js';

describe('tool catalogue', () => {
  it('has unique, spec-compliant names', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[A-Za-z0-9_.-]{1,128}$/);
  });
});

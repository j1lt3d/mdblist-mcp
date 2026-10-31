import { describe, expect, it } from 'vitest';
import type { ApiRequest } from '../../src/mdblist-client.js';
import type { ToolDefinition } from '../../src/tools/index.js';

/** POST endpoints that only read data. */
const READ_ONLY_POSTS = new Set(['get_ratings', 'get_item_state']);

export type RequestCase = [name: string, args: unknown, expected: ApiRequest];
export type InvalidCase = [name: string, args: unknown];

/**
 * Table-driven checks for a domain's tools: each case's args are validated by the tool
 * schema (applying defaults) and must map to the expected request; invalid args must be
 * rejected by the schema before any request is built.
 */
export function describeTools(
  domain: string,
  tools: readonly ToolDefinition[],
  requests: RequestCase[],
  invalid: InvalidCase[],
) {
  const tool = (name: string) => {
    const found = tools.find((t) => t.name === name);
    if (!found) throw new Error(`unknown ${domain} tool ${name}`);
    return found;
  };

  describe(`${domain} tools`, () => {
    it('each have at least one request case', () => {
      expect(new Set(requests.map(([name]) => name))).toEqual(new Set(tools.map((t) => t.name)));
    });

    it.each(requests)('%s %j', (name, args, expected) => {
      const t = tool(name);
      expect(t.toRequest(t.inputSchema.parse(args))).toEqual(expected);
      const isRead = expected.method === 'GET' || READ_ONLY_POSTS.has(name);
      expect(t.annotations.readOnlyHint, 'readOnlyHint').toBe(isRead);
    });

    it.each(invalid)('%s rejects %j', (name, args) => {
      expect(tool(name).inputSchema.safeParse(args).success).toBe(false);
    });
  });
}

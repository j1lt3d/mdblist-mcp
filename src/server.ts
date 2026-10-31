import { readFileSync } from 'node:fs';
import { McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { MdblistApiError, type MdblistClient } from './mdblist-client.js';
import { tools, type ToolDefinition } from './tools/index.js';

export const SERVER_NAME = 'mdblist-mcp';
// Resolves from both src/ (tests) and dist/ (runtime): package.json is one level up.
const { version: SERVER_VERSION } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };
const TOOLS_LIST_TTL_MS = 60 * 60 * 1000;

const textResult = (text: string, isError = false): CallToolResult => ({
  content: [{ type: 'text', text }],
  ...(isError && { isError }),
});

function errorText(
  error: unknown,
  tool: ToolDefinition,
  args: Parameters<ToolDefinition['toRequest']>[0],
): string {
  if (!(error instanceof MdblistApiError)) {
    return error instanceof Error ? error.message : String(error);
  }
  const retry = error.retryAfter === null ? '' : ` (retry after ${error.retryAfter}s)`;
  const hint = tool.errorHint?.(error.status, args);
  return `${error.message}${retry}${hint ? ` — ${hint}` : ''}`;
}

async function callTool(
  client: MdblistClient,
  tool: ToolDefinition,
  args: unknown,
): Promise<CallToolResult> {
  const input = args as Parameters<typeof tool.toRequest>[0];
  try {
    const raw = await client.request(tool.toRequest(input));
    const data = tool.transformResult ? tool.transformResult(raw, input) : raw;
    // Compact JSON: pretty-printing inflates large list payloads by ~40%.
    return textResult(JSON.stringify(data));
  } catch (error) {
    // Tool execution errors are reported in-band so the model can react (MCP spec: isError).
    return textResult(errorText(error, tool, input), true);
  }
}

export function createServer(client: MdblistClient): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { cacheHints: { 'tools/list': { ttlMs: TOOLS_LIST_TTL_MS, cacheScope: 'public' } } },
  );
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      (args) => callTool(client, tool, args),
    );
  }
  return server;
}

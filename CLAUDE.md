# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP server (TypeScript, ESM, `@modelcontextprotocol/server` v2) that exposes the MDBList API (`api.mdblist.com`) as 33 tools. It authenticates with a single `MDBLIST_API_KEY` and serves over stdio (default) or Streamable HTTP (`MCP_TRANSPORT=http`).

## Commands

```sh
npm ci                     # install (Node 24 per .nvmrc; engines >=22)
npm run build              # tsc -p tsconfig.build.json -> dist/
npm run dev                # run from source with tsx
npm run lint               # eslint (strict, type-checked)
npm run typecheck          # tsc --noEmit (includes test/)
npm run format:check       # prettier; `npm run format` to fix
npm test                   # vitest run
npm run test:coverage      # v8 coverage, 90% thresholds enforced (src/index.ts excluded)

npx vitest run test/http.test.ts           # one file
npx vitest run -t "external lists"         # tests matching a name

MDBLIST_API_KEY=... node dist/index.js                      # stdio
MCP_TRANSPORT=http MDBLIST_API_KEY=... node dist/index.js   # HTTP on 127.0.0.1:3000/mcp
```

CI (`.github/workflows/ci.yml`) runs all of the above, plus `npm audit --audit-level=moderate`, `npm audit signatures` and hadolint on the `Dockerfile`.

## Architecture

**Tools are data.** Each domain file in `src/tools/` (`lists.ts`, `media.ts`, …) exports an array of `defineTool({...})` entries. They're aggregated in `src/tools/index.ts`. A tool declares:

- `inputSchema`: zod v4;
- `annotations`: `READ` / `WRITE` / `REMOVE` from `shared.ts`;
- `toRequest(args) → ApiRequest`: method, path, query and body; no I/O;
- optional `errorHint(status, args)`: text appended to API errors. Use `hintFor({404: '…'})` for fixed hints;
- optional `transformResult(data, args)`: rewrites the API response before the model sees it.

Shared schemas and helpers (`listId`, `mediaRef`, `listItemsParams`, …) live in `src/tools/shared.ts`.

**One generic handler.** `createServer(client)` in `src/server.ts` registers every tool. Its `callTool` does validated args → `toRequest` → `MdblistClient.request` → `transformResult` → compact `JSON.stringify`. API and network errors are returned in-band as `isError` results, with `errorHint` appended; they're never thrown. `tools/list` advertises a 1-hour cache TTL.

**HTTP client** (`src/mdblist-client.ts`):

- Sends the key as the `apikey` query parameter and times out after 30 s.
- Throws `MdblistApiError(status, message, retryAfter)`.
- When an endpoint reports pagination only in `X-Has-More`/`X-Total-Items` headers, wraps the body as `{data, pagination}`.
- Build paths with the `apiPath` tagged template, which URI-encodes every interpolated segment.

**Transports** (`src/index.ts` picks one via `loadConfig()` in `src/config.ts`):

- **stdio:** `serveStdio`. stdout is reserved for MCP messages, so all diagnostics go to stderr.
- **HTTP** (`src/http.ts`): a `node:http` ↔ Web `Request`/`Response` adapter around the SDK's `createMcpHandler`. That handler is stateless and builds a fresh `McpServer` per request from the factory, which is cheap and intended. Checks run in this order:
  1. a DNS-rebinding Host check, only when bound to a loopback address;
  2. an Origin allowlist: localhost plus `MCP_ALLOWED_ORIGINS`;
  3. an optional bearer token (`MCP_AUTH_TOKEN`).

  `/healthz` is unauthenticated. Unparseable request targets get a 400 instead of crashing the process.

- HTTP settings (`PORT`, `MCP_HOST`, `MCP_ALLOWED_ORIGINS`, `MCP_AUTH_TOKEN`) are read **only** in HTTP mode, so stray inherited variables can't break stdio. The bind-address variable is deliberately `MCP_HOST`, not `HOST`. The Docker image defaults to stdio and sets `MCP_HOST=0.0.0.0`.

**External lists (non-obvious).** IMDb, Trakt and Letterboxd imports, from `/external/lists/...`, come back with a plain `id` that only works as `list: {external_id}`. Passed as `{id}`, it hits `/lists/{id}`, which 404s or returns an unrelated MDBList list.

- `markExternalLists` renames `id` → `external_id`. Apply it **only** where the response is known to be external: `browse_lists` with `source: "external"`, and `get_list {external_id}`.
- Don't apply it elsewhere. Other endpoints return real MDBList list IDs, and `get_list_items` rows carry title IDs, even on the `/external/lists/{n}/items` path.
- The 404 hints in `listNotFoundHint` and on the write tools depend on how the list was addressed.

## Tests

- `test/tools/<domain>.test.ts` use the table-driven `describeTools` harness (`test/tools/harness.ts`). Every tool must have at least one request case, and `readOnlyHint` must match the HTTP method. Read-only POSTs are allowlisted in `READ_ONLY_POSTS`. So adding a tool means adding a `defineTool` entry and a request case.
- `test/server.test.ts` exercises the real MCP server through `InMemoryTransport`, pinned to protocol `2026-07-28`, with `mockFetch`/`jsonResponse` from `test/helpers.ts`.
- `test/http.test.ts` starts real HTTP servers on port 0 and fails if anything is reported through `onerror`.

## Releases

- Pushes to `main` run `release.yml`: CI (`ci.yml` is reused via `workflow_call`), then semantic-release, then a multi-arch image push to `ghcr.io/j1lt3d/mdblist-mcp`, tagged `X.Y.Z`, `X.Y` and `latest`.
- Versions come from squash-merged PR titles, so **PR titles must be Conventional Commits**. `pr-title-lint.yml` enforces this, and `labeler.yml` labels PRs from title and paths.
- semantic-release commits `package.json`, `package-lock.json` and `CHANGELOG.md` back to `main`. The server reads its version from `package.json` at runtime.
- The semantic-release toolchain is pinned in its own lockfile under `.github/release/`, not the root `package.json`. That keeps its bundled npm out of the app's `npm audit`.
- Every third-party GitHub Action is pinned by commit SHA.

## Conventions

- ESM with `NodeNext` resolution: relative imports use `.js` extensions, even from `.ts` files.
- TypeScript is strict, with `noUncheckedIndexedAccess`.
- Tool results are MDBList's own JSON in compact form. Keep tool descriptions short: the whole tool list costs about 7k tokens of model context.
- Use the handle `j1lt3d` in public files (README, package metadata, commit attribution), never a personal name.

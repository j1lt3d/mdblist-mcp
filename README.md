# MDBList MCP Server

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js ≥ 22](https://img.shields.io/badge/node-%E2%89%A522-brightgreen.svg)](https://nodejs.org)
[![MCP 2026-07-28](https://img.shields.io/badge/MCP-2026--07--28-purple.svg)](https://modelcontextprotocol.io)

**Connect Claude, Cursor and other AI assistants to [MDBList](https://mdblist.com).**
Search movies and TV shows, compare ratings from IMDb, Rotten Tomatoes,
Metacritic, Letterboxd, TMDb and Trakt, and manage your lists, watchlist and
watch history by just asking.

`mdblist-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io)
(MCP) server. Once it's installed, your AI assistant can call the MDBList API
for you. You don't need to write any code.

## What you can ask

> "What are the top-rated sci-fi movies from 2025, sorted by Rotten Tomatoes score?"

> "Compare the IMDb, Metacritic and Letterboxd ratings for Dune: Part Two."

> "Where can I stream Severance?"

> "Add the top 5 movies from that list to my 'Weekend' list."

> "Which episodes are up next for the shows I'm watching?"

> "Mark The Bear as watched and rate it 9/10."

> "Find me something similar to Arrival."

> "Which of my favourite actors have new movies coming out?"

## Features

- **Search and discovery**: search by title, or browse the full movie and TV
  catalog filtered by genre, year, runtime, country, language and score.
- **Ratings from everywhere**: IMDb, Rotten Tomatoes (critics and audience),
  Metacritic, Letterboxd, TMDb, Trakt, RogerEbert.com and MyAnimeList, plus
  MDBList's combined score. Batch lookups cover many titles at once.
- **Streaming availability**: see where a movie or show is streaming.
- **Recommendations**: get similar titles for any movie or show.
- **Lists**: browse top, curated and official MDBList lists, search public lists,
  and create, fill, edit or delete your own.
- **Watchlist**: view it, add to it, and remove from it.
- **Watch history and ratings**: mark items as watched, rate titles, check what's
  up next or airing soon, and view your watch statistics.
- **People**: look up actors and directors, follow your favourites and see
  their upcoming releases.

## Quick start

### 1. Get a free MDBList API key

Sign in at [mdblist.com](https://mdblist.com), open
[**Preferences**](https://mdblist.com/preferences/), scroll to the
**API Access** section and generate an API key (or copy your existing one).
A free account works. Supporter accounts get higher rate limits and larger
batch lookups.

### 2. Install the server

You need [Node.js 22 or newer](https://nodejs.org) and
[Git](https://git-scm.com).

```sh
git clone https://github.com/j1lt3d/mdblist-mcp.git
cd mdblist-mcp
npm ci
npm run build
```

This builds the server into `dist/index.js`. In the configs below, replace
`/absolute/path/to/mdblist-mcp` with the folder you just cloned (run `pwd`
inside it to see the path).

> **Coming soon:** once `mdblist-mcp` is published to npm, you'll be able to
> skip this step and run it with `npx -y mdblist-mcp` instead.

To update later, run `git pull && npm ci && npm run build` in the same folder.

### 3. Add the server to your AI client

#### Claude Desktop

Open **Settings → Developer → Edit Config**, or edit the config file directly:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add this, then restart Claude Desktop:

```json
{
  "mcpServers": {
    "mdblist": {
      "command": "node",
      "args": ["/absolute/path/to/mdblist-mcp/dist/index.js"],
      "env": { "MDBLIST_API_KEY": "your-api-key" }
    }
  }
}
```

#### Claude Code

```sh
claude mcp add mdblist -e MDBLIST_API_KEY=your-api-key -- node /absolute/path/to/mdblist-mcp/dist/index.js
```

#### Cursor, Windsurf, Cline and other MCP clients

Any client that supports stdio MCP servers can use the same `mcpServers` block
as Claude Desktop. In Cursor, add it to `~/.cursor/mcp.json` (global) or
`.cursor/mcp.json` (per project).

#### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "mdblist": {
      "command": "node",
      "args": ["/absolute/path/to/mdblist-mcp/dist/index.js"],
      "env": { "MDBLIST_API_KEY": "your-api-key" }
    }
  }
}
```

### 4. Ask away

Try _"What's on my MDBList watchlist?"_ to check that it works.

### Alternative: Docker

If you'd rather not install Node.js, build the image from the cloned repo:

```sh
git clone https://github.com/j1lt3d/mdblist-mcp.git
cd mdblist-mcp
docker build -t mdblist-mcp .
```

```json
{
  "mcpServers": {
    "mdblist": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "MDBLIST_API_KEY", "mdblist-mcp"],
      "env": { "MDBLIST_API_KEY": "your-api-key" }
    }
  }
}
```

The container runs as an unprivileged user, and its application files are
read-only.

## Available tools

The server has 33 tools, grouped by area. Tools marked ✏️ change your MDBList
data, and 🗑️ marks removals. Every tool carries MCP annotations (`readOnlyHint`,
`destructiveHint`), so clients can ask you to confirm before a change.

<details>
<summary><strong>Movies and TV shows</strong> (6)</summary>

| Tool                  | What it does                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `search_media`        | Search movies and shows by title                                                               |
| `get_media_info`      | Full details for a title: ratings, scores, streaming services, IDs and optional similar titles |
| `get_ratings`         | One rating source (IMDb, Rotten Tomatoes, Letterboxd, …) for many titles at once               |
| `discover_catalog`    | Browse the catalog with filters (genre, year, score, runtime, country, language) and sorting   |
| `get_genres`          | List available genres, including anime genres                                                  |
| `get_watch_providers` | Direct watch-provider links (supporter feature)                                                |

</details>

<details>
<summary><strong>Lists</strong> (10)</summary>

| Tool                   | What it does                                                                |
| ---------------------- | --------------------------------------------------------------------------- |
| `get_user_lists`       | Your MDBList lists, or another user's public lists                          |
| `browse_lists`         | Top, curated, liked, official, or your imported IMDb/Trakt/Letterboxd lists |
| `search_lists`         | Search public lists by title                                                |
| `get_list`             | List details: name, owner, item count, likes                                |
| `get_list_items`       | Movies and shows in a list, with filtering, sorting and pagination          |
| `get_list_membership`  | Which of your lists already contain a title                                 |
| `create_list` ✏️       | Create a new list                                                           |
| `add_list_items` ✏️    | Add titles to one of your lists                                             |
| `remove_list_items` 🗑️ | Remove titles from one of your lists                                        |
| `delete_list` 🗑️       | Permanently delete one of your lists                                        |

</details>

<details>
<summary><strong>Watchlist</strong> (3)</summary>

| Tool                        | What it does                      |
| --------------------------- | --------------------------------- |
| `get_watchlist`             | Your watchlist                    |
| `add_watchlist_items` ✏️    | Add titles to your watchlist      |
| `remove_watchlist_items` 🗑️ | Remove titles from your watchlist |

</details>

<details>
<summary><strong>Watch history, ratings and up next</strong> (8)</summary>

| Tool                  | What it does                                                                  |
| --------------------- | ----------------------------------------------------------------------------- |
| `get_sync`            | Your watched history, ratings, collection, or dropped shows and seasons       |
| `get_last_activities` | When your watched items, ratings and other data last changed                  |
| `get_item_state`      | Watched, rated, collected and watchlist state for up to 100 titles            |
| `get_up_next`         | Next episodes for shows in progress, upcoming episodes, and watchlisted shows |
| `rate_media` ✏️       | Rate movies and shows                                                         |
| `remove_ratings` 🗑️   | Remove your ratings                                                           |
| `mark_watched` ✏️     | Mark movies or whole shows as watched                                         |
| `unmark_watched` 🗑️   | Remove watched status                                                         |

</details>

<details>
<summary><strong>People</strong> (4)</summary>

| Tool                   | What it does                                                 |
| ---------------------- | ------------------------------------------------------------ |
| `get_person`           | Details on an actor, director or other crew member           |
| `get_favorite_people`  | Your favourite people, or their upcoming movies and episodes |
| `favorite_person` ✏️   | Add a person to your favourites                              |
| `unfavorite_person` 🗑️ | Remove a person from your favourites                         |

</details>

<details>
<summary><strong>Account</strong> (2)</summary>

| Tool             | What it does                                                             |
| ---------------- | ------------------------------------------------------------------------ |
| `get_user`       | Your profile, supporter status and API limits, or another user's profile |
| `get_user_stats` | Your watch statistics                                                    |

</details>

Results are MDBList's own JSON, sent in compact form. Related endpoints share
one tool, which keeps the tool list at about 7k tokens of your assistant's
context. Scrobbling, check-ins, discussions, notifications, devices and account
management are left out on purpose.

## Configuration

| Environment variable | Required | Description                                                                   |
| -------------------- | -------- | ----------------------------------------------------------------------------- |
| `MDBLIST_API_KEY`    | Yes      | Your API key from [mdblist.com/preferences](https://mdblist.com/preferences/) |

The server communicates over stdio and only contacts `api.mdblist.com`. It
doesn't collect any data or send it anywhere else. API errors, including rate
limits (`429` with `Retry-After`), are passed back to the assistant so it can
explain them or try again.

## FAQ

### What is MDBList?

[MDBList](https://mdblist.com) is a free service that combines movie and TV
ratings from many sources and lets you build lists, including dynamic lists you can use
in Radarr and Sonarr. It also tracks your watchlist and watch
history.

### What is an MCP server?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open
standard for connecting AI assistants to tools and data. An MCP server like
this one gives the assistant a set of actions it can perform, in this case
calls to the MDBList API.

### Which AI apps does it work with?

Any MCP client that supports local (stdio) servers. That includes Claude
Desktop, Claude Code, Cursor, Windsurf, Cline, VS Code with GitHub Copilot, and
others. It supports MCP specification 2026-07-28, and older 2025 clients still
work.

### Do I need an MDBList supporter account?

No. A free account works with almost every tool. Supporters get higher API rate
limits and larger batch lookups: `get_ratings` accepts 100 IDs per call instead
of 10. `get_watch_providers` is a supporter feature, but `get_media_info` also
lists streaming services for everyone.

### The server doesn't show up in Claude Desktop

- Restart Claude Desktop completely after you edit the config.
- Check that `node --version` prints 22 or higher.
- Check that the config file is valid JSON and that `MDBLIST_API_KEY` is set.
- Look at the MCP logs (**Settings → Developer**) for error messages.

### Can it change or delete my data?

Only through the ✏️ and 🗑️ tools listed above, and only when you ask. Clients
that respect MCP annotations ask you to confirm before a destructive action.

## Development

```sh
git clone https://github.com/j1lt3d/mdblist-mcp.git
cd mdblist-mcp
npm ci
npm run build
MDBLIST_API_KEY=... node dist/index.js
```

| Command                 | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Run from source with `tsx`               |
| `npm run lint`          | ESLint (strict, type-checked)            |
| `npm run typecheck`     | `tsc --noEmit`                           |
| `npm run format:check`  | Prettier                                 |
| `npm test`              | Vitest                                   |
| `npm run test:coverage` | Vitest with v8 coverage (≥ 90% enforced) |

Tools are declared as data in `src/tools/<domain>.ts`, using shared schemas
from `src/tools/shared.ts`. One generic handler in `src/server.ts` serves all
of them through `MdblistClient`. To add an endpoint, add a `defineTool` entry
and a request test case in `test/tools/<domain>.test.ts`.

CI checks formatting, lint, types, tests with coverage, the build, `npm audit`,
npm signature verification and the Dockerfile (hadolint).

Contributions are welcome. Please open an issue or pull request.

## License

[MIT](LICENSE)

This project was built with AI assistance (Claude Code). It has an automated
test suite, but please report anything that looks wrong.

This is an unofficial project and isn't affiliated with or endorsed by MDBList.
Movie and TV data is provided by the [MDBList API](https://api.mdblist.com/docs/).

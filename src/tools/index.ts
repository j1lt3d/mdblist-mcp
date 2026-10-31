import { listTools } from './lists.js';
import { mediaTools } from './media.js';
import { peopleTools } from './people.js';
import type { ToolDefinition } from './shared.js';
import { syncTools } from './sync.js';
import { userTools } from './user.js';
import { watchlistTools } from './watchlist.js';

export type { ToolDefinition } from './shared.js';

export const tools: readonly ToolDefinition[] = [
  ...mediaTools,
  ...peopleTools,
  ...listTools,
  ...watchlistTools,
  ...syncTools,
  ...userTools,
];

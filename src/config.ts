export interface Config {
  apiKey: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.MDBLIST_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'MDBLIST_API_KEY environment variable is required (generate one in your mdblist.com preferences)',
    );
  }
  return { apiKey };
}

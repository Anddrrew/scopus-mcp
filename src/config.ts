export interface Config {
  apiKey?: string;
  instToken?: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.ELSEVIER_API_KEY?.trim();
  const instToken = env.ELSEVIER_INST_TOKEN?.trim();
  return {
    ...(apiKey ? { apiKey } : {}),
    ...(instToken ? { instToken } : {}),
  };
}

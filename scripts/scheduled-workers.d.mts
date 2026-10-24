export function runScheduledWorkers(env: Record<string,string|undefined>, options?: {
  fetcher?: (url: URL, options: RequestInit) => Promise<Response>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  error?: (message: string) => void;
  log?: (message: string) => void;
}): Promise<boolean>;

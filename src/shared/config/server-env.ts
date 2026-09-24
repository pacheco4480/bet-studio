import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().max(65535).default(3000),
  BET_STUDIO_DB_PATH: z.string().min(1).default('./data/bet-studio.db'),
  GOAL_API_KEY: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  GOAL_API_BASE_URL: z
    .string()
    .url()
    .startsWith('https://')
    .default('https://api.goal-api.com/v1'),
  GOAL_API_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5000)
    .max(15000)
    .default(10000),
  API_FOOTBALL_API_KEY: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
  API_FOOTBALL_BASE_URL: z
    .string()
    .url()
    .startsWith('https://')
    .default('https://v3.football.api-sports.io'),
  API_FOOTBALL_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(5000)
    .max(15000)
    .default(10000),
  API_FOOTBALL_REQUEST_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(6000)
    .max(60000)
    .default(6500),
  API_FOOTBALL_SEASON: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.coerce.number().int().min(2000).max(2200).default(2024),
  ),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnv {
  const fileValues = source === process.env ? loadDotEnvFile() : {};
  return serverEnvSchema.parse({ ...fileValues, ...source });
}

function loadDotEnvFile(path = '.env'): Record<string, string> {
  if (!existsSync(path)) return {};

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        if (separator === -1) return [line, ''];
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim(),
        ];
      }),
  );
}

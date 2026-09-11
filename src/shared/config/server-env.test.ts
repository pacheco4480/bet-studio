// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { loadServerEnv } from './server-env.js';

describe('loadServerEnv', () => {
  it('parses the foundation server configuration', () => {
    expect(
      loadServerEnv({
        NODE_ENV: 'test',
        API_HOST: '127.0.0.1',
        API_PORT: '3010',
      }),
    ).toEqual({
      NODE_ENV: 'test',
      API_HOST: '127.0.0.1',
      API_PORT: 3010,
      BET_STUDIO_DB_PATH: './data/bet-studio.db',
      GOAL_API_BASE_URL: 'https://api.goal-api.com/v1',
      GOAL_API_TIMEOUT_MS: 10000,
    });
  });

  it('rejects invalid ports', () => {
    expect(() =>
      loadServerEnv({
        API_PORT: '70000',
      }),
    ).toThrow();
  });
});

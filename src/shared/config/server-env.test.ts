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

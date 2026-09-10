// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildApiApp } from './app.js';

describe('Bet Studio API health endpoint', () => {
  it('returns a minimal healthy response', async () => {
    const app = buildApiApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });

    await app.close();
  });
});

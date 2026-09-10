import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the catalog management shell and loads competitions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          items: [
            {
              id: 'competition_1',
              name: 'Liga Portugal',
              shortName: 'LP',
              countryCode: 'PT',
              regionName: null,
              active: true,
            },
          ],
        }),
    } as Response);

    render(<App />);

    expect(screen.getByText('Bet Studio')).toBeInTheDocument();
    expect(screen.getByText('Catalog Management')).toBeInTheDocument();
    expect(await screen.findByText('Liga Portugal')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  it('renders the Bet Studio foundation shell', () => {
    render(<App />);

    expect(screen.getByText('Bet Studio')).toBeInTheDocument();
    expect(screen.getByText('Fastify API')).toBeInTheDocument();
  });
});

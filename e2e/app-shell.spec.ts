import { expect, test } from '@playwright/test';

test('loads the Bet Studio shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('main')).toContainText('Bet Studio');
  await expect(page.getByText('React + Vite')).toBeVisible();
});

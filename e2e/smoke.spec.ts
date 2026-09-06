import { test, expect } from '@playwright/test';

test.describe('Sai Smoke Tests', () => {
  test('Лендинг загружается и показывает CTA', async ({ page }) => {
    await page.goto('/');

    // Лендинг должен загрузиться
    await expect(page.locator('h1').first()).toBeVisible();

    // Должна быть кнопка «Попробовать» или «Try without registration»
    const cta = page.getByRole('link', { name: /попробовать|try|начать/i });
    await expect(cta.first()).toBeVisible();
  });

  test('Лендинг → канвас: кнопка Попробовать открывает канвас', async ({ page }) => {
    await page.goto('/');

    // Нажать кнопку «Попробовать»
    const tryBtn = page.getByRole('link', { name: /попробовать|try/i }).first();
    await tryBtn.click();

    // Должны оказаться на странице проекта (канвас)
    await expect(page).toHaveURL(/\/projects\//, { timeout: 10_000 });

    // Должен быть виден канвас (React Flow)
    await expect(page.locator('.react-flow, [data-testid="canvas"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Страница входа отображается', async ({ page }) => {
    await page.goto('/signin');

    // Должна быть форма входа
    await expect(page.getByPlaceholder(/email/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /email/i }).first()).toBeVisible();
  });
});

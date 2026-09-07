import { test, expect } from '@playwright/test';

test.describe('Sai Smoke Tests', () => {
  test('Лендинг загружается и показывает CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    const cta = page.getByRole('link', { name: /попробовать|try|начать/i });
    await expect(cta.first()).toBeVisible();
  });

  test('Золотой путь: лендинг → канвас → узел → чат → экспорт', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /попробовать|try/i }).first().click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 10_000 });

    // Добавить узел
    await page.getByRole('button', { name: /добавить узел/i }).click();
    await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 10_000 });

    // Чат открыт по умолчанию — проверяем панель
    await expect(page.getByText(/чат|сообщение|спрос/i).first()).toBeVisible({ timeout: 5_000 });

    // Экспорт MD
    const exportBtn = page.getByRole('button', { name: /экспорт/i });
    await exportBtn.click();
    await page.getByRole('button', { name: /экспортировать/i }).click();
    // диалог закрылся — UI вернулся к канвасу
    await expect(page.locator('.react-flow').first()).toBeVisible();
  });

  test('Mind Map: переключение режима отображения', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /попробовать|try/i }).first().click();
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 10_000 });

    const mindMapBtn = page.getByRole('button', { name: /mind map/i });
    await mindMapBtn.click();
    await expect(page.getByRole('button', { name: /graph/i })).toBeVisible();
    await page.getByRole('button', { name: /graph/i }).click();
    await expect(mindMapBtn).toBeVisible();
  });

  test('Sync: диалог анализа деревьев', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /попробовать|try/i }).first().click();
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /синхронизация/i }).click();
    await expect(page.getByText(/синхронизация деревьев/i)).toBeVisible();
    await page.getByRole('button', { name: /анализировать/i }).click();
    await expect(
      page.getByText(/синхронизировано|потенциальных проблем|разработка/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});

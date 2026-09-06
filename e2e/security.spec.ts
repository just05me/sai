import { test, expect } from '@playwright/test';

test.describe('Security Headers', () => {
  test('Базовые security-заголовки присутствуют', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};

    // X-Content-Type-Options
    expect(headers['x-content-type-options']).toBe('nosniff');

    // Referrer-Policy
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  test('X-Frame-Options присутствует (кроме /share)', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};

    // SAMEORIGIN или DENY
    const frameOptions = headers['x-frame-options'];
    expect(['SAMEORIGIN', 'DENY']).toContain(frameOptions);
  });
});

test.describe('XSS Protection', () => {
  test('JavaScript в URL не исполняется', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Попытка XSS через query string
    await page.goto('/?x=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    // Страница не должна содержать незаэкранированный script-тег
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('<script>alert(1)</script>');
  });
});

test.describe('Auth Protection', () => {
  test('/workspace без сессии — не 500', async ({ page }) => {
    // В selfhost-режиме /workspace должен работать (local user)
    // В cloud — редирект на signin
    const response = await page.goto('/workspace');

    // Не должен быть 500
    expect(response?.status()).not.toBe(500);
  });

  test('API health отдаёт статус', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBeLessThan(500);
    const body = await response.json();
    expect(body).toHaveProperty('ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('mode');
  });
});

import { test as base, expect, chromium, Page, ConsoleMessage } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * OxyBroker E2E Smoke Test
 * Navigates every route as a logged-in admin, captures console/page errors,
 * visible error UI, and prints a pass/fail matrix at the end.
 */

const AUTH_FILE = path.join(__dirname, '.auth.json');
const EMAIL = 'playwright@o2inc.com.br';
const PASSWORD = 'PlaywrightTest2026!';
const BASE_URL = 'http://localhost:5174';

type RouteSpec = { path: string; label: string };

const ROUTES: RouteSpec[] = [
  { path: '/marketplace', label: 'Marketplace' },
  { path: '/my-auctions', label: 'Meus Leilões' },
  { path: '/wallet', label: 'Carteira' },
  { path: '/transfers', label: 'Transferências' },
  { path: '/purchases', label: 'Minhas Compras' },
  { path: '/notifications', label: 'Notificações' },
  { path: '/admin/settings', label: 'Admin Settings' },
  { path: '/admin/users', label: 'Admin Users' },
  { path: '/admin/categories', label: 'Admin Categories' },
  { path: '/admin/assets', label: 'Admin Assets' },
  { path: '/admin/leads-inbox', label: 'Admin Leads Inbox' },
  { path: '/admin/lots', label: 'Admin Lots' },
  { path: '/admin/promotions', label: 'Admin Promotions' },
  { path: '/admin/analytics', label: 'Admin Analytics' },
];

type RouteResult = {
  route: string;
  label: string;
  status: 'OK' | 'FAIL';
  consoleErrors: number;
  pageErrors: number;
  visibleErrors: number;
  notes: string;
};

const results: RouteResult[] = [];

function attachErrorCollectors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onPageError = (err: Error) => {
    pageErrors.push(`${err.name}: ${err.message}`);
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  return {
    consoleErrors,
    pageErrors,
    detach() {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    },
  };
}

async function ensureAuthFile() {
  if (fs.existsSync(AUTH_FILE)) return;
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto('/auth/login', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/marketplace/, { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  await context.storageState({ path: AUTH_FILE });
  await context.close();
  await browser.close();
  if (!fs.existsSync(AUTH_FILE)) throw new Error('Failed to save auth storage state');
}

// Custom fixture: authenticated page that reuses storage state
const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser }, use) => {
    await ensureAuthFile();
    const context = await browser.newContext({
      baseURL: BASE_URL,
      storageState: AUTH_FILE,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// One test per route
for (const route of ROUTES) {
  test(`smoke: ${route.label} (${route.path})`, async ({ authedPage: page }) => {
    const collectors = attachErrorCollectors(page);
    const notes: string[] = [];
    let status: 'OK' | 'FAIL' = 'OK';

    try {
      await page.goto(route.path, { waitUntil: 'networkidle', timeout: 30_000 });
    } catch (err) {
      status = 'FAIL';
      notes.push(`nav error: ${(err as Error).message.substring(0, 120)}`);
    }

    await page.waitForTimeout(700);

    const currentPath = new URL(page.url()).pathname;

    if (currentPath !== route.path) {
      status = 'FAIL';
      if (/\/auth\/login/i.test(currentPath)) notes.push(`bounced to login (${currentPath})`);
      else if (/404/.test(currentPath)) notes.push(`bounced to 404 (${currentPath})`);
      else notes.push(`redirected to ${currentPath}`);
    }

    const notFoundCount = await page
      .locator('text=/404|Página não encontrada/i')
      .count()
      .catch(() => 0);
    if (notFoundCount > 0) {
      status = 'FAIL';
      notes.push(`NotFound text visible (${notFoundCount} matches)`);
    }

    const visibleErrors = await page
      .locator('[role="alert"], text=/Erro ao/i')
      .count()
      .catch(() => 0);
    if (visibleErrors > 0) notes.push(`${visibleErrors} alert/error UI`);

    if (route.path === '/wallet') {
      const walletHit = await page
        .locator('text=/R\\$\\s*50[.,]000[.,]00|50\\.000,00/')
        .count()
        .catch(() => 0);
      if (walletHit === 0) notes.push('R$50.000,00 balance not found');
      else notes.push('wallet balance OK');
    }

    const pageErrors = collectors.pageErrors.length;
    const consoleErrors = collectors.consoleErrors.length;

    if (pageErrors > 0) {
      status = 'FAIL';
      notes.push(
        `${pageErrors} pageerror(s): ${collectors.pageErrors.slice(0, 2).join(' | ').substring(0, 220)}`,
      );
    }
    if (consoleErrors > 0) {
      const sample = collectors.consoleErrors.slice(0, 2).join(' | ');
      notes.push(`console: ${sample.substring(0, 200)}`);
    }

    results.push({
      route: route.path,
      label: route.label,
      status,
      consoleErrors,
      pageErrors,
      visibleErrors,
      notes: notes.join('; ') || '-',
    });

    collectors.detach();

    expect.soft(currentPath, `Should not bounce from ${route.path}`).toBe(route.path);
    expect.soft(notFoundCount, `No 404 text on ${route.path}`).toBe(0);
    expect.soft(pageErrors, `No page errors on ${route.path}`).toBe(0);
  });
}

// Golden path: admin leads approval
test('golden path: admin leads approval flow', async ({ authedPage: page }) => {
  const collectors = attachErrorCollectors(page);

  await page.goto('/admin/leads-inbox', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const approveButtons = page.locator(
    'button:has-text("Aprovar"), button:has-text("Approve"), [data-testid*="approve"]',
  );
  const approveCount = await approveButtons.count().catch(() => 0);
  const pendingBadges = await page
    .locator('text=/pending_review|pendente|Aguardando revisão/i')
    .count()
    .catch(() => 0);

  console.log(
    `[golden path] approve buttons: ${approveCount}, pending indicators: ${pendingBadges}`,
  );

  if (approveCount === 0) {
    console.log('[golden path] no pending leads to approve — skipping');
    collectors.detach();
    test.skip(true, 'No pending leads to approve');
    return;
  }

  const first = approveButtons.first();
  await first.scrollIntoViewIfNeeded().catch(() => undefined);
  await first.click();

  const toastSuccess = page.locator(
    '[role="status"], [data-sonner-toast], text=/sucesso|aprovado/i',
  );
  const appeared = await toastSuccess
    .first()
    .waitFor({ state: 'visible', timeout: 8_000 })
    .then(() => true)
    .catch(() => false);

  console.log(
    appeared
      ? '[golden path] success toast appeared'
      : '[golden path] no visible success toast after approval click',
  );

  collectors.detach();
  expect.soft(appeared, 'Expected success toast after approval click').toBe(true);
});

test.afterAll(async () => {
  const header = ['ROUTE', 'LABEL', 'STATUS', 'CONSOLE', 'PAGEERR', 'VIS_ERR', 'NOTES'];
  const rows = results.map((r) => [
    r.route,
    r.label,
    r.status,
    String(r.consoleErrors),
    String(r.pageErrors),
    String(r.visibleErrors),
    r.notes,
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? '').toString().length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => (c ?? '').toString().padEnd(widths[i])).join('  ');

  console.log('\n============ OXYBROKER SMOKE MATRIX ============');
  console.log(fmt(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) console.log(fmt(row));

  const okCount = results.filter((r) => r.status === 'OK').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const totalConsole = results.reduce((s, r) => s + r.consoleErrors, 0);
  const totalPage = results.reduce((s, r) => s + r.pageErrors, 0);

  console.log(
    `\nSummary: ${okCount} OK / ${failCount} FAIL • total console errors: ${totalConsole} • total page errors: ${totalPage}`,
  );
  console.log('=================================================\n');
});

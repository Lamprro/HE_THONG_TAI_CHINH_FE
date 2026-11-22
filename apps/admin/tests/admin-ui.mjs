import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve('dist');
const server = createServer(async (req, res) => {
  const path = resolve(root, `.${req.url === '/' ? '/index.html' : req.url.split('?')[0]}`);
  if (!path.startsWith(root + '/') && !path.startsWith(root + '\\')) return res.writeHead(403).end();
  try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream'); res.end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const writes = [], errors = [];
const token = 'fixture.jwt.admin';
const username = 'fixture-admin', password = 'fixture-password';
const job = { id: '00000000-0000-0000-0000-000000000001', code: 'MARKET_PRICE_BUILD', name: 'Build canonical prices', datasetType: 'MARKET_PRICE', dataSourceCode: 'VN', dataSourceId: 1, active: false, maxRetries: 10, timeoutSeconds: 120, parameters: {}, createdAt: '2026-10-19T00:00:00Z' };
const commandId = '00000000-0000-0000-0000-000000000002';
let command, polls = 0, pythonDetailsRequests = 0, logoutAttempts = 0;
page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const reply = (body, status = 200) => route.fulfill({ status, json: body, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS' } });
  if (request.method() === 'OPTIONS') return reply({});
  if (path === '/api/auth/login') {
    assert.equal(request.method(), 'POST');
    assert.equal(request.headers().authorization, undefined);
    const credentials = request.postDataJSON();
    if (credentials.username !== username || credentials.password !== password) return reply({}, 401);
    return reply({ accessToken: token, tokenType: 'Bearer', expiresAt: new Date(Date.now() + 900000).toISOString() });
  }
  if (path !== '/api/health' && request.headers().authorization !== `Bearer ${token}`) return reply({ message: 'Admin credential required' }, 403);
  if (path === '/api/auth/logout' && request.method() === 'POST') {
    logoutAttempts++;
    if (logoutAttempts === 1) return reply({ message: 'Unavailable' }, 503);
    if (logoutAttempts === 3) return reply({}, 404);
    return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (request.method() !== 'GET') {
    const body = request.postDataJSON(); writes.push({ path, method: request.method(), body });
    if (path === '/api/admin/console/commands') { command = { id: commandId, status: 'QUEUED', ...body }; return reply(command, 202); }
    if (path === '/api/admin/catalog/master-data/seed') return reply({ count: 3 });
    return reply({ message: 'Unexpected mutation in test' }, 400);
  }
  if (path === '/api/admin/console/runtime') return reply({
    database: 'UP', timezone: 'Asia/Ho_Chi_Minh',
    schedulers: { ingestion: { enabled: true }, llm: { enabled: false }, 'news-recovery': { enabled: false } },
    adminWorkers: { commandsEnabled: false },
  });
  if (path === '/api/external-financial-data/health') return reply({ status: 'ok' });
  if (path === '/api/external-financial-data/providers') { pythonDetailsRequests++; return reply([{ name: 'Fixture source' }]); }
  if (path === '/api/external-financial-data/capabilities') return reply({ dataset: 'OHLCV' });
  if (path === '/api/admin/console/session') return reply({ authenticated: true, principal: 'fixture-admin', email: null, authorities: ['ROLE_ADMIN'] });
  if (path === '/api/health') return reply({ status: 'UP', service: 'Fixture Java' });
  if (path === '/api/ingestion-jobs') { assert.equal(url.searchParams.get('activeOnly'), 'false'); return reply([job]); }
  if (path === '/api/data-sources') return reply([{ id: 1, code: 'VN', name: 'Source', active: true }]);
  if (path === '/api/admin/console/datasets') return reply([{ name: 'ingestion_runs', available: true, columns: ['id', 'status', 'ingestion_run_id'] }, { name: 'financial_metrics', available: true, columns: ['id', 'value'] }, { name: 'llm_validation_rounds', available: false, columns: [] }]);
  if (path === `/api/admin/console/commands/${commandId}`) { polls++; return reply({ ...command, status: polls > 1 ? 'SUCCEEDED' : 'RUNNING', result_json: { status: 'NO_CHANGE', runId: 'native-run-id' } }); }
  if (path.endsWith('/data/admin_commands')) {
    const current = command && { ...command, status: polls > 1 ? 'SUCCEEDED' : command.status };
    const statuses = url.searchParams.get('status');
    const rows = current && (!statuses || statuses.split(',').includes(current.status)) ? [current] : [];
    return reply({ rows, total: rows.length });
  }
  if (path.endsWith('/data/ingestion_runs') && url.searchParams.get('size') === '100') {
    const offset = Number(url.searchParams.get('page'));
    return reply({ rows: [{ id: 'batch-' + offset, message: 'Batch ' + offset }], total: 501 });
  }
  if (path.includes('/data/')) return reply({ rows: [{ id: 'row-1', status: 'FAILED', message: 'Source quota 429', value: '12345678901234567890.125', request_query_params: { symbol: 'FPT', operation: 'OHLCV', provider: 'vndirect' } }], total: 51, page: Number(url.searchParams.get('page')), size: 25 });
  return reply([]);
});
const button = name => page.getByRole('button', { name, exact: true });
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByLabel('Tên đăng nhập').fill(username);
  await page.getByLabel('Mật khẩu').fill('wrong-password'); await button('Đăng nhập').click();
  await page.getByRole('alert').waitFor(); assert.equal(writes.length, 0);
  await page.getByLabel('Mật khẩu').fill(password); await button('Đăng nhập').click();
  await button('Luồng dữ liệu').click(); await page.getByLabel('Cách xử lý', { exact: true }).selectOption('RUN_JOB'); await page.getByLabel('Workflow/job', { exact: true }).selectOption(job.id);
  await page.getByLabel('Lý do xử lý', { exact: true }).fill('Rebuild reviewed prices'); await button('Kiểm tra phạm vi').click();
  await button('Xác nhận chạy luồng').dblclick(); await page.getByText('SUCCEEDED', { exact: true }).first().waitFor({ timeout: 10000 });
  assert.equal(writes.length, 1); assert.equal(writes[0].body.action, 'RUN_JOB'); assert.equal(writes[0].body.input.jobId, job.id);
  assert.match(writes[0].body.idempotencyKey, /^[a-f\d-]{36}$/); assert.equal(writes[0].body.reason, 'Rebuild reviewed prices');
  await button('Tra cứu dữ liệu').click(); await page.getByLabel('Loại dữ liệu').selectOption('ingestion_runs'); await page.getByText('12345678901234567890.125', { exact: true }).waitFor();
  await page.getByText('FPT', { exact: true }).waitFor(); await page.getByText('OHLCV', { exact: true }).waitFor();
  await button('Trang sau').click(); await page.getByText('51 bản ghi · Trang 2', { exact: true }).waitFor();
  await button('Chi tiết').click(); await page.getByRole('dialog').getByText('Source quota 429', { exact: true }).waitFor(); await button('Close').click();
  await page.getByLabel('Bản ghi mỗi trang').selectOption('500');
  await page.getByText('Batch 4', { exact: true }).waitFor();
  await page.getByText('501 bản ghi · Trang 1', { exact: true }).waitFor();
  await button('Trang sau').click();
  await page.getByText('Batch 5', { exact: true }).waitFor();
  assert.equal(await page.getByText('Batch 4', { exact: true }).count(), 0);
  await button('Hệ thống').click();
  const runtime = page.getByRole('heading', { name: 'Kết nối dịch vụ', exact: true }).locator('xpath=ancestor::section');
  await runtime.getByText('Đã kết nối', { exact: true }).nth(2).waitFor();
  await page.getByText('Lịch nền · 1/3 bật', { exact: true }).waitFor();
  await page.getByText('Lấy dữ liệu theo lịch', { exact: true }).waitFor();
  assert.equal(await page.getByText('news-recovery', { exact: true }).count(), 0);
  assert.equal(pythonDetailsRequests, 0);
  if (process.env.ADMIN_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, 'admin-runtime.png') });
  await page.getByText('Nhà cung cấp và dữ liệu Python hỗ trợ', { exact: true }).click();
  await page.getByText('Fixture source', { exact: true }).waitFor();
  assert.equal(pythonDetailsRequests, 1);
  await page.getByText('Nhà cung cấp và dữ liệu Python hỗ trợ', { exact: true }).click();
  await button('Danh mục & tài liệu API').click();
  await page.getByRole('link', { name: 'Mở Swagger UI' }).waitFor();
  await button('Nạp danh mục công ty và mã').click();
  assert.equal(writes.length, 1);
  await button('Xác nhận nạp').click();
  await page.getByText('Hoàn tất · 3 bản ghi.', { exact: true }).waitFor();
  assert.equal(writes.length, 2); assert.equal(writes[1].path, '/api/admin/catalog/master-data/seed');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await button('Đăng xuất').click();
  await page.getByText('Chưa thể đăng xuất. Hãy thử lại.', { exact: true }).waitFor();
  await button('Đăng xuất').click();
  await page.getByRole('heading', { name: 'Đăng nhập quản trị' }).waitFor();
  assert.equal(logoutAttempts, 2);
  assert.equal(await page.getByLabel('Mật khẩu').inputValue(), '');
  await page.getByLabel('Mật khẩu').fill(password);
  await button('Đăng nhập').click();
  await button('Đăng xuất').click();
  await page.getByText('Đã thoát trên trình duyệt. Phiên trên máy chủ chưa được thu hồi.', { exact: true }).waitFor();
  assert.equal(logoutAttempts, 3);
  assert.deepEqual(errors, []);
  console.log('ADMIN UI PASS: denied login, token-only memory, disabled-job command, double-submit guard, polling, exact decimals, pagination, error details, explicit catalog action, mobile and logout. All API responses are intercepted fixtures; no provider/LLM/database writes.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }

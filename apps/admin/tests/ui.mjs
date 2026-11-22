import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
// Serves the production build and intercepts every API request. No live backend access.
const root = resolve('dist');
const server = createServer(async (req, res) => {
  const path = resolve(root, `.${req.url === '/' ? '/index.html' : req.url.split('?')[0]}`);
  if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
  try { const body = await readFile(path); res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream'); res.end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const problems = []; const writes = [];
page.on('pageerror', error => problems.push(error.message));
const source = { id: 1, code: 'VN', name: 'Market Source', provider: 'vnstock', sourceType: 'API', priority: 1, official: true, licenseStatus: 'FREE', baseUrl: 'https://example.org', active: true };
const job = { id: '00000000-0000-0000-0000-000000000001', dataSourceId: 1, dataSourceCode: 'VN', code: 'PRICES', name: 'Price Import', datasetType: 'MARKET_PRICE', cronExpression: null, parameters: {}, maxRetries: 10, timeoutSeconds: 120, active: true, createdAt: '2026-10-15T00:00:00Z' };
const company = { id: 'company-1', companyCode: 'ACME', legalName: 'Acme Company', shortName: 'Acme', englishName: null, taxCode: '123', industryCode: null, industryName: 'Technology', sectorName: null, website: null, headquarters: null, foundedDate: null, listingStatus: null, description: 'Test master record', active: true };
const security = { id: 'security-1', companyId: company.id, symbol: 'FPT', exchange: 'HOSE', securityType: 'STOCK', isin: null, currency: 'VND', listedDate: null, delistedDate: null, sharesOutstanding: 1000, parValue: 10000, primary: true, active: false };
const run = { id: '00000000-0000-0000-0000-000000000002', ingestionJobId: job.id, dataSourceId: 1, triggerType: 'MANUAL', status: 'SUCCESS', fetchedCount: 2, insertedCount: 2, updatedCount: 0, rejectedCount: 0, errorCount: 0, startedAt: '2026-10-15T00:00:00Z', finishedAt: '2026-10-15T00:01:00Z', createdAt: '2026-10-15T00:00:00Z' };
const internalJob = { ...job, id: '00000000-0000-0000-0000-000000000018', code: 'MARKET_PRICE_BUILD', name: 'Price Build' };
const activatedVersion = { id: 'version-3', data_domain: 'MARKET_PRICE', version_code: 'VERSION-3', status: 'ACTIVATED', ingestion_run_id: run.id };

await page.route('**/api/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' } });
  if (url.pathname === '/api/auth/login') return route.fulfill({
    json: { accessToken: 'fixture.jwt.admin', tokenType: 'Bearer' }, headers: { 'Access-Control-Allow-Origin': '*' },
  });
  if (request.method() !== 'GET') { writes.push(request.url()); await route.abort(); return; }
  const path = url.pathname;
  const data = path === '/api/admin/console/session' ? { authenticated: true, principal: 'fixture-admin', email: null, authorities: ['ROLE_ADMIN'] } : path === '/api/companies' ? [company] : path === '/api/securities' ? [security] : path.endsWith('/aliases') ? [{ id: 1, alias: 'Acme Legacy', aliasType: 'FORMER_NAME' }] : path === '/api/health' ? { status: 'UP', service: 'financial-data-api' } : path === '/api/data-sources' ? [source] : path === '/api/ingestion-jobs' ? [job, internalJob] : path === '/api/ingestions' ? [run] : path === `/api/ingestions/${run.id}` ? run : path === '/api/raw-payloads' ? [{ id: 'raw-1', ingestionRunId: run.id, dataSourceId: 1, contentType: 'application/json' }] : path === '/api/raw-payloads/raw-1' ? { id: 'raw-1', ingestionRunId: run.id, dataSourceId: 1, contentType: 'application/json', fetchedAt: run.createdAt, createdAt: run.createdAt, checksumSha256: 'a'.repeat(64), body: null } : path === '/api/admin/console/data/validation_results' ? { rows: [{ id: 'validation-1', validation_rule_id: '1', rule_code: 'RAW_REQUIRED', raw_payload_id: 'raw-1', ingestion_run_id: run.id, severity: 'ERROR', result_status: 'FAIL', handling_status: 'OPEN', message: 'Required field missing', observed_value: 'null', expected_value: 'value', checked_at: run.createdAt, resolved_by_user_id: null, resolved_at: null, resolution_note: 'Check source mapping' }], total: 1 } : path === '/api/admin/console/data/data_versions' ? { rows: [{ id: 'version-2', data_domain: 'MARKET_PRICE', version_code: 'VERSION-2', status: 'REJECTED', parent_data_version_id: 'version-1', ingestion_run_id: run.id, created_at: run.createdAt, activated_at: null, checksum_sha256: 'b'.repeat(64), row_count: '2' }, { id: 'version-1', version_code: 'VERSION-1', status: 'ACTIVE', parent_data_version_id: null, ingestion_run_id: run.id, created_at: run.createdAt }], total: 2 } : path === '/api/admin/validation/rules' ? [{ id: 1, code: 'RAW_REQUIRED', name: 'Required fields', dataDomain: 'MARKET_PRICE', severity: 'ERROR', ruleType: 'SCHEMA', isActive: true, ruleConfig: {}, createdAt: run.createdAt, updatedAt: run.createdAt }] : [];
  if (path === '/api/admin/console/data/ingestion_runs') {
    const matched = !url.searchParams.has('ingestion_job_id') || url.searchParams.get('ingestion_job_id') === job.id;
    return route.fulfill({ json: { total: matched ? 1 : 0, rows: matched ? [{
      id: run.id, ingestion_job_id: job.id, data_source_id: run.dataSourceId, status: run.status,
      started_at: run.startedAt, fetched_count: 2, inserted_count: 2, error_count: 0,
    }] : [] }, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (path === '/api/admin/console/datasets') {
    return route.fulfill({ json: [{ name: 'market_prices', available: true, columns: ['id','data_version_id','raw_payload_id'], exactFilters: ['id','data_version_id','raw_payload_id'] }], headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (path === '/api/admin/console/data/market_prices') {
    assert.equal(url.searchParams.get('data_version_id'), activatedVersion.id);
    return route.fulfill({ json: { rows: [{ id: '19', symbol: 'FPT', close_price: '123456.780000', raw_payload_id: 'raw-1' }], total: 1 }, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  if (path === '/api/admin/console/data/data_versions' && url.searchParams.get('runId') === run.id && url.searchParams.get('size') === '100') {
    data.rows.push(activatedVersion);
  }
  const resolved = path === '/api/admin/validation/results' || path === '/api/admin/validation/results/open' ? [{ id: 'validation-1', validationRuleId: 1, ruleCode: 'RAW_REQUIRED', rawPayloadId: 'raw-1', ingestionRunId: run.id, severity: 'ERROR', status: 'FAIL', handlingStatus: 'OPEN', message: 'Required field missing', observedValue: 'null', expectedValue: 'value', checkedAt: run.createdAt, resolvedByUserId: null, resolvedAt: null, resolutionNote: 'Check source mapping' }] : path === '/api/admin/validation/data-versions' ? [{ id: 'version-2', dataDomain: 'MARKET_PRICE', versionCode: 'VERSION-2', status: 'REJECTED', parentDataVersionId: 'version-1', ingestionRunId: run.id, createdAt: run.createdAt, activatedAt: null, checksumSha256: 'b'.repeat(64), rowCount: 2 }, { id: 'version-1', versionCode: 'VERSION-1', status: 'ACTIVE', parentDataVersionId: null, ingestionRunId: run.id, createdAt: run.createdAt }] : data;
  await route.fulfill({ json: resolved, headers: { 'Access-Control-Allow-Origin': request.headers().origin || '*', 'Access-Control-Allow-Credentials': 'true' } });
});
const button = name => page.getByRole('button', { name, exact: true });
const close = () => page.getByRole('button', { name: 'Close', exact: true }).click();
const review = async () => { const reason = page.getByLabel('Lý do vận hành *', { exact: true }); if (await reason.count()) await reason.fill('UI test review only'); await button('Xem lại yêu cầu').click(); };
const available = async () => assert.equal(await button('Xác nhận và thực hiện').isDisabled(), false);
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByLabel('Tên đăng nhập').fill('fixture-admin');
  await page.getByLabel('Mật khẩu').fill('fixture-password');
  await button('Đăng nhập').click();
  await button('Job & nguồn').click();
  await button('Tạo job').click(); await review();
  assert.ok(await page.getByText('Trường này bắt buộc.', { exact: true }).count());
  await page.getByLabel('Nguồn dữ liệu *', { exact: true }).selectOption('VN');
  await page.getByLabel('Mã job *', { exact: true }).fill('NEW_PRICE');
  await page.getByLabel('Tên job *', { exact: true }).fill('New price import');
  await page.getByLabel('Loại dữ liệu *', { exact: true }).selectOption('MARKET_PRICE');
  await page.getByLabel('Tham số (JSON object) *', { exact: true }).fill('[]'); await review();
  assert.equal(await page.getByText('Nhập một JSON object.', { exact: true }).count(), 1);
  await page.getByLabel('Tham số (JSON object) *', { exact: true }).fill('{}'); await review(); await available(); await close();
  await page.getByText('Price Import', { exact: true }).click(); await button('Chạy ngay').click(); await review(); await available();
  assert.equal(await page.getByText('Thao tác có thể gọi dịch vụ bên ngoài, tốn tài nguyên và ghi dữ liệu. Mỗi lần xác nhận tạo một lượt chạy mới.').count(), 1); await close();
  await page.getByText('Price Import', { exact: true }).click(); await button('Tắt job').click(); await review(); await available(); await close();
  await button('Lấy dữ liệu thủ công').click();
  await page.getByLabel('Thao tác nguồn *', { exact: true }).selectOption('OHLCV');
  await page.getByLabel('Nguồn dữ liệu *', { exact: true }).selectOption('VN'); await review();
  assert.equal(await page.getByText('Thao tác này cần mã chứng khoán.').count(), 1);
  await page.getByLabel('Mã chứng khoán', { exact: true }).fill('FPT'); await review(); await available(); await close();
  await button('Job & nguồn').click(); await button('Nguồn dữ liệu').click(); await page.getByText('Market Source', { exact: true }).click(); await button('Sửa nguồn dữ liệu').click();
  assert.equal(await page.getByLabel('Mã nguồn *', { exact: true }).getAttribute('readonly'), '');
  assert.equal(await page.getByLabel('Tên nguồn *', { exact: true }).inputValue(), 'Market Source');
  await page.getByLabel('Đang bật', { exact: true }).selectOption('false'); await review(); await available();
  assert.equal(await page.getByText('Trạng thái bật của nguồn sẽ thay đổi và có thể ảnh hưởng việc lấy dữ liệu.').count(), 1); await close();
  await button('Chất lượng dữ liệu').click(); await page.getByRole('tab', { name: 'Luật validation' }).click();
  await page.getByText('RAW_REQUIRED', { exact: true }).waitFor();
  await button('Validate dữ liệu chờ').click(); await page.getByLabel('Số payload tối đa *').fill('101'); await review();
  assert.equal(await page.getByText('Nhập số nguyên từ 1 đến 100.').count(), 1);
  await page.getByLabel('Số payload tối đa *').fill('50'); await review(); await available(); await close();
  await button('Tác vụ & lịch sử').click(); await button('Lịch sử job').click(); await page.getByText('Price Import', { exact: true }).click();
  await button('Chạy validation').click(); await review(); await available(); await close();
  await button('Danh mục mã').click(); await page.getByText('Acme Company', { exact: true }).click();
  await page.getByText('Acme Legacy', { exact: true }).waitFor(); await button('Sửa công ty').click();
  assert.equal(await page.getByLabel('Tên pháp lý *', { exact: true }).inputValue(), 'Acme Company');
  assert.equal(await page.getByLabel('Mô tả', { exact: true }).inputValue(), 'Test master record');
  await review(); await available(); await close();
  await page.getByText('Acme Company', { exact: true }).click(); await button('Thêm tên gọi khác').click(); await review();
  assert.equal(await page.getByText('Trường này bắt buộc.', { exact: true }).count(), 1);
  await page.getByLabel('Tên gọi khác *', { exact: true }).fill('Another name'); await page.getByLabel('Loại tên gọi *', { exact: true }).selectOption('OTHER');
  await review(); await available(); await close();
  await page.getByRole('tab', { name: 'Mã chứng khoán', exact: true }).click(); await page.getByText('FPT', { exact: true }).click();
  await button('Kích hoạt mã').click(); await review(); await available();
  assert.equal(await page.getByText('Yêu cầu này thay đổi dữ liệu danh mục, có thể thay đổi job lấy dữ liệu và cấu hình nguồn.').count(), 1); await close();
  await page.getByText('FPT', { exact: true }).click(); await button('Sửa mã chứng khoán').click();
  assert.equal(await page.getByLabel('Số cổ phiếu lưu hành', { exact: true }).inputValue(), '1000');
  await page.getByLabel('Tiền tệ *', { exact: true }).fill('VIETNAM'); await review();
  assert.equal(await page.getByText('Dùng mã tiền tệ 3 chữ cái.').count(), 1);
  await page.getByLabel('Tiền tệ *', { exact: true }).fill('VND'); await review(); await available(); await close();
  await button('Tác vụ & lịch sử').click(); await button('Lịch sử job').click(); await page.getByText('Price Import', { exact: true }).click();
  await button('Xem raw payload').click(); await page.getByText('SHA-256: ' + 'a'.repeat(64), { exact: true }).waitFor();
  await button('Xem validation của payload').click();
  await page.getByText('RAW_REQUIRED', { exact: true }).click();
  await page.getByText('Check source mapping', { exact: true }).waitFor();
  await button('Xem raw payload').click(); await button('Xem version của lượt chạy').click();
  await page.getByText('VERSION-2', { exact: true }).click(); await button('Xem version cha').click();
  assert.equal(await page.getByRole('dialog').getByRole('heading', { name: 'VERSION-1', exact: true }).count(), 1); await close();
  await button('Tác vụ & lịch sử').click(); await button('Lịch sử job').click();
  await page.getByLabel('Nhóm job', { exact: true }).selectOption('source');
  assert.equal(await page.getByRole('option', { name: /Price Build/ }).count(), 0);
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('SUCCESS');
  await Promise.all([
    page.waitForRequest(request => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/data/ingestion_runs') && url.searchParams.get('ingestion_job_id') === job.id
        && url.searchParams.get('status') === 'SUCCESS';
    }),
    page.getByLabel('Job', { exact: true }).selectOption(job.id),
  ]);
  await button('Mở lượt chạy').click();
  const drawer = page.getByRole('dialog', { name: 'Lượt chạy job' });
  const stages = await drawer.locator('.run-stages h3').allTextContents();
  assert.deepEqual(stages, ['1. Dữ liệu nguồn', '2. Kết quả kiểm tra', '3. Ghi dữ liệu']);
  await button('Xem dữ liệu đã ghi').click();
  await page.getByText('123456.780000', { exact: true }).waitFor();
  assert.equal(await page.getByText('Bảng dữ liệu', { exact: true }).count(), 0);
  if (process.env.ADMIN_SCREENSHOT_DIR) {
    await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, 'admin-output-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(process.env.ADMIN_SCREENSHOT_DIR, 'admin-output-mobile.png') });
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await button('Chất lượng dữ liệu').click();
  assert.equal(await button('Truy vết nguồn (Lineage)').count(), 0);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 545 });
    await button('Tổng quan').click();
    const sidebar = page.locator('.sidebar');
    const before = await sidebar.boundingBox();
    const main = page.locator('.main');
    await main.hover();
    await page.mouse.wheel(0, 480);
    await page.waitForFunction(() => document.querySelector('.main').scrollTop > 0);
    assert.deepEqual(await sidebar.boundingBox(), before);
    assert.equal(await main.evaluate(element => element.scrollWidth <= element.clientWidth), true);
    await button('Tác vụ & lịch sử').click();
    assert.deepEqual(await sidebar.boundingBox(), before);
    assert.equal(await main.evaluate(element => element.scrollTop), 0);
  }

  await page.setViewportSize({ width: 390, height: 844 }); await button('Job & nguồn').click(); await button('Job lấy dữ liệu').click(); await button('Tạo job').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
  assert.deepEqual(problems, []); assert.deepEqual(writes, []);
  console.log('UI PASS: form validation, review/confirmation, available actions, run/raw actions, source prefill, rules, master forms/aliases/security side effects, raw-validation-version traversal and mobile layout; zero API writes.');
} finally { await browser.close(); await new Promise(r => server.close(r)); }

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('dist');
const server=createServer(async(req,res)=>{const file=resolve(root,`.${req.url==='/'?'/index.html':req.url.split('?')[0]}`);if(!file.startsWith(root+'/')&&!file.startsWith(root+'\\'))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const source={id:1,code:'VN',name:'Fixture source',provider:'vndirect',active:true,sourceType:'API'};
const job={id:id(1),code:'MARKET_PRICE_BUILD',name:'Fixture price builder',dataSourceId:1,dataSourceCode:'VN',active:true,cronExpression:'0 0 0 * * *',datasetType:'MARKET_PRICE',parameters:{},maxRetries:10,timeoutSeconds:120,createdAt:'2026-10-20T00:00:00Z'};
const queue={id:id(2),action:'RUN_JOB',status:'QUEUED',reason:'Queued fixture',request_json:{jobId:job.id}};
const pendingVersion={id:id(11),version_code:'TEST-VERSION',status:'PENDING_REVIEW',notes:'Giá đóng cửa nguồn mới lệch dữ liệu hiện tại'};
const commands=new Map([[queue.id,queue]]);const writes=[],errors=[];let count=20,promoted=false,newPrompt=null;const notes=[];
const forecastRun=id(60);let previewEligible=false;
const runSummary={id:forecastRun,taskCode:"FINANCIAL_SCENARIOS",status:"FAILED",symbol:"FPT",modelName:"fixture-model",attemptCount:1,errorMessage:"PROVIDER_RATE_LIMIT",createdAt:"2026-10-16T00:00:00Z"};
const original={id:id(3),task_code:'NEWS_SUMMARY',version:'v1',enabled:true,system_prompt:'Real-shaped fixture instructions',request_schema:{type:'object'},response_schema:{required:['evidence']}};
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();const reply=(body,status=200)=>route.fulfill({status,json:body,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,OPTIONS'}});
  if(method==='OPTIONS')return reply({});
  if(path==='/api/auth/login')return reply({accessToken:'fixture.jwt.admin',tokenType:'Bearer'});
  if(method!=='GET'){
    const body=request.postDataJSON();writes.push({path,method,body});
    if(path==='/api/admin/console/commands') {const command={id:id(count++),...body,request_json:body.input,status:'SUCCEEDED',result_json:body.action==='FORECAST_PREVIEW'?{eligible:previewEligible,issues:previewEligible?[]:['No verified publication history']}:body.action==='FORECAST_EXECUTE'?{status:'FAILED',runId:forecastRun}:{status:body.action==='RECOVERY_APPROVE'?'APPROVED':'ACTIVATED'},progress_json:body.action==='INGEST_VALIDATE_BUILD'?{stage:'COMPLETE',sourceRunId:id(10)}:null};commands.set(command.id,command);return reply({...command,status:'QUEUED'},202);}
    if(path.endsWith('/cancel')){queue.status='CANCELLED';return reply(queue);}
    if(path.endsWith('/retry')){const child={id:id(count++),status:'FAILED',action:'RUN_JOB',parent_command_id:queue.id,reason:body.reason,error_message:'Source quota 429',result_json:{category:'RATE_LIMIT'}};commands.set(child.id,child);return reply(child,202);}
    if(path.endsWith('/data-versions/'+pendingVersion.id+'/review')){pendingVersion.status=body.accept?'ACTIVE':'REJECTED';return reply(pendingVersion);}
    if(path.endsWith('/reviews')){notes.push({id:id(40),reason:body.reason,event_type:'ISSUE_REVIEWED'});return reply({validationStatusChanged:false});}
    if(path==='/api/admin/prompts'){newPrompt={...original,id:id(4),version:body.version,system_prompt:body.prompt,enabled:false};return reply(newPrompt);}
    if(path.endsWith('/enabled')){promoted=body.enabled;newPrompt.enabled=promoted;return reply({id:newPrompt.id,enabled:promoted});}
    return reply({message:'Unexpected fixture mutation'},400);
  }
  if (path === '/api/admin/console/runtime') return reply({ database: 'UP', timezone: 'Asia/Ho_Chi_Minh', schedulers: {}, adminWorkers: { commandsEnabled: false } });
  if(path==='/api/admin/console/session')return reply({ authenticated: true, principal: 'fixture-admin', email: null, authorities: ['ROLE_ADMIN'] });if(path==='/api/health')return reply({status:'UP'});
  if(path==='/api/ingestion-jobs')return reply([job]);if(path==='/api/data-sources')return reply([source]);if(path==='/api/securities')return reply([{id:id(5),symbol:'FPT',exchange:'HOSE',active:true}]);
  if(path==='/api/admin/console/summary')return reply({jobs:[{is_active:true,count:1}],commands:[],runs:[],versions:[],validation:[]});
  if(path==='/api/admin/console/datasets')return reply([{name:'market_prices',available:true,columns:['id','security_id','trading_date']}]);
  if(path==='/api/admin/console/commands/ai')return reply({content:[...commands.values()].filter(command=>command.action==='FORECAST_PREVIEW'&&command.result_json?.eligible).map(command=>({id:command.id,action:command.action,status:command.status,outcome:'READY_FOR_EXECUTION',createdAt:runSummary.createdAt})),totalElements:1});
  if(path==='/api/admin/llm/runs')return reply({content:[runSummary],totalElements:1});
  if(path==='/api/admin/llm/runs/'+forecastRun)return reply({id:forecastRun,task_code:'FINANCIAL_SCENARIOS',status:'FAILED',model_name:'fixture-model',request_metadata:{forecast_request:{securityId:id(5)}},error_message:'PROVIDER_RATE_LIMIT',attempts:[{attempt_no:1,http_status:429}],written_results:[{id:id(61),is_current:false,quality_status:"VALID",result_json:{overview:"Kịch bản đã lưu"}}],validations:[{rule_code:'FORECAST_RULE',result_status:'FAIL'}]});
  if(path.startsWith('/api/admin/console/commands/'))return reply(commands.get(path.split('/').at(-1))||{});
  if(path.endsWith('/data/admin_commands'))return reply({rows:[queue],total:1});
  if(path.endsWith('/data/data_versions'))return reply({rows:[pendingVersion],total:1});
  if(path.endsWith('/data/validation_results'))return reply({rows:[{id:id(6),rule_code:'REQUIRED_FIELD',result_status:'FAIL',message:'Missing source field',ingestion_run_id:id(10)}],total:1});
  if(path.includes('/issues/')&&path.endsWith('/reviews'))return reply(notes);
  if(path.endsWith('/configuration'))return reply({configured:false,llmConfigured:false,adminReviewRequired:true});
  if(path==='/api/admin/news-recovery/pending')return reply([{runId:id(7),articleId:id(8),status:'SUCCESS',proposal:{content:'Fixture proposal requiring review'}}]);
  if(path.endsWith('/candidates')||path==='/api/admin/console/news-candidates')return reply([{articleId:id(8),title:'Fixture financial article'}]);
  if(path.endsWith('/results'))return reply([]);
  if(path==='/api/admin/prompts')return reply(newPrompt?[original,newPrompt]:[original]);
  if(path.startsWith('/api/admin/prompts/'))return reply(path.endsWith(id(4))?newPrompt:original);
  if(path==='/api/admin/financial-data/status')return reply({
    symbol:'FPT', canonical:{canonical_statements:8,missing_publication:2,missing_scope:0,missing_unit:1},
  });
  if(path.includes('/data/'))return reply({rows:[],total:0});return reply([]);
});
const button=name=>page.getByRole('button',{name,exact:true});
const fieldStyle = locator => locator.evaluate(element => {
  const style = getComputedStyle(element);
  return [style.height, style.fontSize, style.borderRadius, style.borderColor, style.paddingInlineStart];
});
const views = [
  ['Tổng quan', []],
  ['Job & nguồn', ['Nguồn dữ liệu', 'Job lấy dữ liệu']],
  ['Luồng dữ liệu', []],
  ['Tác vụ & lịch sử', ['Kiểm tra & ghi dữ liệu', 'Tác vụ nền', 'Lịch sử job']],
  ['Chất lượng dữ liệu', ['Phiên bản dữ liệu', 'Luật validation', 'Kết quả validation']],
  ['Tra cứu dữ liệu', []],
  ['Danh mục mã', ['Mã chứng khoán', 'Công ty']],
  ['Vận hành AI', ['Phân tích tin', 'Khôi phục & duyệt', 'Lịch sử LLM', 'Prompt & cấu hình', 'Dự báo']],
  ['Hệ thống', ['Độ phủ dữ liệu', 'Dữ liệu thị trường', 'Tra cứu Giá Canonical cổ phiếu', 'Chỉ số thị trường & Rổ thành phần', 'Danh mục & tài liệu API', 'Kết nối']],
];
async function assertPageControls(scope, view) {
  const mismatched = await scope.locator('input:not([type=checkbox], [type=radio], [type=hidden]), select, textarea').evaluateAll(fields =>
    fields.filter(field => {
      if (!field.getClientRects().length || getComputedStyle(field).visibility === 'hidden') return false;
      const style = getComputedStyle(field);
      const minimumHeight = field.matches('textarea') ? 88 : field.matches('select[multiple]') ? 136 : 42;
      const {height, left, right} = field.getBoundingClientRect();
      const outsideViewport = !field.closest('.table-scroll') && (left < -1 || right > innerWidth + 1);
      return style.fontSize !== '14px' || style.borderRadius !== '8px' ||
        outsideViewport || (minimumHeight === 42 ? Math.abs(height - minimumHeight) > 1 : height < minimumHeight);
    }).map(field => field.getAttribute('aria-label') || field.labels?.[0]?.textContent || field.outerHTML.slice(0, 100)),
  );
  assert.deepEqual(mismatched, [], view);
}
try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByLabel('Tên đăng nhập').fill('fixture-admin');await page.getByLabel('Mật khẩu').fill('fixture-password');await button('Đăng nhập').click();
  await page.getByText('1 tác vụ đang chờ',{exact:true}).waitFor();
  const navigation = page.getByRole('navigation', {name:'Điều hướng quản trị'});
  const main = page.getByRole('main');
  for (const width of [1440, 390]) {
    await page.setViewportSize({width, height: 1000});
    for (const [section, tabs] of views) {
      const item = navigation.getByRole('button', {name:section, exact:true});
      await item.click();
      assert.equal(await item.getAttribute('aria-current'), 'page');
      await assertPageControls(main, `${width}px / ${section}`);
      for (const tab of tabs) {
        await main.getByRole('button', {name:tab, exact:true})
          .or(main.getByRole('tab', {name:tab, exact:true})).click();
        await assertPageControls(main, `${width}px / ${section} / ${tab}`);
      }
    }
  }
  await page.setViewportSize({width:1440,height:1000});
  await button('Giao diện tối').click();
  await navigation.getByRole('button', {name:'Luồng dữ liệu', exact:true}).click();
  await assertPageControls(main, 'Luồng dữ liệu / Giao diện tối');
  await button('Giao diện sáng').click();
  await button('Job & nguồn').click();
  const jobFilter = page.getByPlaceholder('Tên, mã job hoặc mã nguồn');
  const jobStyle = await fieldStyle(jobFilter);
  assert.deepEqual(await fieldStyle(page.locator('.toolbar.filters select').first()), jobStyle);
  await button('Luồng dữ liệu').click();
  const workflowMode = page.getByLabel('Cách xử lý',{exact:true});
  const workflowDate = page.getByLabel('Từ ngày',{exact:true});
  assert.deepEqual(await fieldStyle(workflowMode), jobStyle);
  assert.deepEqual(await fieldStyle(workflowDate), jobStyle);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const fields = [...document.querySelectorAll('.admin-form-grid > label')];
    return fields.length >= 6 && fields.every(field => field.getBoundingClientRect().right <= innerWidth);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await button('Luồng dữ liệu').click();await page.getByLabel('Nguồn dữ liệu',{exact:true}).selectOption('VN');await page.getByLabel('Mã chứng khoán/chỉ số',{exact:true}).fill('FPT');await page.getByLabel('Từ ngày',{exact:true}).fill('2026-10-01');await page.getByLabel('Đến ngày',{exact:true}).fill('2026-10-16');await page.getByLabel('Lý do xử lý',{exact:true}).fill('Reviewed source range');await button('Kiểm tra phạm vi').click();await button('Xác nhận chạy luồng').click();await page.getByText('Kết quả nghiệp vụ: ACTIVATED',{exact:true}).waitFor();assert.equal(writes[0].body.action,'INGEST_VALIDATE_BUILD');assert.equal(writes[0].body.input.symbol,'FPT');
  await button('Tác vụ & lịch sử').click();await button('Tác vụ nền').click();await button('Theo dõi / xử lý').click();await button('Hủy tác vụ đang chờ').click();await page.getByLabel('Lý do xác nhận',{exact:true}).fill('Cancel queued fixture');await button('Xác nhận xử lý tác vụ').click();await button('Kiểm tra và gửi lại').waitFor();await button('Kiểm tra và gửi lại').click();await page.getByLabel('Lý do xác nhận',{exact:true}).fill('Reviewed original result, retry');await button('Xác nhận xử lý tác vụ').click();await page.getByText('Source quota 429',{exact:true}).waitFor();assert.equal(writes.find(w=>w.path.endsWith('/retry')).body.reviewed,true);
  await button('Kiểm tra & ghi dữ liệu').click();await page.getByLabel('Trạng thái',{exact:true}).selectOption('FAIL');
  assert.equal(await page.getByRole('option', { name: 'Luật kiểm tra', exact: true }).count(), 0);
  const filterBounds = await page.getByLabel('Trạng thái', { exact: true }).boundingBox();
  const buttonBounds = await button('Lọc lịch sử').boundingBox();
  assert.ok(Math.abs(filterBounds.y + filterBounds.height - buttonBounds.y - buttonBounds.height) <= 1);
  await Promise.all([
    page.waitForRequest(request => new URL(request.url()).searchParams.get('status') === 'FAIL'),
    button('Lọc lịch sử').click(),
  ]);
  await button('Ghi nhận xử lý lỗi').click();await page.getByLabel('Ghi chú xử lý',{exact:true}).fill('Investigating source mapping; FAIL retained');await button('Lưu ghi chú').click();await page.getByText('Investigating source mapping; FAIL retained',{exact:true}).waitFor();await button('Close').click();
  await button('Vận hành AI').click();assert.equal(await button('Chuẩn bị chạy dự báo').isDisabled(),true);await page.getByLabel('Chứng khoán dự báo',{exact:true}).selectOption(id(5));await page.getByLabel('Ngày chốt dữ liệu dự báo',{exact:true}).fill('2026-10-16');await page.getByLabel('Lý do thao tác AI',{exact:true}).fill('Preview without model calls');await button('Kiểm tra dữ liệu đầu vào').click();await button('Xác nhận thao tác AI').click();await page.getByText('Kết quả nghiệp vụ: INPUT_NOT_ELIGIBLE',{exact:true}).waitFor();assert.equal(await button('Chuẩn bị chạy dự báo').isDisabled(),true);
  previewEligible=true;
  await button('Kiểm tra dữ liệu đầu vào').click();await button('Xác nhận thao tác AI').click();
  await page.getByText('Đầu vào sẵn sàng. Bấm Chuẩn bị chạy dự báo rồi xác nhận để gọi LLM.').waitFor();
  assert.equal(writes.filter(w=>w.body?.action==='FORECAST_EXECUTE').length,0);
  await button('Chuẩn bị chạy dự báo').click();await button('Xác nhận thao tác AI').click();
  await page.getByRole('button',{name:/^Xem lượt LLM/}).click();
  const runDetail=page.getByRole('dialog',{name:'Chi tiết lượt LLM'});
  await runDetail.getByText(/Lần gọi nhà cung cấp \(1\)/i).waitFor();
  await runDetail.getByText('Xem dữ liệu đã ghi · Lịch sử · VALID',{exact:true}).click();
  await runDetail.getByRole('cell',{name:'429',exact:true}).waitFor();
  await runDetail.getByText('FORECAST_RULE', {exact:true}).waitFor();
  await runDetail.getByRole('button',{name:'Chạy lại',exact:true}).click();
  await runDetail.getByLabel('Lý do',{exact:true}).fill('Retry reviewed provider failure');
  await runDetail.getByRole('button',{name:'Xác nhận',exact:true}).click();
  await runDetail.getByRole('heading',{name:'Tiến trình và kết quả'}).waitFor();
  assert.deepEqual(writes.find(w=>w.body?.action==='FORECAST_RETRY').body.input,{runId:forecastRun});
  await runDetail.getByRole('button',{name:'Close'}).click();
  await page.getByLabel('Tác vụ',{exact:true}).selectOption('FINANCIAL_SCENARIOS');
  await button('Lọc lịch sử').click();
  await page.getByRole('row').filter({hasText:'fixture-model'}).getByRole('button',{name:'FPT',exact:true}).click();
  await runDetail.getByRole('button',{name:'Close'}).click();
  await page.getByRole('row').filter({hasText:'fixture-model'}).waitFor();
  await button('Lệnh quản trị AI').click();
  await page.getByRole('row').filter({hasText:'Đầu vào sẵn sàng'}).getByRole('button',{name:'Kiểm tra đầu vào',exact:true}).click();
  await button('Tiếp tục sang dự báo').click();
  assert.equal(await page.getByLabel('Chứng khoán dự báo',{exact:true}).inputValue(),id(5));
  await button('Chuẩn bị chạy dự báo').waitFor();
  assert.equal(await button('Chuẩn bị chạy dự báo').isEnabled(),true);
  await button('Khôi phục & duyệt').click();await button('Chọn để đọc và duyệt').click();await page.getByLabel('Người duyệt',{exact:true}).fill('Admin fixture');await page.getByLabel('Lý do thao tác AI',{exact:true}).fill('Reviewed recovery proposal');await button('Chuẩn bị duyệt đề xuất').click();await button('Xác nhận thao tác AI').click();await page.getByText('Kết quả nghiệp vụ: APPROVED',{exact:true}).waitFor();assert.equal(writes.some(w=>w.body?.action==='RECOVERY_ANALYZE'),false);
  await button('Prompt & cấu hình').click();await button('Chọn template').click();await button('Lấy nội dung bản gốc để sửa').click();await page.getByLabel('Version prompt mới',{exact:true}).fill('v2');await page.getByLabel('Lý do thay đổi prompt',{exact:true}).fill('Reviewed immutable version');await button('Xem lại version mới').click();await button('Xác nhận thay đổi prompt').click();await button('Chuẩn bị bật version').waitFor();assert.equal(newPrompt.enabled,false);await button('Chuẩn bị bật version').click();await button('Xác nhận thay đổi prompt').click();await button('Chuẩn bị tắt version').waitFor();assert.equal(promoted,true);
  // A click finishes before the mutation response and React's next render.
  await button('Xác nhận cập nhật lịch').waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 390, height: 844 });
  // Wait for responsive layout; measuring immediately after resize races CI rendering.
  try {
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, null, { timeout: 5000 });
  } catch (error) {
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      width: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')]
        .filter(el => el.getBoundingClientRect().right > innerWidth)
        .slice(0, 15).map(el => ({ tag: el.tagName, className: el.className, right: el.getBoundingClientRect().right })),
    }));
    throw new Error(`Mobile horizontal overflow: ${JSON.stringify(layout)}`, { cause: error });
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await button('Tác vụ & lịch sử').click(); await button('Kiểm tra & ghi dữ liệu').click();
  await page.getByLabel('Danh mục chất lượng').selectOption('data_versions');
  await button('Duyệt lệch nguồn').click();
  await page.getByLabel('Lý do duyệt').fill('Verified source outside the fixture');
  await button('Chấp nhận nguồn mới').click();
  await page.getByLabel('Version ID').waitFor();
  assert.equal(await page.getByLabel('Version ID').inputValue(),pendingVersion.id);
  assert.equal(writes.find(w=>w.path.endsWith('/data-versions/'+pendingVersion.id+'/review')).body.accept,true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await button('Chất lượng dữ liệu').click();
  await page.getByRole('tab', { name: 'Luật validation' }).waitFor();
  assert.equal(await button('Chất lượng BCTC').count(), 0);
  console.log('FULL FLOWS UI PASS: typed canonical pipeline, queued cancellation, reviewed retry, issue note, forecast eligibility gate, recovery approval separated from analysis, immutable prompt version/promotion, mobile and no credential persistence. All APIs intercepted; no real provider, AI or business DB writes.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

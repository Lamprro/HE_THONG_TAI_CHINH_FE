# Cập nhật 19/11/2026 — rà soát và hoàn thiện admin FE

- Toàn bộ màn hình (tổng quan, lượt chạy, job, nguồn, chất lượng, danh mục mã, form thao tác) và lỗi API dùng tiếng Việt.
- Lượt chạy / raw payload / chất lượng lọc theo lượt chạy giờ đọc đúng bản ghi của lượt đó qua bộ lọc chính xác của data browser (tối đa 100), không còn chỉ tìm trong mẫu 50 kết quả mới nhất.
- API quản trị nâng cao: suy ra tên tham số đường dẫn từ route khi catalog backend trả tên "body" (47/90 endpoint), nên các form có ID trên đường dẫn dùng được.
- Tác vụ nền: dùng chung một hook theo dõi; khi tác vụ kết thúc, dữ liệu trên màn hình tự làm mới.
- GET timeout 20 giây (kiểm tra Python lạnh mất ~8 giây); phiên hết hạn hiển thị thông báo ở màn hình kết nối.

# Cập nhật 12/11/2026 — gọn điều hướng admin

Menu gộp từ 14 xuống 9 mục, nhãn tiếng Việt, không mất chức năng:

| Mục | Gồm (trước đây) |
|---|---|
| Tổng quan | Overview + System summary |
| Tác vụ & lịch sử | Điều tra & xử lý, Ingestion Runs, Audit (tab: tác vụ nền, lượt chạy gần đây, toàn bộ lượt chạy, validation & version, audit) |
| Tra cứu dữ liệu | giữ nguyên |
| Hệ thống | Hệ thống & độ phủ, lịch chạy, Luồng & API quản trị (tab "API quản trị nâng cao") |
| Luồng dữ liệu | Luồng dữ liệu + Điều hành tác vụ (thêm chế độ lấy lại nguồn theo yêu cầu gốc) |
| Job & nguồn | Ingestion Jobs + Data Sources |
| Danh mục mã · Chất lượng dữ liệu · Vận hành AI | giữ nguyên |

`CommandPage` bị bỏ vì trùng với Luồng dữ liệu + lịch sử tác vụ. API mặc định là `http://localhost:8080`
(trước đây là một URL ngrok cố định); đặt `VITE_API_BASE_URL` khi build cho môi trường khác, hoặc nhập địa chỉ ở màn hình kết nối.
Bảng phân trang không còn làm sập trang khi response thiếu `total`.
Kiểm thử: build, 11 unit, 3 suite Playwright fixture, và walk Chrome thật 18 màn hình qua backend localhost + DB thật (chỉ GET).

# TOKEN BURNER Admin Console

Financial data monitoring and administration with React 19, TypeScript, Vite, TanStack Query and Lucide. Integrates Java Spring Boot only.

- Monitoring: overview, recent ingestion runs, diagnostics, payload metadata and related validation.
- Management: job creation/run/activation workflows, manual ingestion, source add/edit, validation rules and raw/pending validation. Data Scope adds Companies/Securities lists, details, company aliases and reviewed master-data forms.
- Forms include field validation, request review, explicit confirmation, pending/error/server-result states and cache invalidation.

## Development

```sh
npm install
# Copy .env.example to .env and point VITE_API_BASE_URL to Java
npm run dev
npm run typecheck
npm test
npm run build
```

Default Java origin: http://localhost:8080. API errors stay visible; the application does not substitute mock data. No fake login is provided.

## Admin operations

Sign in to Java with an Admin username and password. Java reads the role from the account and issues a 15-minute JWT, which the dashboard keeps in memory. `VITE_API_BASE_URL` points only to Java and must never contain credentials. Jobs includes inactive definitions and reviewed edit/enable/one-off actions.

Structured data workflows run source → validation → selected-version canonical build, or resume a saved source. Durable commands expose progress, native diagnostics, queued cancellation and reviewed retries. Dedicated AI screens expose forecast preview, NEWS, recovery review/analysis and immutable prompt versions. Admin history, audit, exact data filters and scoped scheduling supplement the native API catalog. Scheduling defaults off. See [October 20 workflow report](docs/ADMIN_FLOWS_20261020.md) for actual evidence and boundaries.

## Tests

npm test uses Node 24 synchronous loader hooks and the installed TypeScript compiler; tests intercept fetch and make no network requests. They cover the write services, Java request serialization, validation and HTTP errors.

For isolated browser checks, build first, then install the browser with `npx playwright install chromium`. Playwright is pinned in devDependencies. `npm run test:ui` runs three suites against dist and intercepts every API request; `PLAYWRIGHT_CHANNEL=chromium` selects bundled Chromium, otherwise installed Chrome is used. Fixtures never enter the production bundle or business database. Native source/API acceptance is recorded separately from these mocked suites.

## Integration limits

Legacy monitoring cards retain recent samples. System summary counts, operations history and the data browser query actual database totals with pagination. Java health alone does not prove provider availability; runtime views separately check the Java→Python adapter, capabilities and data coverage. New scoped scheduling has real heartbeat/sweep evidence; legacy scheduler flags remain configuration-only. Management/subsidiaries/events remain raw-only native operations. This release does not certify training data completeness or point-in-time accuracy.

Documentation: [API matrix](docs/API_INTEGRATION_MATRIX.md), [backend gaps](docs/BACKEND_REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), [implementation report](docs/IMPLEMENTATION_REPORT.md), [use-case traceability](docs/USE_CASE_TRACEABILITY.md).
# Admin control update (2026-10-19)

Read [current admin capabilities and verification](docs/ADMIN_CONTROL_20261019.md).
Sign in with your Admin username and password. The JWT issued by Java is kept
only in browser memory. New hosting is intentionally not created; the user's
instruction is to merge the FE changes only.

Live server acceptance and final progress/audit follow-up: [October 20 evidence](docs/ADMIN_ACCEPTANCE_20261020.md).

## Research data browser (2026-10-25)

See [current integration evidence](docs/ADMIN_RESEARCH_BROWSER_20261025.md).
The data browser reads exact filter capabilities from Java, supports Local AI registry
and disclosure history, and distinguishes applied filters from draft input. Research
results remain admin-only and do not imply production approval. Large suite manifests,
features and provider call payloads are omitted. Missing tables are disabled in the catalog.

For real localhost read-only acceptance, build first and run `node tests/research-live.mjs`
with a freshly issued JWT as `ADMIN_API_TOKEN` in the process environment and `ADMIN_API_BASE` pointing to
localhost (default port 8094). The test requires all five new datasets, stored FPT
inputs, disabled admin workers and a read-only Java datasource. Port 5173 must be
free and allowed by CORS. It uses installed Chrome, performs GETs only, and never
executes a model or imports fixture data. Do not put the token in Vite variables,
command arguments, committed files or logs. Normal CI continues using fixture suites.

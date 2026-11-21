import { authHeaders, authCredentials, sessionExpired } from './access';
import { safeText } from '../utils/format';
export let API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
export function setApiBase(value: string) {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))))
    throw new Error('Dùng địa chỉ HTTPS, hoặc HTTP localhost, không kèm thông tin đăng nhập hay tham số truy vấn.');
  const path = url.pathname.replace(/\/$/, '').replace(/\/api$/, '');
  if (path) throw new Error('Chỉ nhập origin của backend, không kèm đường dẫn API.');
  API_BASE = url.origin;
}

// Java proxies some checks to the Python adapter; a cold adapter call can take ~8s, so GETs get headroom.
const GET_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(message: string, public kind: 'http' | 'network' | 'timeout' | 'empty', public status?: number, public runId?: string, public upstreamStatus?: number) { super(message); }
}

export async function requestJson<T>(base: string, path: string, method = 'GET', payload?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), method === 'GET' ? GET_TIMEOUT_MS : 180000);
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { method, redirect: 'error', signal: controller.signal, credentials: authCredentials(), headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true', ...authHeaders(), ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    if (!response.ok) {
      if (response.status === 401) sessionExpired();
      let message = response.status === 401 ? 'Phiên quản trị đã hết hạn hoặc chưa xác thực. Hãy đăng nhập lại.' : response.status === 403 ? 'Tài khoản hiện tại không có quyền thực hiện thao tác này.' : response.status === 404 ? 'Không tìm thấy dữ liệu hoặc chức năng trên backend (HTTP 404).' : `Backend trả lỗi HTTP ${response.status}.`;
      let runId: string | undefined, upstreamStatus: number | undefined;
      try { const error = await response.json(); if (response.status !== 401 && response.status !== 403 && typeof error.message === 'string') message = safeText(error.message).slice(0, 1000); if (typeof error.runId === 'string' && /^[a-f0-9-]{36}$/i.test(error.runId)) runId = error.runId; if (typeof error.upstreamStatus === 'number') upstreamStatus = error.upstreamStatus; } catch { /* Keep the safe HTTP fallback. */ }
      throw new ApiError(message, 'http', response.status, runId, upstreamStatus);
    }
    if (response.status === 204 && method !== 'GET') return undefined as T;
    if (response.status === 204) throw new ApiError('Backend trả phản hồi rỗng.', 'empty');
    const body = await response.text();
    if (!body.trim()) throw new ApiError('Backend trả phản hồi rỗng.', 'empty');
    try { return JSON.parse(body) as T; }
    catch { throw new ApiError('Backend trả JSON không hợp lệ.', 'empty'); }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(method === 'GET' ? 'Hết thời gian chờ backend phản hồi. Thử tải lại.' : 'Hết thời gian chờ. Thao tác có thể vẫn hoàn tất trên server; tải lại lịch sử trước khi thử lại.', 'timeout');
    throw new ApiError(method === 'GET' ? 'Không kết nối được backend Java. Kiểm tra server đang chạy và cấu hình CORS.' : 'Mất kết nối, chưa rõ kết quả thao tác. Tải lại lịch sử trước khi thử lại.', 'network');
  } finally { window.clearTimeout(timer); }
}
export const getJson = <T>(base: string, path: string) => requestJson<T>(base, path);
export const postJson = <T>(base: string, path: string, payload?: unknown) => requestJson<T>(base, path, 'POST', payload);
export const putJson = <T>(base: string, path: string, payload?: unknown) => requestJson<T>(base, path, 'PUT', payload);
export const patchJson = <T>(base: string, path: string, payload?: unknown) => requestJson<T>(base, path, 'PATCH', payload);
export const deleteJson = <T>(base: string, path: string) => requestJson<T>(base, path, 'DELETE');

export async function getHealth<T>(base: string, path: string): Promise<{ data: T; latencyMs: number; checkedAt: string }> {
  const start = performance.now();
  const data = await getJson<T>(base, path);
  return { data, latencyMs: Math.round(performance.now() - start), checkedAt: new Date().toISOString() };
}

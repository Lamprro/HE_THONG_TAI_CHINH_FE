import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE, ApiError, getJson, setApiBase } from './client';
import { installAuthIntegration } from './access';
import type { AdminSession } from './admin-contract';

export function SessionGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession>();
  const [base, setBase] = useState(API_BASE);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const disconnect = (notice = '') => {
    installAuthIntegration(); setToken(''); setSession(undefined); setError(notice); client.clear();
  };
  const connect = async () => {
    setBusy(true); setError('');
    try {
      setApiBase(base);
      if (token.trim().length < 32) throw new Error('Token admin phải có ít nhất 32 ký tự.');
      const credential = token.trim();
      installAuthIntegration({ authorize: () => true, headers: () => ({ Authorization: `Bearer ${credential}` }),
        inactiveJobsAccessible: () => true, onUnauthorized: () => disconnect('Phiên quản trị đã hết hạn hoặc token bị thu hồi. Nhập lại token để tiếp tục.') });
      const session = await getJson<AdminSession>(API_BASE, '/api/admin/console/session');
      if (session.authenticated !== true || !session.authorities?.includes('ROLE_ADMIN')) throw new Error('Backend chưa xác nhận quyền admin.');
      client.clear(); setToken(''); setSession(session);
    } catch (cause) {
      installAuthIntegration();
      setError(cause instanceof ApiError && (cause.status === 401 || cause.status === 403) ? 'Token admin không đúng hoặc không có quyền quản trị.'
        : cause instanceof Error ? cause.message : 'Không thể kết nối.');
    } finally { setBusy(false); }
  };
  if (session) return <><div className="session-bar"><span>Admin · {session.email ?? session.principal} · {API_BASE} · token chỉ giữ trong phiên này</span><button className="text-button" onClick={() => disconnect()}>Ngắt kết nối</button></div>{children}</>;
  return <main className="connect-page"><form className="panel connect-card" onSubmit={e => { e.preventDefault(); if (!busy) void connect(); }}>
    <h1>Kết nối quản trị</h1><p>Đăng nhập bằng token admin riêng của backend. Tác vụ và lịch sử được xử lý tại Java, nguồn dữ liệu đi qua Python.</p>
    <label>Địa chỉ backend<input type="url" required value={base} onChange={e => setBase(e.target.value)} autoComplete="url"/></label>
    <label>Token admin<input type="password" required minLength={32} value={token} onChange={e => setToken(e.target.value)} autoComplete="off" spellCheck={false}/></label>
    <p className="subtle">Token không được lưu vào localStorage, mã nguồn hay cấu hình Vite. Tải lại trang cần kết nối lại.</p>
    {error && <p className="state-error" role="alert">{error}</p>}
    <button className="primary-button" disabled={busy}>{busy ? 'Đang xác thực…' : 'Kết nối'}</button>
  </form></main>;
}

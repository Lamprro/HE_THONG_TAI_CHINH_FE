import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE, ApiError, getJson, postJson, setApiBase } from './client';
import { installAuthIntegration } from './access';
import type { AdminLogin, AdminSession } from './admin-contract';

export function SessionGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession>();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();

  const disconnect = (notice = '') => {
    installAuthIntegration();
    setPassword('');
    setSession(undefined);
    setError(notice);
    client.clear();
  };

  const connect = async () => {
    setBusy(true);
    setError('');
    try {
      setApiBase(API_BASE);
      const { accessToken } = await postJson<AdminLogin>(API_BASE, '/api/auth/login', {
        username: username.trim(), password,
      });
      if (!accessToken) throw new Error('Backend chưa cấp phiên đăng nhập.');
      installAuthIntegration({
        authorize: () => true,
        headers: () => ({ Authorization: `Bearer ${accessToken}` }),
        inactiveJobsAccessible: () => true,
        onUnauthorized: () => disconnect('Phiên quản trị đã hết hạn. Hãy đăng nhập lại.'),
      });
      const current = await getJson<AdminSession>(API_BASE, '/api/admin/console/session');
      if (!current.authenticated || !current.authorities?.includes('ROLE_ADMIN')) {
        throw new Error('Tài khoản không có quyền quản trị.');
      }
      client.clear();
      setSession(current);
    } catch (cause) {
      installAuthIntegration();
      setError(cause instanceof ApiError && cause.status === 401 ? 'Tên đăng nhập hoặc mật khẩu không đúng.'
        : cause instanceof ApiError && cause.status === 403 ? 'Tài khoản không có quyền quản trị.'
        : cause instanceof Error ? cause.message : 'Không thể đăng nhập.');
    } finally {
      setPassword('');
      setBusy(false);
    }
  };

  if (session) return <><div className="session-bar"><span>Admin · {session.email ?? session.principal}</span>
    <button className="text-button" onClick={() => disconnect()}>Đăng xuất</button></div>{children}</>;

  return <main className="connect-page">
    <form className="panel connect-card" onSubmit={event => { event.preventDefault(); if (!busy) void connect(); }}>
      <h1>Đăng nhập quản trị</h1>
      <label>Tên đăng nhập<input required maxLength={100} value={username}
        onChange={event => setUsername(event.target.value)} autoComplete="username"/></label>
      <label>Mật khẩu<input type="password" required maxLength={72} value={password}
        onChange={event => setPassword(event.target.value)} autoComplete="current-password"/></label>
      {error && <p className="state-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
  </main>;
}

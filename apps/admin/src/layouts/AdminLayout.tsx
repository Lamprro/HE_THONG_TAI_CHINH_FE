import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Activity, Bot, BriefcaseBusiness, Building2, LayoutDashboard, Moon, Search, ServerCog, ShieldCheck, Sun, Workflow } from 'lucide-react';

export type Section = 'overview' | 'workflow' | 'history' | 'jobs' | 'scope' | 'quality' | 'ai' | 'data' | 'system';
export const sections: { id: Section; title: string; group: 'Dữ liệu' | 'Quản trị'; icon: typeof Activity }[] = [
  { id: 'overview', title: 'Tổng quan', group: 'Dữ liệu', icon: LayoutDashboard },
  { id: 'jobs', title: 'Job & nguồn', group: 'Dữ liệu', icon: BriefcaseBusiness },
  { id: 'workflow', title: 'Luồng dữ liệu', group: 'Dữ liệu', icon: Workflow },
  { id: 'history', title: 'Tác vụ & lịch sử', group: 'Dữ liệu', icon: Activity },
  { id: 'quality', title: 'Chất lượng dữ liệu', group: 'Dữ liệu', icon: ShieldCheck },
  { id: 'data', title: 'Tra cứu dữ liệu', group: 'Dữ liệu', icon: Search },
  { id: 'scope', title: 'Danh mục mã', group: 'Quản trị', icon: Building2 },
  { id: 'ai', title: 'Vận hành AI', group: 'Quản trị', icon: Bot },
  { id: 'system', title: 'Hệ thống', group: 'Quản trị', icon: ServerCog },
];

export function AdminLayout({ section, setSection, dark, setDark, account, onLogout, children }: {
  section: Section; setSection: (section: Section) => void; dark: boolean; setDark: (value: boolean) => void;
  account: string; onLogout: () => void; children: ReactNode;
}) {
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [section]);
  const themeLabel = dark ? 'Giao diện sáng' : 'Giao diện tối';

  return <div className={dark ? 'shell dark' : 'shell'}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TC</div><strong>Quản trị tài chính</strong></div>
      <nav aria-label="Điều hướng quản trị">{(['Dữ liệu', 'Quản trị'] as const).map(group => <div className="nav-group" key={group}>
        <div className="nav-label">{group}</div>
        {sections.filter(item => item.group === group).map(item => <button key={item.id} className={section === item.id ? 'nav-item active' : 'nav-item'}
          aria-label={item.title} title={item.title} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}>
          <item.icon size={19} aria-hidden="true"/><span>{item.title}</span>
        </button>)}
      </div>)}</nav>
      <button className="theme-button" aria-label={themeLabel} title={themeLabel} onClick={() => setDark(!dark)}>
        {dark ? <Sun size={17} aria-hidden="true"/> : <Moon size={17} aria-hidden="true"/>}<span>{themeLabel}</span>
      </button>
    </aside>
    <header className="account-bar"><span title={account}>{account}</span><button className="text-button" onClick={onLogout}>Đăng xuất</button></header>
    <main className="main" ref={main}>{children}</main>
  </div>;
}

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const BUILD_VERSION = (() => {
  const now = new Date();
  const pad = (n: number, d = 2) => String(n).padStart(d, '0');
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
})();

export default function MenuBar() {
  const { isAdmin, isManager, user } = useAuth();

  const menus = [
    { to: '/farm-status', label: '농장 현황', always: true },
    { to: '/control',     label: '제어 정보',  always: false, show: isManager },
    { to: '/schedule',    label: '일정 관리',  always: false, show: isManager },
    { to: '/order',       label: '주문',       always: false, show: !!user },
    { to: '/crop-price',  label: '작물 가격',  always: false, show: isManager },
    { to: '/monitoring',  label: '모니터링',   always: true },
    { to: '/members',     label: '회원 정보',  always: false, show: isAdmin },
    { to: '/dev',         label: '개발자모드', always: false, show: isAdmin },
  ].filter(m => m.always || m.show);

  const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    color: isActive ? '#FFD700' : '#e0f0ff',
    textDecoration: 'none',
    padding: '0 16px',
    fontWeight: isActive ? 700 : 500,
    fontSize: 15,
    borderBottom: isActive ? '3px solid #FFD700' : '3px solid transparent',
    lineHeight: '48px',
    display: 'inline-block',
    transition: 'color 0.2s',
  });

  return (
    <nav style={{ position: 'relative', backgroundColor: '#1565C0', height: 48, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {menus.map(m => (
        <NavLink key={m.to} to={m.to} style={linkStyle}>{m.label}</NavLink>
      ))}
      <span style={{
        position: 'absolute', right: 12, bottom: 4,
        fontSize: 11, color: '#fff', opacity: 0.7,
      }}>ver. {BUILD_VERSION}</span>
    </nav>
  );
}

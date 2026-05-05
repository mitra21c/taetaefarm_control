import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: 60, backgroundColor: '#fff',
      borderBottom: '2px solid #87CEEB', boxShadow: '0 2px 6px rgba(135,206,235,0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => navigate('/')}>
        <img src="https://mitra21c.github.io/data/images/taetaefarm/taetaefarm/icon.png"
          alt="태태농장" style={{ height: 40, objectFit: 'contain' }} />
        <span style={{ fontSize: 20, fontWeight: 700, color: '#1565C0' }}>태태농장</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {user ? (
          <>
            <span style={{ alignSelf: 'center', fontSize: 14, color: '#555', marginRight: 8 }}>
              {user.name}님 ({user.role})
            </span>
            <button onClick={handleLogout} style={btnStyle('#87CEEB', '#1565C0')}>로그아웃</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate('/login')} style={btnStyle('#87CEEB', '#1565C0')}>로그인</button>
            <button onClick={() => navigate('/register')} style={btnStyle('#1565C0', '#fff')}>계정 정보</button>
          </>
        )}
      </div>
    </header>
  );
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '6px 16px', borderRadius: 10, border: 'none',
    backgroundColor: bg, color, fontWeight: 600, cursor: 'pointer', fontSize: 14,
  };
}

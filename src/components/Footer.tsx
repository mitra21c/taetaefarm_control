import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      backgroundColor: '#1565C0', color: '#e0f0ff',
      padding: '16px 20px', display: 'flex', justifyContent: 'center',
      alignItems: 'center', gap: 24,
    }}>
      <img src="https://mitra21c.github.io/data/images/taetaefarm/taetaefarm/icon.png"
        alt="태태농장" style={{ height: 48, objectFit: 'contain' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14 }}>주소 : 전라남도 장성군 삼서면 수해리</span>
        <span style={{ fontSize: 14 }}>연락처 : mitra21c@naver.com</span>
      </div>
    </footer>
  );
}

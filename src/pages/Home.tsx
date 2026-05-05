import React from 'react';

const PRODUCTS = [
  { name: '대추',    img: 'https://mitra21c.github.io/data/images/taetaefarm/%ED%83%9C%EC%B6%94_%EC%86%8C%EA%B0%9C.png' },
  { name: '대봉',    img: 'https://mitra21c.github.io/data/images/taetaefarm/%EB%8C%80%EB%B4%89_%EC%86%8C%EA%B0%9C.png' },
  { name: '울금',    img: 'https://mitra21c.github.io/data/images/taetaefarm/%EC%9A%B8%EA%B8%88_%EC%86%8C%EA%B0%9C.png' },
  { name: '감 말랭이', img: 'https://mitra21c.github.io/data/images/taetaefarm/%EA%B0%90%EB%A7%90%EB%9E%AD%EC%9D%B4_%EC%86%8C%EA%B0%9C.png' },
  { name: '블루베리', img: 'https://mitra21c.github.io/data/images/taetaefarm/%EB%B8%94%EB%A3%A8%EB%B2%A0%EB%A6%AC_%EC%86%8C%EA%B0%9C.png' },
];

export default function Home() {
  return (
    <div style={{ padding: '24px 20px' }}>
      <h2 style={{ color: '#1565C0', marginBottom: 8, fontSize: 22, fontWeight: 700 }}>
        농장 제어 시스템 구축
      </h2>
      <p style={{ color: '#666', marginBottom: 28, fontSize: 14 }}>
        태태농장 스마트 제어 시스템에 오신 것을 환영합니다.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {PRODUCTS.map(p => (
          <div key={p.name} style={{
            background: '#fff', border: '1px solid #87CEEB', borderRadius: 12,
            padding: 12, textAlign: 'center', width: 160,
            boxShadow: '0 2px 8px rgba(135,206,235,0.2)',
          }}>
            <img src={p.img} alt={p.name}
              style={{ width: '100%', height: 120, objectFit: 'contain' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <p style={{ marginTop: 8, fontWeight: 600, color: '#1565C0', fontSize: 14 }}>{p.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

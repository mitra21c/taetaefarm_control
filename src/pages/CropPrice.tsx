import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axiosInstance';

interface CropPrice {
  id: number;
  name: string;
  weight: string;
  price: number;
  available: 'Y' | 'N';
}

const h2: React.CSSProperties = {
  color: '#1565C0', fontSize: 20, fontWeight: 700,
  marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #87CEEB',
};

export default function CropPrice() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<CropPrice[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isManager) { navigate('/'); return; }
    api.get('/api/crop-prices')
      .then(r => setRows(r.data))
      .catch(() => setError('데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [isManager, navigate]);

  const update = (id: number, field: keyof CropPrice, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: field === 'price' ? Number(value) : value } : r));
  };

  const save = async (row: CropPrice) => {
    setSaving(row.id);
    try {
      const { data } = await api.put(`/api/crop-prices/${row.id}`, {
        weight: row.weight,
        price: row.price,
        available: row.available,
      });
      setRows(prev => prev.map(r => r.id === data.id ? data : r));
      setMsg({ id: row.id, text: '저장되었습니다.', ok: true });
    } catch {
      setMsg({ id: row.id, text: '저장에 실패했습니다.', ok: false });
    } finally {
      setSaving(null);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  if (!isManager) return null;

  return (
    <div style={{ padding: '24px 20px', maxWidth: 720 }}>
      <h2 style={h2}>작물 가격</h2>

      {loading && <p style={{ color: '#999' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#c62828' }}>{error}</p>}

      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#e3f2fd' }}>
              {['작물명', '무게', '가격 (원)', '구매 가능', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', border: '1px solid #b3d4f5', color: '#1565C0', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} style={{ background: '#fff' }}>
                <td style={tdStyle}><strong>{row.name}</strong></td>
                <td style={tdStyle}>
                  <input
                    value={row.weight}
                    onChange={e => update(row.id, 'weight', e.target.value)}
                    placeholder="예) 500g, 1kg"
                    style={inputStyle}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    type="number"
                    min={0}
                    value={row.price}
                    onChange={e => update(row.id, 'price', e.target.value)}
                    style={{ ...inputStyle, width: 110 }}
                  />
                </td>
                <td style={tdStyle}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={row.available === 'Y'}
                      onChange={e => update(row.id, 'available', e.target.checked ? 'Y' : 'N')}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <span style={{ color: row.available === 'Y' ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                      {row.available === 'Y' ? '가능' : '불가'}
                    </span>
                  </label>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <button
                    onClick={() => save(row)}
                    disabled={saving === row.id}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: saving === row.id ? '#90caf9' : '#1565C0', color: '#fff',
                      fontWeight: 600, fontSize: 13,
                    }}
                  >
                    {saving === row.id ? '저장 중...' : '저장'}
                  </button>
                  {msg?.id === row.id && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: msg.ok ? '#2e7d32' : '#c62828' }}>
                      {msg.text}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', border: '1px solid #e3f2fd', verticalAlign: 'middle',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 8px', borderRadius: 6, border: '1px solid #b3d4f5',
  fontSize: 13, width: 140, outline: 'none',
};

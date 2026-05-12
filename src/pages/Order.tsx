import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';

interface CropPrice {
  id: number;
  name: string;
  weight: string;
  price: number;
  available: 'Y' | 'N';
}

interface OrderForm {
  orderer_name: string;
  phone: string;
  quantity: number;
  address: string;
}

const CROP_ORDER = ['블루베리', '태추', '대봉', '감 말랭이', '울금'];

const CROP_META: Record<string, { displayName: string; img: string }> = {
  블루베리: {
    displayName: '블루베리',
    img: 'https://mitra21c.github.io/data/images/taetaefarm/%EB%B8%94%EB%A3%A8%EB%B2%A0%EB%A6%AC_%EC%86%8C%EA%B0%9C.png',
  },
  태추: {
    displayName: '태추 단감',
    img: 'https://mitra21c.github.io/data/images/taetaefarm/%ED%83%9C%EC%B6%94_%EC%86%8C%EA%B0%9C.png',
  },
  대봉: {
    displayName: '대봉',
    img: 'https://mitra21c.github.io/data/images/taetaefarm/%EB%8C%80%EB%B4%89_%EC%86%8C%EA%B0%9C.png',
  },
  '감 말랭이': {
    displayName: '감 말랭이',
    img: 'https://mitra21c.github.io/data/images/taetaefarm/%EA%B0%90%EB%A7%90%EB%9E%AD%EC%9D%B4_%EC%86%8C%EA%B0%9C.png',
  },
  울금: {
    displayName: '울금',
    img: 'https://mitra21c.github.io/data/images/taetaefarm/%EC%9A%B8%EA%B8%88_%EC%86%8C%EA%B0%9C.png',
  },
};

const EMPTY_FORM: OrderForm = { orderer_name: '', phone: '', quantity: 1, address: '' };

export default function Order() {
  const [crops, setCrops] = useState<CropPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CropPrice | null>(null);
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.get('/api/crop-prices')
      .then(r => {
        const sorted = CROP_ORDER
          .map(name => (r.data as CropPrice[]).find(c => c.name === name))
          .filter((c): c is CropPrice => !!c);
        setCrops(sorted);
      })
      .catch(() => setError('상품 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const openModal = (crop: CropPrice) => {
    setSelected(crop);
    setForm(EMPTY_FORM);
    setSuccess(false);
    setSubmitError('');
  };

  const closeModal = () => { setSelected(null); setSuccess(false); setSubmitError(''); };

  const setField = (field: keyof OrderForm, value: string) =>
    setForm(prev => ({ ...prev, [field]: field === 'quantity' ? Math.max(1, Number(value)) : value }));

  const submit = async () => {
    if (!selected) return;
    if (!form.orderer_name.trim() || !form.phone.trim()) {
      setSubmitError('주문자명과 연락처를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.post('/api/orders', { crop_id: selected.id, ...form });
      setSuccess(true);
    } catch (e: any) {
      setSubmitError(e.response?.data?.message ?? '주문 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px 20px' }}>
      <h2 style={h2}>농작물 주문</h2>

      {loading && <p style={{ color: '#999' }}>불러오는 중...</p>}
      {error && <p style={{ color: '#c62828' }}>{error}</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {crops.map(crop => {
          const meta = CROP_META[crop.name];
          const ok = crop.available === 'Y';
          return (
            <div key={crop.id} style={card}>
              <div style={{ height: 160, background: '#f0f8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={meta?.img}
                  alt={meta?.displayName ?? crop.name}
                  style={{ width: '100%', height: 160, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <div style={{ padding: '14px 16px' }}>
                <p style={{ fontWeight: 700, fontSize: 16, color: '#1565C0', marginBottom: 8 }}>
                  {meta?.displayName ?? crop.name}
                </p>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                  무게 &nbsp;<strong>{crop.weight || '-'}</strong>
                </div>
                <div style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>
                  가격 &nbsp;<strong style={{ color: '#c62828' }}>{crop.price.toLocaleString()}원</strong>
                </div>
                <button
                  onClick={() => ok && openModal(crop)}
                  disabled={!ok}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                    background: ok ? '#1565C0' : '#bdbdbd',
                    color: '#fff', fontWeight: 700, fontSize: 14,
                    cursor: ok ? 'pointer' : 'not-allowed',
                    transition: 'background 0.2s',
                  }}
                >
                  {ok ? '주문하기' : '구매 불가'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={modal}>
            {success ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#2e7d32', marginBottom: 8 }}>주문 완료!</p>
                <p style={{ color: '#555', fontSize: 14, marginBottom: 24 }}>
                  {CROP_META[selected.name]?.displayName ?? selected.name} 주문이 접수되었습니다.
                </p>
                <button onClick={closeModal} style={{ ...btnPrimary, width: 120 }}>확인</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ color: '#1565C0', fontSize: 17, fontWeight: 700 }}>
                    {CROP_META[selected.name]?.displayName ?? selected.name} 주문
                  </h3>
                  <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
                </div>

                <div style={{ background: '#f0f8ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#555' }}>
                  무게 {selected.weight}&nbsp;&nbsp;|&nbsp;&nbsp;단가 {selected.price.toLocaleString()}원
                </div>

                {([
                  { label: '주문자명 *', field: 'orderer_name', type: 'text', placeholder: '이름을 입력하세요' },
                  { label: '연락처 *',  field: 'phone',         type: 'tel',  placeholder: "'-' 없이 입력하세요" },
                  { label: '수량',      field: 'quantity',      type: 'number', placeholder: '1' },
                  { label: '배송 주소', field: 'address',       type: 'text',  placeholder: '배송 주소를 입력하세요' },
                ] as const).map(({ label, field, type, placeholder }) => (
                  <div key={field} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, color: '#333', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input
                      type={type}
                      value={String(form[field])}
                      min={field === 'quantity' ? 1 : undefined}
                      placeholder={placeholder}
                      onChange={e => setField(field, e.target.value)}
                      style={inp}
                    />
                  </div>
                ))}

                {form.quantity > 0 && (
                  <div style={{ fontSize: 13, color: '#1565C0', fontWeight: 600, marginBottom: 12 }}>
                    총 금액: {(selected.price * form.quantity).toLocaleString()}원
                  </div>
                )}

                {submitError && <p style={{ color: '#c62828', fontSize: 13, marginBottom: 8 }}>{submitError}</p>}

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={closeModal} style={btnSecondary}>취소</button>
                  <button onClick={submit} disabled={submitting} style={btnPrimary}>
                    {submitting ? '처리 중...' : '주문 확인'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const h2: React.CSSProperties = {
  color: '#1565C0', fontSize: 20, fontWeight: 700,
  marginBottom: 20, paddingBottom: 8, borderBottom: '2px solid #87CEEB',
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #b3d4f5', borderRadius: 14,
  width: 200, overflow: 'hidden', boxShadow: '0 2px 10px rgba(135,206,235,0.25)',
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '24px 28px',
  width: 380, maxWidth: '92vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #b3d4f5', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
  background: '#1565C0', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '10px 0', borderRadius: 8,
  border: '1px solid #b3d4f5', background: '#fff',
  color: '#555', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};

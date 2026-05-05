import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { FarmInfo, FarmImage } from '../types';
import { AlertModal } from '../components/Modal';

const API_BASE = 'http://localhost:3001';

export default function FarmStatus() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [selectedFarm, setSelectedFarm] = useState<FarmInfo | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [alert, setAlert] = useState('');

  const { data: farms = [] } = useQuery<FarmInfo[]>({
    queryKey: ['farm-info'],
    queryFn: () => api.get('/api/farm-info').then(r => r.data),
  });

  const { data: images = [] } = useQuery<FarmImage[]>({
    queryKey: ['farm-images', selectedFarm?.id],
    queryFn: () => api.get(`/api/farm-info/${selectedFarm!.id}/images`).then(r => r.data),
    enabled: !!selectedFarm,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ farmId, file }: { farmId: number; file: File }) => {
      const fd = new FormData();
      fd.append('image', file);
      return api.post(`/api/farm-info/${farmId}/images`, fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm-images', selectedFarm?.id] }),
    onError: () => setAlert('이미지 업로드 실패'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ farmId, imgId }: { farmId: number; imgId: number }) =>
      api.delete(`/api/farm-info/${farmId}/images/${imgId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm-images', selectedFarm?.id] }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedFarm) {
      uploadMutation.mutate({ farmId: selectedFarm.id, file });
      e.target.value = '';
    }
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 8000,
        }}>
          <img src={lightbox} alt="확대" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}

      <h2 style={h2}>농장 현황</h2>

      {farms.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14 }}>등록된 농장 구역이 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {farms.map(f => (
            <button key={f.id}
              onClick={() => setSelectedFarm(f.id === selectedFarm?.id ? null : f)}
              style={{
                padding: '8px 18px', borderRadius: 10, border: '2px solid',
                borderColor: selectedFarm?.id === f.id ? '#1565C0' : '#87CEEB',
                background: selectedFarm?.id === f.id ? '#1565C0' : '#fff',
                color: selectedFarm?.id === f.id ? '#fff' : '#1565C0',
                fontWeight: 600, cursor: 'pointer', fontSize: 14,
              }}>
              {f.name} {f.use === 'N' ? '(미사용)' : ''}
            </button>
          ))}
        </div>
      )}

      {selectedFarm && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #87CEEB', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ color: '#1565C0', fontSize: 16 }}>{selectedFarm.name}</h3>
            {isManager && (
              <label style={{
                padding: '7px 14px', borderRadius: 10, background: '#87CEEB',
                color: '#1565C0', fontWeight: 600, cursor: 'pointer', fontSize: 13,
              }}>
                이미지 추가
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            )}
          </div>
          {selectedFarm.description && (
            <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>{selectedFarm.description}</p>
          )}
          {images.length === 0 ? (
            <p style={{ color: '#aaa', fontSize: 13 }}>등록된 이미지가 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {images.map(img => (
                <div key={img.id} style={{ position: 'relative' }}>
                  <img
                    src={`${API_BASE}${img.url}`} alt={img.filename}
                    onClick={() => setLightbox(`${API_BASE}${img.url}`)}
                    style={{
                      width: 160, height: 120, objectFit: 'contain',
                      border: '1px solid #e0e0e0', borderRadius: 8, cursor: 'zoom-in',
                      background: '#f9f9f9',
                    }}
                  />
                  {isManager && (
                    <button onClick={() => deleteMutation.mutate({ farmId: selectedFarm.id, imgId: img.id })}
                      style={{
                        position: 'absolute', top: 4, right: 4, background: 'rgba(229,57,53,0.85)',
                        border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer',
                        fontSize: 11, padding: '2px 6px',
                      }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const h2: React.CSSProperties = {
  color: '#1565C0', fontSize: 20, fontWeight: 700, marginBottom: 16,
  paddingBottom: 8, borderBottom: '2px solid #87CEEB',
};

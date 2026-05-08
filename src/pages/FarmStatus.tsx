import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../api/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { FarmInfo, FarmImage } from '../types';
import { AlertModal, ConfirmModal } from '../components/Modal';

const API_BASE = process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001';

type ZoneForm = { name: string; description: string; use: 'Y' | 'N' };

export default function FarmStatus() {
  const { isManager } = useAuth();
  const qc = useQueryClient();

  const [selectedFarm, setSelectedFarm] = useState<FarmInfo | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [alert, setAlert] = useState('');
  const [confirmDel, setConfirmDel] = useState<{ type: 'zone' | 'img'; id: number; farmId?: number } | null>(null);
  const [zoneModal, setZoneModal] = useState<{ mode: 'add' | 'edit'; data?: FarmInfo } | null>(null);

  // ── 쿼리 ──────────────────────────────────────────────────────
  const { data: farms = [] } = useQuery<FarmInfo[]>({
    queryKey: ['farm-info'],
    queryFn: () => api.get('/api/farm-info').then(r => r.data),
  });

  const { data: images = [] } = useQuery<FarmImage[]>({
    queryKey: ['farm-images', selectedFarm?.id],
    queryFn: () => api.get(`/api/farm-info/${selectedFarm!.id}/images`).then(r => r.data),
    enabled: !!selectedFarm,
  });

  // ── 구역 뮤테이션 ─────────────────────────────────────────────
  const addZone = useMutation({
    mutationFn: (d: ZoneForm) => api.post('/api/farm-info', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farm-info'] }); setZoneModal(null); },
    onError: () => setAlert('구역 추가 실패'),
  });

  const editZone = useMutation({
    mutationFn: ({ id, ...d }: ZoneForm & { id: number }) => api.patch(`/api/farm-info/${id}`, d),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['farm-info'] });
      setZoneModal(null);
      if (selectedFarm?.id === vars.id) {
        setSelectedFarm(f => f ? { ...f, name: vars.name, description: vars.description, use: vars.use } : f);
      }
    },
    onError: () => setAlert('구역 수정 실패'),
  });

  const deleteZone = useMutation({
    mutationFn: (id: number) => api.delete(`/api/farm-info/${id}`),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: ['farm-info'] });
      if (selectedFarm?.id === id) setSelectedFarm(null);
      setAlert(res.data?.message ?? '성공적으로 삭제 하였습니다.');
    },
    onError: (e: any) => setAlert(e.response?.data?.message ?? '구역 삭제 실패'),
  });

  // ── 이미지 뮤테이션 ───────────────────────────────────────────
  const uploadImg = useMutation({
    mutationFn: ({ farmId, file }: { farmId: number; file: File }) => {
      const fd = new FormData();
      fd.append('image', file);
      return api.post(`/api/farm-info/${farmId}/images`, fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm-images', selectedFarm?.id] }),
    onError: () => setAlert('이미지 업로드 실패'),
  });

  const deleteImg = useMutation({
    mutationFn: ({ farmId, imgId }: { farmId: number; imgId: number }) =>
      api.delete(`/api/farm-info/${farmId}/images/${imgId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm-images', selectedFarm?.id] }),
    onError: () => setAlert('이미지 삭제 실패'),
  });

  // ── 확인 처리 ─────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!confirmDel) return;
    if (confirmDel.type === 'zone') deleteZone.mutate(confirmDel.id);
    else if (confirmDel.type === 'img' && confirmDel.farmId != null)
      deleteImg.mutate({ farmId: confirmDel.farmId, imgId: confirmDel.id });
    setConfirmDel(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedFarm) {
      uploadImg.mutate({ farmId: selectedFarm.id, file });
      e.target.value = '';
    }
  };

  return (
    <div style={{ padding: '16px 20px', height: '100%' }}>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmDel && (
        <ConfirmModal
          message={confirmDel.type === 'zone'
            ? '구역을 삭제하시겠습니까?\n(이미지도 함께 삭제되며, PLC 정보에서 사용 중이면 삭제되지 않습니다.)'
            : '이미지를 삭제하시겠습니까?'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {zoneModal && (
        <ZoneFormModal
          mode={zoneModal.mode}
          data={zoneModal.data}
          onSubmit={(d) => {
            if (zoneModal.mode === 'add') addZone.mutate(d);
            else if (zoneModal.data) editZone.mutate({ id: zoneModal.data.id, ...d });
          }}
          onClose={() => setZoneModal(null)}
        />
      )}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={styles.lightboxBack}>
          <div style={styles.lightboxWrap} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} style={styles.lightboxClose}>✕</button>
            <img src={lightbox} alt="확대" style={styles.lightboxImg} />
          </div>
        </div>
      )}

      <h2 style={styles.h2}>농장 현황</h2>

      <div style={styles.layout}>
        {/* ── 좌측: 구역 목록 ── */}
        <div style={styles.leftPanel}>
          <div style={styles.panelHeader}>
            <span style={styles.panelTitle}>농장 구역 목록</span>
            {isManager && (
              <button style={styles.btnAdd} onClick={() => setZoneModal({ mode: 'add' })}>+ 추가</button>
            )}
          </div>
          <div style={styles.zoneList}>
            {farms.length === 0 && (
              <p style={styles.empty}>등록된 구역이 없습니다.</p>
            )}
            {farms.map(f => (
              <div
                key={f.id}
                onClick={() => setSelectedFarm(f.id === selectedFarm?.id ? null : f)}
                style={{
                  ...styles.zoneItem,
                  background: selectedFarm?.id === f.id ? '#1565C0' : '#fff',
                  color: selectedFarm?.id === f.id ? '#fff' : '#1a1a1a',
                  borderColor: selectedFarm?.id === f.id ? '#1565C0' : '#d0e8f8',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </div>
                  {f.use === 'N' && (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>미사용</span>
                  )}
                </div>
                {isManager && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setZoneModal({ mode: 'edit', data: f }); }}
                      style={{
                        ...styles.iconBtn,
                        background: selectedFarm?.id === f.id ? 'rgba(255,255,255,0.25)' : '#e3f2fd',
                        color: selectedFarm?.id === f.id ? '#fff' : '#1565C0',
                      }}
                      title="수정"
                    >✎</button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDel({ type: 'zone', id: f.id }); }}
                      style={{
                        ...styles.iconBtn,
                        background: selectedFarm?.id === f.id ? 'rgba(255,255,255,0.25)' : '#fde8e8',
                        color: selectedFarm?.id === f.id ? '#ffd0d0' : '#c62828',
                      }}
                      title="삭제"
                    >✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 우측: 구역 상세 + 이미지 ── */}
        <div style={styles.rightPanel}>
          {!selectedFarm ? (
            <div style={styles.placeholder}>
              <div style={styles.placeholderIcon}>🌱</div>
              <div style={styles.placeholderText}>좌측에서 농장 구역을 선택하세요</div>
            </div>
          ) : (
            <>
              {/* 구역 정보 카드 */}
              <div style={styles.infoCard}>
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>구역명</span>
                  <span style={styles.infoValue}>{selectedFarm.name}</span>
                </div>
                {selectedFarm.description && (
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>설명</span>
                    <span style={styles.infoValue}>{selectedFarm.description}</span>
                  </div>
                )}
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>사용여부</span>
                  <span style={{
                    ...styles.badge,
                    background: selectedFarm.use === 'Y' ? '#e8f5e9' : '#fce4ec',
                    color: selectedFarm.use === 'Y' ? '#2e7d32' : '#c62828',
                  }}>
                    {selectedFarm.use === 'Y' ? '사용' : '미사용'}
                  </span>
                </div>
              </div>

              {/* 이미지 섹션 */}
              <div style={styles.imgSection}>
                <div style={styles.imgSectionHeader}>
                  <span style={styles.imgSectionTitle}>이미지</span>
                  {isManager && (
                    <label style={styles.btnImgAdd}>
                      {uploadImg.isPending ? '업로드 중...' : '+ 이미지 추가'}
                      <input
                        type="file" accept="image/*"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        disabled={uploadImg.isPending}
                      />
                    </label>
                  )}
                </div>

                {images.length === 0 ? (
                  <div style={styles.noImages}>등록된 이미지가 없습니다.</div>
                ) : (
                  <div style={styles.imgGrid}>
                    {images.map(img => (
                      <div key={img.id} style={styles.imgWrap}>
                        {/* Zoom 모드 이미지 (objectFit: contain = PictureBoxSizeMode.Zoom) */}
                        <img
                          src={`${API_BASE}${img.url}`}
                          alt={img.filename}
                          onClick={() => setLightbox(`${API_BASE}${img.url}`)}
                          style={styles.img}
                          title={img.filename}
                        />
                        {isManager && (
                          <button
                            onClick={() => setConfirmDel({ type: 'img', id: img.id, farmId: selectedFarm.id })}
                            style={styles.imgDel}
                            title="삭제"
                          >✕</button>
                        )}
                        <div style={styles.imgName}>{img.filename}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 구역 추가/수정 모달 ──────────────────────────────────────────
function ZoneFormModal({
  mode, data, onSubmit, onClose,
}: {
  mode: 'add' | 'edit';
  data?: FarmInfo;
  onSubmit: (d: ZoneForm) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<ZoneForm>({
    defaultValues: { name: data?.name ?? '', description: data?.description ?? '', use: data?.use ?? 'Y' },
  });

  const farmId = data?.id;
  const isEdit = mode === 'edit' && farmId != null;

  const { data: images = [] } = useQuery<FarmImage[]>({
    queryKey: ['farm-images', farmId],
    queryFn: () => api.get(`/api/farm-info/${farmId}/images`).then(r => r.data),
    enabled: isEdit,
  });

  const uploadImg = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('image', file);
      return api.post(`/api/farm-info/${farmId}/images`, fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm-images', farmId] }),
  });

  const deleteImg = useMutation({
    mutationFn: (imgId: number) => api.delete(`/api/farm-info/${farmId}/images/${imgId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farm-images', farmId] }),
  });

  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { uploadImg.mutate(file); e.target.value = ''; }
  };

  return (
    <div style={styles.modalBack} onClick={onClose}>
      {lightbox && (
        <div
          style={{ ...styles.lightboxBack, zIndex: 9500 }}
          onClick={e => { e.stopPropagation(); setLightbox(null); }}
        >
          <div style={styles.lightboxWrap} onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} style={styles.lightboxClose}>✕</button>
            <img src={lightbox} alt="확대" style={styles.lightboxImg} />
          </div>
        </div>
      )}

      <div
        style={{ ...styles.modalBox, width: isEdit ? 600 : 360 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={styles.modalTitle}>{mode === 'add' ? '농장 구역 추가' : '농장 구역 수정'}</h3>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {/* 기본 정보 폼 */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ flex: '0 0 240px' }}>
            <div style={styles.formRow}>
              <label style={styles.label}>구역명 *</label>
              <input
                {...register('name', { required: '구역명을 입력하세요' })}
                style={styles.input}
                placeholder="구역명"
              />
              {errors.name && <span style={styles.err}>{errors.name.message}</span>}
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>설명</label>
              <textarea
                {...register('description')}
                style={{ ...styles.input, height: 72, resize: 'vertical' }}
                placeholder="구역 설명 (선택)"
              />
            </div>
            <div style={styles.formRow}>
              <label style={styles.label}>사용여부</label>
              <select {...register('use')} style={styles.input}>
                <option value="Y">사용</option>
                <option value="N">미사용</option>
              </select>
            </div>
            <div style={styles.modalBtns}>
              <button type="button" onClick={onClose} style={styles.btnCancel}>취소</button>
              <button type="submit" style={styles.btnSave}>{mode === 'add' ? '추가' : '저장'}</button>
            </div>
          </form>

          {/* 이미지 섹션 (편집 모드만) */}
          {isEdit && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={styles.label}>이미지</span>
                <label style={styles.btnImgAdd}>
                  {uploadImg.isPending ? '업로드 중...' : '+ 추가'}
                  <input
                    type="file" accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={uploadImg.isPending}
                  />
                </label>
              </div>

              {images.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 12, textAlign: 'center', padding: '20px 0', border: '1px dashed #d0e8f8', borderRadius: 8 }}>
                  등록된 이미지가 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                  {images.map(img => (
                    <div key={img.id} style={styles.imgWrap}>
                      <img
                        src={`${API_BASE}${img.url}`}
                        alt={img.filename}
                        onClick={() => setLightbox(`${API_BASE}${img.url}`)}
                        style={{ ...styles.img, width: 110, height: 82 }}
                        title={img.filename}
                      />
                      <button
                        onClick={() => deleteImg.mutate(img.id)}
                        style={styles.imgDel}
                        title="삭제"
                      >✕</button>
                      <div style={{ ...styles.imgName, maxWidth: 110 }}>{img.filename}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  h2: { color: '#1565C0', fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #87CEEB' },
  layout: { display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' },

  // 좌측 패널
  leftPanel: { width: 220, flexShrink: 0, background: '#fff', border: '1px solid #d0e8f8', borderRadius: 12, overflow: 'hidden' },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#e3f2fd', borderBottom: '1px solid #d0e8f8' },
  panelTitle: { fontSize: 13, fontWeight: 700, color: '#1565C0' },
  btnAdd: { padding: '4px 10px', fontSize: 12, borderRadius: 8, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600 },
  zoneList: { maxHeight: 420, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 },
  zoneItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid', cursor: 'pointer', transition: 'all .15s', userSelect: 'none' },
  iconBtn: { width: 24, height: 24, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  empty: { fontSize: 13, color: '#aaa', textAlign: 'center', padding: '20px 0' },

  // 우측 패널
  rightPanel: { flex: 1, minWidth: 320 },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, border: '2px dashed #d0e8f8', borderRadius: 12, color: '#90a4ae' },
  placeholderIcon: { fontSize: 40, marginBottom: 12 },
  placeholderText: { fontSize: 14 },

  // 구역 정보 카드
  infoCard: { background: '#fff', border: '1px solid #d0e8f8', borderRadius: 12, padding: '16px 20px', marginBottom: 16 },
  infoRow: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8, fontSize: 14 },
  infoLabel: { width: 64, color: '#78909c', flexShrink: 0, fontWeight: 500, paddingTop: 2 },
  infoValue: { color: '#1a1a1a', flex: 1 },
  badge: { padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },

  // 이미지 섹션
  imgSection: { background: '#fff', border: '1px solid #d0e8f8', borderRadius: 12, padding: '16px 20px' },
  imgSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  imgSectionTitle: { fontSize: 14, fontWeight: 700, color: '#1565C0' },
  btnImgAdd: { padding: '6px 14px', fontSize: 12, borderRadius: 8, background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, userSelect: 'none' },
  noImages: { color: '#aaa', fontSize: 13, textAlign: 'center', padding: '20px 0' },
  imgGrid: { display: 'flex', flexWrap: 'wrap', gap: 12 },
  imgWrap: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  img: {
    width: 160, height: 120,
    objectFit: 'contain',       // PictureBoxSizeMode.Zoom
    background: '#f5f8fc',
    border: '1px solid #d0e8f8',
    borderRadius: 8,
    cursor: 'zoom-in',
    display: 'block',
  },
  imgDel: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, border: 'none', borderRadius: 5, background: 'rgba(198,40,40,0.85)', color: '#fff', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  imgName: { fontSize: 11, color: '#90a4ae', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' },

  // 라이트박스
  lightboxBack: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 },
  lightboxWrap: { position: 'relative', maxWidth: '92vw', maxHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' },
  lightboxClose: { position: 'absolute', top: -16, right: -16, width: 32, height: 32, border: 'none', borderRadius: '50%', background: '#fff', color: '#1a1a1a', fontSize: 18, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },

  // 모달
  modalBack: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 8000 },
  modalBox: { background: '#fff', borderRadius: 14, padding: '28px 32px', width: 360, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' },
  modalTitle: { color: '#1565C0', fontSize: 16, fontWeight: 700, marginBottom: 20 },
  formRow: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, color: '#546e7a', marginBottom: 5, fontWeight: 500 },
  input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #b0bec5', fontSize: 14, boxSizing: 'border-box' as const, outline: 'none' },
  err: { color: '#c62828', fontSize: 12, marginTop: 4, display: 'block' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 },
  btnCancel: { padding: '8px 20px', borderRadius: 8, border: '1px solid #b0bec5', background: '#fff', color: '#546e7a', cursor: 'pointer', fontSize: 13 },
  btnSave: { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FarmInfo, PlcInfo, PlcAddInfo, PlcCtrlInfo, SequenceGrpInfo, SequenceInfo } from '../types';
import { AlertModal } from '../components/Modal';

const TAB_LABELS = ['농장', 'PLC 정보', 'PLC Address', 'PLC Control', '시퀀스 그룹', '시퀀스'];

// ── 공통 컴포넌트 ────────────────────────────────────────────────
function UseTag({ v }: { v: string }) {
  return <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11,
    background: v === 'Y' ? '#e8f5e9' : '#fce4ec',
    color: v === 'Y' ? '#2e7d32' : '#c62828', fontWeight: 600,
  }}>{v === 'Y' ? '사용' : '미사용'}</span>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '8px 10px', background: '#e3f2fd', color: '#1565C0', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', borderBottom: '1px solid #bbdefb' }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '7px 10px', fontSize: 13, borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }}>{children}</td>;
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#87CEEB', color: '#1565C0', cursor: 'pointer', fontWeight: 600, fontSize: 12, marginRight: 4 }}>수정</button>;
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#ffcdd2', color: '#c62828', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>삭제</button>;
}

// ── 폼 모달 ─────────────────────────────────────────────────────
function FormModal({ title, fields, defaultValues, onSave, onClose }: {
  title: string;
  fields: { name: string; label: string; type?: string; options?: string[] }[];
  defaultValues?: any;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const { register, handleSubmit } = useForm({ defaultValues });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ color: '#1565C0', marginBottom: 16, fontSize: 16 }}>{title}</h3>
        <form onSubmit={handleSubmit(onSave)}>
          {fields.map(f => (
            <div key={f.name} style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>{f.label}</label>
              {f.options ? (
                <select {...register(f.name)} style={inputSt}>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input {...register(f.name)} type={f.type || 'text'} style={inputSt} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>취소</button>
            <button type="submit" style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 농장 탭 ─────────────────────────────────────────────────────
function FarmTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [alert, setAlert] = useState('');

  const { data: farms = [] } = useQuery<FarmInfo[]>({ queryKey: ['farm-info'], queryFn: () => api.get('/api/farm-info').then(r => r.data) });
  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/farm-info/${d.id}`, d) : api.post('/api/farm-info', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farm-info'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '오류'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/farm-info/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farm-info'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  const fields = [
    { name: 'name', label: '농장명' },
    { name: 'description', label: '설명' },
    { name: 'use', label: '사용', options: ['Y', 'N'] },
  ];

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {modal && <FormModal title={modal.id ? '농장 수정' : '농장 추가'} fields={fields} defaultValues={modal} onSave={d => save.mutate({ ...d, id: modal.id })} onClose={() => setModal(null)} />}
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setModal({})} style={addBtn}>+ 추가</button>
      </div>
      <table style={tableStyle}>
        <thead><tr><Th>ID</Th><Th>농장명</Th><Th>설명</Th><Th>사용</Th><Th>생성일</Th><Th>관리</Th></tr></thead>
        <tbody>
          {farms.map(f => (
            <tr key={f.id}>
              <Td>{f.id}</Td><Td>{f.name}</Td><Td>{f.description}</Td>
              <Td><UseTag v={f.use} /></Td>
              <Td>{f.created_at?.slice(0, 10)}</Td>
              <Td><EditBtn onClick={() => setModal(f)} /><DelBtn onClick={() => del.mutate(f.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── PLC 탭 ──────────────────────────────────────────────────────
function PlcTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [alert, setAlert] = useState('');
  const { data: items = [] } = useQuery<PlcInfo[]>({ queryKey: ['plc-info'], queryFn: () => api.get('/api/plc-info').then(r => r.data) });
  const { data: farms = [] } = useQuery<FarmInfo[]>({ queryKey: ['farm-info'], queryFn: () => api.get('/api/farm-info').then(r => r.data) });
  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/plc-info/${d.id}`, d) : api.post('/api/plc-info', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-info'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '오류'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/plc-info/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-info'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });
  const farmName = (id: number) => farms.find(f => f.id === id)?.name || id;

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {modal && (
        <FormModal title={modal.id ? 'PLC 수정' : 'PLC 추가'}
          fields={[
            { name: 'farm_id', label: '농장ID' },
            { name: 'name', label: 'PLC명' },
            { name: 'description', label: '설명' },
            { name: 'ip', label: 'IP' },
            { name: 'port', label: 'Port', type: 'number' },
            { name: 'use', label: '사용', options: ['Y', 'N'] },
          ]}
          defaultValues={modal}
          onSave={d => save.mutate({ ...d, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 12 }}><button onClick={() => setModal({})} style={addBtn}>+ 추가</button></div>
      <table style={tableStyle}>
        <thead><tr><Th>ID</Th><Th>농장</Th><Th>PLC명</Th><Th>IP</Th><Th>Port</Th><Th>사용</Th><Th>관리</Th></tr></thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <Td>{p.id}</Td><Td>{farmName(p.farm_id)}</Td><Td>{p.name}</Td>
              <Td>{p.ip}</Td><Td>{p.port}</Td>
              <Td><UseTag v={p.use} /></Td>
              <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => del.mutate(p.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── PLC Address 탭 ───────────────────────────────────────────────
function PlcAddTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [alert, setAlert] = useState('');
  const { data: items = [] } = useQuery<PlcAddInfo[]>({ queryKey: ['plc-add-info'], queryFn: () => api.get('/api/plc-add-info').then(r => r.data) });
  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/plc-add-info/${d.id}`, d) : api.post('/api/plc-add-info', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-add-info'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '오류'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/plc-add-info/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-add-info'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {modal && (
        <FormModal title={modal.id ? 'Address 수정' : 'Address 추가'}
          fields={[
            { name: 'plc_id', label: 'PLC ID', type: 'number' },
            { name: 'name', label: '명칭' },
            { name: 'address', label: 'Address' },
            { name: 'data_type', label: '데이터 타입', options: ['Word', 'Bit'] },
            { name: 'use', label: '사용', options: ['Y', 'N'] },
          ]}
          defaultValues={modal}
          onSave={d => save.mutate({ ...d, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 12 }}><button onClick={() => setModal({})} style={addBtn}>+ 추가</button></div>
      <table style={tableStyle}>
        <thead><tr><Th>ID</Th><Th>PLC ID</Th><Th>명칭</Th><Th>Address</Th><Th>타입</Th><Th>사용</Th><Th>관리</Th></tr></thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <Td>{p.id}</Td><Td>{p.plc_id}</Td><Td>{p.name}</Td>
              <Td>{p.address}</Td><Td>{p.data_type}</Td>
              <Td><UseTag v={p.use} /></Td>
              <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => del.mutate(p.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── PLC Control 탭 ───────────────────────────────────────────────
function PlcCtrlTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [alert, setAlert] = useState('');
  const { data: items = [] } = useQuery<PlcCtrlInfo[]>({ queryKey: ['plc-ctrl-info'], queryFn: () => api.get('/api/plc-ctrl-info').then(r => r.data) });
  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/plc-ctrl-info/${d.id}`, d) : api.post('/api/plc-ctrl-info', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-ctrl-info'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '오류'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/plc-ctrl-info/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-ctrl-info'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {modal && (
        <FormModal title={modal.id ? 'Control 수정' : 'Control 추가'}
          fields={[
            { name: 'plc_add_id', label: 'Address ID', type: 'number' },
            { name: 'name', label: '이름' },
            { name: 'description', label: '설명' },
            { name: 'value', label: '값' },
            { name: 'use', label: '사용', options: ['Y', 'N'] },
          ]}
          defaultValues={modal}
          onSave={d => save.mutate({ ...d, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 12 }}><button onClick={() => setModal({})} style={addBtn}>+ 추가</button></div>
      <table style={tableStyle}>
        <thead><tr><Th>ID</Th><Th>Add.ID</Th><Th>이름</Th><Th>설명</Th><Th>값</Th><Th>사용</Th><Th>관리</Th></tr></thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <Td>{p.id}</Td><Td>{p.plc_add_id}</Td><Td>{p.name}</Td>
              <Td>{p.description}</Td><Td>{p.value}</Td>
              <Td><UseTag v={p.use} /></Td>
              <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => del.mutate(p.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 시퀀스 그룹 탭 ───────────────────────────────────────────────
function SeqGrpTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [alert, setAlert] = useState('');
  const { data: items = [] } = useQuery<SequenceGrpInfo[]>({ queryKey: ['sequence-grp'], queryFn: () => api.get('/api/sequence-grp').then(r => r.data) });
  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/sequence-grp/${d.id}`, d) : api.post('/api/sequence-grp', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence-grp'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '오류'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/sequence-grp/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence-grp'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {modal && (
        <FormModal title={modal.id ? '그룹 수정' : '그룹 추가'}
          fields={[{ name: 'name', label: '그룹명' }, { name: 'description', label: '설명' }, { name: 'use', label: '사용', options: ['Y', 'N'] }]}
          defaultValues={modal} onSave={d => save.mutate({ ...d, id: modal.id })} onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 12 }}><button onClick={() => setModal({})} style={addBtn}>+ 추가</button></div>
      <table style={tableStyle}>
        <thead><tr><Th>ID</Th><Th>그룹명</Th><Th>설명</Th><Th>사용</Th><Th>관리</Th></tr></thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <Td>{p.id}</Td><Td>{p.name}</Td><Td>{p.description}</Td>
              <Td><UseTag v={p.use} /></Td>
              <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => del.mutate(p.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 시퀀스 탭 ────────────────────────────────────────────────────
function SeqTab() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [alert, setAlert] = useState('');
  const { data: items = [] } = useQuery<SequenceInfo[]>({ queryKey: ['sequence'], queryFn: () => api.get('/api/sequence').then(r => r.data) });
  const save = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/sequence/${d.id}`, d) : api.post('/api/sequence', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '오류'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/sequence/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {modal && (
        <FormModal title={modal.id ? '시퀀스 수정' : '시퀀스 추가'}
          fields={[
            { name: 'grp_id', label: '그룹 ID', type: 'number' },
            { name: 'plc_ctrl_id', label: 'Control ID', type: 'number' },
            { name: 'name', label: '명칭' },
            { name: 'description', label: '설명' },
            { name: 'start_gap', label: '시작 Gap(분)', type: 'number' },
            { name: 'use', label: '사용', options: ['Y', 'N'] },
          ]}
          defaultValues={modal} onSave={d => save.mutate({ ...d, id: modal.id })} onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 12 }}><button onClick={() => setModal({})} style={addBtn}>+ 추가</button></div>
      <table style={tableStyle}>
        <thead><tr><Th>ID</Th><Th>그룹ID</Th><Th>Ctrl ID</Th><Th>명칭</Th><Th>Gap(분)</Th><Th>사용</Th><Th>관리</Th></tr></thead>
        <tbody>
          {items.map(p => (
            <tr key={p.id}>
              <Td>{p.id}</Td><Td>{p.grp_id}</Td><Td>{p.plc_ctrl_id}</Td><Td>{p.name}</Td>
              <Td>{p.start_gap}</Td>
              <Td><UseTag v={p.use} /></Td>
              <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => del.mutate(p.id)} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export default function ControlInfo() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  if (!isManager) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#e53935', fontSize: 16 }}>접근 권한이 없습니다.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer' }}>홈으로</button>
      </div>
    );
  }

  const TABS = [FarmTab, PlcTab, PlcAddTab, PlcCtrlTab, SeqGrpTab, SeqTab];
  const ActiveTab = TABS[tab];

  return (
    <div style={{ padding: '16px 20px' }}>
      <h2 style={h2}>제어 정보</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #87CEEB' }}>
        {TAB_LABELS.map((l, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: tab === i ? '#1565C0' : '#e3f2fd',
            color: tab === i ? '#fff' : '#1565C0', fontWeight: tab === i ? 700 : 500, fontSize: 13,
          }}>{l}</button>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', padding: 16, border: '1px solid #e3f2fd', overflowX: 'auto' }}>
        <ActiveTab />
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { color: '#1565C0', fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #87CEEB' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', minWidth: 600 };
const addBtn: React.CSSProperties = { padding: '7px 16px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const inputSt: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #87CEEB', fontSize: 13, boxSizing: 'border-box' };

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../api/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FarmInfo, PlcInfo, PlcAddInfo, PlcCtrlInfo, SequenceGrpInfo, SequenceInfo } from '../types';
import { AlertModal, ConfirmModal } from '../components/Modal';

const TAB_LABELS = ['PLC 정보', 'PLC Address', 'PLC Control 정보', '시퀀스 그룹', '시퀀스 정보'];

// ── 공통 셀 ──────────────────────────────────────────────────────
function UseTag({ v }: { v: string }) {
  return <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11,
    background: v === 'Y' ? '#e8f5e9' : '#fce4ec',
    color: v === 'Y' ? '#2e7d32' : '#c62828', fontWeight: 600,
  }}>{v === 'Y' ? '사용' : '미사용'}</span>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '8px 12px', background: '#e3f2fd', color: '#1565C0', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', borderBottom: '1px solid #bbdefb', textAlign: 'left' }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #f0f0f0', verticalAlign: 'middle' }}>{children}</td>;
}
function EditBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#e3f2fd', color: '#1565C0', cursor: 'pointer', fontWeight: 600, fontSize: 12, marginRight: 6 }}>수정</button>;
}
function DelBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ padding: '4px 12px', borderRadius: 8, border: 'none', background: '#fde8e8', color: '#c62828', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>삭제</button>;
}

// ── 공통 폼 모달 ─────────────────────────────────────────────────
interface FieldDef {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  selectData?: { value: number | string; label: string }[];
}
function FormModal({ title, fields, defaultValues, onSave, onClose }: {
  title: string; fields: FieldDef[]; defaultValues?: any;
  onSave: (d: any) => void; onClose: () => void;
}) {
  const { register, handleSubmit } = useForm({ defaultValues });
  return (
    <div style={S.modalBack}>
      <div style={S.modalBox}>
        <h3 style={{ color: '#1565C0', marginBottom: 18, fontSize: 16 }}>{title}</h3>
        <form onSubmit={handleSubmit(onSave)}>
          {fields.map(f => (
            <div key={f.name} style={{ marginBottom: 13 }}>
              <label style={S.label}>{f.label}</label>
              {f.selectData ? (
                <select {...register(f.name)} style={S.input}>
                  <option value="">선택</option>
                  {f.selectData.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.options ? (
                <select {...register(f.name)} style={S.input}>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input {...register(f.name)} type={f.type || 'text'} style={S.input} />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
            <button type="button" onClick={onClose} style={S.btnCancel}>취소</button>
            <button type="submit" style={S.btnSave}>저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 필터된 데이터 묶음 ────────────────────────────────────────────
interface CtrlData {
  farms: FarmInfo[];
  plcs: PlcInfo[];
  plcAdds: PlcAddInfo[];
  ctrls: PlcCtrlInfo[];
  grps: SequenceGrpInfo[];
  seqs: SequenceInfo[];
}

// ── PLC 정보 탭 ──────────────────────────────────────────────────
function PlcTab({ d }: { d: CtrlData }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<Partial<PlcInfo> | null>(null);
  const [alert, setAlert] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const farmOpts = d.farms.map(f => ({ value: f.id, label: `[${f.id}] ${f.name}` }));
  const farmName = (id: number) => d.farms.find(f => f.id === id)?.name ?? String(id);

  const save = useMutation({
    mutationFn: (v: any) => v.id ? api.patch(`/api/plc-info/${v.id}`, v) : api.post('/api/plc-info', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-info'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/plc-info/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-info'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmId !== null && (
        <ConfirmModal
          message="PLC 정보를 삭제하시겠습니까?&#10;(PLC Address에서 사용 중이면 삭제되지 않습니다.)"
          onConfirm={() => { del.mutate(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)}
        />
      )}
      {modal !== null && (
        <FormModal title={modal.id ? 'PLC 수정' : 'PLC 추가'}
          fields={[
            { name: 'farm_id', label: '농장 구역', selectData: farmOpts },
            { name: 'name', label: 'PLC명' },
            { name: 'description', label: '설명' },
            { name: 'ip', label: 'IP 주소' },
            { name: 'port', label: 'Port', type: 'number' },
            { name: 'use', label: '사용여부', options: ['Y', 'N'] },
          ]}
          defaultValues={{ port: 502, use: 'Y', ...modal }}
          onSave={v => save.mutate({ ...v, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 14 }}><button onClick={() => setModal({})} style={S.addBtn}>+ 추가</button></div>
      {d.plcs.length === 0 ? <p style={S.empty}>등록된 PLC 정보가 없습니다.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr><Th>ID</Th><Th>농장 구역</Th><Th>PLC명</Th><Th>IP 주소</Th><Th>Port</Th><Th>설명</Th><Th>사용</Th><Th>관리</Th></tr></thead>
            <tbody>
              {d.plcs.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafcff' }}>
                  <Td>{p.id}</Td><Td>{farmName(p.farm_id)}</Td><Td>{p.name}</Td>
                  <Td>{p.ip}</Td><Td>{p.port}</Td><Td>{p.description}</Td>
                  <Td><UseTag v={p.use} /></Td>
                  <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => setConfirmId(p.id)} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── PLC Address 탭 ───────────────────────────────────────────────
function PlcAddTab({ d }: { d: CtrlData }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<Partial<PlcAddInfo> | null>(null);
  const [alert, setAlert] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const plcOpts = d.plcs.map(p => ({ value: p.id, label: `[${p.id}] ${p.name}` }));
  const plcName = (id: number) => d.plcs.find(p => p.id === id)?.name ?? String(id);

  const save = useMutation({
    mutationFn: (v: any) => v.id ? api.patch(`/api/plc-add-info/${v.id}`, v) : api.post('/api/plc-add-info', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-add-info'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/plc-add-info/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-add-info'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmId !== null && (
        <ConfirmModal message="PLC Address를 삭제하시겠습니까?"
          onConfirm={() => { del.mutate(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {modal !== null && (
        <FormModal title={modal.id ? 'Address 수정' : 'Address 추가'}
          fields={[
            { name: 'plc_id', label: 'PLC', selectData: plcOpts },
            { name: 'name', label: '명칭' },
            { name: 'address', label: 'Address' },
            { name: 'data_type', label: '데이터 타입', options: ['Word', 'Bit'] },
            { name: 'use', label: '사용여부', options: ['Y', 'N'] },
          ]}
          defaultValues={{ data_type: 'Word', use: 'Y', ...modal }}
          onSave={v => save.mutate({ ...v, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 14 }}><button onClick={() => setModal({})} style={S.addBtn}>+ 추가</button></div>
      {d.plcAdds.length === 0 ? <p style={S.empty}>등록된 Address 정보가 없습니다.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr><Th>ID</Th><Th>PLC</Th><Th>명칭</Th><Th>Address</Th><Th>데이터 타입</Th><Th>사용</Th><Th>관리</Th></tr></thead>
            <tbody>
              {d.plcAdds.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafcff' }}>
                  <Td>{p.id}</Td><Td>{plcName(p.plc_id)}</Td><Td>{p.name}</Td>
                  <Td>{p.address}</Td><Td>{p.data_type}</Td>
                  <Td><UseTag v={p.use} /></Td>
                  <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => setConfirmId(p.id)} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── PLC Control 정보 탭 ──────────────────────────────────────────
function PlcCtrlTab({ d }: { d: CtrlData }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<Partial<PlcCtrlInfo> | null>(null);
  const [alert, setAlert] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const addOpts = d.plcAdds.map(a => ({ value: a.id, label: `[${a.id}] ${a.name} (${a.address})` }));
  const addName = (id: number) => d.plcAdds.find(a => a.id === id)?.name ?? String(id);

  const save = useMutation({
    mutationFn: (v: any) => v.id ? api.patch(`/api/plc-ctrl-info/${v.id}`, v) : api.post('/api/plc-ctrl-info', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-ctrl-info'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/plc-ctrl-info/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['plc-ctrl-info'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmId !== null && (
        <ConfirmModal message="PLC Control 정보를 삭제하시겠습니까?"
          onConfirm={() => { del.mutate(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {modal !== null && (
        <FormModal title={modal.id ? 'Control 수정' : 'Control 추가'}
          fields={[
            { name: 'plc_add_id', label: 'PLC Address', selectData: addOpts },
            { name: 'name', label: '이름' },
            { name: 'description', label: '설명' },
            { name: 'value', label: '값' },
            { name: 'use', label: '사용여부', options: ['Y', 'N'] },
          ]}
          defaultValues={{ use: 'Y', ...modal }}
          onSave={v => save.mutate({ ...v, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 14 }}><button onClick={() => setModal({})} style={S.addBtn}>+ 추가</button></div>
      {d.ctrls.length === 0 ? <p style={S.empty}>등록된 Control 정보가 없습니다.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr><Th>ID</Th><Th>PLC Address</Th><Th>이름</Th><Th>설명</Th><Th>값</Th><Th>사용</Th><Th>관리</Th></tr></thead>
            <tbody>
              {d.ctrls.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafcff' }}>
                  <Td>{p.id}</Td><Td>{addName(p.plc_add_id)}</Td><Td>{p.name}</Td>
                  <Td>{p.description}</Td><Td>{p.value}</Td>
                  <Td><UseTag v={p.use} /></Td>
                  <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => setConfirmId(p.id)} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 시퀀스 그룹 탭 ───────────────────────────────────────────────
function SeqGrpTab({ d }: { d: CtrlData }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<Partial<SequenceGrpInfo> | null>(null);
  const [alert, setAlert] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: (v: any) => v.id ? api.patch(`/api/sequence-grp/${v.id}`, v) : api.post('/api/sequence-grp', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence-grp'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/sequence-grp/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence-grp'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmId !== null && (
        <ConfirmModal message="시퀀스 그룹을 삭제하시겠습니까?"
          onConfirm={() => { del.mutate(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {modal !== null && (
        <FormModal title={modal.id ? '시퀀스 그룹 수정' : '시퀀스 그룹 추가'}
          fields={[
            { name: 'name', label: '그룹명' },
            { name: 'description', label: '설명' },
            { name: 'use', label: '사용여부', options: ['Y', 'N'] },
          ]}
          defaultValues={{ use: 'Y', ...modal }}
          onSave={v => save.mutate({ ...v, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 14 }}><button onClick={() => setModal({})} style={S.addBtn}>+ 추가</button></div>
      {d.grps.length === 0 ? <p style={S.empty}>등록된 시퀀스 그룹이 없습니다.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr><Th>ID</Th><Th>그룹명</Th><Th>설명</Th><Th>사용</Th><Th>관리</Th></tr></thead>
            <tbody>
              {d.grps.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafcff' }}>
                  <Td>{p.id}</Td><Td>{p.name}</Td><Td>{p.description}</Td>
                  <Td><UseTag v={p.use} /></Td>
                  <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => setConfirmId(p.id)} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 시퀀스 정보 탭 ───────────────────────────────────────────────
function SeqTab({ d }: { d: CtrlData }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<Partial<SequenceInfo> | null>(null);
  const [alert, setAlert] = useState('');
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const grpOpts = d.grps.map(g => ({ value: g.id, label: `[${g.id}] ${g.name}` }));
  const ctrlOpts = d.ctrls.map(c => ({ value: c.id, label: `[${c.id}] ${c.name}` }));
  const grpName = (id: number) => d.grps.find(g => g.id === id)?.name ?? String(id);
  const ctrlName = (id: number) => d.ctrls.find(c => c.id === id)?.name ?? String(id);

  const save = useMutation({
    mutationFn: (v: any) => v.id ? api.patch(`/api/sequence/${v.id}`, v) : api.post('/api/sequence', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence'] }); setModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/api/sequence/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sequence'] }); setAlert('성공적으로 삭제 하였습니다.'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  return (
    <div>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmId !== null && (
        <ConfirmModal message="시퀀스 정보를 삭제하시겠습니까?"
          onConfirm={() => { del.mutate(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)} />
      )}
      {modal !== null && (
        <FormModal title={modal.id ? '시퀀스 수정' : '시퀀스 추가'}
          fields={[
            { name: 'grp_id', label: '시퀀스 그룹', selectData: grpOpts },
            { name: 'plc_ctrl_id', label: 'PLC Control', selectData: ctrlOpts },
            { name: 'name', label: '명칭' },
            { name: 'description', label: '설명' },
            { name: 'start_gap', label: '시작 Gap (분)', type: 'number' },
            { name: 'use', label: '사용여부', options: ['Y', 'N'] },
          ]}
          defaultValues={{ start_gap: 0, use: 'Y', ...modal }}
          onSave={v => save.mutate({ ...v, id: modal.id })}
          onClose={() => setModal(null)} />
      )}
      <div style={{ marginBottom: 14 }}><button onClick={() => setModal({})} style={S.addBtn}>+ 추가</button></div>
      {d.seqs.length === 0 ? <p style={S.empty}>등록된 시퀀스 정보가 없습니다.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={S.table}>
            <thead><tr><Th>ID</Th><Th>시퀀스 그룹</Th><Th>PLC Control</Th><Th>명칭</Th><Th>설명</Th><Th>Gap(분)</Th><Th>사용</Th><Th>관리</Th></tr></thead>
            <tbody>
              {d.seqs.map((p, i) => (
                <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafcff' }}>
                  <Td>{p.id}</Td><Td>{grpName(p.grp_id)}</Td><Td>{ctrlName(p.plc_ctrl_id)}</Td>
                  <Td>{p.name}</Td><Td>{p.description}</Td><Td>{p.start_gap}</Td>
                  <Td><UseTag v={p.use} /></Td>
                  <Td><EditBtn onClick={() => setModal(p)} /><DelBtn onClick={() => setConfirmId(p.id)} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function ControlInfo() {
  const { isManager } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [farmId, setFarmId] = useState<number | ''>('');

  // 전체 데이터 로드
  const { data: farms    = [] } = useQuery<FarmInfo[]>       ({ queryKey: ['farm-info'],     queryFn: () => api.get('/api/farm-info').then(r => r.data) });
  const { data: allPlcs  = [] } = useQuery<PlcInfo[]>        ({ queryKey: ['plc-info'],      queryFn: () => api.get('/api/plc-info').then(r => r.data) });
  const { data: allAdds  = [] } = useQuery<PlcAddInfo[]>     ({ queryKey: ['plc-add-info'],  queryFn: () => api.get('/api/plc-add-info').then(r => r.data) });
  const { data: allCtrls = [] } = useQuery<PlcCtrlInfo[]>    ({ queryKey: ['plc-ctrl-info'], queryFn: () => api.get('/api/plc-ctrl-info').then(r => r.data) });
  const { data: allGrps  = [] } = useQuery<SequenceGrpInfo[]>({ queryKey: ['sequence-grp'], queryFn: () => api.get('/api/sequence-grp').then(r => r.data) });
  const { data: allSeqs  = [] } = useQuery<SequenceInfo[]>   ({ queryKey: ['sequence'],      queryFn: () => api.get('/api/sequence').then(r => r.data) });

  // 농장 기준 연쇄 필터
  const plcs     = farmId ? allPlcs.filter(p => p.farm_id === Number(farmId)) : allPlcs;
  const plcIds   = new Set(plcs.map(p => p.id));
  const plcAdds  = allAdds.filter(a => !farmId || plcIds.has(a.plc_id));
  const addIds   = new Set(plcAdds.map(a => a.id));
  const ctrls    = allCtrls.filter(c => !farmId || addIds.has(c.plc_add_id));
  const ctrlIds  = new Set(ctrls.map(c => c.id));
  const seqs     = allSeqs.filter(s => !farmId || ctrlIds.has(s.plc_ctrl_id));
  const grpIds   = new Set(seqs.map(s => s.grp_id));
  const grps     = allGrps.filter(g => !farmId || grpIds.has(g.id));

  const data: CtrlData = { farms, plcs, plcAdds, ctrls, grps, seqs };

  const TABS = [
    <PlcTab    key="plc"   d={data} />,
    <PlcAddTab key="add"   d={data} />,
    <PlcCtrlTab key="ctrl" d={data} />,
    <SeqGrpTab key="grp"  d={data} />,
    <SeqTab    key="seq"   d={data} />,
  ];

  if (!isManager) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#e53935', fontSize: 16 }}>접근 권한이 없습니다.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer' }}>홈으로</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <h2 style={S.h2}>제어 정보</h2>

      {/* 농장 구역 필터 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 14px', background: '#e3f2fd', borderRadius: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1565C0', whiteSpace: 'nowrap' }}>농장 구역</span>
        <select
          value={farmId}
          onChange={e => setFarmId(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #90caf9', fontSize: 13, minWidth: 180, background: '#fff', color: '#1a1a1a' }}
        >
          <option value="">전체</option>
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {farmId !== '' && (
          <button onClick={() => setFarmId('')} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#90caf9', color: '#1565C0', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>전체 보기</button>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #87CEEB' }}>
        {TAB_LABELS.map((l, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: tab === i ? '#1565C0' : '#e3f2fd',
            color: tab === i ? '#fff' : '#1565C0',
            fontWeight: tab === i ? 700 : 500, fontSize: 13,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '0 12px 12px 12px', padding: 20, border: '1px solid #e3f2fd' }}>
        {TABS[tab]}
      </div>
    </div>
  );
}

// ── 스타일 ───────────────────────────────────────────────────────
const S = {
  h2:       { color: '#1565C0', fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #87CEEB' } as React.CSSProperties,
  table:    { width: '100%', borderCollapse: 'collapse', minWidth: 640 } as React.CSSProperties,
  addBtn:   { padding: '7px 18px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 } as React.CSSProperties,
  empty:    { color: '#aaa', fontSize: 13, textAlign: 'center', padding: '24px 0' } as React.CSSProperties,
  input:    { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #87CEEB', fontSize: 13, boxSizing: 'border-box' } as React.CSSProperties,
  label:    { display: 'block', fontSize: 12, color: '#546e7a', marginBottom: 5, fontWeight: 500 } as React.CSSProperties,
  modalBack:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000 } as React.CSSProperties,
  modalBox: { background: '#fff', borderRadius: 14, padding: '28px 32px', width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' } as React.CSSProperties,
  btnCancel:{ padding: '8px 20px', borderRadius: 10, border: '1px solid #b0bec5', background: '#fff', color: '#546e7a', cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  btnSave:  { padding: '8px 20px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 } as React.CSSProperties,
};

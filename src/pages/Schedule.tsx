import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, addWeeks, addMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../api/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { FarmInfo, PlcInfo, PlcAddInfo, PlcCtrlInfo, ScheduleInfo, SequenceGrpInfo, SequenceInfo } from '../types';
import { AlertModal, ConfirmModal } from '../components/Modal';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: ko }),
  getDay, locales: { ko },
});

const GROUP_COLORS = ['#1565C0','#2e7d32','#6a1b9a','#e65100','#00838f','#ad1457','#37474f','#f57f17'];

function toLocalInputStr(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

interface EventItem {
  id: string; title: string; start: Date; end: Date;
  resource: ScheduleInfo; color: string;
}

function expandEvents(schedules: ScheduleInfo[], grpColors: Map<number, string>): EventItem[] {
  const events: EventItem[] = [];
  const now = new Date();
  const rangeEnd = addMonths(now, 3);

  schedules.forEach(s => {
    if (s.use === 'N') return;
    const base = new Date(s.exec_datetime);
    const color = s.is_sequence === 'Y' && s.seq_grp_id
      ? (grpColors.get(s.seq_grp_id) || '#1565C0')
      : '#1565C0';

    const push = (start: Date) =>
      events.push({ id: `${s.id}-${start.getTime()}`, title: s.name, start, end: addDays(start, 0), resource: s, color });

    if (s.repeat_type === 'none') { push(base); return; }
    let cur = base;
    while (cur <= rangeEnd) {
      push(cur);
      if (s.repeat_type === 'daily')        cur = addDays(cur, 1);
      else if (s.repeat_type === 'weekly')   cur = addWeeks(cur, 1);
      else if (s.repeat_type === 'monthly')  cur = addMonths(cur, 1);
      else break;
    }
  });
  return events;
}

// ── 일반 일정 모달 ───────────────────────────────────────────────
function ScheduleModal({ item, farms, plcs, plcAdds, ctrls, onSave, onDelete, onClose }: {
  item: ScheduleInfo | null;
  farms: FarmInfo[]; plcs: PlcInfo[]; plcAdds: PlcAddInfo[]; ctrls: PlcCtrlInfo[];
  onSave: (d: any) => void; onDelete?: () => void; onClose: () => void;
}) {
  const { register, handleSubmit, watch } = useForm<Record<string, any>>({
    defaultValues: item
      ? { ...item, exec_datetime: toLocalInputStr(new Date(item.exec_datetime)) }
      : { repeat_type: 'none', use: 'Y', is_sequence: 'N' },
  });
  const isSeq = watch('is_sequence');

  return (
    <div style={S.back}>
      <div style={S.box}>
        <h3 style={S.title}>{item ? '일정 수정' : '일정 추가'}</h3>
        <form onSubmit={handleSubmit(onSave)}>
          {item && <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>ID: {item.id}</div>}
          <Row label="일정명"><input {...register('name')} type="text" style={inp} /></Row>
          <Row label="실행 일시"><input {...register('exec_datetime')} type="datetime-local" style={inp} /></Row>
          <Row label="일정 반복">
            <select {...register('repeat_type')} style={inp}>
              <option value="none">없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
          </Row>
          <Row label="시퀀스 여부">
            <select {...register('is_sequence')} style={inp}>
              <option value="N">일반</option>
              <option value="Y">시퀀스</option>
            </select>
          </Row>
          {isSeq !== 'Y' && (<>
            <Row label="농장 구역">
              <select {...register('farm_id')} style={inp}>
                <option value="">선택</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Row>
            <Row label="PLC">
              <select {...register('plc_id')} style={inp}>
                <option value="">선택</option>
                {plcs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Row>
            <Row label="PLC Address">
              <select {...register('plc_add_id')} style={inp}>
                <option value="">선택</option>
                {plcAdds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Row>
            <Row label="제어 정보">
              <select {...register('ctrl_id')} style={inp}>
                <option value="">선택</option>
                {ctrls.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Row>
          </>)}
          <Row label="사용">
            <select {...register('use')} style={inp}>
              <option value="Y">사용</option>
              <option value="N">미사용</option>
            </select>
          </Row>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            {item && onDelete && (
              <button type="button" onClick={onDelete}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#fde8e8', color: '#c62828', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>삭제</button>
            )}
            <button type="button" onClick={onClose} style={S.btnCancel}>취소</button>
            <button type="submit" style={S.btnSave}>저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 시퀀스 일정 모달 (추가 / 수정) ──────────────────────────────
function SeqScheduleModal({ mode, grps, seqGrpId, grpName, defaultValues, onSave, onClose }: {
  mode: 'add' | 'edit';
  grps: SequenceGrpInfo[];
  seqGrpId?: number;
  grpName?: string;
  defaultValues?: { exec_datetime: string; repeat_type: string; use: string };
  onSave: (d: any) => void;
  onClose: () => void;
}) {
  const { register, handleSubmit } = useForm<Record<string, any>>({
    defaultValues: mode === 'edit' && defaultValues
      ? defaultValues
      : { repeat_type: 'none', use: 'Y', seq_grp_id: '', exec_datetime: '' },
  });

  return (
    <div style={S.back}>
      <div style={S.box}>
        <h3 style={S.title}>{mode === 'add' ? '시퀀스 일정 추가' : '시퀀스 일정 수정'}</h3>
        <form onSubmit={handleSubmit(onSave)}>
          {mode === 'add' ? (
            <Row label="시퀀스 그룹">
              <select {...register('seq_grp_id')} style={inp}>
                <option value="">선택</option>
                {grps.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Row>
          ) : (
            <Row label="시퀀스 그룹">
              <div style={{ padding: '8px 10px', background: '#f5f8fc', borderRadius: 8, border: '1px solid #d0e8f8', fontSize: 13, color: '#1565C0', fontWeight: 600 }}>
                {grpName}
              </div>
            </Row>
          )}
          <Row label="기준 실행 일시">
            <input {...register('exec_datetime')} type="datetime-local" style={inp} />
          </Row>
          <div style={{ padding: '6px 10px', marginBottom: 10, background: '#fffde7', borderRadius: 8, border: '1px solid #fff176', fontSize: 11, color: '#f57f17' }}>
            각 시퀀스의 실행 시각 = 기준 실행 일시 + start_gap(분)
          </div>
          <Row label="일정 반복">
            <select {...register('repeat_type')} style={inp}>
              <option value="none">없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
          </Row>
          <Row label="사용">
            <select {...register('use')} style={inp}>
              <option value="Y">사용</option>
              <option value="N">미사용</option>
            </select>
          </Row>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={onClose} style={S.btnCancel}>취소</button>
            <button type="submit" style={S.btnSave}>저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────────────────
export default function Schedule() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<any>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [scheduleModal, setScheduleModal] = useState<ScheduleInfo | null | 'new'>(null);
  const [seqAddModal, setSeqAddModal] = useState(false);
  const [seqEditTarget, setSeqEditTarget] = useState<ScheduleInfo | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<number | ''>('');
  const [alert, setAlert] = useState('');
  const [confirmDel, setConfirmDel] = useState<ScheduleInfo | null>(null);

  const { data: schedules = [] } = useQuery<ScheduleInfo[]>({ queryKey: ['schedule'],       queryFn: () => api.get('/api/schedule').then(r => r.data) });
  const { data: farms    = [] } = useQuery<FarmInfo[]>      ({ queryKey: ['farm-info'],    queryFn: () => api.get('/api/farm-info').then(r => r.data) });
  const { data: plcs     = [] } = useQuery<PlcInfo[]>       ({ queryKey: ['plc-info'],     queryFn: () => api.get('/api/plc-info').then(r => r.data) });
  const { data: plcAdds  = [] } = useQuery<PlcAddInfo[]>    ({ queryKey: ['plc-add-info'], queryFn: () => api.get('/api/plc-add-info').then(r => r.data) });
  const { data: ctrls    = [] } = useQuery<PlcCtrlInfo[]>   ({ queryKey: ['plc-ctrl-info'],queryFn: () => api.get('/api/plc-ctrl-info').then(r => r.data) });
  const { data: grps     = [] } = useQuery<SequenceGrpInfo[]>({ queryKey: ['sequence-grp'],queryFn: () => api.get('/api/sequence-grp').then(r => r.data) });
  const { data: seqs     = [] } = useQuery<SequenceInfo[]>  ({ queryKey: ['sequence'],     queryFn: () => api.get('/api/sequence').then(r => r.data) });

  const grpColorMap = useMemo(() => {
    const m = new Map<number, string>();
    grps.forEach((g, i) => m.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]));
    return m;
  }, [grps]);

  const filtered = selectedFarmId ? schedules.filter(s => s.farm_id === selectedFarmId) : schedules;
  const events   = useMemo(() => expandEvents(filtered, grpColorMap), [filtered, grpColorMap]);

  // ── 뮤테이션 ─────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/schedule/${d.id}`, d) : api.post('/api/schedule', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); setScheduleModal(null); },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });

  const seqAddMutation = useMutation({
    mutationFn: (d: any) => api.post('/api/schedule/sequence-batch', d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      setSeqAddModal(false);
      setAlert(res.data?.message || '시퀀스 일정이 추가되었습니다.');
    },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });

  const seqEditMutation = useMutation({
    mutationFn: ({ grpId, ...d }: any) => api.patch(`/api/schedule/sequence-batch/${grpId}`, d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      setSeqEditTarget(null);
      setAlert(res.data?.message || '시퀀스 일정이 업데이트되었습니다.');
    },
    onError: (e: any) => setAlert(e.response?.data?.message || '업데이트 실패'),
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/schedule/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); setScheduleModal(null); setConfirmDel(null); setAlert('삭제 완료'); },
  });

  // ── 이벤트 클릭 핸들러 ────────────────────────────────────────
  const handleSelectEvent = (ev: EventItem) => {
    const s = ev.resource;
    if (s.is_sequence === 'Y' && s.seq_grp_id) {
      setSeqEditTarget(s);
    } else {
      setScheduleModal(s);
    }
  };

  // 시퀀스 그룹의 기준 실행 시각 계산:
  // 해당 그룹 내 start_gap=0에 해당하는 스케줄의 exec_datetime을 기준으로 함
  // = 그룹 내 최소 exec_datetime (start_gap이 가장 작은 항목)
  const getSeqBaseTime = (target: ScheduleInfo): string => {
    if (!target.seq_grp_id) return toLocalInputStr(new Date(target.exec_datetime));
    const seq = seqs.find(s => s.plc_ctrl_id === target.ctrl_id && s.grp_id === target.seq_grp_id);
    if (seq) {
      const base = new Date(new Date(target.exec_datetime).getTime() - seq.start_gap * 60 * 1000);
      return toLocalInputStr(base);
    }
    // fallback: 그룹 내 최소 exec_datetime
    const groupSchedules = schedules.filter(s => s.seq_grp_id === target.seq_grp_id);
    const min = groupSchedules.reduce((m, s) => new Date(s.exec_datetime) < new Date(m) ? s.exec_datetime : m, target.exec_datetime);
    return toLocalInputStr(new Date(min));
  };

  const handleSaveSchedule = (form: any) => {
    saveMutation.mutate({ ...form, is_sequence: 'N', id: (scheduleModal as ScheduleInfo)?.id });
  };

  if (!isManager) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#e53935' }}>접근 권한이 없습니다.</div>;
  }

  // 시퀀스 수정 모달용 기준 시각
  const seqEditBaseTime = seqEditTarget ? getSeqBaseTime(seqEditTarget) : '';
  const seqEditGrpName  = seqEditTarget ? (grps.find(g => g.id === seqEditTarget.seq_grp_id)?.name ?? '') : '';

  return (
    <div style={{ padding: '16px 20px' }}>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmDel && (
        <ConfirmModal
          message={`"${confirmDel.name}" 일정을 삭제하시겠습니까?`}
          onConfirm={() => delMutation.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {/* 일반 일정 모달 */}
      {scheduleModal !== null && (
        <ScheduleModal
          item={scheduleModal === 'new' ? null : scheduleModal as ScheduleInfo}
          farms={farms} plcs={plcs} plcAdds={plcAdds} ctrls={ctrls}
          onSave={handleSaveSchedule}
          onDelete={scheduleModal !== 'new' ? () => { setConfirmDel(scheduleModal as ScheduleInfo); setScheduleModal(null); } : undefined}
          onClose={() => setScheduleModal(null)}
        />
      )}
      {/* 시퀀스 추가 모달 */}
      {seqAddModal && (
        <SeqScheduleModal
          mode="add" grps={grps}
          onSave={d => seqAddMutation.mutate(d)}
          onClose={() => setSeqAddModal(false)}
        />
      )}
      {/* 시퀀스 수정 모달 */}
      {seqEditTarget && (
        <SeqScheduleModal
          mode="edit" grps={grps}
          seqGrpId={seqEditTarget.seq_grp_id ?? undefined}
          grpName={seqEditGrpName}
          defaultValues={{
            exec_datetime: seqEditBaseTime,
            repeat_type: seqEditTarget.repeat_type,
            use: seqEditTarget.use,
          }}
          onSave={d => seqEditMutation.mutate({ grpId: seqEditTarget.seq_grp_id, ...d })}
          onClose={() => setSeqEditTarget(null)}
        />
      )}

      <h2 style={h2}>일정 관리</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          value={selectedFarmId}
          onChange={e => setSelectedFarmId(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #87CEEB', fontSize: 13 }}
        >
          <option value="">전체 농장</option>
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button onClick={() => setScheduleModal('new')} style={addBtn}>+ 일정 추가</button>
        <button onClick={() => setSeqAddModal(true)} style={{ ...addBtn, background: '#6a1b9a' }}>+ 시퀀스 추가</button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e3f2fd', padding: 16 }}>
        <Calendar
          localizer={localizer}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          style={{ height: 600 }}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          onSelectEvent={e => handleSelectEvent(e as EventItem)}
          eventPropGetter={e => ({
            style: { backgroundColor: (e as EventItem).color, borderRadius: 6, border: 'none', fontSize: 12 },
          })}
          messages={{ month: '월', week: '주', day: '일', agenda: '목록', today: '오늘', next: '다음', previous: '이전', noEventsInRange: '일정 없음' }}
        />
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { color: '#1565C0', fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #87CEEB' };
const addBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#555', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #87CEEB', fontSize: 13, boxSizing: 'border-box' };

const S = {
  back:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000 } as React.CSSProperties,
  box:       { background: '#fff', borderRadius: 14, padding: '24px 28px', width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' } as React.CSSProperties,
  title:     { color: '#1565C0', marginBottom: 16, fontSize: 16 } as React.CSSProperties,
  btnCancel: { padding: '8px 16px', borderRadius: 10, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 } as React.CSSProperties,
  btnSave:   { padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 } as React.CSSProperties,
};

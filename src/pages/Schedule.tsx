import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, addWeeks, addMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import api from '../api/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { FarmInfo, PlcInfo, PlcAddInfo, PlcCtrlInfo, ScheduleInfo, SequenceGrpInfo } from '../types';
import { AlertModal, ConfirmModal } from '../components/Modal';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { locale: ko }), getDay, locales: { ko } });

const GROUP_COLORS = ['#1565C0','#2e7d32','#6a1b9a','#e65100','#00838f','#ad1457','#37474f','#f57f17'];

function toLocalInputStr(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

interface EventItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: ScheduleInfo;
  color: string;
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

    const push = (start: Date) => {
      events.push({ id: `${s.id}-${start.getTime()}`, title: s.name, start, end: addDays(start, 0), resource: s, color });
    };

    if (s.repeat_type === 'none') { push(base); return; }
    let cur = base;
    while (cur <= rangeEnd) {
      push(cur);
      if (s.repeat_type === 'daily')   cur = addDays(cur, 1);
      else if (s.repeat_type === 'weekly')  cur = addWeeks(cur, 1);
      else if (s.repeat_type === 'monthly') cur = addMonths(cur, 1);
      else break;
    }
  });
  return events;
}

// ── 일정 팝업 ────────────────────────────────────────────────────
function ScheduleModal({ item, farms, plcs, plcAdds, ctrls, onSave, onDelete, onClose }: {
  item: ScheduleInfo | null;
  farms: FarmInfo[]; plcs: PlcInfo[]; plcAdds: PlcAddInfo[]; ctrls: PlcCtrlInfo[];
  onSave: (d: any) => void; onDelete?: () => void; onClose: () => void;
}) {
  const { register, handleSubmit, watch } = useForm<Record<string, any>>({
    defaultValues: item ? {
      ...item,
      exec_datetime: toLocalInputStr(new Date(item.exec_datetime)),
    } : { repeat_type: 'none', use: 'Y', is_sequence: 'N' },
  });
  const isSeq = watch('is_sequence');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ color: '#1565C0', marginBottom: 16, fontSize: 16 }}>{item ? '일정 수정' : '일정 추가'}</h3>
        <form onSubmit={handleSubmit(onSave)}>
          {item && <div style={{ marginBottom: 8, fontSize: 12, color: '#999' }}>ID: {item.id}</div>}
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>일정명</label>
            <input {...register('name')} type="text" style={inp} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>실행 일시</label>
            <input {...register('exec_datetime')} type="datetime-local" style={inp} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>일정 반복</label>
            <select {...register('repeat_type')} style={inp}>
              <option value="none">없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>시퀀스 여부</label>
            <select {...register('is_sequence')} style={inp}>
              <option value="N">일반</option>
              <option value="Y">시퀀스</option>
            </select>
          </div>

          {isSeq !== 'Y' && (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>농장 구역</label>
                <select {...register('farm_id')} style={inp}>
                  <option value="">선택</option>
                  {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>PLC</label>
                <select {...register('plc_id')} style={inp}>
                  <option value="">선택</option>
                  {plcs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>PLC Address</label>
                <select {...register('plc_add_id')} style={inp}>
                  <option value="">선택</option>
                  {plcAdds.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={lbl}>제어 정보</label>
                <select {...register('ctrl_id')} style={inp}>
                  <option value="">선택</option>
                  {ctrls.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>사용</label>
            <select {...register('use')} style={inp}>
              <option value="Y">사용</option>
              <option value="N">미사용</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            {item && onDelete && (
              <button type="button" onClick={onDelete}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: '#ffcdd2', color: '#c62828', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>삭제</button>
            )}
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>취소</button>
            <button type="submit" style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 시퀀스 팝업 ──────────────────────────────────────────────────
function SeqScheduleModal({ grps, onSave, onClose }: {
  grps: SequenceGrpInfo[];
  onSave: (d: any) => void; onClose: () => void;
}) {
  const { register, handleSubmit } = useForm<Record<string, any>>({ defaultValues: { repeat_type: 'none', use: 'Y', seq_grp_id: '', exec_datetime: '' } });
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 7000 }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 420, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ color: '#1565C0', marginBottom: 16, fontSize: 16 }}>시퀀스 일정 추가</h3>
        <form onSubmit={handleSubmit(onSave)}>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>시퀀스 그룹</label>
            <select {...register('seq_grp_id')} style={inp}>
              <option value="">선택</option>
              {grps.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>실행 일시</label>
            <input {...register('exec_datetime')} type="datetime-local" style={inp} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>일정 반복</label>
            <select {...register('repeat_type')} style={inp}>
              <option value="none">없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>사용</label>
            <select {...register('use')} style={inp}>
              <option value="Y">사용</option>
              <option value="N">미사용</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid #ccc', background: '#fff', cursor: 'pointer', fontSize: 13 }}>취소</button>
            <button type="submit" style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────
export default function Schedule() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<any>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [scheduleModal, setScheduleModal] = useState<ScheduleInfo | null | 'new'>(null);
  const [seqModal, setSeqModal] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState<number | ''>('');
  const [alert, setAlert] = useState('');
  const [confirmDel, setConfirmDel] = useState<ScheduleInfo | null>(null);

  const { data: schedules = [] } = useQuery<ScheduleInfo[]>({ queryKey: ['schedule'], queryFn: () => api.get('/api/schedule').then(r => r.data) });
  const { data: farms = [] } = useQuery<FarmInfo[]>({ queryKey: ['farm-info'], queryFn: () => api.get('/api/farm-info').then(r => r.data) });
  const { data: plcs = [] } = useQuery<PlcInfo[]>({ queryKey: ['plc-info'], queryFn: () => api.get('/api/plc-info').then(r => r.data) });
  const { data: plcAdds = [] } = useQuery<PlcAddInfo[]>({ queryKey: ['plc-add-info'], queryFn: () => api.get('/api/plc-add-info').then(r => r.data) });
  const { data: ctrls = [] } = useQuery<PlcCtrlInfo[]>({ queryKey: ['plc-ctrl-info'], queryFn: () => api.get('/api/plc-ctrl-info').then(r => r.data) });
  const { data: grps = [] } = useQuery<SequenceGrpInfo[]>({ queryKey: ['sequence-grp'], queryFn: () => api.get('/api/sequence-grp').then(r => r.data) });

  const saveMutation = useMutation({
    mutationFn: (d: any) => d.id ? api.patch(`/api/schedule/${d.id}`, d) : api.post('/api/schedule', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); setScheduleModal(null); setSeqModal(false); },
    onError: (e: any) => setAlert(e.response?.data?.message || '저장 실패'),
  });

  const delMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/schedule/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedule'] }); setScheduleModal(null); setConfirmDel(null); setAlert('삭제 완료'); },
  });

  const grpColorMap = useMemo(() => {
    const map = new Map<number, string>();
    grps.forEach((g, i) => map.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]));
    return map;
  }, [grps]);

  const filtered = selectedFarmId ? schedules.filter(s => s.farm_id === selectedFarmId) : schedules;
  const events = useMemo(() => expandEvents(filtered, grpColorMap), [filtered, grpColorMap]);

  const handleSaveSchedule = (form: any) => {
    saveMutation.mutate({ ...form, is_sequence: 'N', id: scheduleModal !== 'new' ? (scheduleModal as ScheduleInfo)?.id : undefined });
  };

  const handleSaveSeq = (form: any) => {
    saveMutation.mutate({ ...form, name: `시퀀스-${form.seq_grp_id}`, is_sequence: 'Y' });
  };

  if (!isManager) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#e53935' }}>접근 권한이 없습니다.</div>;
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmDel && (
        <ConfirmModal message={`"${confirmDel.name}" 일정을 삭제하시겠습니까?`}
          onConfirm={() => delMutation.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)} />
      )}
      {scheduleModal !== null && scheduleModal !== 'new' && (
        <ScheduleModal item={scheduleModal} farms={farms} plcs={plcs} plcAdds={plcAdds} ctrls={ctrls}
          onSave={handleSaveSchedule}
          onDelete={() => { setConfirmDel(scheduleModal as ScheduleInfo); setScheduleModal(null); }}
          onClose={() => setScheduleModal(null)} />
      )}
      {scheduleModal === 'new' && (
        <ScheduleModal item={null} farms={farms} plcs={plcs} plcAdds={plcAdds} ctrls={ctrls}
          onSave={handleSaveSchedule} onClose={() => setScheduleModal(null)} />
      )}
      {seqModal && <SeqScheduleModal grps={grps} onSave={handleSaveSeq} onClose={() => setSeqModal(false)} />}

      <h2 style={h2}>일정 관리</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value ? Number(e.target.value) : '')}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1.5px solid #87CEEB', fontSize: 13 }}>
          <option value="">전체 농장</option>
          {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <button onClick={() => setScheduleModal('new')} style={addBtn}>+ 일정 추가</button>
        <button onClick={() => setSeqModal(true)} style={{ ...addBtn, background: '#6a1b9a' }}>+ 시퀀스 추가</button>
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
          onSelectEvent={e => setScheduleModal(e.resource)}
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

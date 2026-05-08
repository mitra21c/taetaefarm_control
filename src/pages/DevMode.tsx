import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosInstance';
import { AlertModal } from '../components/Modal';

const WS_URL = process.env.REACT_APP_WS_URL ?? 'ws://localhost:3001';

function DbSection() {
  const [tables, setTables] = useState<string[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<any[] | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [alert, setAlert] = useState('');

  useEffect(() => {
    setLoadingTables(true);
    api.get('/api/dev/tables')
      .then(r => setTables(r.data))
      .catch(() => setAlert('테이블 목록 조회 실패'))
      .finally(() => setLoadingTables(false));
  }, []);

  const fetchTable = async (name: string) => {
    if (selected === name && rows !== null) { setSelected(null); setRows(null); return; }
    setSelected(name);
    setLoadingRows(true);
    setRows(null);
    try {
      const { data } = await api.get(`/api/dev/table/${name}`);
      setRows(data);
    } catch (e: any) { setAlert(e.response?.data?.message || '조회 실패'); setSelected(null); }
    finally { setLoadingRows(false); }
  };

  const cols = rows && rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div style={sec}>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      <h3 style={sh3}>DB 조회</h3>

      {loadingTables ? (
        <p style={{ fontSize: 13, color: '#888' }}>테이블 목록 로딩 중...</p>
      ) : tables.length === 0 ? (
        <p style={{ fontSize: 13, color: '#aaa' }}>테이블 없음</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {tables.map(t => (
            <button
              key={t}
              onClick={() => fetchTable(t)}
              disabled={loadingRows}
              style={{
                ...btnP,
                background: selected === t ? '#0d47a1' : '#1565C0',
                outline: selected === t ? '2px solid #90caf9' : 'none',
                outlineOffset: 2,
                opacity: loadingRows && selected !== t ? 0.55 : 1,
                fontSize: 12,
                padding: '6px 14px',
              }}
            >
              {selected === t && loadingRows ? '조회 중...' : t}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div style={{ border: '1px solid #d0e8f8', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#e3f2fd' }}>
            <span style={{ color: '#1565C0', fontWeight: 700, fontSize: 13 }}>
              {selected}
              {rows && (
                <span style={{ fontWeight: 400, fontSize: 12, color: '#888', marginLeft: 10 }}>
                  {rows.length}행{rows.length === 500 ? ' (최대 500)' : ''}
                </span>
              )}
            </span>
            <button onClick={() => { setSelected(null); setRows(null); }} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#78909c' }}>✕</button>
          </div>

          {loadingRows ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: 13 }}>조회 중...</div>
          ) : rows && rows.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>데이터 없음</div>
          ) : rows ? (
            <div style={{ overflow: 'auto', maxHeight: 420 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ ...mth, background: '#b0bec5', color: '#37474f', position: 'sticky', top: 0 }}>#</th>
                    {cols.map(c => <th key={c} style={{ ...mth, position: 'sticky', top: 0 }}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f5faff' }}>
                      <td style={{ ...mtd, color: '#bbb', textAlign: 'right', userSelect: 'none' }}>{i + 1}</td>
                      {cols.map(c => (
                        <td key={c} style={mtd}>
                          {row[c] == null
                            ? <span style={{ color: '#ccc' }}>NULL</span>
                            : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SmsSection() {
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true); setStatus('');
    try {
      const { data } = await api.post('/api/sms/send', { to, text });
      setStatus(`✅ ${data.message}`);
    } catch (e: any) { setStatus(`❌ ${e.response?.data?.message || '실패'}`); }
    finally { setLoading(false); }
  };

  return (
    <div style={sec}>
      <h3 style={sh3}>문자 메시지 전송 테스트</h3>
      <label style={lbl}>수신인 연락처</label>
      <input value={to} onChange={e => setTo(e.target.value)} placeholder="010-0000-0000" style={inp} />
      <label style={lbl}>메시지 내용</label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
      <button onClick={send} disabled={loading} style={{ ...btnP, marginTop: 8 }}>{loading ? '전송 중...' : '전송'}</button>
      {status && <p style={{ marginTop: 8, fontSize: 13, color: status.startsWith('✅') ? '#2e7d32' : '#e53935' }}>{status}</p>}
    </div>
  );
}

function NoticeSection() {
  const [text, setText] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const sendAll = async () => {
    setLoading(true); setStatus(''); setHistory([]);
    try {
      const { data } = await api.post('/api/sms/send-all', { text });
      setHistory(data.history || []);
      setStatus(`✅ ${data.history?.length ?? 0}명에게 전송 완료`);
    } catch (e: any) { setStatus(`❌ ${e.response?.data?.message || '실패'}`); }
    finally { setLoading(false); }
  };

  return (
    <div style={sec}>
      <h3 style={sh3}>공지 메시지 전송</h3>
      <label style={lbl}>메시지 내용</label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="전체 회원 공지" />
      <button onClick={sendAll} disabled={loading} style={{ ...btnP, marginTop: 8 }}>{loading ? '전송 중...' : '전체 회원 전송'}</button>
      {status && <p style={{ marginTop: 8, fontSize: 13, color: status.startsWith('✅') ? '#2e7d32' : '#e53935' }}>{status}</p>}
      {history.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4 style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>전송 이력</h4>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr><th style={mth}>순번</th><th style={mth}>성명</th><th style={mth}>연락처</th></tr></thead>
            <tbody>{history.map((u, i) => <tr key={u.id}><td style={mtd}>{i+1}</td><td style={mtd}>{u.name}</td><td style={mtd}>{u.phone}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SocketSection() {
  const [ip, setIp] = useState('192.168.0.45');
  const [port, setPort] = useState('9000');
  const [connected, setConnected] = useState(false);
  const [sendData, setSendData] = useState('');
  const [log, setLog] = useState<{ time: string; msg: string; type: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const addLog = useCallback((msg: string, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLog(prev => [...prev, { time, msg, type }]);
  }, []);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);

  const connect = () => {
    if (connected) {
      wsRef.current?.send(JSON.stringify({ type: 'disconnect' }));
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      addLog('연결 해제됨', 'warn');
      return;
    }
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ type: 'connect', ip, port: Number(port) })); };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'connected') { setConnected(true); addLog(`✅ 연결 완료 (${m.ip}:${m.port})`, 'success'); }
      else if (m.type === 'disconnected') { setConnected(false); addLog('연결 종료', 'warn'); }
      else if (m.type === 'data') { addLog(`← 수신: ${m.data}`, 'recv'); }
      else if (m.type === 'error') { setConnected(false); addLog(`❌ 오류: ${m.message}`, 'error'); }
    };
    ws.onclose = () => { setConnected(false); wsRef.current = null; };
    ws.onerror = () => addLog('WebSocket 연결 오류', 'error');
  };

  const sendMsg = () => {
    if (!connected || !wsRef.current || !sendData) return;
    wsRef.current.send(JSON.stringify({ type: 'send', data: sendData }));
    addLog(`→ 전송: ${sendData}`, 'send');
    setSendData('');
  };

  const logColor: Record<string, string> = { info: '#555', success: '#2e7d32', error: '#e53935', warn: '#e65100', send: '#1565C0', recv: '#6a1b9a' };

  return (
    <div style={sec}>
      <h3 style={sh3}>소켓 통신 테스트</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
        <div><label style={lbl}>IP</label><input value={ip} onChange={e => setIp(e.target.value)} disabled={connected} style={{ ...inp, width: 160 }} /></div>
        <div><label style={lbl}>Port</label><input value={port} onChange={e => setPort(e.target.value)} disabled={connected} style={{ ...inp, width: 80 }} /></div>
        <button onClick={connect} style={{ ...btnP, background: connected ? '#e53935' : '#1565C0' }}>{connected ? '연결 해제' : '연결'}</button>
        <span style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${connected ? '#2e7d32' : '#ccc'}`, color: connected ? '#2e7d32' : '#999', fontSize: 13, fontWeight: 600 }}>
          {connected ? '● 연결됨' : '○ 미연결'}
        </span>
      </div>
      <div ref={logRef} style={{ background: '#f5f5f5', borderRadius: 8, padding: 10, height: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, marginBottom: 10, border: '1px solid #e0e0e0' }}>
        {log.length === 0 ? <span style={{ color: '#bbb' }}>로그 없음</span> :
          log.map((l, i) => <div key={i} style={{ color: logColor[l.type] || '#555' }}><span style={{ color: '#bbb' }}>[{l.time}]</span> {l.msg}</div>)}
      </div>
      <label style={lbl}>전송 데이터</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={sendData} onChange={e => setSendData(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMsg(); }}
          disabled={!connected} placeholder={connected ? 'Enter로 전송' : '연결 후 사용'} style={{ ...inp, flex: 1 }} />
        <button onClick={sendMsg} disabled={!connected} style={{ ...btnP, opacity: connected ? 1 : 0.4 }}>전송</button>
      </div>
    </div>
  );
}

export default function DevMode() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const TABS = [{ label: 'DB 조회', C: DbSection }, { label: 'SMS 테스트', C: SmsSection }, { label: '공지 전송', C: NoticeSection }, { label: '소켓 테스트', C: SocketSection }];
  const ActiveTab = TABS[tab].C;

  if (!isAdmin) {
    return <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: '#e53935' }}>관리자만 접근 가능합니다.</p>
      <button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer' }}>홈으로</button>
    </div>;
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <h2 style={h2}>개발자 모드</h2>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #87CEEB' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{ padding: '8px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', background: tab === i ? '#1565C0' : '#e3f2fd', color: tab === i ? '#fff' : '#1565C0', fontWeight: tab === i ? 700 : 500, fontSize: 13 }}>{t.label}</button>
        ))}
      </div>
      <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', padding: 16, border: '1px solid #e3f2fd' }}>
        <ActiveTab />
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { color: '#1565C0', fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #87CEEB' };
const sec: React.CSSProperties = {};
const sh3: React.CSSProperties = { color: '#1565C0', fontSize: 15, fontWeight: 600, marginBottom: 14, paddingBottom: 6, borderBottom: '1px solid #e3f2fd' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: '#555', marginBottom: 4, marginTop: 8 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #87CEEB', fontSize: 13, boxSizing: 'border-box' };
const btnP: React.CSSProperties = { padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000 };
const popBox: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 20, width: '95vw', maxWidth: 1100, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' };
const mth: React.CSSProperties = { padding: '5px 12px', background: '#e3f2fd', color: '#1565C0', fontWeight: 600, textAlign: 'left' };
const mtd: React.CSSProperties = { padding: '5px 12px', borderBottom: '1px solid #f0f0f0' };

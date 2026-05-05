import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import api from '../api/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import { AlertModal, ConfirmModal } from '../components/Modal';

type SortKey = keyof User;

export default function Members() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortAsc, setSortAsc] = useState(true);
  const [alert, setAlert] = useState('');
  const [confirmDel, setConfirmDel] = useState<User | null>(null);
  const [editRow, setEditRow] = useState<{ [id: number]: Partial<User> }>({});

  const { data: users = [], refetch } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/api/users').then(r => r.data),
    enabled: isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => api.patch(`/api/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setAlert('수정 완료'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '수정 실패'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setConfirmDel(null); setAlert('삭제 완료'); },
    onError: (e: any) => setAlert(e.response?.data?.message || '삭제 실패'),
  });

  const sortedFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return [...users]
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q))
      .sort((a, b) => {
        const va = String(a[sortKey] ?? '');
        const vb = String(b[sortKey] ?? '');
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }, [users, search, sortKey, sortAsc]);

  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#e53935', fontSize: 16 }}>관리자만 접근 가능합니다.</p>
        <button onClick={() => navigate('/')} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer' }}>홈으로</button>
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const getEdit = (u: User) => editRow[u.id] ?? {};
  const setEdit = (u: User, patch: Partial<User>) =>
    setEditRow(prev => ({ ...prev, [u.id]: { ...getEdit(u), ...patch } }));

  const handleUpdate = (u: User) => {
    const changes = getEdit(u);
    if (!Object.keys(changes).length) { setAlert('변경된 내용이 없습니다.'); return; }
    updateMutation.mutate({ id: u.id, data: changes });
    setEditRow(prev => { const n = { ...prev }; delete n[u.id]; return n; });
  };

  const exportExcel = () => {
    const rows = sortedFiltered.map((u, i) => ({
      순번: i + 1, 이름: u.name, 전화번호: u.phone, 이메일: u.email,
      권한: u.role, 승인: u.use,
      생성일: u.created_at?.slice(0, 10), 수정일: u.modified_at?.slice(0, 10),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '회원정보');
    XLSX.writeFile(wb, '태태농장_회원정보.xlsx');
  };

  const SortBtn = ({ col }: { col: SortKey }) => (
    <span style={{ cursor: 'pointer', marginLeft: 4, fontSize: 10 }}
      onClick={() => handleSort(col)}>
      {sortKey === col ? (sortAsc ? '▲' : '▼') : '⇅'}
    </span>
  );

  return (
    <div style={{ padding: '16px 20px', margin: '0 20px' }}>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      {confirmDel && (
        <ConfirmModal message={`"${confirmDel.name}"을 삭제하시겠습니까?`}
          onConfirm={() => deleteMutation.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)} />
      )}

      <h2 style={h2}>회원 정보</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름/이메일/전화번호 검색..." style={searchInput} />
        <button onClick={() => refetch()} style={btnPrimary}>새로고침</button>
        <button onClick={exportExcel} style={{ ...btnPrimary, background: '#2e7d32' }}>엑셀 다운로드</button>
        <span style={{ fontSize: 13, color: '#666' }}>총 {sortedFiltered.length}명</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr style={{ background: '#e3f2fd' }}>
              <th style={th}>순번</th>
              <th style={th}>이름<SortBtn col="name" /></th>
              <th style={th}>전화번호<SortBtn col="phone" /></th>
              <th style={th}>E-Mail<SortBtn col="email" /></th>
              <th style={th}>권한<SortBtn col="role" /></th>
              <th style={th}>승인</th>
              <th style={th}>생성일/수정일</th>
              <th style={th}>수정</th>
              <th style={th}>삭제</th>
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((u, i) => {
              const ed = getEdit(u);
              const isAdmin_ = u.role === 'admin';
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{u.name}</td>
                  <td style={td}>{u.phone}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>
                    {isAdmin_ ? (
                      <span style={{ fontSize: 12, color: '#1565C0', fontWeight: 700 }}>admin</span>
                    ) : (
                      <select value={ed.role ?? u.role} onChange={e => setEdit(u, { role: e.target.value as any })} style={selectSt}>
                        <option value="manager">manager</option>
                        <option value="user">user</option>
                      </select>
                    )}
                  </td>
                  <td style={td}>
                    {isAdmin_ ? (
                      <span style={{ fontSize: 12, color: '#2e7d32', fontWeight: 700 }}>Y</span>
                    ) : (
                      <select value={ed.use ?? u.use} onChange={e => setEdit(u, { use: e.target.value as any })} style={selectSt}>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    )}
                  </td>
                  <td style={{ ...td, fontSize: 11, lineHeight: 1.6 }}>
                    {u.created_at?.slice(0, 16)}<br />{u.modified_at?.slice(0, 16)}
                  </td>
                  <td style={td}>
                    {!isAdmin_ && (
                      <button onClick={() => handleUpdate(u)}
                        style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#87CEEB', color: '#1565C0', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        수정
                      </button>
                    )}
                  </td>
                  <td style={td}>
                    {!isAdmin_ && (
                      <button onClick={() => setConfirmDel(u)}
                        style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: '#ffcdd2', color: '#c62828', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const h2: React.CSSProperties = { color: '#1565C0', fontSize: 20, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #87CEEB' };
const th: React.CSSProperties = { padding: '9px 10px', color: '#1565C0', fontWeight: 600, fontSize: 13, textAlign: 'left', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '7px 10px', fontSize: 13, verticalAlign: 'middle' };
const searchInput: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #87CEEB', fontSize: 13, width: 260 };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, border: 'none', background: '#1565C0', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 };
const selectSt: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, border: '1px solid #87CEEB', fontSize: 12 };

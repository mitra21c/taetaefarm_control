import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { AlertModal } from '../components/Modal';

interface LoginForm { email: string; password: string; }

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [alert, setAlert] = useState('');

  const mutation = useMutation({
    mutationFn: (data: LoginForm) => api.post('/api/auth/login', data).then(r => r.data),
    onSuccess: data => {
      login(data.user, data.accessToken, data.refreshToken);
      navigate('/');
    },
    onError: (err: any) => setAlert(err.response?.data?.message || '로그인 실패'),
  });

  return (
    <div style={pageStyle}>
      {alert && <AlertModal message={alert} onClose={() => setAlert('')} />}
      <div style={cardStyle}>
        <img src="https://mitra21c.github.io/data/images/taetaefarm/taetaefarm/icon.png"
          alt="태태농장" style={{ height: 64, marginBottom: 8, objectFit: 'contain' }} />
        <h2 style={{ color: '#1565C0', marginBottom: 24, fontSize: 20 }}>태태농장 로그인</h2>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} style={{ width: '100%' }}>
          <label style={labelStyle}>이메일</label>
          <input {...register('email', { required: '이메일을 입력해 주세요.' })}
            type="email" placeholder="이메일" style={inputStyle} />
          {errors.email && <p style={errStyle}>{errors.email.message}</p>}

          <label style={labelStyle}>비밀번호</label>
          <input {...register('password', { required: '비밀번호를 입력해 주세요.' })}
            type="password" placeholder="비밀번호" style={inputStyle} />
          {errors.password && <p style={errStyle}>{errors.password.message}</p>}

          <button type="submit" disabled={mutation.isPending} style={submitBtn}>
            {mutation.isPending ? '로그인 중...' : '로그인'}
          </button>
        </form>
        <p style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
          계정이 없으신가요?{' '}
          <Link to="/register" style={{ color: '#1565C0', fontWeight: 600 }}>회원 가입</Link>
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(135deg,#e0f4ff 0%,#fff 100%)', padding: 20,
};
const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '36px 40px', width: 360,
  boxShadow: '0 8px 32px rgba(21,101,192,0.15)', display: 'flex',
  flexDirection: 'column', alignItems: 'center',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #87CEEB', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
};
const errStyle: React.CSSProperties = { color: '#e53935', fontSize: 12, margin: '4px 0 0' };
const submitBtn: React.CSSProperties = {
  width: '100%', padding: '12px', marginTop: 20, borderRadius: 10,
  border: 'none', backgroundColor: '#1565C0', color: '#fff',
  fontWeight: 700, fontSize: 15, cursor: 'pointer',
};

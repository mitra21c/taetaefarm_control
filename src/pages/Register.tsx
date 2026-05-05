import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import { AlertModal } from '../components/Modal';

interface RegForm {
  name: string; phone: string; email: string;
  password: string; passwordConfirm: string; referrer?: string;
}

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors, isValid } } = useForm<RegForm>({ mode: 'onChange' });
  const navigate = useNavigate();
  const [alert, setAlert] = useState('');
  const [alertCb, setAlertCb] = useState<(() => void) | null>(null);
  const [phoneChecked, setPhoneChecked] = useState(false);

  const phone = watch('phone');

  const checkPhone = async () => {
    if (!phone) return;
    try {
      const { data } = await api.post('/api/auth/check-duplicate', { phone });
      if (data.isDuplicate) {
        setAlert('이미 등록 되어 있는 사용자 입니다. 관리자에게 문의 하세요');
        setPhoneChecked(false);
      } else {
        setAlert('등록 가능합니다.');
        setPhoneChecked(true);
      }
    } catch { setAlert('확인 중 오류가 발생했습니다.'); }
  };

  const registerMutation = useMutation({
    mutationFn: (form: RegForm) =>
      api.post('/api/auth/register', {
        name: form.name, phone: form.phone,
        email: form.email, password: form.password,
      }).then(r => r.data),
    onSuccess: async (_, form) => {
      try {
        await api.post('/api/sms/send', {
          to: '01052570412',
          text: `신규 회원 가입\n성명 : ${form.name}\n연락처 : ${form.phone}\n추천인 성명 : ${form.referrer || '없음'}`,
        });
      } catch {
        setAlert('회원 가입은 완료되었으나 관리자 SMS 전송에 실패했습니다.');
      }
      setAlert('정상적으로 입력이 되었습니다.');
      setAlertCb(() => () => navigate('/login'));
    },
    onError: (err: any) => setAlert(err.response?.data?.message || '에러가 발생하였습니다. 관리자에게 문의 하세요'),
  });

  const handleClose = () => {
    setAlert('');
    if (alertCb) { alertCb(); setAlertCb(null); }
  };

  const onSubmit = (form: RegForm) => {
    if (!phoneChecked) { setAlert('개인정보 확인을 먼저 해주세요.'); return; }
    if (form.password !== form.passwordConfirm) { setAlert('비밀번호가 일치하지 않습니다.'); return; }
    registerMutation.mutate(form);
  };

  return (
    <div style={pageStyle}>
      {alert && <AlertModal message={alert} onClose={handleClose} />}
      <div style={cardStyle}>
        <img src="https://mitra21c.github.io/data/images/taetaefarm/taetaefarm/icon.png"
          alt="태태농장" style={{ height: 56, marginBottom: 8, objectFit: 'contain' }} />
        <h2 style={{ color: '#1565C0', marginBottom: 20, fontSize: 20 }}>회원 가입</h2>
        <form onSubmit={handleSubmit(onSubmit)} style={{ width: '100%' }}>

          <label style={labelStyle}>이름</label>
          <input {...register('name', { required: '이름을 입력해 주세요.' })}
            placeholder="이름" style={inputStyle} />
          {errors.name && <p style={errStyle}>{errors.name.message}</p>}

          <label style={labelStyle}>전화번호</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input {...register('phone', { required: '전화번호를 입력해 주세요.' })}
              placeholder="010-0000-0000" style={{ ...inputStyle, flex: 1 }} />
            <button type="button" onClick={checkPhone} style={smBtn}>개인정보 확인</button>
          </div>
          {errors.phone && <p style={errStyle}>{errors.phone.message}</p>}

          <label style={labelStyle}>이메일</label>
          <input {...register('email', { required: '이메일을 입력해 주세요.', pattern: { value: /\S+@\S+\.\S+/, message: '올바른 이메일을 입력해 주세요.' } })}
            type="email" placeholder="이메일" style={inputStyle} />
          {errors.email && <p style={errStyle}>{errors.email.message}</p>}

          <label style={labelStyle}>비밀번호</label>
          <input {...register('password', { required: '비밀번호를 입력해 주세요.', minLength: { value: 6, message: '6자 이상 입력해 주세요.' } })}
            type="password" placeholder="비밀번호" style={inputStyle} />
          {errors.password && <p style={errStyle}>{errors.password.message}</p>}

          <label style={labelStyle}>비밀번호 확인</label>
          <input {...register('passwordConfirm', { required: '비밀번호 확인을 입력해 주세요.' })}
            type="password" placeholder="비밀번호 확인" style={inputStyle} />
          {errors.passwordConfirm && <p style={errStyle}>{errors.passwordConfirm.message}</p>}

          <label style={labelStyle}>추천인 성명 (선택)</label>
          <input {...register('referrer')} placeholder="추천인 성명" style={inputStyle} />

          <button type="submit"
            disabled={!isValid || !phoneChecked || registerMutation.isPending}
            style={{ ...submitBtn, opacity: (!isValid || !phoneChecked) ? 0.5 : 1 }}>
            {registerMutation.isPending ? '등록 중...' : '회원 가입'}
          </button>
        </form>
        <p style={{ marginTop: 14, fontSize: 13, color: '#666' }}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" style={{ color: '#1565C0', fontWeight: 600 }}>로그인</Link>
        </p>
        <p style={{ marginTop: 8, fontSize: 12, color: '#999', textAlign: 'center' }}>
          회원 가입 후 관리자 승인이 필요합니다.
        </p>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '60vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
  background: 'linear-gradient(135deg,#e0f4ff 0%,#fff 100%)', padding: '30px 20px',
};
const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: '32px 40px', width: 400,
  boxShadow: '0 8px 32px rgba(21,101,192,0.15)', display: 'flex',
  flexDirection: 'column', alignItems: 'center',
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1.5px solid #87CEEB', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const errStyle: React.CSSProperties = { color: '#e53935', fontSize: 12, margin: '4px 0 0' };
const submitBtn: React.CSSProperties = {
  width: '100%', padding: '12px', marginTop: 20, borderRadius: 10,
  border: 'none', backgroundColor: '#1565C0', color: '#fff',
  fontWeight: 700, fontSize: 15, cursor: 'pointer',
};
const smBtn: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10, border: 'none',
  backgroundColor: '#87CEEB', color: '#1565C0', fontWeight: 600,
  cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap',
};

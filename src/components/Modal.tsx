import React from 'react';

interface Props {
  title?: string;
  message: string;
  onClose: () => void;
}

export function AlertModal({ title, message, onClose }: Props) {
  return (
    <div style={overlay}>
      <div style={box}>
        {title && <h3 style={{ color: '#1565C0', marginBottom: 12, fontSize: 16 }}>{title}</h3>}
        <p style={{ fontSize: 14, color: '#333', marginBottom: 20, whiteSpace: 'pre-line' }}>{message}</p>
        <button onClick={onClose} style={btn}>확인</button>
      </div>
    </div>
  );
}

interface ConfirmProps {
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmProps) {
  return (
    <div style={overlay}>
      <div style={box}>
        {title && <h3 style={{ color: '#1565C0', marginBottom: 12, fontSize: 16 }}>{title}</h3>}
        <p style={{ fontSize: 14, color: '#333', marginBottom: 20, whiteSpace: 'pre-line' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ ...btn, background: '#aaa' }}>취소</button>
          <button onClick={onConfirm} style={btn}>확인</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000,
};

const box: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '24px 28px',
  minWidth: 300, maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};

const btn: React.CSSProperties = {
  padding: '8px 24px', borderRadius: 10, border: 'none',
  backgroundColor: '#1565C0', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14,
};

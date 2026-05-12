import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import MenuBar from './components/MenuBar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import FarmStatus from './pages/FarmStatus';
import ControlInfo from './pages/ControlInfo';
import Schedule from './pages/Schedule';
import Monitoring from './pages/Monitoring';
import Members from './pages/Members';
import DevMode from './pages/DevMode';
import CropPrice from './pages/CropPrice';
import Order from './pages/Order';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
    mutations: { retry: 0 },
  },
});

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f0f8ff' }}>
      <Header />
      <MenuBar />
      <main style={{ flex: 1, padding: 0 }}>{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/farm-status" element={<Layout><FarmStatus /></Layout>} />
            <Route path="/control"     element={<Layout><ControlInfo /></Layout>} />
            <Route path="/schedule"    element={<Layout><Schedule /></Layout>} />
            <Route path="/monitoring"  element={<Layout><Monitoring /></Layout>} />
            <Route path="/order"       element={<Layout><Order /></Layout>} />
            <Route path="/crop-price"  element={<Layout><CropPrice /></Layout>} />
            <Route path="/members"     element={<Layout><Members /></Layout>} />
            <Route path="/dev"         element={<Layout><DevMode /></Layout>} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

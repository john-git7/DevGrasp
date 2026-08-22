import { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Home from './pages/Home';
import ChatApp from './pages/ChatApp';
import Login from './pages/Login';
import Signup from './pages/Signup';

export default function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-apple-bg)] text-[var(--color-apple-text)]">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={<Home />} 
      />
      <Route 
        path="/login" 
        element={user ? <Navigate to="/chat" replace /> : <Login />} 
      />
      <Route 
        path="/register" 
        element={user ? <Navigate to="/chat" replace /> : <Signup />} 
      />
      <Route 
        path="/chat" 
        element={user ? <ChatApp /> : <Navigate to="/login" replace />} 
      />
    </Routes>
  );
}

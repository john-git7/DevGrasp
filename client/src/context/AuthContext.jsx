import { createContext, useState, useEffect } from 'react';
import api from '../lib/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchUser();
    } else {
      localStorage.removeItem('token');
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await api.get('/api/auth/me');
      if (res.status === 200) {
        setUser(res.data.user);
      } else {
        setToken(null);
      }
    } catch (err) {
      console.error(err);
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const res = await api.post('/api/auth/login', { email, password });
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message);
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await api.post('/api/auth/register', { name, email, password });
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      throw new Error(err.response?.data?.error || err.message);
    }
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

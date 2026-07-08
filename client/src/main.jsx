import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import App from './App.jsx'

// Global fetch interceptor to inject the JWT token on all backend requests
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  // Only intercept requests going to our API backend
  if (typeof resource === 'string' && resource.startsWith(import.meta.env.VITE_API_URL)) {
    const token = localStorage.getItem('token');
    config = config || {};
    config.headers = {
      ...config.headers,
    };
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return originalFetch(resource, config);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

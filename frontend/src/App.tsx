import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Servers from './pages/Servers';
import Marketplace from './pages/Marketplace';
import ApiKeys from './pages/ApiKeys';
import Groups from './pages/Groups';

function App() {
  const { isAuthenticated, login } = useAuthStore();

  // 앱 시작 시 localStorage에서 인증 상태 복원
  useEffect(() => {
    const authData = localStorage.getItem('auth-storage');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        const state = parsed.state ?? parsed;
        if (state.isAuthenticated && state.user && state.token) {
          console.log('앱 시작 시 인증 상태 복원:', state);
          login(state.user, state.token);
        }
      } catch (error) {
        console.error('인증 상태 복원 실패:', error);
        localStorage.removeItem('auth-storage');
      }
    }
  }, [login]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />} 
          />
          <Route 
            path="/dashboard" 
            element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/servers" 
            element={isAuthenticated ? <Servers /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/marketplace" 
            element={isAuthenticated ? <Marketplace /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/api-keys" 
            element={isAuthenticated ? <ApiKeys /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/groups" 
            element={isAuthenticated ? <Groups /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/" 
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;


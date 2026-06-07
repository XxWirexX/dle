import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Library from './pages/Library';
import AnimeDetail from './pages/AnimeDetail';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import { ReactNode } from 'react';

function Protected({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Navbar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  if (!user) return null;
  const isActive = (p: string) => (loc.pathname === p ? 'active' : '');
  return (
    <nav className="nav">
      <Link to="/" className="brand">🎬 Suivi d'anime</Link>
      <div className="nav-links">
        <Link className={isActive('/')} to="/">Bibliothèque</Link>
        {user.role === 'admin' && <Link className={isActive('/dashboard')} to="/dashboard">Suivi</Link>}
        {user.role === 'admin' && <Link className={isActive('/admin')} to="/admin">Gérer</Link>}
      </div>
      <div className="nav-right">
        <span className="muted">{user.username} · {user.role === 'admin' ? 'admin' : 'spectateur'}</span>
        <button className="btn ghost" onClick={logout}>Déconnexion</button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Library /></Protected>} />
          <Route path="/anime/:id" element={<Protected><AnimeDetail /></Protected>} />
          <Route path="/dashboard" element={<Protected adminOnly><Dashboard /></Protected>} />
          <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

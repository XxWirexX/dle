import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      nav('/');
    } catch (err: any) {
      setError(err.message || 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={onSubmit}>
        <h1>🎬 Suivi d'anime</h1>
        <p className="muted">Connecte-toi pour continuer.</p>
        <label>Identifiant
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label>Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? '…' : 'Se connecter'}</button>
      </form>
    </div>
  );
}

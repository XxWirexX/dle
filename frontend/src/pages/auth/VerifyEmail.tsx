import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import useTitle from '../../hooks/useTitle';
import authService from '../../services/authService.js';
import './Auth.css';

export default function VerifyEmail() {
  useTitle('Vérification email');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token manquant');
      return;
    }

    authService.verifyEmail(token)
      .then(data => {
        setStatus('success');
        setMessage(data.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message || 'Erreur de connexion');
      });
  }, [searchParams]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Verification Email</h1>

        {status === 'loading' && (
          <div className="auth-message"><p>Verification en cours...</p></div>
        )}
        {status === 'success' && (
          <div className="auth-message success">
            <p>{message}</p>
            <Link to="/login" className="auth-btn">Se connecter</Link>
          </div>
        )}
        {status === 'error' && (
          <div className="auth-message error">
            <p>{message}</p>
            <Link to="/login" className="auth-btn">Retour a la connexion</Link>
          </div>
        )}
      </div>
    </div>
  );
}

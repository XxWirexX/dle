import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useTitle from '../hooks/useTitle';
import useStats from '../hooks/useStats';
import customDleService from '../services/customDleService';
import type { CustomDleDetail } from '../types/customDle';
import { AttributeType } from '../constants/enums';
import './Detail.css';
import './CustomDetail.css';

export default function CustomDetail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [dle, setDle] = useState<CustomDleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { stats } = useStats(id);
  useTitle(dle?.name ?? null);

  useEffect(() => {
    if (!id) return;
    customDleService.getDetail(id)
      .then((data) => { setDle(data); setLoading(false); })
      .catch((e) => { setError(e.message || 'Erreur'); setLoading(false); });
  }, [id]);

  async function handleCopyLink() {
    try {
      const url = `${window.location.origin}/custom/${id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm('Supprimer ce DLE définitivement ? Cette action est irréversible.')) return;
    setDeleting(true);
    try {
      await customDleService.delete(id);
      navigate('/');
    } catch (e: any) {
      setError(e.message || 'Erreur suppression');
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="detail-container"><div className="detail-loading">Chargement...</div></div>;
  }

  if (error || !dle) {
    return (
      <div className="detail-container">
        <div className="detail-error">
          <h2>DLE introuvable</h2>
          <p>{error || 'Le DLE demandé n\'existe pas ou n\'est plus accessible.'}</p>
          <Link to="/" className="back-home-btn">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  const bgStyle = dle.backgroundUrl ? { backgroundImage: `url(${dle.backgroundUrl})` } : {};

  return (
    <div className="detail-container" style={bgStyle}>
      <div className="detail-overlay">
        <div className="detail-nav">
          <Link to="/" className="back-home-btn">← Accueil</Link>
          <div className="cdetail-nav-actions">
            <button className={`cdetail-share ${copied ? 'copied' : ''}`} onClick={handleCopyLink}>
              {copied ? '✓ Lien copié' : '🔗 Partager le lien'}
            </button>
            {dle.isOwner && (
              <>
                <Link to={`/custom/${dle.id}/edit`} className="cdetail-edit">✎ Modifier</Link>
                <button className="cdetail-delete" onClick={handleDelete} disabled={deleting}>
                  {deleting ? '...' : '🗑 Supprimer'}
                </button>
              </>
            )}
          </div>
        </div>

        <header className="detail-header">
          {dle.iconUrl && (
            <div className="detail-icon">
              <img src={dle.iconUrl} alt={dle.name} />
            </div>
          )}
          <div className="detail-title-section">
            <div className="cdetail-title-row">
              <h1 className="detail-title">{dle.name}</h1>
              <span className={`cdetail-badge-vis vis-${dle.visibility}`}>
                {dle.visibility === 'private' && '🔒 Privé'}
                {dle.visibility === 'unlisted' && '🔗 Non listé'}
                {dle.visibility === 'public' && '🌍 Public'}
              </span>
            </div>
            {dle.ownerUsername && (
              <p className="cdetail-owner">par <strong>@{dle.ownerUsername}</strong></p>
            )}
            <div className="detail-stats">
              <div className="stat-badge">
                <span className="stat-number">{dle.characterCount}</span>
                <span className="stat-label">Personnages</span>
              </div>
              <div className="stat-badge">
                <span className="stat-number">{dle.attributeCount}</span>
                <span className="stat-label">Attributs</span>
              </div>
              <div className="stat-badge">
                <span className="stat-number">{dle.maxAttempts}</span>
                <span className="stat-label">Essais max</span>
              </div>
            </div>
          </div>
        </header>

        {user && stats && stats.played > 0 && (
          <section className="detail-section">
            <h2 className="section-title">Mes stats</h2>
            <div className="cdetail-userstats">
              <div className="cdetail-userstat"><span className="val">{stats.played}</span><span className="lbl">Parties</span></div>
              <div className="cdetail-userstat"><span className="val">{stats.wins}</span><span className="lbl">Victoires</span></div>
              <div className="cdetail-userstat"><span className="val">{Math.round((stats.wins / stats.played) * 100)}%</span><span className="lbl">Win rate</span></div>
              <div className="cdetail-userstat"><span className="val">{stats.streak}</span><span className="lbl">Streak</span></div>
              <div className="cdetail-userstat"><span className="val">{stats.maxStreak}</span><span className="lbl">Meilleure</span></div>
            </div>
          </section>
        )}

        <section className="detail-section">
          <h2 className="section-title">Modes de jeu</h2>
          <div className="game-modes">
            <Link to={`/custom/${dle.id}/play`} className="mode-card solo">
              <div className="mode-icon">S</div>
              <div className="mode-info">
                <h3>Solo</h3>
                <p>Trouve le personnage mystère en utilisant les indices</p>
              </div>
              <div className="mode-arrow">→</div>
            </Link>
            <Link to={`/custom/${dle.id}/play?mode=daily`} className="mode-card daily">
              <div className="mode-icon">★</div>
              <div className="mode-info">
                <h3>Défi du jour</h3>
                <p>Un personnage identique pour tous, renouvelé chaque jour</p>
              </div>
              <div className="mode-arrow">→</div>
            </Link>
            <Link
              to={`/custom/${dle.id}/play?mode=duo`}
              className={`mode-card duo ${!user && !authLoading ? 'requires-login' : ''}`}
            >
              <div className="mode-icon">2</div>
              <div className="mode-info">
                <h3>Duo</h3>
                <p>Affronte un autre joueur en temps réel</p>
                {!user && !authLoading && <span className="login-hint">Connexion requise</span>}
              </div>
              <div className="mode-arrow">→</div>
            </Link>
          </div>
        </section>

        <section className="detail-section">
          <h2 className="section-title">Attributs du jeu</h2>
          <div className="attributes-grid">
            {dle.attributes.map((attr) => (
              <div key={attr.key} className="attribute-card">
                <div className="attribute-name">{attr.label}</div>
                <div className="attribute-type">
                  {attr.type === AttributeType.Ordered && 'Ordonné'}
                  {attr.type === AttributeType.Text && 'Texte'}
                  {attr.type === AttributeType.Number && 'Nombre'}
                  {attr.type === AttributeType.Multi && 'Multi'}
                </div>
                {attr.order && (
                  <div className="attribute-hints">
                    {attr.order[0]} → {attr.order[attr.order.length - 1]}
                  </div>
                )}
                {attr.options && (
                  <div className="attribute-hints">
                    {attr.options.slice(0, 4).join(', ')}
                    {attr.options.length > 4 && ` +${attr.options.length - 4}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="detail-section">
          <h2 className="section-title">Aperçu des personnages</h2>
          <div className="characters-preview">
            {dle.characters.map((char) => (
              <div key={char.id} className="character-preview-card">
                <img src={char.image} alt={char.name} />
                <span className="character-name">{char.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

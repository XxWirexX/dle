// src/pages/Detail.jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useTitle from "../hooks/useTitle";
import "./Detail.css";

export default function Detail() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [anime, setAnime] = useState(null);
  useTitle(anime?.name ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/anime/${id}?lite=true`)
      .then((res) => res.json())
      .then((data) => {
        setAnime(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="detail-container">
        <div className="detail-loading">Chargement...</div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="detail-container">
        <div className="detail-error">
          <h2>Anime introuvable</h2>
          <Link to="/" className="back-home-btn">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  const characterCount = anime.characters?.length || 0;
  const attributeCount = anime.attributes?.length || 0;
  const previewCharacters = anime.characters?.slice(0, 8) || [];

  return (
    <div
      className="detail-container"
      style={{ backgroundImage: `url(/api/images/${id}/${anime.background})` }}
    >
      <div className="detail-overlay">
        {/* Navigation */}
        <div className="detail-nav">
          <Link to="/" className="back-home-btn">← Accueil</Link>
        </div>

        {/* Header */}
        <header className="detail-header">
          <div className="detail-icon">
            <img src={`/api/images/${id}/${anime.icon}`} alt={anime.name} />
          </div>
          <div className="detail-title-section">
            <h1 className="detail-title">{anime.name}</h1>
            <div className="detail-stats">
              <div className="stat-badge">
                <span className="stat-number">{characterCount}</span>
                <span className="stat-label">Personnages</span>
              </div>
              <div className="stat-badge">
                <span className="stat-number">{attributeCount}</span>
                <span className="stat-label">Attributs</span>
              </div>
              <div className="stat-badge">
                <span className="stat-number">{anime.maxAttempts || 26}</span>
                <span className="stat-label">Essais max</span>
              </div>
            </div>
          </div>
        </header>

        {/* Game Modes */}
        <section className="detail-section">
          <h2 className="section-title">Modes de jeu</h2>
          <div className="game-modes">
            <Link to={`/anime/${id}/play`} className="mode-card solo">
              <div className="mode-icon">S</div>
              <div className="mode-info">
                <h3>Solo</h3>
                <p>Trouve le personnage mystère en utilisant les indices</p>
              </div>
              <div className="mode-arrow">→</div>
            </Link>
            <Link to={`/anime/${id}/play?mode=daily`} className="mode-card daily">
              <div className="mode-icon">★</div>
              <div className="mode-info">
                <h3>Défi du jour</h3>
                <p>Un personnage différent chaque jour, identique pour tous</p>
              </div>
              <div className="mode-arrow">→</div>
            </Link>
            <Link to={`/anime/${id}/play?mode=duo`} className={`mode-card duo ${!user && !authLoading ? 'requires-login' : ''}`}>
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

        {/* Attributes */}
        <section className="detail-section">
          <h2 className="section-title">Attributs du jeu</h2>
          <div className="attributes-grid">
            {anime.attributes?.map((attr) => (
              <div key={attr.key} className="attribute-card">
                <div className="attribute-name">{attr.label}</div>
                <div className="attribute-type">
                  {attr.type === "ordered" && "Ordonné"}
                  {attr.type === "text" && "Texte"}
                  {attr.type === "number" && "Nombre"}
                </div>
                {attr.hints && (
                  <div className="attribute-hints">
                    {attr.hints.slice(0, 4).join(", ")}
                    {attr.hints.length > 4 && ` +${attr.hints.length - 4}`}
                  </div>
                )}
                {attr.order && (
                  <div className="attribute-hints">
                    {attr.order[0]} → {attr.order[attr.order.length - 1]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Characters Preview */}
        <section className="detail-section">
          <div className="section-header">
            <h2 className="section-title">Personnages</h2>
            <Link to={`/anime/${id}/characters`} className="see-all-btn">
              Voir tous →
            </Link>
          </div>
          <div className="characters-preview">
            {previewCharacters.map((char) => (
              <div key={char.id} className="character-preview-card">
                <img
                  src={`/api/images/${id}/characters/${char.image}`}
                  alt={char.name}
                  onError={(e) => { e.target.src = "placeholder.png"; }}
                />
                <span className="character-name">{char.name}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

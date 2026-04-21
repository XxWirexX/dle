import "./Home.css";
import { useEffect, useState } from "react";
import useTitle from "../hooks/useTitle";
import Card from "../components/Card.jsx";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import animeService from "../services/animeService.js";
import customDleService from "../services/customDleService";
import type { CustomDleListItem } from "../types/customDle";

export default function Home() {
  useTitle(null);
  const [mangas, setMangas] = useState([]);
  const [publicDles, setPublicDles] = useState<CustomDleListItem[]>([]);
  const { user, loading } = useAuth();

  useEffect(() => {
    animeService.getAll().then(setMangas).catch(() => {});
    customDleService.getPublic().then(setPublicDles).catch(() => {});
  }, []);

  return (
    <div className="home-container">
      <header className="home-header">
        <div className="logo-container">
          <img src="/images/logo.jpg" alt="Mangadle" className="logo" />
          <h1 className="site-title">DLE</h1>
        </div>

        <nav className="nav-buttons">
          <Link to="/" className="nav-btn active">Manga</Link>
          <span className="nav-btn nav-btn-disabled">Video Games</span>
        </nav>

        <div className="user-section">
          {loading ? null : user ? (
            <Link to="/profile" className="user-btn">
              <Avatar user={user} size="md" />
            </Link>
          ) : (
            <Link to="/login" className="nav-btn login-btn">Connexion</Link>
          )}
        </div>
      </header>

      <p className="home-section-title">Manga — {mangas.length} jeux disponibles</p>
      <div className="games-grid">
        {mangas.map((game) => (
          <Card key={game.id} game={game} />
        ))}
      </div>

      <div className="community-section">
        <div className="community-header">
          <h2 className="community-title">
            <span className="community-badge">Communauté</span>
            DLEs créés par les joueurs
          </h2>
          <Link to="/create" className="community-create-btn">+ Créer le tien</Link>
        </div>

        {publicDles.length === 0 ? (
          <div className="community-empty">
            Aucun DLE public pour le moment.{' '}
            {user ? <Link to="/create">Sois le premier à en créer un</Link> : <Link to="/login">Connecte-toi</Link>} !
          </div>
        ) : (
          <div className="community-grid">
            {publicDles.map((dle) => <CustomDleCard key={dle.id} dle={dle} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomDleCard({ dle }: { dle: CustomDleListItem }) {
  const navigate = useNavigate();
  const base = `/custom/${dle.id}/play`;
  return (
    <div className="custom-card" onClick={() => navigate(`/custom/${dle.id}`)}>
      {dle.backgroundUrl && (
        <div className="custom-card-bg" style={{ backgroundImage: `url(${dle.backgroundUrl})` }} />
      )}
      <div className="custom-card-gradient" />

      {dle.iconUrl && (
        <div className="custom-card-icon">
          <img src={dle.iconUrl} alt={dle.name} />
        </div>
      )}

      <div className="custom-card-body">
        <h3 className="custom-card-title">{dle.name}</h3>
        <div className="custom-card-meta">
          <span>{dle.characterCount} persos</span>
          <span>·</span>
          <span>{dle.attributeCount} attributs</span>
        </div>
        {dle.ownerUsername && (
          <div className="custom-card-owner">par @{dle.ownerUsername}</div>
        )}
        <div className="custom-card-actions">
          <button
            className="custom-card-btn solo"
            onClick={(e) => { e.stopPropagation(); navigate(base); }}
          >
            Solo
          </button>
          <button
            className="custom-card-btn duo"
            onClick={(e) => { e.stopPropagation(); navigate(`${base}?mode=duo`); }}
          >
            Duo
          </button>
        </div>
        <button
          className="custom-card-btn daily"
          onClick={(e) => { e.stopPropagation(); navigate(`${base}?mode=daily`); }}
        >
          Défi du jour
        </button>
      </div>
    </div>
  );
}

import "./Home.css";
import { useEffect, useState } from "react";
import useTitle from "../hooks/useTitle";
import Card from "../components/Card.jsx";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Avatar from "../components/Avatar";
import animeService from "../services/animeService.js";

export default function Home() {
  useTitle(null);
  const [mangas, setMangas] = useState([]);
  const { user, loading } = useAuth();

  useEffect(() => {
    animeService.getAll().then(setMangas).catch(() => {});
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
    </div>
  );
}

// src/pages/Home.jsx
import "./Home.css";
import {useEffect, useState} from "react";
import Card from "../components/Card.jsx";
import {Link} from "react-router-dom";

export default function Home() {
  const [mangas, setMangas] = useState([]);

  useEffect(() => {
    fetch("/api/animes")
      .then(res => res.json())
      .then(data => {
        console.log(data);
        setMangas(data);
      });
  }, []);
  
  return (
    <div className="home-container">
      <header className="home-header">
        <div className="logo-container">
          <img src="/images/logo.jpg" alt="Mangadle" className="logo" />
          <h1 className="site-title">Mangadle</h1>
        </div>
        
        <nav className="nav-buttons">
          <Link to="/" className="nav-btn active">
            Manga
          </Link>
          <Link to="/video-games" className="nav-btn">
            Video Games
          </Link>
        </nav>
      </header>

      <div className="games-grid">
        {mangas.map((game) => (
          <Card key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
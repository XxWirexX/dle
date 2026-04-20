// src/pages/CharactersList.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import CharactersTable from "../components/CharactersTable";
import GameNavbar from "../components/GameNavbar";
import useTitle from "../hooks/useTitle";
import "./Game.css";

export default function CharactersList() {
  const { id } = useParams();
  const [gameData, setGameData] = useState(null);
  useTitle(gameData ? `Personnages — ${gameData.name}` : null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/anime/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setGameData(data);
        setCharacters(data.characters || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading characters:", err);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="loading">Loading characters...</div>
        </div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="loading" style={{ flexDirection: 'column', gap: '1rem' }}>
            <span style={{ color: '#ef4444' }}>Game not found</span>
            <Link to="/" className="back-btn">
              ← Retour a l'accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="characters-list-container"
      style={{ backgroundImage: `url(/api/images/${id}/${gameData.background})` }}
    >
      <GameNavbar gameId={id} />
      <div className="characters-list-overlay">
        <div className="characters-list-content">
          <h1 className="characters-list-title">{gameData.name} - All Characters</h1>
          <CharactersTable
            characters={characters}
            attributes={gameData.attributes || []}
            gameId={id}
          />
        </div>
      </div>
    </div>
  );
}

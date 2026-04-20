import "./Card.css";
import { useNavigate } from "react-router-dom";

export default function Card({ game }) {
  const navigate = useNavigate();
  const characterCount = game.characterCount ?? game.characters?.length ?? 0;

  return (
    <div className="game-card" onClick={() => navigate(`/anime/${game.id}`)}>
      <div
        className="card-bg"
        style={{ backgroundImage: `url(/api/images/${game.id}/${game.background})` }}
      />
      <div className="card-gradient" />

      <div className="card-icon">
        <img src={`/api/images/${game.id}/${game.icon}`} alt={game.name} />
      </div>

      <div className="card-body">
        <h2 className="card-title">{game.name}</h2>
        <span className="card-stat">{characterCount} personnages</span>
        <div className="card-actions">
          <div className="card-actions-row">
            <button
              className="action-btn solo-btn"
              onClick={e => { e.stopPropagation(); navigate(`/anime/${game.id}/play`); }}
            >
              Solo
            </button>
            <button
              className="action-btn duo-btn"
              onClick={e => { e.stopPropagation(); navigate(`/anime/${game.id}/play?mode=duo`); }}
            >
              Duo
            </button>
          </div>
          <button
            className="action-btn daily-btn daily-btn-full"
            onClick={e => { e.stopPropagation(); navigate(`/anime/${game.id}/play?mode=daily`); }}
          >
            Défi du jour
          </button>
        </div>
      </div>
    </div>
  );
}

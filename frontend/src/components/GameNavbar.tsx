// src/components/GameNavbar.jsx
import { NavLink } from "react-router-dom";
import "./GameNavbar.css";

export default function GameNavbar({ gameId }) {
  return (
    <nav className="game-navbar">
      <NavLink to="/" className="nav-home">
        ← Accueil
      </NavLink>
      <div className="nav-tabs">
        <NavLink
          to={`/anime/${gameId}/play`}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Game
        </NavLink>
        <NavLink
          to={`/anime/${gameId}/characters`}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          Characters
        </NavLink>
      </div>
    </nav>
  );
}

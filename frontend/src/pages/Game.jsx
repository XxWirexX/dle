import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import DuoGame from "./DuoGame";
import GameNavbar from "../components/GameNavbar";
import useAuth from "../hooks/useAuth";
import "./Game.css";

// Hook pour persister l'état - utilise l'API si connecté, sinon localStorage
function useStats(animeId) {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0
  });
  const [loaded, setLoaded] = useState(false);

  // Charger les stats au montage
  useEffect(() => {
    if (!animeId) return;

    if (token && user) {
      // Charger depuis l'API
      fetch(`/api/stats/${animeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          setStats(data);
          setLoaded(true);
        })
        .catch(() => loadFromLocalStorage());
    } else {
      // Charger depuis localStorage
      loadFromLocalStorage();
    }

    function loadFromLocalStorage() {
      try {
        const raw = localStorage.getItem(`stats-${animeId}`);
        if (raw) setStats(JSON.parse(raw));
      } catch { /* ignore parse errors */ }
      setLoaded(true);
    }
  }, [animeId, token, user]);

  // Mettre à jour les stats après une partie
  const updateStats = useCallback((won, attempts = 0, isDuo = false) => {
    if (token && user) {
      // Sauvegarder via l'API
      fetch(`/api/stats/${animeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ won, attempts, isDuo })
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => setStats(data))
        .catch(() => updateLocalStorage(won));
    } else {
      // Sauvegarder dans localStorage
      updateLocalStorage(won);
    }

    function updateLocalStorage(won) {
      setStats(s => {
        const newStats = {
          played: s.played + 1,
          wins: s.wins + (won ? 1 : 0),
          streak: won ? s.streak + 1 : 0,
          maxStreak: Math.max(s.maxStreak, won ? s.streak + 1 : 0)
        };
        try {
          localStorage.setItem(`stats-${animeId}`, JSON.stringify(newStats));
        } catch { /* ignore storage errors */ }
        return newStats;
      });
    }
  }, [animeId, token, user]);

  return { stats, updateStats, loaded };
}

// Sélection aléatoire d'une cible
function pickTarget(list) {
  const i = Math.floor(Math.random() * list.length);
    console.log(list[i]);
  return list[i];
}

// Calcul du feedback pour un champ
function computeFieldFeedback(guessVal, targetVal, attribute) {
  const gLower = guessVal ? guessVal.toString().toLowerCase() : null;
  const tLower = targetVal ? targetVal.toString().toLowerCase() : null;

  // Si les deux sont identiques (y compris "unknown" === "unknown"), c'est correct
  if (gLower && tLower && gLower === tLower) {
    return { type: "correct", label: guessVal };
  }

  // Vérifier si un des deux est vide ou "unknown"
  const gIsUnknown = !gLower || gLower === "unknown";
  const tIsUnknown = !tLower || tLower === "unknown";

  // Si un des deux est unknown (mais pas les deux, car déjà géré au-dessus)
  if (gIsUnknown || tIsUnknown) {
    return { type: "wrong", label: guessVal || "-" };
  }

  const { type, order } = attribute;

  // Type numérique
  if (type === "number") {
    const g = Number(guessVal);
    const t = Number(targetVal);

    if (isNaN(g) || isNaN(t)) {
      return { type: "wrong", label: guessVal };
    }

    if (g === t) return { type: "correct", label: guessVal };
    if (Math.abs(g - t) === 1) return { type: "close", label: guessVal, direction: g > t ? "higher" : "lower" };
    if (g > t) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type ordonné (ex: arcs)
  if (type === "ordered" && order) {
    const guessIndex = order.findIndex(item =>
      gLower.includes(item.toLowerCase()) ||
      item.toLowerCase().includes(gLower)
    );
    const targetIndex = order.findIndex(item =>
      tLower.includes(item.toLowerCase()) ||
      item.toLowerCase().includes(tLower)
    );

    if (guessIndex === -1 || targetIndex === -1) {
      return { type: "wrong", label: guessVal };
    }

    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    if (Math.abs(guessIndex - targetIndex) === 1) return { type: "close", label: guessVal, direction: guessIndex > targetIndex ? "higher" : "lower" };
    if (guessIndex > targetIndex) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Exception pour male/female (female contient male mais c'est pas un match)
  const isMaleFemale = (gLower === "male" && tLower === "female") || (gLower === "female" && tLower === "male");

  // Type texte - match partiel (jaune) si l'un contient l'autre
  if (!isMaleFemale && (tLower.includes(gLower) || gLower.includes(tLower))) {
    return { type: "close", label: guessVal };
  }

  return { type: "wrong", label: guessVal };
}

// Calcul du feedback pour tous les attributs
function getFeedbackObject(guess, target, attributes) {
  const obj = {};
  attributes.forEach((attr) => {
    obj[attr.key] = computeFieldFeedback(guess[attr.key], target[attr.key], attr);
  });
  return obj;
}

function SoloGame() {
  const { id } = useParams();

  const [gameData, setGameData] = useState(null);
  const [pool, setPool] = useState([]);
  const [target, setTarget] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [statsUpdated, setStatsUpdated] = useState(false);

  const { stats, updateStats } = useStats(id);

  const searchRef = useRef(null);

  // Chargement des données du jeu
  useEffect(() => {
    fetch(`/api/anime/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setGameData(data);
        const characters = data.characters || [];
        setPool(characters);
        setTarget(pickTarget(characters));
      })
      .catch(console.error);
  }, [id]);

  // Fermer les suggestions au clic extérieur
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mise à jour des stats à la fin de partie
  useEffect(() => {
    if (!gameOver || statsUpdated) return;
    const won = attempts.some((a) => a.isCorrect);
    updateStats(won, attempts.length, false);
    // Note: statsUpdated sera mis à true via le callback updateStats
  }, [gameOver, statsUpdated, attempts, updateStats]);

  // Flag pour éviter double update
  useEffect(() => {
    if (gameOver && !statsUpdated) {
      const timer = setTimeout(() => setStatsUpdated(true), 0);
      return () => clearTimeout(timer);
    }
  }, [gameOver, statsUpdated]);

  function validateSelection(char) {
    if (gameOver || !target || !gameData) return;

    if (attempts.some((a) => a.guess.id === char.id)) {
      alert("Tu as deja essaye ce personnage !");
      return;
    }

    const fb = getFeedbackObject(char, target, gameData.attributes || []);
    const isCorrect = char.id === target.id;

    const entry = { guess: char, feedback: fb, isCorrect };
    const next = [entry, ...attempts];
    setAttempts(next);
    setQuery("");
    setShowSuggestions(false);

    if (isCorrect) {
      setGameOver(true);
      return;
    }
    if (next.length >= (gameData.maxAttempts || 26)) {
      setGameOver(true);
      return;
    }
  }

  function newGame() {
    setTarget(pickTarget(pool));
    setAttempts([]);
    setGameOver(false);
    setStatsUpdated(false);
    setQuery("");
    setShowSuggestions(false);
  }

  function revealAnswer() {
    setGameOver(true);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && filteredSuggestions.length > 0) {
      validateSelection(filteredSuggestions[0]);
    }
  }

  const filteredSuggestions = query.trim()
    ? pool.filter((c) => {
        if (attempts.some((a) => a.guess.id === c.id)) return false;
        return c.name.toLowerCase().includes(query.toLowerCase());
      })
    : [];

  if (!gameData || !target || pool.length === 0) {
    return <div className="loading">Chargement...</div>;
  }

  const attributes = gameData.attributes || [];
  const maxAttempts = gameData.maxAttempts || 26;

  // Grouper les hints par attribut (pour les attributs qui ont des hints ou order)
  const hintsData = attributes.filter(attr => attr.hints || attr.order);

  return (
    <div className="game-container" style={{ backgroundImage: `url(/api/images/${id}/${gameData.background})` }}>
      <GameNavbar gameId={id} />
      <div className="game-overlay">
        {/* Header */}
        <div className="game-header">
          <h1 className="game-title">{gameData.name}</h1>

          <div className="header-buttons">
            <button onClick={newGame} className="new-game-btn">
              Nouvelle partie
            </button>
            <button onClick={revealAnswer} className="reveal-btn">
              Reveler
            </button>
          </div>

          {/* Barre de recherche */}
          <div className="search-container" ref={searchRef}>
            <input
              type="text"
              placeholder={`Rechercher un personnage...`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="search-input"
              disabled={gameOver}
            />

            {/* Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && !gameOver && (
              <div className="suggestions-dropdown">
                {filteredSuggestions.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => validateSelection(char)}
                    className="suggestion-item"
                  >
                    <div className="suggestion-image">
                      <img src={`/api/images/${gameData.id}/characters/${char.image}`} alt={char.name} />
                    </div>
                    <div className="suggestion-name">{char.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tableau des essais */}
        <div className="attempts-wrapper">
          <div className="attempts-table">
            {/* En-tetes */}
            <div className="table-headers">
              <div className="table-header">Image</div>
              <div className="table-header">Name</div>
              {attributes.map((attr) => (
                <div key={attr.key} className="table-header">
                  {attr.label}
                </div>
              ))}
            </div>

            {/* Lignes */}
            <div className="attempts-list">
              {attempts.map((a, i) => (
                <div key={i} className="attempt-row">
                  {/* Image */}
                  <div className="cell-image">
                    <div className="character-image">
                      <img src={`/api/images/${gameData.id}/characters/${a.guess.image}`} alt={a.guess.name} />
                    </div>
                  </div>

                  {/* Nom */}
                  <div className={`cell bg-${a.isCorrect ? "correct" : "wrong"}`}>
                    <div className="cell-text">{a.guess.name}</div>
                  </div>

                  {/* Attributs dynamiques */}
                  {attributes.map((attr) => {
                    const fb = a.feedback[attr.key];
                    const showArrow = attr.type === "number" || attr.type === "ordered";
                    const cellClass = showArrow ? "cell-with-arrow" : "cell";

                    return (
                      <div
                        key={attr.key}
                        className={`${cellClass} bg-${fb?.type || "wrong"}`}
                      >
                        <div className="cell-text-sm">
                          {a.guess[attr.key] || "-"}
                        </div>
                        {showArrow && fb?.type === "higher" && <div className="arrow">▼</div>}
                        {showArrow && fb?.type === "lower" && <div className="arrow">▲</div>}
                        {showArrow && fb?.type === "close" && fb?.direction === "higher" && <div className="arrow">▼</div>}
                        {showArrow && fb?.type === "close" && fb?.direction === "lower" && <div className="arrow">▲</div>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section des indices */}
        {hintsData.length > 0 && (
          <div className="hints-section">
            <button onClick={() => setShowHints(!showHints)} className="hints-toggle">
              {showHints ? "▲ Masquer les indices" : "▼ Afficher les indices"}
            </button>

            {showHints && (
              <div className="hints-content">
                {hintsData.map((attr) => (
                  <div key={attr.key} className="hint-category">
                    <h3 className="hint-title">{attr.label}</h3>
                    <div className="hint-list">
                      {(attr.hints || attr.order || []).map((item, i) => (
                        <div key={i} className="hint-item">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message de fin */}
        {gameOver && (
          <div className="game-over-message">
            <div className={`game-over-title ${attempts.some((a) => a.isCorrect) ? "win" : "lose"}`}>
              {attempts.some((a) => a.isCorrect)
                ? `Bravo ! Tu as trouve : ${target.name}`
                : `La reponse etait : ${target.name}`}
            </div>
            <div className="game-over-stats">
              Essais : {attempts.length}/{maxAttempts} |
              Parties : {stats.played} |
              Victoires : {stats.wins} |
              Serie : {stats.streak}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Game() {
  const search = new URLSearchParams(useLocation().search);
  const mode = search.get("mode") || "solo";
  const { user, loading } = useAuth();

  // Mode duo requiert une connexion
  if (mode === "duo") {
    if (loading) {
      return <div className="loading">Chargement...</div>;
    }

    if (!user) {
      // Rediriger vers login avec retour après connexion
      const returnUrl = window.location.pathname + window.location.search;
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = `/login?redirect=${encodeURIComponent(returnUrl)}`;
      return <div className="loading">Redirection...</div>;
    }

    return <DuoGame />;
  }

  return <SoloGame />;
}

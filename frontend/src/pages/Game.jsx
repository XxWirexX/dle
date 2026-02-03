import { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import DuoGame from "./DuoGame";
import GameNavbar from "../components/GameNavbar";
import "./Game.css";

// Hook pour persister l'état dans localStorage
function usePersistentState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState];
}

// Sélection aléatoire d'une cible
function pickTarget(list) {
  const i = Math.floor(Math.random() * list.length);
    console.log(list[i]);
  return list[i];
}

// Calcul du feedback pour un champ
function computeFieldFeedback(guessVal, targetVal, attribute) {
  if (!guessVal || !targetVal || guessVal === "Unknown" || targetVal === "Unknown") {
    return { type: "unknown", label: guessVal || "-" };
  }

  const { type, order, partialMatch } = attribute;

  // Type numérique
  if (type === "number") {
    const g = Number(guessVal);
    const t = Number(targetVal);

    if (isNaN(g) || isNaN(t)) {
      return { type: guessVal === targetVal ? "correct" : "wrong", label: guessVal };
    }

    if (g === t) return { type: "correct", label: guessVal };
    if (Math.abs(g - t) === 1) return { type: "close", label: guessVal, direction: g > t ? "higher" : "lower" };
    if (g > t) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type ordonné (ex: arcs)
  if (type === "ordered" && order) {
    const guessIndex = order.findIndex(item =>
      guessVal.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(guessVal.toLowerCase())
    );
    const targetIndex = order.findIndex(item =>
      targetVal.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(targetVal.toLowerCase())
    );

    if (guessIndex === -1 || targetIndex === -1) {
      return { type: guessVal.toLowerCase() === targetVal.toLowerCase() ? "correct" : "wrong", label: guessVal };
    }

    if (guessIndex === targetIndex) return { type: "correct", label: guessVal };
    if (guessIndex > targetIndex) return { type: "higher", label: guessVal };
    return { type: "lower", label: guessVal };
  }

  // Type texte
  if (guessVal.toLowerCase() === targetVal.toLowerCase()) {
    return { type: "correct", label: guessVal };
  }

  // Match partiel (jaune)
  if (partialMatch) {
    if (targetVal.toLowerCase().includes(guessVal.toLowerCase()) ||
        guessVal.toLowerCase().includes(targetVal.toLowerCase())) {
      return { type: "close", label: guessVal };
    }
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

  const [stats, setStats] = usePersistentState(`stats-${id}`, {
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0,
  });

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
    if (!gameOver) return;
    setStats((s) => {
      const played = s.played + 1;
      const won = attempts.some((a) => a.isCorrect);
      const wins = s.wins + (won ? 1 : 0);
      const streak = won ? s.streak + 1 : 0;
      const maxStreak = Math.max(s.maxStreak, streak);
      return { played, wins, streak, maxStreak };
    });
  }, [gameOver]);

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

  if (mode === "duo") {
    return <DuoGame />;
  }

  return <SoloGame />;
}

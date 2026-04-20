import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import DuoGame from "./DuoGame";
import GameNavbar from "../../components/GameNavbar";
import AttemptsTable from "../../components/game/AttemptsTable";
import GameOverCard from "../../components/game/GameOverCard";
import HintsSection from "../../components/game/HintsSection";
import SearchBar from "../../components/game/SearchBar";
import useAuth from "../../hooks/useAuth";
import useStats from "../../hooks/useStats";
import useTitle from "../../hooks/useTitle";
import { getFeedbackObject } from "../../utils/feedback";
import { pickTarget, generateShareText } from "../../utils/gameUtils";
import animeService from "../../services/animeService.js";
import dailyService from "../../services/dailyService.js";
import statsService from "../../services/statsService.js";
import "./Game.css";

function SoloGame() {
  const { id } = useParams();
  const [gameData, setGameData] = useState(null);
  useTitle(gameData ? `Solo — ${gameData.name}` : null);
  const [pool, setPool] = useState([]);
  const [target, setTarget] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [statsUpdated, setStatsUpdated] = useState(false);
  const { stats, updateStats } = useStats(id);

  useEffect(() => {
    animeService.getGame(id)
      .then(data => {
        setGameData(data);
        const chars = data.characters || [];
        setPool(chars);
        setTarget(pickTarget(chars));
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!gameOver || statsUpdated) return;
    updateStats(attempts.some(a => a.isCorrect), attempts.length, false);
  }, [gameOver, statsUpdated, attempts, updateStats]);

  useEffect(() => {
    if (gameOver && !statsUpdated) {
      const t = setTimeout(() => setStatsUpdated(true), 0);
      return () => clearTimeout(t);
    }
  }, [gameOver, statsUpdated]);

  function validateSelection(char) {
    if (gameOver || !target || !gameData) return;
    if (attempts.some(a => a.guess.id === char.id)) {
      alert("Tu as deja essaye ce personnage !");
      return;
    }
    const fb = getFeedbackObject(char, target, gameData.attributes || []);
    const isCorrect = char.id === target.id;
    const next = [{ guess: char, feedback: fb, isCorrect }, ...attempts];
    setAttempts(next);
    if (isCorrect || next.length >= (gameData.maxAttempts || 26)) setGameOver(true);
  }

  function newGame() {
    setTarget(pickTarget(pool));
    setAttempts([]);
    setGameOver(false);
    setStatsUpdated(false);
  }

  if (!gameData || !target || pool.length === 0) return <div className="loading">Chargement...</div>;

  const attributes = gameData.attributes || [];
  const maxAttempts = gameData.maxAttempts || 26;

  return (
    <div className="game-container" style={{ backgroundImage: `url(/api/images/${id}/${gameData.background})` }}>
      <GameNavbar gameId={id} />
      <div className="game-overlay">
        <div className="game-header">
          <h1 className="game-title">{gameData.name}</h1>
          <div className="header-buttons">
            <button onClick={newGame} className="new-game-btn">Nouvelle partie</button>
            <button onClick={() => setGameOver(true)} className="reveal-btn">Reveler</button>
          </div>
          {!gameOver && <SearchBar pool={pool} attempts={attempts} gameId={id} onSelect={validateSelection} />}
        </div>

        {gameOver && (
          <GameOverCard
            target={target}
            gameId={id}
            isWon={attempts.some(a => a.isCorrect)}
            attempts={attempts}
            maxAttempts={maxAttempts}
            stats={stats}
          />
        )}

        <AttemptsTable attempts={attempts} attributes={attributes} gameId={id} />
        {!gameOver && <HintsSection attributes={attributes} />}
      </div>
    </div>
  );
}

function DailyGame() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [gameData, setGameData] = useState(null);
  useTitle(gameData ? `Défi du jour — ${gameData.name}` : null);
  const [pool, setPool] = useState([]);
  const [target, setTarget] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [statsUpdated, setStatsUpdated] = useState(false);
  const [dayNumber, setDayNumber] = useState(0);
  const [dateStr, setDateStr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDateStr(today);

    Promise.all([
      animeService.getGame(id),
      dailyService.getDaily(id),
    ]).then(([data, daily]) => {
      setGameData(data);
      setDayNumber(daily.dayNumber);
      const chars = data.characters || [];
      setPool(chars);
      const dailyTarget = chars[daily.characterIndex];
      setTarget(dailyTarget);

      const stored = localStorage.getItem(`daily-${id}-${today}`);
      if (stored) {
        try {
          const result = JSON.parse(stored);
          const restored = (result.guessIds || []).map(guessId => {
            const char = chars.find(c => c.id === guessId);
            if (!char) return null;
            return { guess: char, feedback: getFeedbackObject(char, dailyTarget, data.attributes || []), isCorrect: char.id === dailyTarget.id };
          }).filter(Boolean);
          setAttempts(restored);
          setGameOver(true);
          setStatsUpdated(true);
        } catch { /* localStorage corrompu */ }
      }
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!gameOver || statsUpdated || !target || !dateStr) return;
    setStatsUpdated(true);
    const won = attempts.some(a => a.isCorrect);
    localStorage.setItem(`daily-${id}-${dateStr}`, JSON.stringify({
      won,
      guessIds: [...attempts].reverse().map(a => a.guess.id)
    }));
    if (token && user) {
      statsService.update(id, token, { won, attempts: attempts.length, isDuo: false, isDaily: true }).catch(() => {});
    }
  }, [gameOver, statsUpdated, attempts, target, dateStr, id, token, user]);

  function validateSelection(char) {
    if (gameOver || !target || !gameData) return;
    if (attempts.some(a => a.guess.id === char.id)) return;
    const fb = getFeedbackObject(char, target, gameData.attributes || []);
    const isCorrect = char.id === target.id;
    const next = [{ guess: char, feedback: fb, isCorrect }, ...attempts];
    setAttempts(next);
    if (isCorrect || next.length >= (gameData.maxAttempts || 26)) setGameOver(true);
  }

  function copyResult() {
    if (!gameData) return;
    const text = generateShareText(attempts, gameData.attributes || [], gameData.name, dayNumber, gameData.maxAttempts || 26);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  if (!gameData || !target || pool.length === 0) return <div className="loading">Chargement du défi du jour...</div>;

  const attributes = gameData.attributes || [];
  const maxAttempts = gameData.maxAttempts || 26;
  const isWon = attempts.some(a => a.isCorrect);

  return (
    <div className="game-container" style={{ backgroundImage: `url(/api/images/${id}/${gameData.background})` }}>
      <GameNavbar gameId={id} />
      <div className="game-overlay">
        <div className="game-header">
          <div className="daily-badge">DÉFI DU JOUR #{dayNumber}</div>
          <h1 className="game-title">{gameData.name}</h1>
          <div className="daily-meta">
            <span className="daily-date">{dateStr}</span>
            <span className="daily-attempts-count">{attempts.length} / {maxAttempts}</span>
          </div>
          {!gameOver && <SearchBar pool={pool} attempts={attempts} gameId={id} onSelect={validateSelection} />}
        </div>

        {gameOver && (
          <GameOverCard target={target} gameId={id} isWon={isWon} attempts={attempts} maxAttempts={maxAttempts}>
            <div className="daily-share-section">
              <pre className="daily-emoji-grid">
                {generateShareText(attempts, attributes, gameData.name, dayNumber, maxAttempts)}
              </pre>
              <button onClick={copyResult} className={`copy-btn${copied ? " copied" : ""}`}>
                {copied ? "✓ Copié !" : "Partager le résultat"}
              </button>
              <p className="daily-comeback">Reviens demain pour un nouveau défi !</p>
            </div>
          </GameOverCard>
        )}

        <AttemptsTable attempts={attempts} attributes={attributes} gameId={id} />
        {!gameOver && <HintsSection attributes={attributes} />}
      </div>
    </div>
  );
}

export default function Game() {
  const mode = new URLSearchParams(useLocation().search).get("mode") || "solo";
  const { user, loading } = useAuth();

  if (mode === "daily") return <DailyGame />;

  if (mode === "duo") {
    if (loading) return <div className="loading">Chargement...</div>;
    if (!user) {
      const returnUrl = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(returnUrl)}`;
      return <div className="loading">Redirection...</div>;
    }
    return <DuoGame />;
  }

  return <SoloGame />;
}

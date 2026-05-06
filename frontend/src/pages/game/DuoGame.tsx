import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import useSocket from "../../hooks/useSocket";
import useAuth from "../../hooks/useAuth";
import WaitingRoom from "../../components/game/WaitingRoom";
import TurnIndicator from "../../components/game/TurnIndicator";
import RematchModal from "../../components/game/RematchModal";
import ChatBox from "../../components/game/ChatBox";
import SafeImage from "../../components/SafeImage";
import animeService from "../../services/animeService";
import customDleService from "../../services/customDleService";
import statsService from "../../services/statsService";
import { resolveCharacterImage, resolveBackgroundImage } from "../../utils/imageUrl";
import "./Game.css";

// Helper to filter characters by difficulty level (inclusive of lower difficulties)
function getDifficultyLevel(difficulty) {
  const levels = { facile: 1, moyen: 2, difficile: 3 };
  return levels[difficulty?.toLowerCase()] || 0;
}

function filterByDifficulty(characters, selectedDifficulty) {
  if (!selectedDifficulty) return characters;
  const selectedLevel = getDifficultyLevel(selectedDifficulty);
  return characters.filter(c => getDifficultyLevel(c.difficulty) <= selectedLevel);
}

export default function DuoGame({ isCustom = false, difficulty = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [localGameData, setLocalGameData] = useState(null);
  const [pool, setPool] = useState([]);
  const [filteredPool, setFilteredPool] = useState([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [statsUpdated, setStatsUpdated] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(difficulty);

  const searchRef = useRef(null);
  const hasJoinedQueue = useRef(false);

  const {
    connect, disconnect, isConnected, connectionError, socketId,
    joinQueue, leaveQueue, inQueue, queuePosition, queueError,
    roomId, isYourTurn, playerName, opponentName,
    makeGuess, myAttempts, opponentAttempts,
    gameOver, winner, target, myScore, opponentScore,
    requestRematch, rematchRequested, opponentWantsRematch,
    opponentDisconnected, opponentLeft, leaveRoom,
    messages, sendChatMessage
  } = useSocket();

  const [chatOpen, setChatOpen] = useState(false);

  // Get difficulty attribute if it exists
  const difficultyAttr = localGameData?.attributes?.find(a => a.key === 'difficulty');
  const difficultyValues = difficultyAttr ? [...new Set(localGameData.characters.map(c => c.difficulty).filter(Boolean))] : [];

  useEffect(() => {
    const fetcher = isCustom ? customDleService.getGame(id) : animeService.getGame(id);
    fetcher
      .then((data) => {
        setLocalGameData(data);
        setPool(data.characters || []);
        // Apply difficulty filtering if specified (inclusive)
        const filtered = filterByDifficulty(data.characters || [], selectedDifficulty);
        setFilteredPool(filtered);
      })
      .catch(() => {});
  }, [id, isCustom, selectedDifficulty]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (isConnected && localGameData && !roomId && !inQueue && !queueError && !hasJoinedQueue.current) {
      hasJoinedQueue.current = true;
      joinQueue(id, localGameData, selectedDifficulty);
    }
    if (!isConnected) hasJoinedQueue.current = false;
  }, [isConnected, localGameData, id, joinQueue, roomId, inQueue, queueError, selectedDifficulty]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!gameOver || statsUpdated || !user || !socketId || !id) return;
    statsService.update(id, { won: winner === socketId, attempts: myAttempts.length, isDuo: true }).catch(() => {});
    setStatsUpdated(true);
  }, [gameOver, statsUpdated, user, id, winner, socketId, myAttempts.length]);

  useEffect(() => {
    if (!gameOver && statsUpdated) setStatsUpdated(false);
  }, [gameOver, statsUpdated]);

  const allAttempts = [
    ...myAttempts.map(a => ({ ...a, isMe: true })),
    ...opponentAttempts.map(a => ({ ...a, isMe: false }))
  ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const playedIds = new Set([
    ...myAttempts.map(a => a.guess.id),
    ...opponentAttempts.map(a => a.guess.id)
  ]);

  function validateSelection(char) {
    if (gameOver || !isYourTurn) return;
    if (playedIds.has(char.id)) { alert("Ce personnage a deja ete joue !"); return; }
    makeGuess(char);
    setQuery("");
    setShowSuggestions(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && filteredSuggestions.length > 0) validateSelection(filteredSuggestions[0]);
  }

  const filteredSuggestions = query.trim()
    ? filteredPool.filter(c => !playedIds.has(c.id) && c.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  const backUrl = isCustom ? '/' : `/anime/${id}`;

  if (connectionError) {
    return (
      <div className="game-container"><div className="game-overlay">
        <div className="connection-error">
          <h2>Erreur de connexion</h2>
          <p>{connectionError}</p>
          <button onClick={() => navigate(backUrl)} className="back-btn">Retour</button>
        </div>
      </div></div>
    );
  }

  if (queueError) {
    return (
      <div className="game-container"><div className="game-overlay">
        <div className="connection-error">
          <h2>Impossible de rejoindre</h2>
          <p>{queueError}</p>
          <button onClick={() => navigate(backUrl)} className="back-btn">Retour</button>
        </div>
      </div></div>
    );
  }

  if (!localGameData || filteredPool.length === 0) return <div className="loading">Chargement...</div>;

  if (inQueue || (!roomId && isConnected)) {
    return (
      <div className="game-container"><div className="game-overlay">
        <WaitingRoom
          position={queuePosition || 1}
          onCancel={() => { leaveQueue(id); navigate(backUrl); }}
          animeName={localGameData.name}
          difficultyAttr={difficultyAttr}
          difficultyValues={difficultyValues}
          selectedDifficulty={selectedDifficulty}
          onDifficultyChange={setSelectedDifficulty}
        />
      </div></div>
    );
  }

  if (!isConnected) {
    return <div className="game-container"><div className="game-overlay"><div className="loading">Connexion au serveur...</div></div></div>;
  }

  const attributes = localGameData.attributes || [];
  const displayAttributes = attributes.filter(a => a.key !== 'difficulty');
  const hintsData = displayAttributes.filter(attr => attr.hints || attr.order);
  const isWinner = winner === socketId;

  return (
    <div className="game-container duo-mode" style={{ backgroundImage: `url(${resolveBackgroundImage(localGameData.background, id)})` }}>
      <div className="game-overlay">
        <div className="nav-back">
          <Link to={backUrl} className="back-btn" onClick={() => leaveRoom()}>&larr; Quitter</Link>
        </div>

        <div className="game-header">
          <h1 className="game-title">{localGameData.name}</h1>
          <div className="mode-badge">Mode Duo</div>

          <div className="players-display">
            <span className="player-name me">{playerName || "Joueur 1"}</span>
            <span className="session-score">
              <span className="score me">{myScore}</span>
              <span className="score-separator">-</span>
              <span className="score opponent">{opponentScore}</span>
            </span>
            <span className="player-name opponent">{opponentName || "Joueur 2"}</span>
          </div>

          <TurnIndicator isYourTurn={isYourTurn} gameOver={gameOver} />

          <div className="search-container" ref={searchRef}>
            <input
              type="text"
              placeholder={isYourTurn ? "Rechercher un personnage..." : "Attends ton tour..."}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="search-input"
              disabled={gameOver || !isYourTurn}
            />
            {showSuggestions && filteredSuggestions.length > 0 && !gameOver && isYourTurn && (
              <div className="suggestions-dropdown">
                {filteredSuggestions.map(char => (
                  <button key={char.id} onClick={() => validateSelection(char)} className="suggestion-item">
                    <div className="suggestion-image">
                      <SafeImage src={resolveCharacterImage(char.image, id)} alt={char.name} />
                    </div>
                    <div className="suggestion-name">{char.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="attempts-section">
          <h3 className="section-title">
            Essais ({allAttempts.length}) - Toi: {myAttempts.length} | Adversaire: {opponentAttempts.length}
          </h3>
          <div className="attempts-wrapper">
            <div className="attempts-table">
              <div className="table-headers">
                <div className="table-header">Joueur</div>
                <div className="table-header">Image</div>
                <div className="table-header">Name</div>
                {displayAttributes.map(attr => (
                  <div key={attr.key} className="table-header">{attr.label}</div>
                ))}
              </div>
              <div className="attempts-list">
                {allAttempts.map((a, i) => (
                  <div key={i} className={`attempt-row ${a.isMe ? "my-attempt" : "opponent-attempt"}`}>
                    <div className={`cell-player ${a.isMe ? "player-me" : "player-opponent"}`}>
                      {a.isMe ? (playerName || "Toi") : (opponentName || "Adv")}
                    </div>
                    <div className="cell-image">
                      <div className="character-image">
                        <SafeImage src={resolveCharacterImage(a.guess.image, id)} alt={a.guess.name} />
                      </div>
                    </div>
                    <div className={`cell bg-${a.isCorrect ? "correct" : "wrong"}`}>
                      <div className="cell-text">{a.guess.name}</div>
                    </div>
                    {displayAttributes.map(attr => {
                      const fb = a.feedback[attr.key];
                      const showArrow = attr.type === "number" || attr.type === "ordered";
                      let displayValue = a.guess[attr.key];

                      // Handle boolean display
                      if (attr.type === "boolean") {
                        displayValue = displayValue === true || displayValue === "true" ? "oui" : "non";
                      } else if (displayValue === undefined || displayValue === null) {
                        displayValue = "-";
                      }

                      return (
                        <div key={attr.key} className={`${showArrow ? "cell-with-arrow" : "cell"} bg-${fb?.type || "wrong"}`}>
                          <div className="cell-text-sm">{displayValue}</div>
                          {showArrow && fb?.type === "higher" && <div className="arrow">▼</div>}
                          {showArrow && fb?.type === "lower" && <div className="arrow">▲</div>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {hintsData.length > 0 && (
          <div className="hints-section">
            <button onClick={() => setShowHints(!showHints)} className="hints-toggle">
              {showHints ? "▲ Masquer les indices" : "▼ Afficher les indices"}
            </button>
            {showHints && (
              <div className="hints-content">
                {hintsData.map(attr => (
                  <div key={attr.key} className="hint-category">
                    <h3 className="hint-title">{attr.label}</h3>
                    <div className="hint-list">
                      {(attr.hints || attr.order || []).map((item, i) => (
                        <div key={i} className="hint-item">{item}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {gameOver && (
          <RematchModal
            isWinner={isWinner}
            target={target}
            myAttempts={myAttempts.length}
            opponentAttempts={opponentAttempts.length}
            onRematch={requestRematch}
            onLeave={() => { leaveRoom(); navigate(backUrl); }}
            rematchRequested={rematchRequested}
            opponentWantsRematch={opponentWantsRematch}
            opponentDisconnected={opponentDisconnected}
            opponentLeft={opponentLeft}
            gameId={id}
            playerName={playerName}
            opponentName={opponentName}
            myScore={myScore}
            opponentScore={opponentScore}
          />
        )}

        {(opponentDisconnected || opponentLeft) && !gameOver && (
          <div className="opponent-gone-overlay">
            <div className="opponent-gone-modal">
              <h2>{opponentDisconnected ? "Adversaire deconnecte" : "Adversaire parti"}</h2>
              <p>La partie est terminee.</p>
              <button onClick={() => { leaveRoom(); navigate(backUrl); }} className="leave-btn">Retour</button>
            </div>
          </div>
        )}

        <ChatBox messages={messages} onSend={sendChatMessage} mySocketId={socketId} isOpen={chatOpen} onToggle={() => setChatOpen(!chatOpen)} />
      </div>
    </div>
  );
}

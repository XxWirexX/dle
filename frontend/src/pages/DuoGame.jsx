import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import useSocket from "../hooks/useSocket";
import WaitingRoom from "../components/game/WaitingRoom";
import TurnIndicator from "../components/game/TurnIndicator";
import RematchModal from "../components/game/RematchModal";
import "./Game.css";

export default function DuoGame() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [localGameData, setLocalGameData] = useState(null);
  const [pool, setPool] = useState([]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const searchRef = useRef(null);

  const {
    connect,
    disconnect,
    isConnected,
    connectionError,
    socketId,
    joinQueue,
    leaveQueue,
    inQueue,
    queuePosition,
    roomId,
    isYourTurn,
    gameData,
    makeGuess,
    myAttempts,
    opponentAttempts,
    gameOver,
    winner,
    target,
    requestRematch,
    rematchRequested,
    opponentWantsRematch,
    opponentDisconnected,
    opponentLeft,
    leaveRoom
  } = useSocket();

  // Charger les donnees de l'anime
  useEffect(() => {
    fetch(`/api/anime/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setLocalGameData(data);
        setPool(data.characters || []);
      })
      .catch(console.error);
  }, [id]);

  // Se connecter au serveur Socket.IO
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Rejoindre la queue quand connecte et donnees chargees
  useEffect(() => {
    if (isConnected && localGameData && !roomId && !inQueue) {
      joinQueue(id, localGameData);
    }
  }, [isConnected, localGameData, id, joinQueue, roomId, inQueue]);

  // Fermer les suggestions au clic exterieur
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Combine toutes les tentatives (moi + adversaire)
  const allAttempts = [
    ...myAttempts.map(a => ({ ...a, isMe: true })),
    ...opponentAttempts.map(a => ({ ...a, isMe: false }))
  ].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // IDs déjà joués (par moi ou l'adversaire)
  const playedIds = new Set([
    ...myAttempts.map(a => a.guess.id),
    ...opponentAttempts.map(a => a.guess.id)
  ]);

  function validateSelection(char) {
    if (gameOver || !isYourTurn) return;

    if (playedIds.has(char.id)) {
      alert("Ce personnage a deja ete joue !");
      return;
    }

    makeGuess(char);
    setQuery("");
    setShowSuggestions(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && filteredSuggestions.length > 0) {
      validateSelection(filteredSuggestions[0]);
    }
  }

  function handleLeave() {
    leaveRoom();
    navigate(`/anime/${id}`);
  }

  function handleCancel() {
    leaveQueue(id);
    navigate(`/anime/${id}`);
  }

  const filteredSuggestions = query.trim()
    ? pool.filter((c) => {
        if (playedIds.has(c.id)) return false;
        return c.name.toLowerCase().includes(query.toLowerCase());
      })
    : [];

  // Erreur de connexion
  if (connectionError) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="connection-error">
            <h2>Erreur de connexion</h2>
            <p>{connectionError}</p>
            <button onClick={() => navigate(`/anime/${id}`)} className="back-btn">
              Retour
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chargement
  if (!localGameData || pool.length === 0) {
    return <div className="loading">Chargement...</div>;
  }

  // En attente de matchmaking
  if (inQueue || (!roomId && isConnected)) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <WaitingRoom
            position={queuePosition || 1}
            onCancel={handleCancel}
            animeName={localGameData.name}
          />
        </div>
      </div>
    );
  }

  // Pas encore connecte
  if (!isConnected) {
    return (
      <div className="game-container">
        <div className="game-overlay">
          <div className="loading">Connexion au serveur...</div>
        </div>
      </div>
    );
  }

  const attributes = localGameData.attributes || [];
  const hintsData = attributes.filter(attr => attr.hints || attr.order);
  const isWinner = winner === socketId;

  return (
    <div className="game-container duo-mode">
      <div className="game-overlay">
        {/* Bouton retour */}
        <div className="nav-back">
          <Link to={`/anime/${id}`} className="back-btn" onClick={() => leaveRoom()}>
            &larr; Quitter
          </Link>
        </div>

        {/* Header */}
        <div className="game-header">
          <h1 className="game-title">{localGameData.name}</h1>
          <div className="mode-badge">Mode Duo</div>

          <TurnIndicator isYourTurn={isYourTurn} gameOver={gameOver} />

          {/* Barre de recherche */}
          <div className="search-container" ref={searchRef}>
            <input
              type="text"
              placeholder={isYourTurn ? "Rechercher un personnage..." : "Attends ton tour..."}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              className="search-input"
              disabled={gameOver || !isYourTurn}
            />

            {/* Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && !gameOver && isYourTurn && (
              <div className="suggestions-dropdown">
                {filteredSuggestions.slice(0, 10).map((char) => (
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

        {/* Toutes les tentatives combinées */}
        <div className="attempts-section">
          <h3 className="section-title">
            Essais ({allAttempts.length}) - Toi: {myAttempts.length} | Adversaire: {opponentAttempts.length}
          </h3>
          <div className="attempts-wrapper">
            <div className="attempts-table">
              {/* En-tetes */}
              <div className="table-headers">
                <div className="table-header">Joueur</div>
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
                {allAttempts.map((a, i) => (
                  <div key={i} className={`attempt-row ${a.isMe ? "my-attempt" : "opponent-attempt"}`}>
                    {/* Badge joueur */}
                    <div className={`cell-player ${a.isMe ? "player-me" : "player-opponent"}`}>
                      {a.isMe ? "Toi" : "Adv"}
                    </div>

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

        {/* Modal de fin de partie */}
        {gameOver && (
          <RematchModal
            isWinner={isWinner}
            target={target}
            myAttempts={myAttempts.length}
            opponentAttempts={opponentAttempts.length}
            onRematch={requestRematch}
            onLeave={handleLeave}
            rematchRequested={rematchRequested}
            opponentWantsRematch={opponentWantsRematch}
            opponentDisconnected={opponentDisconnected}
            opponentLeft={opponentLeft}
            gameId={gameData.id}
          />
        )}

        {/* Notification adversaire deconnecte pendant la partie */}
        {(opponentDisconnected || opponentLeft) && !gameOver && (
          <div className="opponent-gone-overlay">
            <div className="opponent-gone-modal">
              <h2>{opponentDisconnected ? "Adversaire deconnecte" : "Adversaire parti"}</h2>
              <p>La partie est terminee.</p>
              <button onClick={handleLeave} className="leave-btn">
                Retour
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

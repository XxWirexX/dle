export default function GameOverCard({ target, gameId, isWon, attempts, maxAttempts, stats, children }) {
  return (
    <div className="game-over-message">
      <div className={`game-over-character ${isWon ? "win" : "lose"}`}>
        <img src={`/api/images/${gameId}/characters/${target.image}`} alt={target.name} />
      </div>
      <div className={`game-over-result ${isWon ? "win" : "lose"}`}>
        {isWon ? "Trouvé !" : "Dommage !"}
      </div>
      <p className="game-over-name">{target.name}</p>
      {stats && (
        <div className="game-over-stats">
          <div className="stat-chip">
            <span className="stat-chip-value">{attempts.length}/{maxAttempts}</span>
            <span className="stat-chip-label">Essais</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-value">{stats.played}</span>
            <span className="stat-chip-label">Parties</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-value">{stats.wins}</span>
            <span className="stat-chip-label">Victoires</span>
          </div>
          <div className="stat-chip">
            <span className="stat-chip-value">{stats.streak}</span>
            <span className="stat-chip-label">Série</span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

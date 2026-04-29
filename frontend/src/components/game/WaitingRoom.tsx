export default function WaitingRoom({
  position,
  onCancel,
  animeName,
  difficultyAttr = null,
  difficultyValues = [],
  selectedDifficulty = null,
  onDifficultyChange = null
}) {
  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <div className="waiting-spinner"></div>
        <h2 className="waiting-title">Recherche d'adversaire...</h2>
        <p className="waiting-anime">{animeName}</p>

        {difficultyAttr && difficultyValues.length > 0 && (
          <div className="waiting-difficulty">
            <span className="waiting-difficulty-label">Difficulté:</span>
            <div className="waiting-difficulty-buttons">
              {difficultyValues.map(diff => (
                <button
                  key={diff}
                  className={`waiting-difficulty-btn ${selectedDifficulty === diff ? 'active' : ''}`}
                  onClick={() => onDifficultyChange?.(diff)}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="waiting-position">Position dans la file : {position}</p>
        <button onClick={onCancel} className="cancel-queue-btn">
          Annuler
        </button>
      </div>
    </div>
  );
}

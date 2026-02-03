export default function RematchModal({
  isWinner,
  target,
  myAttempts,
  opponentAttempts,
  onRematch,
  onLeave,
  rematchRequested,
  opponentWantsRematch,
  opponentDisconnected,
  opponentLeft
}) {
  const opponentGone = opponentDisconnected || opponentLeft;

  return (
    <div className="rematch-modal-overlay">
      <div className="rematch-modal">
        <div className={`rematch-result ${isWinner ? 'win' : 'lose'}`}>
          {isWinner ? 'Victoire !' : 'Defaite...'}
        </div>

        <div className="rematch-target">
          <p>Le personnage etait :</p>
          <div className="target-character">
            <img src={target?.image} alt={target?.name} />
            <span>{target?.name}</span>
          </div>
        </div>

        <div className="rematch-stats">
          <div className="stat-item">
            <span className="stat-label">Tes essais</span>
            <span className="stat-value">{myAttempts}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Essais adversaire</span>
            <span className="stat-value">{opponentAttempts}</span>
          </div>
        </div>

        {opponentGone ? (
          <div className="opponent-gone">
            <p>{opponentDisconnected ? "L'adversaire s'est deconnecte" : "L'adversaire a quitte"}</p>
            <button onClick={onLeave} className="leave-btn">
              Retour
            </button>
          </div>
        ) : (
          <div className="rematch-actions">
            {opponentWantsRematch && !rematchRequested && (
              <p className="rematch-notification">L'adversaire veut une revanche !</p>
            )}

            {rematchRequested ? (
              <p className="rematch-waiting">En attente de l'adversaire...</p>
            ) : (
              <button onClick={onRematch} className="rematch-btn">
                {opponentWantsRematch ? 'Accepter la revanche' : 'Demander revanche'}
              </button>
            )}

            <button onClick={onLeave} className="leave-btn">
              Quitter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

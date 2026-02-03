export default function OpponentDisplay({ attempts, attributes }) {
  if (!attempts || attempts.length === 0) {
    return (
      <div className="opponent-display">
        <h3 className="opponent-title">Adversaire</h3>
        <p className="opponent-empty">Aucun essai</p>
      </div>
    );
  }

  return (
    <div className="opponent-display">
      <h3 className="opponent-title">Adversaire ({attempts.length} essais)</h3>
      <div className="opponent-attempts">
        {attempts.map((a, i) => (
          <div key={i} className="opponent-attempt">
            <div className="opponent-character">
              <img src={a.guess.image} alt={a.guess.name} />
              <span className="opponent-name">{a.guess.name}</span>
            </div>
            <div className="opponent-feedback">
              {attributes.map((attr) => {
                const fb = a.feedback[attr.key];
                return (
                  <span
                    key={attr.key}
                    className={`opponent-cell bg-${fb?.type || 'wrong'}`}
                    title={attr.label}
                  >
                    {attr.type === 'number' || attr.type === 'ordered' ? (
                      fb?.type === 'higher' ? '▼' :
                      fb?.type === 'lower' ? '▲' :
                      fb?.type === 'correct' ? '✓' : '✗'
                    ) : (
                      fb?.type === 'correct' ? '✓' :
                      fb?.type === 'close' ? '~' : '✗'
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

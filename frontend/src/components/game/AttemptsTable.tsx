export default function AttemptsTable({ attempts, attributes, gameId }) {
  return (
    <div className="attempts-wrapper">
      <div className="attempts-table">
        <div className="table-headers">
          <div className="table-header">Image</div>
          <div className="table-header">Name</div>
          {attributes.map(attr => (
            <div key={attr.key} className="table-header">{attr.label}</div>
          ))}
        </div>
        <div className="attempts-list">
          {attempts.map((a, i) => (
            <div key={i} className="attempt-row">
              <div className="cell-image">
                <div className="character-image">
                  <img src={`/api/images/${gameId}/characters/${a.guess.image}`} alt={a.guess.name} />
                </div>
              </div>
              <div className={`cell bg-${a.isCorrect ? "correct" : "wrong"}`}>
                <div className="cell-text">{a.guess.name}</div>
              </div>
              {attributes.map(attr => {
                const fb = a.feedback[attr.key];
                const showArrow = attr.type === "number" || attr.type === "ordered";
                return (
                  <div key={attr.key} className={`${showArrow ? "cell-with-arrow" : "cell"} bg-${fb?.type || "wrong"}`}>
                    <div className="cell-text-sm">{a.guess[attr.key] || "-"}</div>
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
  );
}

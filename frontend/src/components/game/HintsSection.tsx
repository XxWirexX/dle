import { useState } from "react";

export default function HintsSection({ attributes }) {
  const [open, setOpen] = useState(false);
  const hintsData = attributes.filter(attr => attr.hints || attr.order);
  if (hintsData.length === 0) return null;

  return (
    <div className="hints-section">
      <button onClick={() => setOpen(v => !v)} className="hints-toggle">
        {open ? "▲ Masquer les indices" : "▼ Afficher les indices"}
      </button>
      {open && (
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
  );
}

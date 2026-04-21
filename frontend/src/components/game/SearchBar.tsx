import { useState, useRef, useCallback } from "react";
import useClickOutside from "../../hooks/useClickOutside";
import { resolveCharacterImage } from "../../utils/imageUrl";

export default function SearchBar({ pool, attempts, gameId, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const closeDropdown = useCallback(() => setOpen(false), []);
  useClickOutside(ref, closeDropdown);

  const suggestions = query.trim()
    ? pool.filter(c =>
        !attempts.some(a => a.guess.id === c.id) &&
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  function handleSelect(char) {
    setQuery("");
    setOpen(false);
    onSelect(char);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && suggestions.length > 0) handleSelect(suggestions[0]);
  }

  return (
    <div className="search-container" ref={ref}>
      <input
        type="text"
        placeholder="Rechercher un personnage..."
        value={query}
        className="search-input"
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map(char => (
            <button key={char.id} onClick={() => handleSelect(char)} className="suggestion-item">
              <div className="suggestion-image">
                <img src={resolveCharacterImage(char.image, gameId)} alt={char.name} />
              </div>
              <div className="suggestion-name">{char.name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

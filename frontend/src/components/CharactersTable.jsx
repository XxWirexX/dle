// src/components/CharactersTable.jsx
import { useState, useMemo } from "react";

export default function CharactersTable({ characters, attributes, gameId }) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 15;

  // Colonnes dynamiques basees sur les attributs
  const columns = [
    { key: "image", label: "Image" },
    { key: "name", label: "Name" },
    ...attributes.map(attr => ({ key: attr.key, label: attr.label }))
  ];

  // FILTRE
  const filtered = useMemo(() => {
    return characters.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [characters, search]);

  // TRI
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortField] || "";
      let vb = b[sortField] || "";

      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortAsc]);

  // PAGINATION
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function handleSort(field) {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  return (
    <div>
      {/* BARRE DE RECHERCHE */}
      <div className="search-bar">
        <input
          className="search-input"
          placeholder="Search character by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {/* TABLEAU */}
      <div className="table-wrapper">
        <table className="characters-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.key !== "image" && handleSort(col.key)}
                  style={{ cursor: col.key === "image" ? "default" : "pointer" }}
                >
                  {col.label}
                  {sortField === col.key && (sortAsc ? " ▲" : " ▼")}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visible.map((c) => (
              <tr key={c.id}>
                {/* IMAGE */}
                <td>
                  <img
                    src={`/api${gameId}/characters/${c.image}`}
                    alt={c.name}
                    className="character-image"
                    onError={(e) => {
                      e.target.src = "placeholder.png";
                    }}
                  />
                </td>

                {/* NOM */}
                <td><strong>{c.name}</strong></td>

                {/* ATTRIBUTS DYNAMIQUES */}
                {attributes.map((attr) => (
                  <td key={attr.key}>
                    {attr.key === "affiliation" || attr.key === "firstArc" ? (
                      <span className="badge">
                        {c[attr.key] || "—"}
                      </span>
                    ) : (
                      c[attr.key] || "—"
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      <div className="pagination">
        <button
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
          className="pagination-btn"
        >
          ‹ Prev
        </button>

        <div className="pagination-info">
          Page {page + 1} / {pages}
        </div>

        <button
          disabled={page === pages - 1}
          onClick={() => setPage(page + 1)}
          className="pagination-btn"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

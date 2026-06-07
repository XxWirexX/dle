import { FormEvent, useEffect, useState } from 'react';
import { api, Anime, Episode } from '../api';

export default function Admin() {
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [error, setError] = useState('');

  // formulaire anime
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [cover, setCover] = useState('');
  // formulaire episode
  const [epTitle, setEpTitle] = useState('');
  const [epUrl, setEpUrl] = useState('');

  function loadAnimes() {
    api<{ animes: Anime[] }>('/animes').then((d) => setAnimes(d.animes)).catch((e) => setError(e.message));
  }
  function loadEpisodes(animeId: number) {
    api<{ episodes: Episode[] }>(`/animes/${animeId}`).then((d) => setEpisodes(d.episodes)).catch((e) => setError(e.message));
  }

  useEffect(() => { loadAnimes(); }, []);
  useEffect(() => { if (selected) loadEpisodes(selected); else setEpisodes([]); }, [selected]);

  async function addAnime(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const d = await api<{ anime: Anime }>('/animes', {
        method: 'POST',
        body: JSON.stringify({ title, synopsis, cover_url: cover }),
      });
      setTitle(''); setSynopsis(''); setCover('');
      loadAnimes();
      setSelected(d.anime.id);
    } catch (err: any) { setError(err.message); }
  }

  async function deleteAnime(id: number) {
    if (!confirm('Supprimer cet anime et tous ses épisodes ?')) return;
    await api(`/animes/${id}`, { method: 'DELETE' });
    if (selected === id) setSelected(null);
    loadAnimes();
  }

  async function addEpisode(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError('');
    try {
      await api(`/animes/${selected}/episodes`, {
        method: 'POST',
        body: JSON.stringify({ title: epTitle, video_url: epUrl }),
      });
      setEpTitle(''); setEpUrl('');
      loadEpisodes(selected);
      loadAnimes();
    } catch (err: any) { setError(err.message); }
  }

  async function deleteEpisode(id: number) {
    await api(`/animes/episodes/${id}`, { method: 'DELETE' });
    if (selected) loadEpisodes(selected);
    loadAnimes();
  }

  return (
    <div>
      <div className="page-head"><h2>Gérer</h2><span className="muted">Ajoute des anime et leurs épisodes</span></div>
      {error && <div className="error">{error}</div>}

      <div className="admin-layout">
        <section className="card">
          <h3>Nouvel anime</h3>
          <form onSubmit={addAnime} className="form">
            <label>Titre<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
            <label>Synopsis<textarea value={synopsis} onChange={(e) => setSynopsis(e.target.value)} rows={3} /></label>
            <label>URL de l'affiche<input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://…" /></label>
            <button className="btn primary">Ajouter</button>
          </form>

          <h3 className="mt">Anime existants</h3>
          <ul className="admin-anime-list">
            {animes.map((a) => (
              <li key={a.id} className={selected === a.id ? 'sel' : ''}>
                <button className="link" onClick={() => setSelected(a.id)}>{a.title} <span className="muted small">({a.episodeCount} ép.)</span></button>
                <button className="btn ghost danger" onClick={() => deleteAnime(a.id)}>Suppr.</button>
              </li>
            ))}
            {animes.length === 0 && <li className="muted">Aucun anime.</li>}
          </ul>
        </section>

        <section className="card">
          {selected ? (
            <>
              <h3>Épisodes — {animes.find((a) => a.id === selected)?.title}</h3>
              <form onSubmit={addEpisode} className="form">
                <label>Titre de l'épisode (optionnel)<input value={epTitle} onChange={(e) => setEpTitle(e.target.value)} /></label>
                <label>Lien vidéo (.mp4 conseillé)<input value={epUrl} onChange={(e) => setEpUrl(e.target.value)} placeholder="https://…/episode.mp4" required /></label>
                <button className="btn primary">Ajouter l'épisode</button>
              </form>
              <ul className="admin-ep-list">
                {episodes.map((ep) => (
                  <li key={ep.id}>
                    <span><strong>#{ep.number}</strong> {ep.title || `Épisode ${ep.number}`}</span>
                    <button className="btn ghost danger" onClick={() => deleteEpisode(ep.id)}>Suppr.</button>
                  </li>
                ))}
                {episodes.length === 0 && <li className="muted">Aucun épisode.</li>}
              </ul>
            </>
          ) : (
            <p className="muted">Sélectionne un anime à gauche pour gérer ses épisodes.</p>
          )}
        </section>
      </div>
    </div>
  );
}

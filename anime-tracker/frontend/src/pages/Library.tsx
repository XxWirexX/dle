import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Anime, STATUS_LABEL } from '../api';
import { useAuth } from '../auth';

export default function Library() {
  const { user } = useAuth();
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ animes: Anime[] }>('/animes')
      .then((d) => setAnimes(d.animes))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="muted">Chargement…</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <div className="page-head">
        <h2>Bibliothèque</h2>
        <span className="muted">
          {user?.role === 'admin' ? "Avancement de ton frère" : 'Tes anime à regarder'}
        </span>
      </div>

      {animes.length === 0 && (
        <p className="muted">Aucun anime pour l'instant. {user?.role === 'admin' && <Link to="/admin">Ajoute-en un</Link>}.</p>
      )}

      <div className="grid">
        {animes.map((a) => {
          const pct = a.episodeCount ? Math.round((a.watchedCount / a.episodeCount) * 100) : 0;
          return (
            <Link key={a.id} to={`/anime/${a.id}`} className="card anime-card">
              <div className="cover" style={{ backgroundImage: a.cover_url ? `url(${a.cover_url})` : undefined }}>
                {!a.cover_url && <span>🎞️</span>}
                <span className={`badge ${a.status}`}>{STATUS_LABEL[a.status]}</span>
              </div>
              <div className="anime-body">
                <h3>{a.title}</h3>
                <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                <span className="muted small">{a.watchedCount} / {a.episodeCount} épisodes</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

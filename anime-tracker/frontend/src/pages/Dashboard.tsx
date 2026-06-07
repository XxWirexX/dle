import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Status, STATUS_LABEL } from '../api';

interface AnimeRow {
  animeId: number; title: string; cover_url: string;
  watched: number; total: number; status: Status; lastActivity: string | null;
}
interface ViewerData {
  viewer: { id: number; username: string };
  summary: { totalWatched: number; totalEpisodes: number; finished: number; inProgress: number; animeCount: number };
  animes: AnimeRow[];
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function Dashboard() {
  const [viewers, setViewers] = useState<ViewerData[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ viewers: ViewerData[] }>('/dashboard')
      .then((d) => setViewers(d.viewers))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="muted">Chargement…</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <div className="page-head"><h2>Suivi</h2><span className="muted">Avancement de chaque spectateur</span></div>

      {viewers.length === 0 && <p className="muted">Aucun spectateur enregistré.</p>}

      {viewers.map((v) => {
        const pct = v.summary.totalEpisodes ? Math.round((v.summary.totalWatched / v.summary.totalEpisodes) * 100) : 0;
        return (
          <section key={v.viewer.id} className="card viewer-block">
            <div className="viewer-head">
              <h3>{v.viewer.username}</h3>
              <div className="stats">
                <span><strong>{v.summary.finished}</strong> terminés</span>
                <span><strong>{v.summary.inProgress}</strong> en cours</span>
                <span><strong>{v.summary.totalWatched}</strong> / {v.summary.totalEpisodes} épisodes</span>
              </div>
            </div>
            <div className="progress big"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>

            <table className="table">
              <thead>
                <tr><th>Anime</th><th>Statut</th><th>Épisodes</th><th>Dernière activité</th></tr>
              </thead>
              <tbody>
                {v.animes.map((a) => (
                  <tr key={a.animeId}>
                    <td><Link to={`/anime/${a.animeId}`}>{a.title}</Link></td>
                    <td><span className={`badge ${a.status}`}>{STATUS_LABEL[a.status]}</span></td>
                    <td>{a.watched} / {a.total}</td>
                    <td className="muted small">{fmtDate(a.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

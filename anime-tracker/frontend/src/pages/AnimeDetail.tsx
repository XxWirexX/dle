import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, Anime, Episode, STATUS_LABEL } from '../api';
import { useAuth } from '../auth';

export default function AnimeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isViewer = user?.role === 'viewer';

  const [anime, setAnime] = useState<Anime | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [current, setCurrent] = useState<Episode | null>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  function load() {
    api<{ anime: Anime; episodes: Episode[] }>(`/animes/${id}`)
      .then((d) => {
        setAnime(d.anime);
        setEpisodes(d.episodes);
        setCurrent((cur) => cur ? d.episodes.find((e) => e.id === cur.id) || null : (d.episodes[0] || null));
      })
      .catch((e) => setError(e.message));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  // Reprend la lecture la ou il s'etait arrete
  useEffect(() => {
    if (videoRef.current && current) {
      videoRef.current.currentTime = current.position || 0;
    }
  }, [current?.id]);

  async function saveProgress(position: number, completed: boolean) {
    if (!isViewer || !current) return;
    try {
      await api(`/episodes/${current.id}/progress`, {
        method: 'POST',
        body: JSON.stringify({ position, completed }),
      });
      if (completed) load();
    } catch { /* silencieux */ }
  }

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v || !current) return;
    // Sauvegarde la position toutes les ~5s
    if (v.currentTime - lastSaved.current > 5) {
      lastSaved.current = v.currentTime;
      saveProgress(v.currentTime, false);
    }
    // Marque "vu" automatiquement a 95%
    if (v.duration && v.currentTime / v.duration > 0.95 && !current.watched) {
      saveProgress(v.currentTime, true);
    }
  }

  async function toggleWatched(ep: Episode) {
    if (!isViewer) return;
    await api(`/episodes/${ep.id}/toggle`, { method: 'POST' });
    load();
  }

  if (error) return <div className="error">{error}</div>;
  if (!anime) return <div className="muted">Chargement…</div>;

  return (
    <div>
      <div className="page-head">
        <h2>{anime.title}</h2>
        <span className={`badge ${anime.status}`}>{STATUS_LABEL[anime.status]}</span>
      </div>
      {anime.synopsis && <p className="muted">{anime.synopsis}</p>}

      <div className="detail-layout">
        <div className="player-col">
          {current ? (
            <>
              <video
                ref={videoRef}
                key={current.id}
                className="player"
                src={current.video_url}
                controls
                onTimeUpdate={onTimeUpdate}
                onEnded={() => saveProgress(videoRef.current?.duration || 0, true)}
              />
              <div className="player-title">
                Épisode {current.number}{current.title ? ` — ${current.title}` : ''}
                {current.watched && <span className="badge termine">Vu</span>}
              </div>
              {!isViewer && <p className="muted small">Aperçu — la progression affichée est celle de ton frère.</p>}
            </>
          ) : (
            <p className="muted">Aucun épisode pour cet anime.</p>
          )}
        </div>

        <ul className="ep-list">
          {episodes.map((ep) => (
            <li
              key={ep.id}
              className={`ep-item ${current?.id === ep.id ? 'current' : ''} ${ep.watched ? 'watched' : ''}`}
              onClick={() => setCurrent(ep)}
            >
              <span className="ep-num">{ep.number}</span>
              <span className="ep-title">{ep.title || `Épisode ${ep.number}`}</span>
              {isViewer ? (
                <button
                  className={`check ${ep.watched ? 'on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); toggleWatched(ep); }}
                  title={ep.watched ? 'Marquer non vu' : 'Marquer vu'}
                >✓</button>
              ) : (
                <span className={`check readonly ${ep.watched ? 'on' : ''}`}>✓</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

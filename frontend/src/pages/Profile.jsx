import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import "./Profile.css";

export default function Profile() {
  const navigate = useNavigate();
  const { user, token, logout, loading } = useAuth();
  const [animes, setAnimes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    fetch("/api/animes")
      .then(res => res.json())
      .then(data => setAnimes(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!token) return;

    setLoadingStats(true);
    fetch("/api/stats/all", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setStats(data);
        setLoadingStats(false);
      })
      .catch(() => setLoadingStats(false));
  }, [token]);

  function handleLogout() {
    logout();
    navigate("/");
  }

  if (loading) {
    return <div className="profile-container"><div className="loading">Chargement...</div></div>;
  }

  if (!user) {
    return null;
  }

  const global = stats?.global || {};
  const byAnime = stats?.byAnime || {};

  return (
    <div className="profile-container">
      <header className="profile-header">
        <Link to="/" className="back-link">&larr; Retour</Link>
        <h1>Mon Profil</h1>
      </header>

      <div className="profile-content">
        {/* Carte utilisateur */}
        <div className="profile-card user-info">
          <div className="user-avatar-large">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 className="username">{user.username}</h2>
          <p className="email">{user.email}</p>
          <button onClick={handleLogout} className="logout-btn">
            Se deconnecter
          </button>
        </div>

        {/* Stats globales */}
        <div className="profile-card global-stats">
          <h3>Statistiques globales</h3>
          {loadingStats ? (
            <div className="loading-stats">Chargement...</div>
          ) : (
            <>
              <div className="stats-grid main-stats">
                <div className="stat-item highlight">
                  <span className="stat-value">{global.totalPlayed || 0}</span>
                  <span className="stat-label">Parties jouees</span>
                </div>
                <div className="stat-item highlight">
                  <span className="stat-value">{global.totalWins || 0}</span>
                  <span className="stat-label">Victoires</span>
                </div>
                <div className="stat-item highlight">
                  <span className="stat-value">{global.winRate || 0}%</span>
                  <span className="stat-label">Win Rate</span>
                </div>
              </div>

              <div className="stats-comparison">
                <div className="mode-stats solo">
                  <div className="mode-header">
                    <span className="mode-icon">🎮</span>
                    <span className="mode-title">Solo</span>
                  </div>
                  <div className="mode-details">
                    <div className="mode-stat">
                      <span className="value">{global.soloPlayed || 0}</span>
                      <span className="label">parties</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.soloWins || 0}</span>
                      <span className="label">victoires</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.soloWinRate || 0}%</span>
                      <span className="label">win rate</span>
                    </div>
                  </div>
                </div>

                <div className="mode-stats duo">
                  <div className="mode-header">
                    <span className="mode-icon">⚔️</span>
                    <span className="mode-title">Duo</span>
                  </div>
                  <div className="mode-details">
                    <div className="mode-stat">
                      <span className="value">{global.duoPlayed || 0}</span>
                      <span className="label">parties</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.duoWins || 0}</span>
                      <span className="label">victoires</span>
                    </div>
                    <div className="mode-stat">
                      <span className="value">{global.duoWinRate || 0}%</span>
                      <span className="label">win rate</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="extra-stats">
                <div className="extra-stat">
                  <span className="extra-icon">🎯</span>
                  <span className="extra-value">{global.avgAttempts || 0}</span>
                  <span className="extra-label">Essais en moyenne</span>
                </div>
                <div className="extra-stat">
                  <span className="extra-icon">🔥</span>
                  <span className="extra-value">{global.bestStreak || 0}</span>
                  <span className="extra-label">Meilleure serie</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Stats par jeu */}
        <div className="profile-card game-stats">
          <h3>Stats par jeu</h3>
          <div className="games-stats-list">
            {animes.map(anime => {
              const s = byAnime[anime.id];
              if (!s || s.played === 0) return null;
              const soloGames = s.played - (s.duoPlayed || 0);
              const soloWins = s.wins - (s.duoWins || 0);
              return (
                <div key={anime.id} className="game-stat-row">
                  <div className="game-info">
                    <span className="game-name">{anime.name}</span>
                    <span className="game-total">{s.played} parties • {s.wins} victoires</span>
                  </div>
                  <div className="game-modes">
                    <div className="game-mode-stat solo">
                      <span className="mode-label">Solo</span>
                      <span className="mode-value">{soloGames}/{soloWins}</span>
                    </div>
                    <div className="game-mode-stat duo">
                      <span className="mode-label">Duo</span>
                      <span className="mode-value">{s.duoPlayed || 0}/{s.duoWins || 0}</span>
                    </div>
                    <div className="game-streak">
                      <span className="streak-icon">🔥</span>
                      <span className="streak-value">{s.streak}/{s.maxStreak}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {Object.keys(byAnime).length === 0 && (
              <p className="no-stats">Aucune partie jouee pour l'instant</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

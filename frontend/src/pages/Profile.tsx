import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import useTitle from "../hooks/useTitle";
import Avatar from "../components/Avatar";
import animeService from "../services/animeService";
import statsService from "../services/statsService";
import authService from "../services/authService";
import customDleService from "../services/customDleService";
import type { AnimeListItem, AvatarGroup } from "../types/anime";
import type { AllStats } from "../types/stats";
import type { CustomDleListItem } from "../types/customDle";
import "./Profile.css";

export default function Profile() {
  useTitle('Mon profil');
  const { user, logout, refreshUser } = useAuth();
  const [animes, setAnimes] = useState<AnimeListItem[]>([]);
  const [stats, setStats] = useState<AllStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState<AvatarGroup[]>([]);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [myDles, setMyDles] = useState<CustomDleListItem[]>([]);

  useEffect(() => {
    animeService.getAll().then(setAnimes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    customDleService.getMine().then(setMyDles).catch(() => {});
  }, [user]);

  async function handleDeleteDle(id: string) {
    if (!confirm('Supprimer ce DLE ? Cette action est irréversible.')) return;
    try {
      await customDleService.delete(id);
      setMyDles(dles => dles.filter(d => d.id !== id));
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!user) return;
    setLoadingStats(true);
    statsService.getAll()
      .then(data => { setStats(data); setLoadingStats(false); })
      .catch(() => setLoadingStats(false));
  }, [user]);

  useEffect(() => {
    if (!showAvatarPicker || avatarOptions.length > 0) return;
    animeService.getAllAvatars()
      .then(results => setAvatarOptions(results.map(g => ({
        animeId: g.animeId,
        animeName: g.animeName,
        characters: g.characters.map(c => ({
          id: c.id,
          name: c.name,
          image: `/api/images/${g.animeId}/characters/${c.image}`
        }))
      }))))
      .catch(() => {});
  }, [showAvatarPicker, avatarOptions.length]);

  function handleLogout() {
    logout();
  }

  async function handleSelectAvatar(imagePath: string) {
    setSavingAvatar(true);
    try {
      await authService.updateAvatar(imagePath);
      await refreshUser();
      setShowAvatarPicker(false);
    } catch { /* ignore */ } finally {
      setSavingAvatar(false);
    }
  }

  async function handleResetAvatar() {
    setSavingAvatar(true);
    try {
      await authService.updateAvatar(null);
      await refreshUser();
      setShowAvatarPicker(false);
    } catch { /* ignore */ } finally {
      setSavingAvatar(false);
    }
  }

  if (!user) return null;

  const global = stats?.global || {};
  const byAnime = stats?.byAnime || {};

  return (
    <div className="profile-container">
      <header className="profile-header">
        <Link to="/" className="back-link">← Accueil</Link>
        <h1>Mon profil</h1>
      </header>

      <div className="profile-body">
      <div className="profile-content">
        {/* Carte utilisateur */}
        <div className="profile-card user-info">
          <button
            className="avatar-edit-btn"
            onClick={() => setShowAvatarPicker(true)}
            title="Changer d'avatar"
          >
            <Avatar user={user} size="xl" />
            <span className="avatar-edit-icon">&#9998;</span>
          </button>
          <h2 className="username">{user.username}</h2>
          <p className="email">{user.email}</p>
          <button onClick={handleLogout} className="logout-btn">
            Se deconnecter
          </button>
        </div>

        {/* Mes DLEs custom */}
        <div className="profile-card my-dles">
          <div className="my-dles-header">
            <h3>Mes DLEs</h3>
            <Link to="/create" className="btn-create-dle">+ Créer un DLE</Link>
          </div>
          {myDles.length === 0 ? (
            <p className="no-stats">Aucun DLE créé pour l'instant.</p>
          ) : (
            <div className="my-dles-list">
              {myDles.map(dle => (
                <div key={dle.id} className="my-dle-row">
                  <Link to={`/custom/${dle.id}`} className="my-dle-link">
                    {dle.iconUrl && <img src={dle.iconUrl} alt={dle.name} className="my-dle-icon" />}
                    <div className="my-dle-info">
                      <span className="my-dle-name">{dle.name}</span>
                      <span className="my-dle-meta">
                        {dle.characterCount} persos · {dle.attributeCount} attributs · {dle.visibility}
                      </span>
                    </div>
                  </Link>
                  <div className="my-dle-actions">
                    <Link to={`/custom/${dle.id}/play`} className="btn-play-dle">Jouer</Link>
                    <Link to={`/custom/${dle.id}/edit`} className="btn-edit-dle" title="Modifier">✎</Link>
                    <button onClick={() => handleDeleteDle(dle.id)} className="btn-delete-dle" title="Supprimer">×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
            {Object.entries(byAnime).map(([id, s]) => {
              if (!s || s.played === 0) return null;
              const official = animes.find(a => a.id === id);
              const isCustom = !!s.isCustom;
              const name = official?.name || s.customName || id;
              const detailUrl = isCustom ? `/custom/${id}` : `/anime/${id}`;
              const soloGames = s.played - (s.duoPlayed || 0);
              const soloWins = s.wins - (s.duoWins || 0);
              return (
                <Link key={id} to={detailUrl} className="game-stat-row">
                  <div className="game-info">
                    <span className="game-name">
                      {name}
                      {isCustom && <span className="stats-custom-badge">Custom</span>}
                    </span>
                    <span className="game-total">{s.played} parties - {s.wins} victoires</span>
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
                </Link>
              );
            })}
            {Object.keys(byAnime).length === 0 && (
              <p className="no-stats">Aucune partie jouee pour l'instant</p>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Modal de selection d'avatar */}
      {showAvatarPicker && (
        <div className="avatar-picker-overlay" onClick={() => setShowAvatarPicker(false)}>
          <div className="avatar-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="avatar-picker-header">
              <h2>Choisir un avatar</h2>
              <button className="close-btn" onClick={() => setShowAvatarPicker(false)}>&times;</button>
            </div>

            <div className="avatar-picker-content">
              {/* Option pour revenir a l'avatar par defaut */}
              <div className="avatar-section">
                <h3>Avatar par defaut</h3>
                <div className="avatar-grid">
                  <button
                    className={`avatar-option ${!user.avatar_image ? 'selected' : ''}`}
                    onClick={handleResetAvatar}
                    disabled={savingAvatar}
                  >
                    <div
                      className="avatar-preview default"
                      style={{ backgroundColor: user.avatar_color || '#3b82f6' }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                  </button>
                </div>
              </div>

              {/* Personnages par anime */}
              {avatarOptions.map(anime => (
                <div key={anime.animeId} className="avatar-section">
                  <h3>{anime.animeName}</h3>
                  <div className="avatar-grid">
                    {anime.characters.map(char => (
                      <button
                        key={char.id}
                        className={`avatar-option ${user.avatar_image === char.image ? 'selected' : ''}`}
                        onClick={() => handleSelectAvatar(char.image)}
                        disabled={savingAvatar}
                        title={char.name}
                      >
                        <img src={char.image} alt={char.name} className="avatar-preview" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {avatarOptions.length === 0 && (
                <div className="loading-avatars">Chargement des avatars...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

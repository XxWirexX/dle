const TOKEN_KEY = 'anime-tracker-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Erreur ${res.status}`);
  }
  return data as T;
}

// Types partages
export type Role = 'admin' | 'viewer';
export type Status = 'a_voir' | 'en_cours' | 'termine';

export interface User { id: number; username: string; role: Role; }
export interface Anime {
  id: number; title: string; synopsis: string; cover_url: string;
  episodeCount: number; watchedCount: number; status: Status;
}
export interface Episode {
  id: number; anime_id: number; number: number; title: string;
  video_url: string; watched: boolean; position: number;
}

export const STATUS_LABEL: Record<Status, string> = {
  a_voir: 'À voir',
  en_cours: 'En cours',
  termine: 'Terminé',
};

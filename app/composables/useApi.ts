/**
 * Wrapper autour de `$fetch` qui transmet le cookie de session pendant le
 * SSR. Un `$fetch` vers notre propre API pendant le rendu serveur est une
 * requête HTTP interne distincte : sans ça, l'utilisateur apparaît
 * déconnecté à chaque fetch fait depuis `setup()` (vécu une première fois
 * avec `useAuth`, reproduit une seconde fois avec `useFriends` avant
 * d'être centralisé ici pour ne pas se refaire avoir une troisième fois).
 */
export function apiFetch<T>(url: string, options: Parameters<typeof $fetch<T>>[1] = {}) {
  const headers = import.meta.server
    ? { ...useRequestHeaders(['cookie']), ...(options?.headers as Record<string, string> | undefined) }
    : options?.headers
  return $fetch<T>(url, { ...options, headers })
}

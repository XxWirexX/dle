<script setup lang="ts">
useHead({ title: 'Politique de confidentialité — DLE' })
</script>

<template>
  <div class="legal-page">
    <div class="legal-content">
      <NuxtLink to="/" class="back">← Accueil</NuxtLink>
      <h1>Politique de confidentialité</h1>
      <p class="updated">Dernière mise à jour : 20 octobre 2026</p>

      <p class="disclaimer">
        Rédigée par le développeur du site, pas par un juriste — elle décrit honnêtement quelles données
        sont collectées et pourquoi. Pour toute question, contacte-nous (voir en bas de page).
      </p>

      <h2>1. Qui est responsable</h2>
      <p>
        DLE (<a href="https://dle.wireredblue.xyz" target="_blank" rel="noopener">dle.wireredblue.xyz</a>)
        est édité et exploité par une personne seule, à titre non commercial. C'est aussi le contact pour
        toute question relative à tes données.
      </p>

      <h2>2. Données collectées</h2>
      <p>Selon la façon dont tu utilises le service :</p>
      <ul>
        <li><strong>Compte email/mot de passe</strong> : adresse email, pseudo, mot de passe (stocké haché,
          jamais en clair), couleur d'avatar, avatar image (optionnel, hébergé sur Cloudinary).</li>
        <li><strong>Compte via Discord (Activity)</strong> : identifiant Discord, pseudo Discord, avatar
          Discord. Aucune donnée de ton compte Discord au-delà de cette identité de base n'est demandée, et
          aucun mot de passe réel ne t'est associé — la connexion se fait uniquement via Discord.</li>
        <li><strong>Usage du jeu</strong> : statistiques de parties (victoires, nombre d'essais), DLE
          personnalisés que tu crées, liste d'amis et favoris si tu utilises ces fonctionnalités.</li>
        <li><strong>Technique</strong> : un cookie de session (voir section 5) ; en multijoueur, les
          parties en cours transitent par le serveur en temps réel mais ne sont pas conservées au-delà de la
          partie.</li>
      </ul>

      <h2>3. Pourquoi ces données</h2>
      <p>
        Uniquement pour faire fonctionner le service : authentification, affichage de ton profil et de tes
        statistiques, fonctionnalités sociales (amis, invitations multijoueur), et pour relier ton compte à
        ton identité Discord si tu passes par l'Activity. Aucune donnée n'est utilisée à des fins publicitaires
        ni revendue à des tiers.
      </p>

      <h2>4. Partage avec des tiers</h2>
      <p>Tes données ne sont partagées qu'avec les prestataires strictement nécessaires au fonctionnement du site :</p>
      <ul>
        <li><strong>Cloudinary</strong> — hébergement des images (avatars, visuels de jeux).</li>
        <li><strong>Un prestataire d'envoi d'emails</strong> — pour les emails de vérification de compte et
          de réinitialisation de mot de passe.</li>
        <li><strong>Discord</strong> — uniquement si tu te connectes via l'Activity Discord, pour vérifier
          ton identité (OAuth2).</li>
      </ul>
      <p>Aucune autre vente, location ou partage de données à des fins commerciales ou publicitaires.</p>

      <h2>5. Cookies</h2>
      <p>
        Le site utilise un seul cookie, <code>dle_token</code>, strictement nécessaire pour te garder
        connecté (httpOnly, donc inaccessible en JavaScript). Aucun cookie publicitaire, de mesure d'audience
        ou de traçage tiers n'est utilisé à ce jour.
      </p>

      <h2>6. Durée de conservation</h2>
      <p>
        Tes données sont conservées tant que ton compte existe. En l'absence de suppression en libre-service
        à ce jour, écris-nous pour une suppression — voir la section 7.
      </p>

      <h2>7. Tes droits</h2>
      <p>
        Tu peux demander l'accès, la rectification ou la suppression de tes données, à tout moment, en
        écrivant à <a href="mailto:contact@wireredblue.xyz">contact@wireredblue.xyz</a>. On y répondra dans
        un délai raisonnable.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Les mots de passe sont hachés (bcrypt), jamais stockés en clair. Les sessions utilisent un cookie
        httpOnly signé, inaccessible depuis le JavaScript du navigateur.
      </p>

      <h2>9. Mineurs</h2>
      <p>
        Le service s'adresse aux personnes d'au moins 13 ans, conformément à l'âge minimum requis par
        Discord pour l'Activity.
      </p>

      <h2>10. Modifications</h2>
      <p>
        Cette politique peut évoluer avec le service. La date en haut de page reflète la dernière révision.
      </p>

      <h2>11. Contact</h2>
      <p>
        <a href="mailto:contact@wireredblue.xyz">contact@wireredblue.xyz</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.legal-page {
  min-height: 100vh;
  background: var(--bg);
  padding: 2rem 1.5rem 4rem;
}

.legal-content {
  max-width: 42rem;
  margin: 0 auto;
}

.back {
  display: inline-block;
  color: var(--text-2);
  font-weight: 500;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

h1 { font-size: 1.75rem; font-weight: 800; color: var(--text); margin: 0 0 0.25rem; }

.updated { color: var(--text-3); font-size: 0.8rem; margin: 0 0 1.5rem; }

.disclaimer {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-2);
  border-radius: 10px;
  padding: 0.9rem 1.1rem;
  color: var(--text-2);
  font-size: 0.85rem;
  margin-bottom: 2rem;
}

h2 { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 1.75rem 0 0.5rem; }

p { color: var(--text-2); line-height: 1.6; margin: 0 0 0.75rem; font-size: 0.92rem; }

ul { margin: 0 0 0.75rem; padding-left: 1.25rem; color: var(--text-2); }
li { margin-bottom: 0.4rem; line-height: 1.55; font-size: 0.92rem; }

code {
  background: rgba(255, 255, 255, 0.06);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85em;
}

a { color: var(--accent); }
</style>

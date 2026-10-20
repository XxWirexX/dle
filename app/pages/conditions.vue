<script setup lang="ts">
useHead({ title: "Conditions d'utilisation — DLE" })
</script>

<template>
  <div class="legal-page">
    <div class="legal-content">
      <NuxtLink to="/" class="back">← Accueil</NuxtLink>
      <h1>Conditions d'utilisation</h1>
      <p class="updated">Dernière mise à jour : 20 octobre 2026</p>

      <p class="disclaimer">
        Ce document est rédigé par le développeur du site, pas par un juriste — il décrit honnêtement
        comment le service fonctionne. Si tu as un doute sur un point précis, contacte-nous (voir en bas de page).
      </p>

      <h2>1. Présentation</h2>
      <p>
        DLE (<a href="https://dle.wireredblue.xyz" target="_blank" rel="noopener">dle.wireredblue.xyz</a>)
        est un jeu de devinettes de personnages inspiré de Wordle, en solo ou en duo. Le service est édité et
        maintenu par une personne seule, à titre non commercial, et propose également un accès via une
        Activity Discord.
      </p>

      <h2>2. Accès au service</h2>
      <p>
        Les jeux officiels sont jouables librement, sans compte. La création d'un compte (par email/mot de
        passe ou via Discord) est nécessaire pour : créer un DLE personnalisé, jouer en multijoueur, ajouter
        des amis, suivre tes statistiques, et pour certaines fonctionnalités liées à l'Activity Discord.
      </p>
      <p>
        Le service est fourni "en l'état", gratuitement, sans garantie de disponibilité continue. Un projet
        géré par une seule personne peut connaître des interruptions, des évolutions ou, en dernier recours,
        un arrêt du service.
      </p>

      <h2>3. Création de compte</h2>
      <p>
        Tu dois fournir un pseudo et un email valides (ou te connecter via Discord, auquel cas un compte est
        automatiquement associé à ton identité Discord — voir la
        <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink> pour le détail). Tu es
        responsable de la confidentialité de ton mot de passe et des actions effectuées depuis ton compte.
      </p>
      <p>
        Le service s'adresse aux personnes d'au moins 13 ans (âge minimum également requis par Discord pour
        utiliser une Activity). Si tu as moins de 13 ans, merci de ne pas créer de compte.
      </p>

      <h2>4. Contenu créé par les utilisateurs</h2>
      <p>
        Tu peux créer tes propres DLE (jeux personnalisés avec tes propres personnages et attributs). Tu es
        seul responsable du contenu que tu publies : il doit rester légal, ne pas être haineux, discriminatoire,
        pornographique, ou porter une atteinte manifeste aux droits d'un tiers. Un contenu signalé ou
        manifestement problématique peut être retiré, et le compte à l'origine peut être suspendu, sans préavis.
      </p>

      <h2>5. Propriété intellectuelle</h2>
      <p>
        Les personnages et œuvres référencés dans les jeux officiels (animes, mangas, etc.) appartiennent à
        leurs ayants droit respectifs. DLE est un projet de fan, non affilié à ces œuvres, à but non lucratif.
        Le code du site et son contenu original restent la propriété de son auteur.
      </p>

      <h2>6. Responsabilité</h2>
      <p>
        Le service est fourni sans garantie d'absence d'erreurs ou d'interruptions. Dans la mesure permise par
        la loi, l'éditeur ne pourra être tenu responsable des dommages indirects liés à l'utilisation du
        service.
      </p>

      <h2>7. Résiliation</h2>
      <p>
        Tu peux cesser d'utiliser le service à tout moment. En l'absence de suppression de compte en libre-
        service à ce jour, contacte-nous pour une suppression de compte et des données associées (voir la
        <NuxtLink to="/confidentialite">politique de confidentialité</NuxtLink>).
      </p>

      <h2>8. Modification de ces conditions</h2>
      <p>
        Ces conditions peuvent évoluer avec le service. La date de mise à jour en haut de page reflète la
        dernière révision.
      </p>

      <h2>9. Contact</h2>
      <p>
        Pour toute question sur ces conditions : <a href="mailto:contact@wireredblue.xyz">contact@wireredblue.xyz</a>.
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

a { color: var(--accent); }
</style>

# pourquoi.senflix.app

Landing page autonome Next.js / TypeScript qui présente, en français, les six
idées fondatrices de Senflix à travers un carrousel de brochures.

## Développement

```bash
npm install
npm run dev
```

Le site est disponible sur [http://localhost:3012](http://localhost:3012).

## Vérifications

```bash
npm run lint
npm run type-check
npm run build
```

## Structure

- `app/` — route principale, métadonnées, robots et sitemap.
- `components/WhyCarousel.tsx` — carrousel accessible et CTA.
- `public/brochures/` — six visuels source fournis pour la page.
- `lib/analytics.ts` — helper `trackEvent` pour Google Analytics 4.
- `lib/consent.ts`, `components/CookieConsent.tsx` — consentement cookies
  (Google Consent Mode v2).

## Analytics

Google Analytics 4 est chargé dans `app/layout.tsx` via `@next/third-parties`
uniquement pour les builds de production Vercel (`VERCEL_ENV=production`) et si
`NEXT_PUBLIC_GA_MEASUREMENT_ID` est un ID valide (`G-XXXX`, valeur inlinée au
build ; un ID mal formé désactive GA). L’ID public de production
(`G-K0HZW1Z379`) est versionné dans `.env.production` (valeurs publiques
uniquement). Tout le reste échoue fermé : previews Vercel, `npm run dev`, et un
`npm run build`/`next start` local n’affichent ni GA ni bandeau, et
`trackEvent` ne fait rien. Pour tester GA en local, construire avec
`VERCEL_ENV=production npm run build` puis `npx next start` (idéalement en
bloquant `/g/collect` pour ne pas polluer les statistiques).

Consentement (Google Consent Mode v2, mode « advanced ») : un script inline
dans `<head>` (rendu seulement quand GA l’est) déclare `dataLayer`/`gtag` et
place tous les signaux à `denied` avant le chargement de gtag.js. Tant que le
visiteur n’a pas accepté, GA n’envoie que des pings sans cookie (`gcs=G100`) et
aucun cookie `_ga` n’est déposé. Le même script fixe
`cookie_expires` à 395 jours (13 mois, comme annoncé dans la politique de
confidentialité) avant la configuration GA. Le bandeau en bas de page propose « Accepter »
et « Refuser » à égalité ; « Accepter » n’accorde que `analytics_storage`
(les signaux publicitaires restent toujours refusés). Le choix est stocké dans
`localStorage` (`senflix_consent` = `{ analytics, ts }`) et redemandé après
6 mois ; un choix « accepté » encore valide est rétabli dès le premier hit.
« Refuser » supprime aussi les cookies `_ga`/`_ga_*` existants. Le lien
« Gérer les cookies » (pied de page sur desktop, sous le CTA sur mobile)
rouvre le bandeau via l’événement `senflix:open-consent`. Le lien « En savoir
plus » pointe vers
`https://founders.senflix.app/politique-de-confidentialite#cookies`. Quand GA
est désactivé, ni bandeau ni lien ne sont affichés. Tant que le bandeau est
ouvert, sa hauteur est publiée dans `--consent-offset` et la page se réduit
d’autant, pour que le CTA principal reste visible et cliquable au-dessus.

Événements envoyés (aucune donnée personnelle) :

- `cta_click` `{ location: "header" | "main", target: "contact_modal" }` —
  `components/WhyCarousel.tsx`, bouton d’en-tête et CTA principal
  « Devenir créateur fondateur ».
- `generate_lead` `{ method: "phone" | "email", location: "contact_modal" }` —
  `components/ContactModal.tsx`, après un envoi réussi du formulaire.

Le déploiement et la publication ne font pas partie de cette version locale.

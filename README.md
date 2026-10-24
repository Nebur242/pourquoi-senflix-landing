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

## Analytics

Google Analytics 4 est chargé dans `app/layout.tsx` via `@next/third-parties`
uniquement si `NEXT_PUBLIC_GA_MEASUREMENT_ID` est défini (valeur inlinée au
build). L’ID public de production (`G-K0HZW1Z379`) est versionné dans
`.env.production` : seuls les builds de production le chargent, et les builds
de preview Vercel (`VERCEL_ENV=preview`) n’affichent pas GA. En `npm run dev`
sans la variable, aucun script GA n’est rendu et `trackEvent` ne fait rien.

Événements envoyés (aucune donnée personnelle) :

- `cta_click` `{ location: "header" | "main", target: "contact_modal" }` —
  `components/WhyCarousel.tsx`, bouton d’en-tête et CTA principal
  « Devenir créateur fondateur ».
- `generate_lead` `{ method: "phone" | "email", location: "contact_modal" }` —
  `components/ContactModal.tsx`, après un envoi réussi du formulaire.

Le déploiement et la publication ne font pas partie de cette version locale.

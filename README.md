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

Le déploiement et la publication ne font pas partie de cette version locale.

# mc-launcher-site

Page de présentation de [mc-launcher](https://github.com/samflix-mc/mc-launcher),
servie sur **https://mc-launcher.ggy.info**.

## Modifier le contenu

Éditer `src/template.html` — **jamais** `chart/files/`, qui est généré.

```bash
cd src && node build.mjs
```

Committer `chart/files/` et pousser.

## Déploiement

| branche | environnement | domaine |
|---|---|---|
| `dev` | `mc-dev` | mc-launcher-dev.ggy.info |
| `main` | `mc-preprod` | mc-launcher-staging.ggy.info |
| tag `v*` | `mc-prod` | mc-launcher.ggy.info |

Le workflow appelle `deploy-helm.yml` de
[`.github`](https://github.com/samflix-mc/.github) : `helm` tourne sur le
serveur, le runner ne fait que du SSH.

## Contraintes à connaître

**Pas de CDN.** La CSP du cluster est en `script-src 'self'` / `style-src
'self'`. Tailwind et DaisyUI sont compilés ici, les icônes Lucide inlinées en
SVG. Aucune requête tierce au chargement.

**CSS nommé d'après son empreinte.** `static-web-server` envoie
`cache-control: max-age=31536000` sur les fichiers d'apparence statique, pages
d'erreur comprises — un 403 transitoire a déjà été mis en cache un an par
Cloudflare.

**Fichiers montés en `subPath`.** Un montage de ConfigMap classique crée des
liens symboliques vers `..data/`, que `static-web-server` refuse : `/` répond
200 mais `/index.html` répond 403.

**Un seul niveau de sous-domaine.** Le certificat public de Cloudflare ne couvre
que `ggy.info` et `*.ggy.info`.

`mc-luncher.ggy.info` est routé en plus : la faute de frappe est fréquente.

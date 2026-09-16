# mc-launcher-site

Page de présentation de [mc-launcher](https://github.com/samflix-mc/mc-launcher),
servie sur **https://mc-launcher.ggy.info**.

Le site sert aussi le **pack du launcher**, sous `/pack/`. Les deux n'ont pas
la même origine, et c'est la première chose à savoir ici :

| chemin | contenu | d'où il vient |
|---|---|---|
| `/` | la page | `src/template.html`, versionné ici, monté en ConfigMap |
| `/pack/samflix.json` | la liste des mods | image `mc-content`, montée en initContainer |
| `/pack/samflix.lock.json` | les builds épinglés | idem |

## Modifier le contenu

Éditer `src/template.html` — **jamais** `chart/files/`, qui est généré.

```bash
cd src && node build.mjs
```

Committer `chart/files/` et pousser.

Le pack, lui, ne se modifie pas ici : il se modifie dans
[mc-content](https://github.com/samflix-mc/mc-content), où il voisine avec les
listes que reçoivent les serveurs. Ce site ne fait que le publier.

## Le pack

```
mc-content ──┬── chart mc-server        → /data/mods, /data/plugins
             └── chart mc-launcher-site → https://mc-launcher.ggy.info/pack/
```

Une seule image, deux consommateurs. Ce n'est pas une économie de moyens : les
registres NeoForge sont négociés à la connexion, et un mod en version
différente entre le client et le serveur éjecte le joueur sans message
exploitable. Faire partir les deux de la même décision est le seul moyen de ne
pas avoir à les rapprocher plus tard.

Le transport est celui que `mc-server` utilise déjà : un initContainer monte
l'image de contenu et recopie `/content/launcher` dans un `emptyDir` que
`static-web-server` publie. Recopié plutôt que monté directement — l'image ne
s'exécute pas, elle transporte, et le conteneur qui sert les fichiers doit
pouvoir vivre sans elle. Si `/content/launcher` manque, l'initContainer échoue
volontairement : un pod sain servant un 404 rendrait `mc-pack install`
impossible pour tout le monde sans que rien ne le signale.

Le tag de l'image est l'environnement. `dev` et `preprod` suivent `main` ; la
production est épinglée dans `.github/workflows/deploy.yml`, là où ce chart
prend déjà ses décisions par environnement. **Ce tag doit être le même que
`environments.prod.content.tag` dans `mc-server`** — c'est là que se joue la
concordance entre ce que le client charge et ce que les serveurs installent.
Elle est écrite à la main aux deux endroits plutôt que déduite : une
désynchronisation doit se voir en revue, pas se découvrir à la première
éjection d'un joueur.

Le pack publié sur `main` de mc-content atteint dev sans intervention : la CI
de mc-content redémarre ce déploiement en même temps que les serveurs.

### Où il est publié

| environnement | `/pack/` | version du pack |
|---|---|---|
| dev | ✅ | `mc-content:main` |
| preprod | ✅ | `mc-content:main` |
| prod | ⏳ | attend un tag de `mc-content` portant `launcher/` |

Preprod le publie bien qu'aucun serveur Minecraft ne tourne derrière elle : le
launcher distingue ses environnements, et une préproduction qui ne servirait
pas de pack ne préparerait rien.

**Le Secret de tirage s'amorce tout seul.** L'image `mc-content` est privée, et
son tirage s'autorise par un Secret qui vit dans le namespace. `mc-dev` et
`mc-prod` l'ont parce que `mc-server` y vit ; `mc-preprod` n'est occupé que par
ce site et ne l'avait pas — l'initContainer y restait en `ImagePullBackOff`, et
`helm --atomic` annulait tout le déploiement, la page avec. Le job `amorcer` du
workflow le recopie désormais depuis un namespace voisin avant de déployer. Il
ne fabrique aucun identifiant et n'en fait transiter aucun par la CI : la copie
se fait de nœud à nœud, et reste sans effet quand le Secret est déjà là.

Pour la production, il faut d'abord poser un tag sur `mc-content` : `v0.1.0`
est antérieur à l'arrivée de `launcher/` dans l'image, et l'initContainer
échouerait volontairement. Le tag reporté dans le workflow doit être le même
que `environments.prod.content.tag` dans `mc-server`.

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

**Le pack échappe au cache.** Le CSS se protège par son nom haché ; le pack,
lui, garde le même nom à vie, puisque c'est ce qui permet au launcher d'aller
le chercher sans rien savoir. Un middleware Traefik pose donc
`cache-control: no-cache` sur `/pack/`, et une route dédiée l'applique. Un pack
périmé ne produit pas une page mal stylée : le joueur installe des versions que
les serveurs n'ont plus et se fait éjecter à la connexion.

**Fichiers montés en `subPath`.** Un montage de ConfigMap classique crée des
liens symboliques vers `..data/`, que `static-web-server` refuse : `/` répond
200 mais `/index.html` répond 403.

**Un seul niveau de sous-domaine.** Le certificat public de Cloudflare ne couvre
que `ggy.info` et `*.ggy.info`.

`mc-luncher.ggy.info` est routé en plus : la faute de frappe est fréquente.

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

Éditer `src/template.html`, committer, pousser. C'est tout : la CI construit et
déploie.

```bash
cd src && pnpm install && node build.mjs   # pour voir le rendu en local
```

`chart/files/` est **généré et ignoré par git**. Il y a été versionné, et deux
choses en découlaient : il fallait penser à lancer la construction avant de
committer, et le déclencheur du déploiement ne regardait même pas `src/` —
modifier le gabarit sans reconstruire ne déployait donc rien, en silence.

Conséquence à connaître : un `helm install` depuis un clone frais ne servirait
aucune page. La construction doit précéder, et c'est la CI qui la fait — elle
dépose le chart construit en artefact, que le déploiement reprend.

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

Le tag de l'image est l'environnement, et il vient de
[`environnements.yaml`](https://github.com/samflix-mc/.github/blob/main/environnements.yaml).
`dev` et `preprod` suivent `main` ; la production est épinglée.

**C'est le même fichier qui le donne à `mc-server`.** Il était auparavant
recopié à la main ici et là-bas, sans que rien ne vérifie qu'ils concordaient —
alors que c'est cette concordance qui décide si un joueur entre dans la partie
ou s'en fait éjecter à la connexion.

Le pack publié sur `main` de mc-content atteint dev sans intervention :
mc-content annonce, et `recharger-contenu.yml` recharge ce déploiement puis
vérifie que le verrou servi est bien le nouveau.

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
`helm --atomic` annulait tout le déploiement, la page avec.

`deploy-helm.yml` le recopie désormais depuis un namespace voisin avant de
déployer, pour tout chart qui le demande. Ce dépôt portait un job entier pour
ça, alors que le besoin n'a rien qui lui soit propre : il naît dès qu'un chart
tire une image privée dans un namespace qu'il est seul à occuper.

Pour la production, il faut d'abord poser un tag sur `mc-content` : `v0.1.0`
est antérieur à l'arrivée de `launcher/` dans l'image, et l'initContainer
échouerait volontairement. Le tag se reporte dans `environnements.yaml`, et une
seule fois — il sert aussi aux serveurs.

## Déploiement

| référence | environnement | domaine |
|---|---|---|
| `main` | `mc-dev` | mc-launcher-dev.ggy.info |
| déclenchement manuel | `mc-preprod` | mc-launcher-staging.ggy.info |
| tag `v*` | `mc-prod` | mc-launcher.ggy.info |

C'est la règle commune aux quatre dépôts. Elle n'était pas celle-ci : `main`
déployait la préproduction et une branche `dev` déployait la dev. Pousser sur
`main` avait quatre effets différents selon le dépôt de l'organisation, ce qui
n'aide personne — et une répétition se décide, elle ne se subit pas.

Le workflow appelle `deploy-helm.yml` de
[`.github`](https://github.com/samflix-mc/.github) : `helm` tourne sur le
serveur, le runner ne fait que du SSH.

## Contraintes à connaître

**Pas de CDN.** La CSP du cluster est en `script-src 'self'` / `style-src
'self'`. Tailwind et DaisyUI sont compilés ici, les icônes Lucide inlinées en
SVG. Aucune requête tierce au chargement.

**Le cache est refusé par défaut.** `static-web-server` pose un
`cache-control` d'office, choisi sur la seule extension du fichier et sans
distinguer une réponse saine d'une erreur : `max-age=31536000` sur le CSS,
`max-age=86400` sur le HTML, et la même chose sur ses pages d'erreur. Un 403
transitoire a déjà été mis en cache un an par Cloudflare.

Trois routes Traefik décident donc à sa place, et la règle est inversée : rien
n'est mis en cache, sauf ce dont le nom garantit qu'il ne changera jamais.

| route | `cache-control` |
|---|---|
| `/style.*` | `public, max-age=31536000, immutable` |
| `/pack/` | `no-cache` |
| tout le reste, page et erreurs comprises | `no-cache` |

**Pourquoi le CSS seul y a droit.** `src/build.mjs` le nomme d'après son
empreinte et supprime l'ancien : l'URL change avec le contenu, elle peut donc
être gardée pour toujours. La page, elle, garde le même nom — un `max-age` d'un
jour y faisait tenir l'ancienne version dans le navigateur des visiteurs, avec
sa référence à un CSS que le déploiement venait de supprimer. Page nue pendant
vingt-quatre heures, et rien côté serveur pour le voir.

**Le pack échappe au cache.** Il garde lui aussi le même nom à vie, puisque
c'est ce qui permet au launcher d'aller le chercher sans rien savoir. Un pack
périmé ne produit pas une page mal stylée : le joueur installe des versions que
les serveurs n'ont plus et se fait éjecter à la connexion.

La revalidation ne coûte pas un téléchargement : `static-web-server` envoie un
`last-modified`, et une réponse inchangée se solde par un 304 vide.

**Fichiers montés en `subPath`.** Un montage de ConfigMap classique crée des
liens symboliques vers `..data/`, que `static-web-server` refuse : `/` répond
200 mais `/index.html` répond 403.

**Un seul niveau de sous-domaine.** Le certificat public de Cloudflare ne couvre
que `ggy.info` et `*.ggy.info`.

`mc-luncher.ggy.info` est routé en plus : la faute de frappe est fréquente.

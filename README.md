# mc-launcher-site

Page de présentation du projet [mc-launcher](https://github.com/Thesam1798/mc-launcher),
servie sur **https://mc-launcher.ggy.info**.

## Pourquoi un dépôt séparé

Le site n'a aucun rapport avec la stack média du cluster : namespace, cycle de
vie et contenu lui sont propres. Il vit donc ici, avec son chart et son
déploiement, plutôt que dans `k8s-samflix`.

## Pourquoi le CSS est compilé et versionné

Le cluster applique une CSP en `script-src 'self'` et `style-src 'self'`. Les CDN
de Tailwind, DaisyUI et Lucide seraient **bloqués par le navigateur** et la page
arriverait sans style. Tout est donc compilé à l'avance et servi depuis le même
domaine :

- Tailwind CSS 4 + DaisyUI 5 → `chart/files/style.css`
- icônes Lucide → SVG inlinés directement dans le HTML, sans runtime JavaScript

Aucune requête vers un tiers au chargement.

## Rebuild après modification du contenu

Le HTML publié est **généré** : éditer `src/template.html`, jamais
`chart/files/index.html`.

```bash
cd src
pnpm install
node build.mjs                                            # injecte les icônes
pnpm exec tailwindcss -i input.css -o ../chart/files/style.css --minify
```

Puis committer `chart/files/` et pousser sur `main` : le déploiement part tout seul.

## Bilingue

Les blocs portent `data-lang="fr"` ou `data-lang="en"` ; une règle CSS masque
celui qui ne correspond pas à `<html data-lang>`. Un script dans le `<head>`
pose l'attribut **avant le premier rendu** — pas de clignotement — en suivant
cet ordre : choix mémorisé dans `localStorage`, puis `navigator.language`, puis
anglais. Sans JavaScript, les deux langues restent affichées : dégradé mais
lisible.

## Déploiement

`git push` sur `main` (chemins `chart/**`) déclenche
[`deploy.yml`](.github/workflows/deploy.yml) : rsync du chart vers le serveur,
puis `helm upgrade --install --atomic` exécuté **sur place**, le kubeconfig K3s
pointant sur `127.0.0.1:6443` et le port 6443 étant fermé depuis l'extérieur.
Le workflow vérifie ensuite que les deux hôtes répondent en 200.

Secrets requis : `SSH_HOST`, `SSH_USER`, `SSH_PORT`, `SSH_PRIVATE_KEY`,
`SSH_KNOWN_HOSTS`. La clé est **propre à ce dépôt**, indépendante de celle de
`k8s-samflix`.

Déploiement manuel :

```bash
helm upgrade --install mc-launcher-site ./chart \
  --namespace mc-launcher --create-namespace --atomic --wait
```

## Le cas mc-luncher

`mc-luncher.ggy.info` est routé en plus de `mc-launcher.ggy.info` : le DNS de
`ggy.info` est joker, les deux résolvent, et « luncher » est la faute de frappe
naturelle sur « launcher ». Autant ne pas envoyer un 403 à quelqu'un qui l'a
tapée.

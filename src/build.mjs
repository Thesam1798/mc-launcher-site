// Génère chart/files/ à partir de template.html.
//
// Le build se fait en trois temps, et l'ordre compte :
//
//   1. les icônes Lucide sont inlinées, ce qui produit un HTML intermédiaire ;
//   2. Tailwind scanne CE fichier-là, pas le gabarit — les classes de taille
//      des icônes n'existent dans le gabarit que dans des jetons {{icon:…}},
//      que le scanner ne sait pas lire. Scanner le gabarit donnait des icônes
//      sans contrainte de taille, affichées en pleine largeur ;
//   3. le CSS est nommé d'après son empreinte, puis le HTML final est écrit.
//
// Les icônes sont inlinées plutôt que chargées via le runtime JS de Lucide :
// la CSP du cluster est en script-src 'self', un CDN serait bloqué.
//
// Le nom haché du CSS répond à un autre piège : static-web-server envoie
// « cache-control: max-age=31536000 » sur les fichiers d'apparence statique,
// y compris sur ses pages d'erreur. Un 403 transitoire s'est retrouvé mis en
// cache un an par Cloudflare sur /style.css.
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ICON_DIR = "./node_modules/lucide-static/icons";
const OUT_DIR = "../chart/files";
const PRE_HTML = "./.index.pre.html";
const PRE_CSS = "./.style.css";

// --- 1. Icônes ---------------------------------------------------------------
const html = readFileSync("./template.html", "utf8").replace(
  /\{\{icon:([a-z0-9-]+)(?::([^}]+))?\}\}/g,
  (_, name, classes) => {
    const svg = readFileSync(`${ICON_DIR}/${name}.svg`, "utf8").trim();
    return svg
      .replace("<svg", `<svg aria-hidden="true" class="${classes ?? "size-5"}"`)
      .replace(/\s+width="24"|\s+height="24"/g, "");
  },
);
writeFileSync(PRE_HTML, html);

// --- 2. CSS ------------------------------------------------------------------
execFileSync("./node_modules/.bin/tailwindcss", ["-i", "input.css", "-o", PRE_CSS, "--minify"], {
  stdio: ["ignore", "ignore", "inherit"],
});

// --- 3. Empreinte et écriture ------------------------------------------------
const css = readFileSync(PRE_CSS);
const cssName = `style.${createHash("sha256").update(css).digest("hex").slice(0, 10)}.css`;

// Le répertoire de sortie n'est plus versionné : il est généré, et git
// l'ignore. Un clone frais — celui de la CI, à chaque exécution — ne le porte
// donc pas, et readdirSync échouerait en ENOENT avant d'avoir rien écrit.
mkdirSync(OUT_DIR, { recursive: true });

for (const f of readdirSync(OUT_DIR)) {
  if (/^style\..*\.css$/.test(f) && f !== cssName) unlinkSync(`${OUT_DIR}/${f}`);
}
writeFileSync(`${OUT_DIR}/${cssName}`, css);
writeFileSync(`${OUT_DIR}/index.html`, html.replace("{{css}}", cssName));

console.log(`${cssName} (${css.length} o) + index.html`);

// Génère chart/files/ à partir de template.html et du CSS compilé par Tailwind.
//
// Deux choses s'y jouent.
//
// 1. Les icônes Lucide sont inlinées en SVG. La CSP du cluster est en
//    script-src 'self' : charger leur runtime depuis un CDN serait bloqué, et
//    l'embarquer pour remplacer des <i> au chargement coûterait un script pour
//    un résultat statique.
//
// 2. Le CSS porte son empreinte dans son nom. static-web-server envoie
//    « cache-control: max-age=31536000 » sur les fichiers d'apparence statique
//    — y compris sur ses pages d'erreur. Un 403 transitoire s'est ainsi
//    retrouvé mis en cache un an par Cloudflare sur /style.css. Un nom haché
//    garantit qu'une URL déjà servie ne change jamais de contenu, et qu'un
//    contenu modifié arrive sous une URL neuve.
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";

const ICON_DIR = "./node_modules/lucide-static/icons";
const OUT_DIR = "../chart/files";

// --- CSS : empreinte et nom de fichier ---------------------------------------
const css = readFileSync("./.style.css");
const hash = createHash("sha256").update(css).digest("hex").slice(0, 10);
const cssName = `style.${hash}.css`;

for (const f of readdirSync(OUT_DIR)) {
  if (/^style\..*\.css$/.test(f) && f !== cssName) unlinkSync(`${OUT_DIR}/${f}`);
}
writeFileSync(`${OUT_DIR}/${cssName}`, css);

// --- HTML : icônes et lien vers le CSS ---------------------------------------
const html = readFileSync("./template.html", "utf8")
  .replace(/\{\{icon:([a-z0-9-]+)(?::([^}]+))?\}\}/g, (_, name, classes) => {
    const svg = readFileSync(`${ICON_DIR}/${name}.svg`, "utf8").trim();
    return svg
      .replace("<svg", `<svg aria-hidden="true" class="${classes ?? "size-5"}"`)
      .replace(/\s+width="24"|\s+height="24"/g, "");
  })
  .replace("{{css}}", cssName);

writeFileSync(`${OUT_DIR}/index.html`, html);
console.log(`${cssName} (${css.length} o) + index.html (${html.length} o)`);

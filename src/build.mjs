// Injecte les icônes Lucide directement dans le HTML.
//
// La CSP du cluster est en script-src 'self' : charger le runtime JS de Lucide
// depuis un CDN serait bloqué, et l'embarquer pour remplacer des <i> par des
// <svg> au chargement coûterait un script pour un résultat statique. Les SVG
// sont donc écrits dans le fichier au moment du build.
import { readFileSync, writeFileSync } from "node:fs";

const ICON_DIR = "./node_modules/lucide-static/icons";

const template = readFileSync("./template.html", "utf8");

const html = template.replace(
  /\{\{icon:([a-z0-9-]+)(?::([^}]+))?\}\}/g,
  (_, name, classes) => {
    const svg = readFileSync(`${ICON_DIR}/${name}.svg`, "utf8").trim();
    return svg
      .replace("<svg", `<svg aria-hidden="true" class="${classes ?? "size-5"}"`)
      .replace(/\s+width="24"|\s+height="24"/g, "");
  },
);

writeFileSync("../files/index.html", html);
console.log(`index.html écrit : ${html.length} octets`);

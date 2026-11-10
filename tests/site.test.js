import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function htmlFiles(directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(fullPath));
    else if (entry.name.endsWith(".html")) files.push(fullPath);
  }
  return files;
}

test("toutes les pages ont un titre unique et un seul H1", async () => {
  const files = await htmlFiles();
  const titles = new Map();
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const title = html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim();
    assert.ok(title, `${path.relative(root, file)} doit avoir un titre`);
    assert.equal((html.match(/<h1(?:\s|>)/gi) || []).length, 1, `${path.relative(root, file)} doit avoir un H1`);
    assert.match(html, /<meta\s+name="description"\s+content="[^"]+"/i, `${path.relative(root, file)} doit avoir une meta description`);
    assert.match(html, /<body\b[^>]*\bdata-canonical-path=/i, `${path.relative(root, file)} doit définir un chemin canonical configurable`);
    assert.ok(!titles.has(title), `Titre dupliqué : ${title}`);
    titles.set(title, file);
  }
});

test("les textes HTML et les chaînes de l’interface ne contiennent pas de tirets cadratins ou demi-cadratins", async () => {
  const files = [...await htmlFiles(), path.join(root, "js", "app.js"), path.join(root, "js", "simulator.js")];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /[—–]/, `${path.relative(root, file)} contient un tiret long`);
  }
});

test("tous les liens et ressources locaux existent et les fragments sont valides", async () => {
  const files = await htmlFiles();
  const checks = [];
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const raw = match[1];
      if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(raw)) continue;
      const [pathname, fragment] = raw.split("#", 2);
      if (pathname) {
        const target = path.resolve(path.dirname(file), decodeURIComponent(pathname.split("?")[0]));
        checks.push(stat(target).then(() => {
          if (fragment && target.endsWith(".html")) return readFile(target, "utf8").then((htmlTarget) => assert.ok(new RegExp(`\\bid="${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(htmlTarget), `Missing #${fragment} in ${path.relative(root, target)}`));
        }).catch((issue) => { throw new Error(`${path.relative(root, file)}: broken local link "${raw}" (${issue.message})`); }));
      } else if (fragment) {
        assert.ok(ids.has(fragment), `${path.relative(root, file)}: missing #${fragment}`);
      }
    }
  }
  await Promise.all(checks);
});

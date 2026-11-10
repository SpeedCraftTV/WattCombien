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

test("chaque page publique charge une seule fois le garde CMP et aucun script tiers sans consentement", async () => {
  for (const file of await htmlFiles()) {
    const html = await readFile(file, "utf8");
    const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map((match) => match[1]);
    const adsenseMeta = [...html.matchAll(/<meta\s+name="google-adsense-account"\s+content="([^"]+)"/gi)];
    assert.equal(adsenseMeta.length, 1, `${path.relative(root, file)} doit avoir une unique balise Meta AdSense`);
    assert.equal(adsenseMeta[0][1], "ca-pub-5689496403962976", `${path.relative(root, file)} doit utiliser le bon identifiant AdSense`);
    assert.equal(scripts.filter((src) => src.endsWith("/adsense.js")).length, 1, `${path.relative(root, file)} doit charger une fois le garde AdSense`);
    assert.equal(scripts.filter((src) => src.includes("adsbygoogle.js")).length, 0, `${path.relative(root, file)} ne doit pas charger AdSense avant le consentement`);
    assert.equal(scripts.filter((src) => src.includes("clarity.ms/tag")).length, 0, `${path.relative(root, file)} ne doit pas charger Clarity avant le consentement`);
    assert.doesNotMatch(html, /<script\b[^>]*src="https:\/\/pagead\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-5689496403962976"/i, `${path.relative(root, file)} ne doit pas contenir l’ancien script AdSense statique`);
  }

  const adsTxt = await readFile(path.join(root, "ads.txt"), "utf8");
  assert.equal(adsTxt.trim(), "google.com, pub-5689496403962976, DIRECT, f08c47fec0942fa0");
});

test("AdSense remains configurable for future ads without loading before consent", async () => {
  const config = await readFile(path.join(root, "js", "config.js"), "utf8");
  const loader = await readFile(path.join(root, "js", "adsense.js"), "utf8");
  assert.match(config, /enabled:\s*true/);
  assert.match(config, /publisherId:\s*"ca-pub-5689496403962976"/);
  assert.match(loader, /grantsAdsConsent\(tcData\)/);
  assert.match(loader, /adsbygoogle\.js\?client=\$\{encodeURIComponent\(config\.adsense\.publisherId\)\}/);
});

test("Clarity uses the configured project ID and loads asynchronously only from the CMP loader", async () => {
  const config = await readFile(path.join(root, "js", "config.js"), "utf8");
  const loader = await readFile(path.join(root, "js", "clarity.js"), "utf8");
  assert.match(config, /projectId:\s*"zbctlkmftd"/);
  assert.match(loader, /script\.async\s*=\s*true/);
  assert.match(loader, /https:\/\/www\.clarity\.ms\/tag\/\$\{encodeURIComponent\(config\.clarity\.projectId\)\}/);
  assert.match(loader, /analytics_Storage:\s*analyticsGranted\s*\?\s*"granted"\s*:\s*"denied"/);
  assert.match(loader, /ad_Storage:\s*"denied"/);
});

test("Cloudflare Web Analytics uses its configured token and loads once after CMP consent", async () => {
  const config = await readFile(path.join(root, "js", "config.js"), "utf8");
  const loader = await readFile(path.join(root, "js", "cloudflare-analytics.js"), "utf8");
  const entry = await readFile(path.join(root, "js", "adsense.js"), "utf8");
  assert.match(config, /token:\s*"f53bdf1fc5cd4b86925ed77fcefbf8a3"/);
  assert.match(loader, /https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(loader, /script\.type\s*=\s*"module"/);
  assert.match(loader, /script\.dataset\.cfBeacon\s*=\s*JSON\.stringify\(\{\s*token:\s*config\.cloudflareAnalytics\.token\s*\}\)/);
  assert.match(loader, /grantsWebAnalyticsConsent\(tcData\)/);
  assert.match(loader, /document\.getElementById\(SCRIPT_ID\)/);
  assert.match(entry, /import "\.\/cloudflare-analytics\.js"/);
});

test("the contact form stays disabled until its public configuration and legal settings are complete", async () => {
  const config = await readFile(path.join(root, "js", "config.js"), "utf8");
  const loader = await readFile(path.join(root, "js", "contact-form.js"), "utf8");
  const page = await readFile(path.join(root, "pages", "contact.html"), "utf8");
  assert.match(config, /contact:\s*\{\s*enabled:\s*false/);
  assert.match(config, /turnstileSiteKey:\s*"0x4AAAAAAF7Td1S4Wd6MOzt-"/);
  assert.match(config, /contactRetentionDays:\s*null/);
  assert.match(loader, /config\.contact\.enabled/);
  assert.match(loader, /config\.legal\.contactRetentionDays/);
  assert.match(loader, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(loader, /form\.checkValidity\(\)/);
  assert.match(loader, /turnstileToken = token/);
  assert.match(page, /Le formulaire reste désactivé tant que la configuration des services/);
  assert.match(page, /<fieldset id="contact-fields" disabled>/);
});

test("legal and contact pages publish the selected contact channel without fabricating publisher identity", async () => {
  const legal = await readFile(path.join(root, "pages", "mentions-legales.html"), "utf8");
  const privacy = await readFile(path.join(root, "pages", "confidentialite.html"), "utf8");
  const contact = await readFile(path.join(root, "pages", "contact.html"), "utf8");
  for (const [file, html] of [["mentions légales", legal], ["confidentialité", privacy], ["contact", contact]]) {
    assert.match(html, /href="mailto:speedoutv\.pro@gmail\.com"/, `${file} doit offrir l’adresse publique choisie`);
    const emails = new Set([...html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map(([email]) => email.toLowerCase()));
    assert.deepEqual(emails, new Set(["speedoutv.pro@gmail.com"]), `${file} ne doit publier aucune autre adresse e-mail`);
    assert.doesNotMatch(html, /\btel:/i, `${file} ne doit publier aucun numéro de téléphone`);
  }
  assert.match(legal, /article 6, III, 2/);
  assert.match(legal, /qualification n’est pas confirmée/);
  assert.match(privacy, /article 13 du RGPD/);
  assert.match(privacy, /Cloudflare Pages Function/);
  assert.doesNotMatch(privacy, /Cloudflare Worker/);
  assert.match(contact, /Le formulaire sécurisé est en préparation et ne transmet actuellement aucune donnée/);
});

test("the contact database migration denies public access and grants only Pages Function insertion", async () => {
  const migration = await readFile(path.join(root, "supabase", "migrations", "20261110000000_create_contact_messages.sql"), "utf8");
  const worker = await readFile(path.join(root, "functions", "api", "contact.js"), "utf8");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all .* from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant insert .* to service_role/i);
  assert.doesNotMatch(migration, /create policy/i);
  assert.match(worker, /siteverify/);
  assert.match(worker, /SUPABASE_SECRET_KEY/);
  assert.match(worker, /return=minimal/);
  assert.match(worker, /secretKey\.startsWith\("eyJ"\)/);
  assert.match(worker, /rest\\\/v1\\\/\?\\?\$/);
  assert.match(worker, /export async function onRequest/);
  assert.match(worker, /env\.TURNSTILE_SECRET/);
});

test("contact messages use created_at while the migration preserves existing timestamps", async () => {
  const schema = await readFile(path.join(root, "supabase", "migrations", "20261110000000_create_contact_messages.sql"), "utf8");
  const migration = await readFile(path.join(root, "supabase", "migrations", "20261110220000_rename_contact_received_at_to_created_at.sql"), "utf8");
  assert.match(schema, /received_at timestamptz not null default now\(\)/i);
  assert.match(migration, /rename column received_at to created_at/i);
});

test("every page uses the same visitor-facing footer", async () => {
  for (const file of await htmlFiles()) {
    const html = await readFile(file, "utf8");
    const footers = [...html.matchAll(/<footer class="site-footer">([\s\S]*?)<\/footer>/g)];
    assert.equal(footers.length, 1, `${path.relative(root, file)} doit avoir un seul pied de page`);
    assert.match(footers[0][1], /Calculs indicatifs selon les paramètres que vous renseignez\./);
    assert.match(footers[0][1], /Outil gratuit, sans inscription\./);
    assert.match(footers[0][1], /Mentions légales/);
    assert.match(footers[0][1], /Confidentialité/);
    assert.match(footers[0][1], /Contact/);
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

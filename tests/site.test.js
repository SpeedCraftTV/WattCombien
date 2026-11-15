import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { calculate, calculateChargingCost, calculateSolar } from "../js/calculations.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function htmlFiles(directory = root) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(fullPath));
    else if (entry.name.endsWith(".html") && fullPath !== path.join(root, "404.html")) files.push(fullPath);
  }
  return files;
}

test("les exemples éditoriaux correspondent aux calculs des simulateurs", async () => {
  const [pc, box, refrigerator, charging] = await Promise.all([
    "pages/guides/cout-pc-gaming.html",
    "pages/simulateurs/box-internet.html",
    "pages/simulateurs/refrigerateur.html",
    "pages/simulateurs/recharge-batterie.html"
  ].map((file) => readFile(path.join(root, file), "utf8")));
  const numberFrom = (html, pattern) => {
    const match = html.match(pattern);
    assert.ok(match, `Résultat absent : ${pattern}`);
    return Number(match[1].replace(",", "."));
  };
  const rounded = (value) => Math.round(value * 100) / 100;
  const pcResult = calculate({ power: 400, hours: 3, days: 7, quantity: 1, price: 0.20 });
  assert.equal(numberFrom(pc, /1,2 × 365 = ([\d,]+) kWh/), rounded(pcResult.annualKwh));
  assert.equal(numberFrom(pc, /438 × 0,20 = ([\d,]+) €/), rounded(pcResult.annualCost));
  assert.equal(numberFrom(pc, /36 kWh, soit ([\d,]+) €/), rounded(pcResult.monthlyCost));
  const boxResult = calculate({ power: 12, hours: 24, days: 7, quantity: 1, price: 0.20 });
  assert.equal(numberFrom(box, /0,288 × 365 = ([\d,]+) kWh/), rounded(boxResult.annualKwh));
  assert.equal(numberFrom(box, /105,12 × 0,20 = ([\d,]+) €/), rounded(boxResult.annualCost));
  assert.equal(numberFrom(box, /8,64 kWh, soit ([\d,]+) €/), rounded(boxResult.monthlyCost));
  const refrigeratorResult = calculate({ power: 25, hours: 24, days: 7, quantity: 1, price: 0.20 });
  assert.equal(numberFrom(refrigerator, /219 × 0,20 = ([\d,]+) €/), rounded(refrigeratorResult.annualCost));
  assert.equal(numberFrom(refrigerator, /219 × 1 000 ÷ \(365 × 24\) = ([\d,]+) W/), 25);
  assert.equal(refrigeratorResult.annualKwh, 219);
  const chargingResult = calculateChargingCost({
    capacity: 60, capacityUnit: "kWh", initialPercent: 20, targetPercent: 80,
    pricePerKwh: 0.20, efficiencyPercent: 90, chargesPerPeriod: 2, period: "week"
  });
  assert.equal(numberFrom(charging, /÷ 100 = ([\d,]+) kWh/), rounded(chargingResult.energyAddedKwh));
  assert.equal(numberFrom(charging, /36 ÷ 0,90 = ([\d,]+) kWh/), rounded(chargingResult.gridEnergyKwh));
  assert.equal(numberFrom(charging, /dont ([\d,]+) kWh de pertes/), rounded(chargingResult.energyLossKwh));
  assert.equal(numberFrom(charging, /40 × 0,20 = ([\d,]+) €/), rounded(chargingResult.costPerCharge));
  assert.equal(numberFrom(charging, /8 × 2 × 52 = ([\d,]+) €/), rounded(chargingResult.annualCost));
});

test("toutes les pages ont un titre unique, un seul H1 et un canonical statique correct", async () => {
  const files = await htmlFiles();
  const titles = new Map();
  const descriptions = new Map();
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const title = html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim();
    assert.ok(title, `${path.relative(root, file)} doit avoir un titre`);
    assert.equal((html.match(/<h1(?:\s|>)/gi) || []).length, 1, `${path.relative(root, file)} doit avoir un H1`);
    const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim();
    assert.ok(description, `${path.relative(root, file)} doit avoir une meta description`);
    assert.match(html, /<body\b[^>]*\bdata-canonical-path=/i, `${path.relative(root, file)} doit définir un chemin canonical configurable`);
    const canonicalPath = html.match(/<body\b[^>]*\bdata-canonical-path="([^"]*)"/i)?.[1];
    const relativePath = path.relative(root, file).split(path.sep).join("/");
    const expectedPath = relativePath === "index.html" ? "" : relativePath.endsWith("/index.html") ? relativePath.slice(0, -"index.html".length) : relativePath.replace(/\.html$/, "");
    assert.equal(canonicalPath, expectedPath, `${relativePath} doit utiliser l’URL Cloudflare sans redirection`);
    const canonicals = [...html.matchAll(/<link\b[^>]*\brel="canonical"\s+href="([^"]+)"/gi)];
    assert.equal(canonicals.length, 1, `${path.relative(root, file)} doit avoir un seul canonical statique`);
    assert.equal(canonicals[0][1], new URL(canonicalPath, "https://wattcombien.pages.dev/").href);
    assert.ok(!titles.has(title), `Titre dupliqué : ${title}`);
    assert.ok(!descriptions.has(description), `Meta description dupliquée : ${description}`);
    titles.set(title, file);
    descriptions.set(description, file);
    const headingLevels = [...html.matchAll(/<h([1-6])(?:\s|>)/gi)].map((match) => Number(match[1]));
    assert.equal(headingLevels[0], 1, `${path.relative(root, file)} doit commencer ses titres par H1`);
    for (let index = 1; index < headingLevels.length; index += 1) {
      assert.ok(headingLevels[index] <= headingLevels[index - 1] + 1, `${path.relative(root, file)} saute un niveau de titre`);
    }
  }
});

test("la page 404 désactive le repli SPA sans entrer dans le sitemap", async () => {
  const html = await readFile(path.join(root, "404.html"), "utf8");
  const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /<h1>Page introuvable<\/h1>/);
  assert.match(html, /href="https:\/\/wattcombien\.pages\.dev\/"/);
  assert.doesNotMatch(sitemap, /\/404(?:\.html)?</);
});

test("les balises Open Graph sont statiques, uniques et alignées sur les métadonnées canoniques", async () => {
  const expectedProperties = ["og:type", "og:locale", "og:site_name", "og:title", "og:description", "og:url"];
  for (const file of await htmlFiles()) {
    const html = await readFile(file, "utf8");
    const metadata = new Map([...html.matchAll(/<meta\s+property="(og:[^"]+)"\s+content="([^"]*)"/gi)].map((match) => [match[1], match[2]]));
    const title = html.match(/<title>(.*?)<\/title>/is)?.[1]?.trim();
    const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1];
    const canonical = html.match(/<link\b[^>]*\brel="canonical"\s+href="([^"]+)"/i)?.[1];
    for (const property of expectedProperties) {
      const propertyCount = [...html.matchAll(/<meta\s+property="([^"]+)"/gi)].filter((match) => match[1] === property).length;
      assert.equal(propertyCount, 1, `${path.relative(root, file)} doit contenir une balise ${property}`);
    }
    const relativePath = path.relative(root, file);
    const expectedType = relativePath.startsWith(path.join("pages", "guides") + path.sep) ? "article" : "website";
    assert.equal(metadata.get("og:type"), expectedType);
    assert.equal(metadata.get("og:locale"), "fr_FR");
    assert.equal(metadata.get("og:site_name"), "WattCombien");
    assert.equal(metadata.get("og:title"), title);
    assert.equal(metadata.get("og:description"), description);
    assert.equal(metadata.get("og:url"), canonical);
  }
});

test("le sitemap ne contient que les URL canoniques du site et robots.txt le référence", async () => {
  const pages = await htmlFiles();
  const canonicalUrls = [];
  for (const file of pages) {
    const html = await readFile(file, "utf8");
    canonicalUrls.push(html.match(/<link\b[^>]*\brel="canonical"\s+href="([^"]+)"/i)?.[1]);
  }
  const sitemap = await readFile(path.join(root, "sitemap.xml"), "utf8");
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1]);
  assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, "Le sitemap ne doit pas répéter d’URL");
  assert.deepEqual([...sitemapUrls].sort(), [...canonicalUrls].sort());
  assert.ok(sitemapUrls.every((url) => url.startsWith("https://wattcombien.pages.dev/")));
  for (const file of pages) {
    const html = await readFile(file, "utf8");
    assert.doesNotMatch(html, /<meta\s+name="robots"[^>]*content="[^"]*noindex/i, `${path.relative(root, file)} ne doit pas être exclue de l’indexation`);
  }
  const robots = await readFile(path.join(root, "robots.txt"), "utf8");
  assert.match(robots, /^Sitemap:\s+https:\/\/wattcombien\.pages\.dev\/sitemap\.xml$/m);
  assert.match(robots, /^Allow:\s+\/$/m);
});

test("les données structurées décrivent le site et les fils d’Ariane visibles", async () => {
  for (const file of await htmlFiles()) {
    const html = await readFile(file, "utf8");
    const canonical = html.match(/<link\b[^>]*\brel="canonical"\s+href="([^"]+)"/i)?.[1];
    const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)]
      .map((match) => JSON.parse(match[1]));
    if (path.relative(root, file) === "index.html") {
      const website = blocks.find((block) => block["@type"] === "WebSite");
      assert.ok(website, "La page d’accueil doit déclarer WebSite");
      assert.equal(website.name, "WattCombien");
      assert.equal(website.url, "https://wattcombien.pages.dev/");
      continue;
    }
    const breadcrumbs = blocks.find((block) => block["@type"] === "BreadcrumbList");
    assert.ok(breadcrumbs, `${path.relative(root, file)} doit déclarer BreadcrumbList`);
    const items = breadcrumbs.itemListElement;
    assert.ok(items.length >= 2);
    assert.deepEqual(items.map((item) => item.position), items.map((_, index) => index + 1));
    assert.equal(items.at(-1).item, canonical);
    const breadcrumbMarkup = html.match(/<p class="breadcrumbs">([\s\S]*?)<\/p>/i)?.[1];
    const visibleBreadcrumb = breadcrumbMarkup?.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    assert.equal(items.map((item) => item.name).join(" / "), visibleBreadcrumb, `${path.relative(root, file)} : le fil JSON-LD doit correspondre au fil visible`);
    const visibleLinks = [...breadcrumbMarkup.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map((match) => match[1]);
    assert.deepEqual(items.map((item) => item.item), [...visibleLinks, canonical], `${path.relative(root, file)} : les URL JSON-LD doivent correspondre aux liens visibles`);
  }
});

test("les textes HTML et les chaînes de l’interface ne contiennent pas de tirets cadratins ou demi-cadratins", async () => {
  const files = [...await htmlFiles(), path.join(root, "js", "app.js"), path.join(root, "js", "simulator.js")];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /[—–]/, `${path.relative(root, file)} contient un tiret long`);
  }
});

test("le comparateur n’insère pas les valeurs des visiteurs comme du HTML", async () => {
  const app = await readFile(path.join(root, "js", "app.js"), "utf8");
  assert.doesNotMatch(app, /\.innerHTML\s*=|\.insertAdjacentHTML\s*\(/);
  assert.match(app, /nameInput\.value = device\.name/);
  assert.match(app, /leaderValue\.textContent = `\$\{items\[0\]\.name/);
});

test("la navigation mobile conserve ses liens et les rend lisibles", async () => {
  const styles = await readFile(path.join(root, "css", "styles.css"), "utf8");
  assert.doesNotMatch(styles, /\.main-nav a:nth-child\(3\)\s*\{\s*display:\s*none\s*;/);
  assert.match(styles, /\.main-nav \{ order: 3; flex: 1 0 100%; justify-content: space-between;/);
  assert.match(styles, /\.main-nav a \{ min-height: 36px; display: inline-flex; align-items: center; font-size: 11px; \}/);
  assert.match(styles, /\.eyebrow, \.hero-note, \.trust-strip>div,[\s\S]*?\.breadcrumbs \{ font-size: 12px; \}/);
});

test("le simulateur HP/HC est relié au site et ne préremplit aucun tarif", async () => {
  const page = await readFile(path.join(root, "pages", "simulateurs", "heures-pleines-creuses.html"), "utf8");
  const homepage = await readFile(path.join(root, "index.html"), "utf8");
  const simulators = await readFile(path.join(root, "pages", "simulateurs", "index.html"), "utf8");
  assert.match(homepage, /pages\/simulateurs\/heures-pleines-creuses"/);
  assert.match(simulators, /pages\/simulateurs\/heures-pleines-creuses"/);
  for (const name of ["annualKwh", "basePrice", "peakPrice", "offPeakPrice", "offPeakPercent"]) {
    const input = page.match(new RegExp(`<input\\b(?=[^>]*\\bname="${name}")[^>]*>`))?.[0];
    assert.ok(input, `${name} doit être présent`);
    assert.match(input, /\brequired\b/);
    assert.doesNotMatch(input, /\bvalue=/);
  }
  assert.match(page, /name="baseSubscription"[^>]*inputmode="decimal"/);
  assert.match(page, /name="timeOfUseSubscription"[^>]*inputmode="decimal"/);
  assert.match(page, /adsense\.js/);
});

test("le calculateur de recharge est listé, accessible et ses valeurs d’exemple sont explicites", async () => {
  const page = await readFile(path.join(root, "pages", "simulateurs", "recharge-batterie.html"), "utf8");
  const simulators = await readFile(path.join(root, "pages", "simulateurs", "index.html"), "utf8");
  assert.match(simulators, /pages\/simulateurs\/recharge-batterie"/);
  assert.match(page, /charging-calculator\.js/);
  assert.match(page, /Les capacités proposées sont uniquement des exemples modifiables/);
  for (const name of ["capacity", "initialPercent", "targetPercent", "efficiencyPercent", "pricePerKwh", "chargesPerPeriod"]) {
    const input = page.match(new RegExp(`<input\\b(?=[^>]*\\bname="${name}")[^>]*>`))?.[0];
    assert.ok(input, `${name} doit être présent`);
    assert.match(input, /\brequired\b/);
    assert.doesNotMatch(input, /\bvalue=/);
    assert.match(input, /aria-describedby="charging-error"/);
  }
  for (const category of ["car", "bike", "laptop", "phone", "powerBank"]) {
    assert.match(page, new RegExp(`<option value="${category}">`));
  }
  assert.match(page, /id="charging-error" class="field-error" role="alert"/);
  assert.match(page, /class="panel charging-results"[^>]*aria-live="polite"/);
});

test("le simulateur de facture est relié au site et ne préremplit aucun tarif", async () => {
  const page = await readFile(path.join(root, "pages", "simulateurs", "facture-electricite.html"), "utf8");
  const simulators = await readFile(path.join(root, "pages", "simulateurs", "index.html"), "utf8");
  assert.match(simulators, /pages\/simulateurs\/facture-electricite"/);
  assert.match(page, /bill-simulator\.js/);
  for (const name of ["consumption", "basePrice", "peakPrice", "offPeakPrice", "offPeakPercent", "subscription"]) {
    const input = page.match(new RegExp(`<input\\b(?=[^>]*\\bname="${name}")[^>]*>`))?.[0];
    assert.ok(input, `${name} doit être présent`);
    assert.match(input, /\brequired\b/);
    assert.doesNotMatch(input, /\bvalue=/);
    assert.match(input, /aria-describedby="bill-error"/);
  }
  assert.match(page, /id="bill-error" class="field-error" role="alert"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /id="bill-copy" type="button" disabled/);
});

test("le simulateur solaire est relié au site et son exemple correspond aux calculs", async () => {
  const page = await readFile(path.join(root, "pages", "simulateurs", "solaire-photovoltaique.html"), "utf8");
  const simulators = await readFile(path.join(root, "pages", "simulateurs", "index.html"), "utf8");
  assert.match(simulators, /pages\/simulateurs\/solaire-photovoltaique"/);
  assert.match(page, /solar-simulator\.js/);
  for (const name of ["capacityKwp", "annualYield", "selfConsumptionPercent", "purchasePrice", "salePrice"]) {
    const input = page.match(new RegExp(`<input\\b(?=[^>]*\\bname="${name}")[^>]*>`))?.[0];
    assert.ok(input, `${name} doit être présent`);
    assert.match(input, /\brequired\b/);
    assert.doesNotMatch(input, /\bvalue=/);
    assert.match(input, /aria-describedby="solar-error"/);
  }
  const result = calculateSolar({ capacityKwp: 3, annualYield: 1100, selfConsumptionPercent: 40, purchasePrice: 0.25, saleEnabled: true, salePrice: 0.1, installationCost: 6000 });
  assert.equal(result.productionKwh, 3300);
  assert.equal(result.selfConsumedKwh, 1320);
  assert.equal(result.surplusKwh, 1980);
  assert.equal(result.savings, 330);
  assert.equal(result.saleRevenue, 198);
  assert.equal(result.annualGrossGain, 528);
  assert.match(page, /3 × 1 100 = 3 300 kWh\/an/);
  assert.match(page, /330 \+ 198 = 528 €\/an/);
  assert.match(page, /6 000 ÷ 528 ≈ 11,36 ans/);
});

test("les noms des estimations sont explicitement masqués dans les éléments destinés à Clarity", async () => {
  const page = await readFile(path.join(root, "index.html"), "utf8");
  for (const id of ["device-name", "results-title"]) {
    assert.match(page, new RegExp(`<[^>]+id="${id}"[^>]+data-clarity-mask="true"`));
  }
});

test("les pages relient les outils complémentaires depuis leur contenu", async () => {
  for (const [file, target] of [
    ["facture-electricite.html", "pages/simulateurs/heures-pleines-creuses"],
    ["heures-pleines-creuses.html", "pages/simulateurs/facture-electricite"],
    ["recharge-batterie.html", "#calculateur"],
    ["pc-gaming.html", "#comparateur"],
    ["veille.html", "pages/simulateurs/facture-electricite"]
  ]) {
    const page = await readFile(path.join(root, "pages", "simulateurs", file), "utf8");
    const article = page.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
    assert.ok(article?.includes(`href="https://wattcombien.pages.dev/${target}"`), `${file} doit relier ${target} dans son contenu`);
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

test("AdSense remains disabled until a compliant CMP is configured", async () => {
  const config = await readFile(path.join(root, "js", "config.js"), "utf8");
  const loader = await readFile(path.join(root, "js", "adsense.js"), "utf8");
  assert.match(config, /adsense:\s*\{\s*enabled:\s*false/);
  assert.match(config, /publisherId:\s*"ca-pub-5689496403962976"/);
  assert.match(loader, /grantsAdsConsent\(tcData\)/);
  assert.match(loader, /adsbygoogle\.js\?client=\$\{encodeURIComponent\(config\.adsense\.publisherId\)\}/);
});

test("Clarity uses the configured project ID and loads asynchronously only from the CMP loader", async () => {
  const config = await readFile(path.join(root, "js", "config.js"), "utf8");
  const loader = await readFile(path.join(root, "js", "clarity.js"), "utf8");
  assert.match(config, /clarity:\s*\{\s*enabled:\s*false/);
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
  assert.match(config, /cloudflareAnalytics:\s*\{\s*enabled:\s*false/);
  assert.match(config, /token:\s*"f53bdf1fc5cd4b86925ed77fcefbf8a3"/);
  assert.match(loader, /https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(loader, /script\.type\s*=\s*"module"/);
  assert.match(loader, /script\.dataset\.cfBeacon\s*=\s*JSON\.stringify\(\{\s*token:\s*config\.cloudflareAnalytics\.token\s*\}\)/);
  assert.match(loader, /grantsWebAnalyticsConsent\(tcData\)/);
  assert.match(loader, /document\.getElementById\(SCRIPT_ID\)/);
  assert.match(entry, /import "\.\/cloudflare-analytics\.js"/);
});

test("contact collection stays paused and the public Contact page uses email only", async () => {
  const config = await readFile(path.join(root, "js", "config.js"), "utf8");
  const loader = await readFile(path.join(root, "js", "contact-form.js"), "utf8");
  const page = await readFile(path.join(root, "pages", "contact.html"), "utf8");
  const privacy = await readFile(path.join(root, "pages", "confidentialite.html"), "utf8");
  assert.match(config, /contact:\s*\{\s*enabled:\s*false/);
  assert.match(config, /legalSettingsApproved:\s*false/);
  assert.match(config, /turnstileSiteKey:\s*"0x4AAAAAAF7Td1S4Wd6MOzt-"/);
  assert.match(config, /contactRetentionDays:\s*365/);
  assert.match(loader, /config\.contact\.enabled/);
  assert.match(loader, /config\.contact\.legalSettingsApproved === true/);
  assert.match(loader, /config\.legal\.contactRetentionDays/);
  assert.match(loader, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(loader, /form\.checkValidity\(\)/);
  assert.match(loader, /turnstileToken = token/);
  assert.doesNotMatch(page, /<form\b|contact-form\.js/i);
  assert.match(page, /href="mailto:speedoutv\.pro@gmail\.com"/);
  assert.match(privacy, /n’envoie pas de demande à Supabase ou à Turnstile/);
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
  assert.match(legal, /article 1-1, II/);
  assert.match(legal, /L’absence d’entreprise ou d’immatriculation ne suffit pas/);
  assert.match(legal, /restent à confirmer/);
  assert.doesNotMatch(legal, /article 6, III, 2/);
  assert.match(privacy, /article 13 du RGPD/);
  assert.match(privacy, /Aucune CMP n’est actuellement installée/);
  assert.match(privacy, /Sans signal de consentement TCF, le code du site ne charge pas Microsoft Clarity ni Cloudflare Web Analytics/);
  assert.match(privacy, /aucun formulaire de contact/);
  assert.doesNotMatch(privacy, /Cloudflare Pages Function/);
  assert.doesNotMatch(privacy, /Cloudflare Worker/);
  assert.match(contact, /ne propose actuellement aucun formulaire de contact/);
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

test("les liens de navigation internes utilisent les URL canoniques Cloudflare", async () => {
  const siteOrigin = "https://wattcombien.pages.dev";
  for (const file of await htmlFiles()) {
    const html = await readFile(file, "utf8");
    const anchors = [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map((match) => match[1]);
    for (const href of anchors) {
      if (href.startsWith("#") || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
      assert.fail(`${path.relative(root, file)} contient encore un lien relatif : ${href}`);
    }
    for (const href of anchors) {
      if (href.startsWith("#") || /^(?:mailto:|tel:)/i.test(href)) continue;
      const url = new URL(href, siteOrigin);
      if (url.origin !== siteOrigin) continue;
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      else if (!path.extname(pathname)) pathname += ".html";
      const target = path.resolve(root, pathname.slice(1));
      await stat(target).catch((issue) => {
        throw new Error(`${path.relative(root, file)}: canonical link "${href}" is broken (${issue.message})`);
      });
      if (url.hash && target.endsWith(".html")) {
        const targetHtml = await readFile(target, "utf8");
        const fragment = decodeURIComponent(url.hash.slice(1));
        assert.ok(new RegExp(`\\bid="${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(targetHtml), `${path.relative(root, file)}: missing #${fragment} in ${path.relative(root, target)}`);
      }
      const targetHtml = await readFile(target, "utf8");
      const canonical = targetHtml.match(/<link\b[^>]*\brel="canonical"\s+href="([^"]+)"/i)?.[1];
      assert.equal(`${url.origin}${url.pathname}`, canonical, `${path.relative(root, file)} : le lien interne doit viser l’URL canonique`);
    }
  }
});

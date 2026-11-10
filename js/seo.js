import { config } from "./config.js";

const canonicalPath = document.body.dataset.canonicalPath;
const title = document.querySelector("title")?.textContent;
const description = document.querySelector('meta[name="description"]')?.content;

for (const [property, content] of [
  ["og:type", "website"],
  ["og:locale", "fr_FR"],
  ["og:title", title],
  ["og:description", description]
]) {
  if (!content || document.querySelector(`meta[property="${property}"]`)) continue;
  const meta = document.createElement("meta");
  meta.setAttribute("property", property);
  meta.content = content;
  document.head.append(meta);
}

if (config.siteUrl && canonicalPath !== undefined) {
  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = new URL(canonicalPath, `${config.siteUrl.replace(/\/+$/, "")}/`).href;
  document.head.append(canonical);
  const ogUrl = document.createElement("meta");
  ogUrl.setAttribute("property", "og:url");
  ogUrl.content = canonical.href;
  document.head.append(ogUrl);
}

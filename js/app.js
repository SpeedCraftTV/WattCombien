import { calculate, formatEuro, formatNumber } from "./calculations.js";
import "./seo.js";

const $ = (selector, root = document) => root.querySelector(selector);
const form = $("#calculator-form");
const error = $("#form-error");
const status = $("#action-status");
const money = (value) => formatEuro(value);
const number = (value, digits = 2) => formatNumber(value, digits);

function readForm() {
  return {
    name: $("#device-name").value.trim() || "Appareil sans nom",
    power: Number($("#power").value),
    hours: Number($("#hours").value),
    days: Number($("#days").value),
    price: Number($("#price").value),
    quantity: Number($("#quantity").value)
  };
}

function validateInput(input) {
  for (const field of form.querySelectorAll("input[required]")) {
    if (field.value.trim() === "" || !field.checkValidity()) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
      throw new RangeError(`Vérifiez le champ « ${field.labels[0]?.textContent.trim() || field.name} ».`);
    }
    field.removeAttribute("aria-invalid");
  }
  return calculate(input);
}

function renderChart(result) {
  const values = [result.dailyCost, result.weeklyCost, result.monthlyCost, result.annualCost];
  const max = Math.max(...values, 0);
  const chart = $("#cost-chart");
  chart.replaceChildren();
  values.forEach((value, index) => {
    const column = document.createElement("div");
    column.className = "chart-column";
    const bar = document.createElement("span");
    bar.className = `chart-bar${index === 3 ? " chart-bar-highlight" : ""}`;
    bar.style.height = `${max === 0 ? 2 : Math.max(2, value / max * 100)}%`;
    bar.title = money(value);
    bar.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "chart-value";
    label.textContent = number(value);
    column.append(bar, label);
    chart.append(column);
  });
}

function updateMain() {
  try {
    const input = readForm();
    const result = validateInput(input);
    error.textContent = "";
    $("#results-title").textContent = input.name;
    $("#annual-cost").textContent = money(result.annualCost);
    $("#annual-energy").textContent = `${number(result.annualKwh)} kWh`;
    $("#daily-cost").textContent = money(result.dailyCost);
    $("#weekly-cost").textContent = money(result.weeklyCost);
    $("#monthly-cost").textContent = money(result.monthlyCost);
    renderChart(result);
    form.dataset.valid = "true";
    return { input, result };
  } catch (issue) {
    error.textContent = issue.message;
    form.dataset.valid = "false";
    return null;
  }
}

for (const field of form.querySelectorAll("input")) field.addEventListener("input", updateMain);
form.addEventListener("reset", () => requestAnimationFrame(() => { error.textContent = ""; updateMain(); }));
const currentYear = $("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const savedKey = "wattcombien.saved-estimates";
$("#save-button").addEventListener("click", () => {
  const current = updateMain();
  if (!current) return;
  try {
    const saved = JSON.parse(localStorage.getItem(savedKey) || "[]");
    saved.push({ ...current.input, ...current.result, savedAt: new Date().toISOString() });
    localStorage.setItem(savedKey, JSON.stringify(saved.slice(-20)));
    status.textContent = "Estimation enregistrée dans ce navigateur.";
  } catch (issue) {
    status.textContent = `Impossible d’enregistrer l’estimation : ${issue.message}`;
  }
});

function resultText() {
  const current = updateMain();
  if (!current) return null;
  const { input, result } = current;
  return `${input.name} : ${input.power} W, ${input.hours} h/jour, ${input.days} j/semaine, ${input.quantity} appareil(s), ${number(input.price, 4)} €/kWh. Coût estimé : ${money(result.monthlyCost)} sur 30 jours et ${money(result.annualCost)} par an (${number(result.annualKwh)} kWh/an).`;
}

$("#copy-button").addEventListener("click", async () => {
  const text = resultText();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Résultats copiés dans le presse-papiers.";
  } catch {
    status.textContent = "Copie indisponible dans ce contexte. Utilisez le partage ou exportez en CSV.";
  }
});

$("#share-button").addEventListener("click", async () => {
  const current = updateMain();
  if (!current) return;
  const { input } = current;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries({ name: input.name, power: input.power, hours: input.hours, days: input.days, price: input.price, quantity: input.quantity })) url.searchParams.set(key, String(value));
  try {
    await navigator.clipboard.writeText(url.href);
    status.textContent = "Lien de partage copié.";
  } catch {
    window.prompt("Copiez ce lien de partage :", url.href);
  }
});

$("#csv-button").addEventListener("click", () => {
  const current = updateMain();
  if (!current) return;
  const { input, result } = current;
  const rows = [
    ["Appareil", "Puissance (W)", "Heures/jour", "Jours/semaine", "Quantité", "Prix (EUR/kWh)", "Énergie (kWh/an)", "Coût/jour (EUR)", "Coût/semaine (EUR)", "Coût/30 jours (EUR)", "Coût/an (EUR)"],
    [input.name, input.power, input.hours, input.days, input.quantity, input.price, result.annualKwh, result.dailyCost, result.weeklyCost, result.monthlyCost, result.annualCost]
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => {
    const value = String(cell);
    const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replaceAll('"', '""')}"`;
  }).join(";")).join("\r\n")}`;
  const downloadUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "estimation-wattcombien.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  status.textContent = "Fichier CSV téléchargé.";
});

function loadSharedParams() {
  const params = new URLSearchParams(location.search);
  const keys = ["power", "hours", "days", "price", "quantity", "name"];
  if (!keys.some((key) => params.has(key))) return;
  for (const key of keys) {
    const field = form.elements.namedItem(key);
    if (field && params.has(key)) field.value = params.get(key);
  }
  updateMain();
}

const themeKey = "wattcombien.theme";
const themeButton = $(".theme-toggle");
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.setAttribute("aria-label", theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre");
  $(".theme-label").textContent = theme === "dark" ? "Thème clair" : "Thème sombre";
}
try {
  setTheme(localStorage.getItem(themeKey) || "dark");
} catch (issue) {
  setTheme("dark");
  status.textContent = `Le thème ne peut pas être mémorisé : ${issue.message}`;
}
themeButton.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(theme);
  try {
    localStorage.setItem(themeKey, theme);
  } catch (issue) {
    status.textContent = `Le thème a changé mais ne peut pas être mémorisé : ${issue.message}`;
  }
});

let compareId = 0;
const comparisonList = $("#comparison-list");
const presets = [
  { name: "Ordinateur portable", power: 65, hours: 6, days: 5, quantity: 1 },
  { name: "Écran", power: 35, hours: 6, days: 5, quantity: 1 }
];

function addComparisonCard(device = { name: "Nouvel appareil", power: 100, hours: 3, days: 7, quantity: 1 }) {
  const id = ++compareId;
  const card = document.createElement("article");
  card.className = "compare-card";
  card.dataset.compareId = String(id);
  card.innerHTML = `<div class="compare-card-head"><label for="compare-name-${id}">Appareil ${id}</label><button type="button" class="remove-device" aria-label="Supprimer l’appareil ${id}">×</button></div>
    <input id="compare-name-${id}" data-key="name" type="text" maxlength="60" value="${device.name.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;")}" aria-label="Nom de l’appareil ${id}">
    <div class="compare-fields"><label>Puissance (W)<input data-key="power" type="number" min="0" max="1000000" step="any" value="${device.power}"></label><label>h/jour<input data-key="hours" type="number" min="0" max="24" step="any" value="${device.hours}"></label><label>j/semaine<input data-key="days" type="number" min="0" max="7" step="1" value="${device.days}"></label><label>Quantité<input data-key="quantity" type="number" min="1" max="10000" step="1" value="${device.quantity}"></label></div>
    <div class="compare-cost"><span>Coût annuel estimé</span><strong>En attente</strong><small>En attente</small></div>`;
  card.addEventListener("input", updateComparison);
  $(".remove-device", card).addEventListener("click", () => { card.remove(); updateComparison(); });
  comparisonList.append(card);
  updateComparison();
}

function updateComparison() {
  const items = [];
  let invalid = false;
  for (const card of comparisonList.querySelectorAll(".compare-card")) {
    const cardFields = [...card.querySelectorAll("[data-key]")];
    if (cardFields.some((field) => field.dataset.key !== "name" && (field.value.trim() === "" || !field.checkValidity()))) {
      card.classList.add("invalid");
      $(".compare-cost strong", card).textContent = "Valeurs à vérifier";
      $(".compare-cost small", card).textContent = "Vérifiez les limites de chaque champ.";
      invalid = true;
      continue;
    }
    const data = Object.fromEntries(cardFields.map((field) => [field.dataset.key, field.dataset.key === "name" ? field.value.trim() : Number(field.value)]));
    try {
      const result = calculate({ ...data, price: Number($("#price").value) });
      card.classList.remove("invalid");
      $(".compare-cost strong", card).textContent = money(result.annualCost);
      $(".compare-cost small", card).textContent = `${number(result.annualKwh)} kWh/an`;
      items.push({ ...data, result, card });
    } catch {
      card.classList.add("invalid");
      $(".compare-cost strong", card).textContent = "Valeurs à vérifier";
      $(".compare-cost small", card).textContent = "Heures : de 0 à 24, jours : de 0 à 7.";
      invalid = true;
    }
  }
  const summary = $("#comparison-summary");
  summary.replaceChildren();
  if (!items.length) {
    summary.textContent = "Ajoutez au moins un appareil pour afficher le classement.";
    return;
  }
  items.sort((a, b) => b.result.annualCost - a.result.annualCost);
  const leader = document.createElement("div");
  leader.innerHTML = `<span>Le plus coûteux dans cette estimation</span><strong>${items[0].name || "Appareil sans nom"} · ${money(items[0].result.annualCost)} / an</strong>`;
  summary.append(leader);
  const details = document.createElement("p");
  details.textContent = invalid ? "Corrigez les valeurs signalées pour inclure tous les appareils au classement." : items.length > 1 ? `Écart entre le plus et le moins coûteux : ${money(items[0].result.annualCost - items.at(-1).result.annualCost)} par an. L’économie théorique maximale en remplaçant le premier par le dernier est la même, si le service rendu est équivalent.` : "Ajoutez un second appareil pour connaître l’écart de coût.";
  summary.append(details);
  for (const [index, item] of items.entries()) {
    item.card.style.setProperty("--rank", String(items.length - index));
    item.card.setAttribute("aria-label", `Rang ${index + 1} : ${item.name || "Appareil sans nom"}, ${money(item.result.annualCost)} par an`);
  }
}

presets.forEach(addComparisonCard);
$("#add-device").addEventListener("click", () => addComparisonCard());
$("#price").addEventListener("input", updateComparison);
loadSharedParams();
updateMain();

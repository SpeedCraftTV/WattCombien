import { calculate, formatEuro, formatNumber } from "./calculations.js";
import { setupSavedEstimates } from "./saved-estimates.js";
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
    for (const id of ["annual-cost", "annual-energy", "daily-cost", "weekly-cost", "monthly-cost"]) {
      $(`#${id}`).textContent = "En attente";
    }
    $("#cost-chart").replaceChildren();
    return null;
  }
}

for (const field of form.querySelectorAll("input")) field.addEventListener("input", updateMain);
form.addEventListener("reset", () => requestAnimationFrame(() => {
  error.textContent = "";
  updateMain();
  updateComparison();
}));
const currentYear = $("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

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
  url.search = "";
  url.hash = "";
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
  const header = document.createElement("div");
  header.className = "compare-card-head";
  const title = document.createElement("label");
  title.htmlFor = `compare-name-${id}`;
  title.textContent = `Appareil ${id}`;
  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-device";
  removeButton.setAttribute("aria-label", `Supprimer l’appareil ${id}`);
  removeButton.textContent = "×";
  header.append(title, removeButton);

  const nameInput = document.createElement("input");
  nameInput.id = `compare-name-${id}`;
  nameInput.dataset.key = "name";
  nameInput.type = "text";
  nameInput.maxLength = 60;
  nameInput.value = device.name;
  nameInput.setAttribute("aria-label", `Nom de l’appareil ${id}`);
  nameInput.setAttribute("data-clarity-mask", "true");

  const fields = document.createElement("div");
  fields.className = "compare-fields";
  for (const [key, labelText, min, max, step] of [
    ["power", "Puissance (W)", "0", "1000000", "any"],
    ["hours", "h/jour", "0", "24", "any"],
    ["days", "j/semaine", "0", "7", "1"],
    ["quantity", "Quantité", "1", "10000", "1"]
  ]) {
    const label = document.createElement("label");
    label.append(document.createTextNode(labelText));
    const input = document.createElement("input");
    input.dataset.key = key;
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = String(device[key]);
    label.append(input);
    fields.append(label);
  }

  const cost = document.createElement("div");
  cost.className = "compare-cost";
  const costLabel = document.createElement("span");
  costLabel.textContent = "Coût annuel estimé";
  const costValue = document.createElement("strong");
  costValue.textContent = "En attente";
  const costEnergy = document.createElement("small");
  costEnergy.textContent = "En attente";
  cost.append(costLabel, costValue, costEnergy);
  card.append(header, nameInput, fields, cost);
  card.addEventListener("input", updateComparison);
  removeButton.addEventListener("click", () => { card.remove(); updateComparison(); });
  comparisonList.append(card);
  updateComparison();
}

function updateComparison() {
  const items = [];
  let invalid = false;
  const price = $("#price");
  const summary = $("#comparison-summary");
  if (price.value.trim() === "" || !price.checkValidity()) {
    for (const card of comparisonList.querySelectorAll(".compare-card")) {
      card.classList.add("invalid");
      card.removeAttribute("aria-label");
      $(".compare-cost strong", card).textContent = "Tarif invalide";
      $(".compare-cost small", card).textContent = "Renseignez un prix du kWh valide.";
    }
    summary.textContent = "Renseignez un prix du kWh valide dans le calculateur pour comparer les appareils.";
    return;
  }
  for (const card of comparisonList.querySelectorAll(".compare-card")) {
    const cardFields = [...card.querySelectorAll("[data-key]")];
    if (cardFields.some((field) => field.dataset.key !== "name" && (field.value.trim() === "" || !field.checkValidity()))) {
      card.classList.add("invalid");
      $(".compare-cost strong", card).textContent = "Valeurs à vérifier";
      $(".compare-cost small", card).textContent = "Vérifiez les limites de chaque champ.";
      card.removeAttribute("aria-label");
      invalid = true;
      continue;
    }
    const data = Object.fromEntries(cardFields.map((field) => [field.dataset.key, field.dataset.key === "name" ? field.value.trim() : Number(field.value)]));
    try {
      const result = calculate({ ...data, price: Number(price.value) });
      card.classList.remove("invalid");
      $(".compare-cost strong", card).textContent = money(result.annualCost);
      $(".compare-cost small", card).textContent = `${number(result.annualKwh)} kWh/an`;
      items.push({ ...data, result, card });
    } catch {
      card.classList.add("invalid");
      $(".compare-cost strong", card).textContent = "Valeurs à vérifier";
      $(".compare-cost small", card).textContent = "Heures : de 0 à 24, jours : de 0 à 7.";
      card.removeAttribute("aria-label");
      invalid = true;
    }
  }
  summary.replaceChildren();
  if (!items.length) {
    summary.textContent = "Ajoutez au moins un appareil pour afficher le classement.";
    return;
  }
  items.sort((a, b) => b.result.annualCost - a.result.annualCost);
  const leader = document.createElement("div");
  const leaderLabel = document.createElement("span");
  leaderLabel.textContent = "Le plus coûteux dans cette estimation";
  const leaderValue = document.createElement("strong");
  leaderValue.textContent = `${items[0].name || "Appareil sans nom"} · ${money(items[0].result.annualCost)} / an`;
  leaderValue.setAttribute("data-clarity-mask", "true");
  leader.append(leaderLabel, leaderValue);
  summary.append(leader);
  const details = document.createElement("p");
  details.textContent = invalid ? "Corrigez les valeurs signalées pour inclure tous les appareils au classement." : items.length > 1 ? `Écart entre le plus et le moins coûteux : ${money(items[0].result.annualCost - items.at(-1).result.annualCost)} par an. L’économie théorique maximale en remplaçant le premier par le dernier est la même, si le service rendu est équivalent.` : "Ajoutez un second appareil pour connaître l’écart de coût.";
  summary.append(details);
  for (const [index, item] of items.entries()) {
    item.card.style.setProperty("--rank", String(items.length - index));
    item.card.setAttribute("aria-label", `Rang ${index + 1} : ${money(item.result.annualCost)} par an`);
  }
}

presets.forEach(addComparisonCard);
$("#add-device").addEventListener("click", () => addComparisonCard());
$("#price").addEventListener("input", updateComparison);
loadSharedParams();
updateMain();
updateComparison();
setupSavedEstimates({
  getCurrent: updateMain,
  restore(input) {
    for (const [key, value] of Object.entries(input)) form.elements.namedItem(key).value = String(value);
    updateMain();
    updateComparison();
  }
});

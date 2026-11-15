import { calculate, formatEuro, formatNumber } from "./calculations.js";

const savedKey = "wattcombien.saved-estimates";
const limit = 20;

class InvalidSavedData extends Error {}

function readSaved() {
  const raw = localStorage.getItem(savedKey);
  if (raw === null) return [];
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (issue) {
    if (!(issue instanceof SyntaxError)) throw issue;
    throw new InvalidSavedData();
  }
  if (!Array.isArray(saved)) throw new InvalidSavedData();
  return saved;
}

function validatedEstimate(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) || typeof entry.name !== "string") return null;
  for (const key of ["power", "hours", "days", "price", "quantity"]) {
    if (typeof entry[key] !== "number" || !Number.isFinite(entry[key])) return null;
  }
  if (entry.power > 1000000 || entry.price > 10000 || entry.quantity > 10000) return null;
  try {
    const result = calculate(entry);
    return { input: {
      name: entry.name, power: entry.power, hours: entry.hours,
      days: entry.days, price: entry.price, quantity: entry.quantity
    }, result };
  } catch (issue) {
    if (issue instanceof TypeError || issue instanceof RangeError) return null;
    throw issue;
  }
}

export function setupSavedEstimates({ getCurrent, restore }) {
  const list = document.querySelector("#saved-list");
  const count = document.querySelector("#saved-count");
  const status = document.querySelector("#saved-status");
  const clearButton = document.querySelector("#clear-saved");
  const saveButton = document.querySelector("#save-button");
  const dashboardMessage = document.querySelector("#dashboard-message");
  const dashboardContent = document.querySelector("#dashboard-content");
  const ranking = document.querySelector("#dashboard-ranking");

  function restoreEstimate(input) {
    restore(input);
    status.textContent = "Estimation restaurée et résultats recalculés.";
  }

  function renderDashboard(estimates, invalidCount) {
    ranking.replaceChildren();
    dashboardContent.hidden = estimates.length === 0;
    if (!estimates.length) {
      dashboardMessage.textContent = invalidCount
        ? `${invalidCount} estimation(s) illisible(s), exclue(s) du tableau de bord. Consultez « Mes estimations ».`
        : "Aucune estimation enregistrée. Utilisez « Enregistrer sur cet appareil » pour commencer.";
      return;
    }

    dashboardMessage.textContent = `${estimates.length} estimation(s) prise(s) en compte${invalidCount ? ` ; ${invalidCount} estimation(s) illisible(s) exclue(s).` : "."}`;
    const devices = estimates.reduce((total, entry) => total + entry.input.quantity, 0);
    const annualEnergy = estimates.reduce((total, entry) => total + entry.result.annualKwh, 0);
    const annualCost = estimates.reduce((total, entry) => total + entry.result.annualCost, 0);
    document.querySelector("#dashboard-devices").textContent = formatNumber(devices, 0);
    document.querySelector("#dashboard-energy").textContent = `${formatNumber(annualEnergy)} kWh / an`;
    document.querySelector("#dashboard-monthly").textContent = `${formatEuro(annualCost / 12)} / mois`;
    document.querySelector("#dashboard-annual").textContent = `${formatEuro(annualCost)} / an`;

    const ordered = [...estimates].sort((a, b) => b.result.annualCost - a.result.annualCost);
    ordered.forEach(({ input, result }, index) => {
      const item = document.createElement("li");
      const line = document.createElement("div");
      line.className = "dashboard-entry";
      const name = document.createElement("strong");
      name.id = `dashboard-name-${index}`;
      name.setAttribute("data-clarity-mask", "true");
      name.textContent = `${input.name || "Appareil sans nom"} (${input.quantity})`;
      const detail = document.createElement("span");
      const share = annualCost === 0 ? null : result.annualCost / annualCost * 100;
      detail.textContent = `${formatEuro(result.annualCost)} / an · ${share === null ? "Part indéterminée (total nul)" : `${formatNumber(share)} % du total`}`;
      line.append(name, detail);
      const bar = document.createElement("div");
      bar.className = "dashboard-bar";
      bar.setAttribute("aria-hidden", "true");
      const fill = document.createElement("span");
      fill.style.width = `${share ?? 0}%`;
      bar.append(fill);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button button-outline";
      button.textContent = "Restaurer";
      button.setAttribute("aria-label", `Restaurer l’estimation classée ${index + 1}`);
      button.setAttribute("aria-describedby", name.id);
      button.addEventListener("click", () => {
        restoreEstimate(input);
        document.querySelector("#device-name").focus();
      });
      item.append(line, bar, button);
      ranking.append(item);
    });
  }

  function showError(issue) {
    status.textContent = issue instanceof InvalidSavedData
      ? "Historique illisible : aucune donnée n’a été modifiée. Vous pouvez vider l’historique après confirmation."
      : "Accès ou écriture impossible : le stockage local est indisponible ou plein. Vérifiez les réglages du navigateur.";
  }

  function render(message = "") {
    let saved;
    try {
      saved = readSaved();
    } catch (issue) {
      list.replaceChildren();
      count.textContent = "Nombre d’estimations indisponible.";
      clearButton.disabled = !(issue instanceof InvalidSavedData);
      ranking.replaceChildren();
      dashboardContent.hidden = true;
      dashboardMessage.textContent = "Tableau de bord indisponible : consultez le message dans « Mes estimations ».";
      showError(issue);
      return;
    }

    count.textContent = `${saved.length} / ${limit} estimations${saved.length >= limit ? " : limite atteinte, supprimez une estimation avant d’en enregistrer une autre." : "."}`;
    status.textContent = message;
    clearButton.disabled = saved.length === 0;
    list.replaceChildren();
    const validatedEntries = saved.map(validatedEstimate);
    const validEntries = validatedEntries.filter(Boolean);
    renderDashboard(validEntries, saved.length - validEntries.length);
    saved.forEach((entry, index) => {
      const validated = validatedEntries[index];
      const signature = JSON.stringify(entry);
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.id = `saved-name-${index}`;
      title.setAttribute("data-clarity-mask", "true");
      title.textContent = validated ? validated.input.name || "Appareil sans nom" : `Estimation illisible n° ${index + 1}`;
      const details = document.createElement("p");
      details.textContent = validated
        ? `${numberDetails(validated.input)} · ${formatEuro(validated.result.annualCost)} / an`
        : "Cette estimation ne peut pas être restaurée. Vous pouvez la supprimer.";
      const actions = document.createElement("div");
      actions.className = "form-actions";
      if (validated) {
        const restoreButton = document.createElement("button");
        restoreButton.type = "button";
        restoreButton.className = "button button-outline";
        restoreButton.textContent = "Restaurer";
        restoreButton.setAttribute("aria-label", `Restaurer l’estimation ${index + 1}`);
        restoreButton.setAttribute("aria-describedby", title.id);
        restoreButton.addEventListener("click", () => restoreEstimate(validated.input));
        actions.append(restoreButton);
      }
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button button-quiet";
      deleteButton.textContent = "Supprimer";
      deleteButton.setAttribute("aria-label", `Supprimer l’estimation ${index + 1}`);
      deleteButton.setAttribute("aria-describedby", title.id);
      deleteButton.addEventListener("click", () => {
        try {
          const current = readSaved();
          if (index >= current.length || JSON.stringify(current[index]) !== signature) {
            render("L’historique a changé ; vérifiez la liste avant de supprimer.");
            return;
          }
          current.splice(index, 1);
          localStorage.setItem(savedKey, JSON.stringify(current));
        } catch (issue) {
          showError(issue);
          return;
        }
        render("Estimation supprimée.");
        document.querySelector("#saved-estimates-title").focus();
      });
      actions.append(deleteButton);
      item.append(title, details, actions);
      list.append(item);
    });
  }

  saveButton.addEventListener("click", () => {
    const current = getCurrent();
    if (!current) {
      status.textContent = "Corrigez les valeurs du calculateur avant d’enregistrer.";
      return;
    }
    try {
      const saved = readSaved();
      if (saved.length >= limit) {
        render("Limite atteinte : aucune estimation n’a été remplacée.");
        return;
      }
      saved.push({ ...current.input, ...current.result, savedAt: new Date().toISOString() });
      localStorage.setItem(savedKey, JSON.stringify(saved));
    } catch (issue) {
      showError(issue);
      return;
    }
    render("Estimation enregistrée dans ce navigateur.");
  });

  clearButton.addEventListener("click", () => {
    if (!window.confirm("Supprimer définitivement toutes les estimations enregistrées dans ce navigateur ?")) return;
    try {
      localStorage.removeItem(savedKey);
    } catch (issue) {
      showError(issue);
      return;
    }
    render("Historique supprimé.");
    saveButton.focus();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === savedKey || event.key === null) render("Historique actualisé depuis un autre onglet.");
  });
  render();
}

function numberDetails(input) {
  return `${formatNumber(input.power)} W · ${formatNumber(input.hours)} h/j · ${input.days} j/sem · ${input.quantity} appareil(s) · ${formatNumber(input.price, 4)} €/kWh`;
}

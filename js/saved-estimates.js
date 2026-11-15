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
      showError(issue);
      return;
    }

    count.textContent = `${saved.length} / ${limit} estimations${saved.length >= limit ? " : limite atteinte, supprimez une estimation avant d’en enregistrer une autre." : "."}`;
    status.textContent = message;
    clearButton.disabled = saved.length === 0;
    list.replaceChildren();
    saved.forEach((entry, index) => {
      const validated = validatedEstimate(entry);
      const signature = JSON.stringify(entry);
      const item = document.createElement("li");
      const title = document.createElement("strong");
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
        restoreButton.setAttribute("aria-label", `Restaurer ${title.textContent}`);
        restoreButton.addEventListener("click", () => {
          restore(validated.input);
          status.textContent = "Estimation restaurée et résultats recalculés.";
        });
        actions.append(restoreButton);
      }
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button button-quiet";
      deleteButton.textContent = "Supprimer";
      deleteButton.setAttribute("aria-label", `Supprimer ${title.textContent}`);
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

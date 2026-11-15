import { calculateSolar, formatEuro, formatNumber } from "./calculations.js";
import "./seo.js";

const form = document.querySelector("#solar-form");
const error = document.querySelector("#solar-error");
const saleFields = document.querySelector("#solar-sale-fields");
const fields = Object.fromEntries([
  "capacityKwp", "annualYield", "selfConsumptionPercent", "purchasePrice",
  "saleEnabled", "salePrice", "installationCost"
].map((name) => [name, form.elements.namedItem(name)]));
const numericFields = [
  fields.capacityKwp, fields.annualYield, fields.selfConsumptionPercent,
  fields.purchasePrice, fields.salePrice, fields.installationCost
];
const outputIds = [
  "solar-production", "solar-consumed", "solar-surplus", "solar-savings",
  "solar-revenue", "solar-gain", "solar-payback"
];

function resetResults() {
  for (const id of outputIds) document.querySelector(`#${id}`).textContent = "En attente";
}

function energy(value) {
  return value > 0 && value < 0.01 ? "< 0,01 kWh" : `${formatNumber(value)} kWh`;
}

function money(value) {
  return value > 0 && value < 0.01 ? "< 0,01 €" : formatEuro(value);
}

function update() {
  const saleEnabled = fields.saleEnabled.checked;
  saleFields.hidden = !saleEnabled;
  fields.salePrice.disabled = !saleEnabled;
  let invalidField;
  for (const field of numericFields) {
    if (field.disabled) {
      field.removeAttribute("aria-invalid");
      continue;
    }
    const missing = field.required && field.value.trim() === "";
    if (missing || !field.checkValidity()) {
      field.setAttribute("aria-invalid", "true");
      invalidField ??= { field, missing };
    } else {
      field.removeAttribute("aria-invalid");
    }
  }
  if (invalidField) {
    error.textContent = invalidField.missing
      ? "Complétez les champs obligatoires pour afficher l’estimation."
      : `Vérifiez le champ « ${invalidField.field.labels[0]?.textContent.trim() || invalidField.field.name} ».`;
    resetResults();
    return;
  }

  const values = {
    capacityKwp: Number(fields.capacityKwp.value),
    annualYield: Number(fields.annualYield.value),
    selfConsumptionPercent: Number(fields.selfConsumptionPercent.value),
    purchasePrice: Number(fields.purchasePrice.value),
    saleEnabled,
    salePrice: saleEnabled ? Number(fields.salePrice.value) : 0,
    installationCost: fields.installationCost.value.trim() === "" ? null : Number(fields.installationCost.value)
  };
  try {
    const result = calculateSolar(values);
    error.textContent = "";
    document.querySelector("#solar-production").textContent = `${energy(result.productionKwh)} / an`;
    document.querySelector("#solar-consumed").textContent = `${energy(result.selfConsumedKwh)} / an`;
    document.querySelector("#solar-surplus").textContent = `${energy(result.surplusKwh)} / an`;
    document.querySelector("#solar-savings").textContent = `${money(result.savings)} / an`;
    document.querySelector("#solar-revenue").textContent = `${money(result.saleRevenue)} / an${saleEnabled ? "" : " (vente désactivée)"}`;
    document.querySelector("#solar-gain").textContent = `${money(result.annualGrossGain)} / an`;
    document.querySelector("#solar-payback").textContent = values.installationCost === null
      ? "Coût initial non renseigné"
      : result.paybackYears === null
        ? "Non calculable : gain annuel nul"
        : result.paybackYears > 0 && result.paybackYears < 0.01
          ? "Moins de 0,01 an"
          : `${formatNumber(result.paybackYears)} ans`;
  } catch (issue) {
    if (!(issue instanceof TypeError || issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    resetResults();
  }
}

form.addEventListener("input", update);
form.addEventListener("change", update);
form.addEventListener("submit", (event) => event.preventDefault());

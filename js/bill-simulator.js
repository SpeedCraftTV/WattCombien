import { calculateElectricityBill, formatEuro, formatNumber } from "./calculations.js";
import "./seo.js";

const form = document.querySelector("#bill-form");
const error = document.querySelector("#bill-error");
const copyButton = document.querySelector("#bill-copy");
const copyStatus = document.querySelector("#bill-copy-status");
const fields = Object.fromEntries([
  "consumption", "consumptionPeriod", "tariff", "basePrice", "peakPrice",
  "offPeakPrice", "offPeakPercent", "subscription", "subscriptionPeriod",
  "extraFees", "extraFeesPeriod"
].map((name) => [name, form.elements.namedItem(name)]));
const numericFields = [
  fields.consumption, fields.basePrice, fields.peakPrice, fields.offPeakPrice,
  fields.offPeakPercent, fields.subscription, fields.extraFees
];
const outputIds = [
  "bill-energy", "bill-subscription", "bill-fees",
  "bill-energy-share", "bill-subscription-share", "bill-fees-share",
  "bill-monthly", "bill-annual"
];
let currentResult = null;

function resetResults() {
  currentResult = null;
  copyButton.disabled = true;
  for (const id of outputIds) document.querySelector(`#${id}`).textContent = "En attente";
}

function updateTariffFields() {
  const isBase = fields.tariff.value === "base";
  document.querySelector("#base-fields").hidden = !isBase;
  document.querySelector("#hp-hc-fields").hidden = isBase;
  fields.basePrice.disabled = !isBase;
  for (const field of [fields.peakPrice, fields.offPeakPrice, fields.offPeakPercent]) {
    field.disabled = isBase;
  }
}

function update() {
  copyStatus.textContent = "";
  updateTariffFields();
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
    consumption: Number(fields.consumption.value),
    consumptionPeriod: fields.consumptionPeriod.value,
    tariff: fields.tariff.value,
    basePrice: Number(fields.basePrice.value),
    peakPrice: Number(fields.peakPrice.value),
    offPeakPrice: Number(fields.offPeakPrice.value),
    offPeakPercent: Number(fields.offPeakPercent.value),
    subscription: Number(fields.subscription.value),
    subscriptionPeriod: fields.subscriptionPeriod.value,
    extraFees: fields.extraFees.value.trim() === "" ? 0 : Number(fields.extraFees.value),
    extraFeesPeriod: fields.extraFeesPeriod.value
  };
  try {
    const result = calculateElectricityBill(values);
    currentResult = result;
    error.textContent = "";
    copyButton.disabled = false;
    const amounts = {
      "bill-energy": result.annualEnergyCost,
      "bill-subscription": result.annualSubscription,
      "bill-fees": result.annualExtraFees,
      "bill-monthly": result.monthlyTotal,
      "bill-annual": result.annualTotal
    };
    for (const [id, value] of Object.entries(amounts)) {
      document.querySelector(`#${id}`).textContent = formatEuro(value);
    }
    for (const [id, share] of Object.entries({
      "bill-energy-share": result.energyShare,
      "bill-subscription-share": result.subscriptionShare,
      "bill-fees-share": result.extraFeesShare
    })) {
      document.querySelector(`#${id}`).textContent = share === null
        ? "Non calculable : total nul"
        : `${formatNumber(share)} %`;
    }
  } catch (issue) {
    if (!(issue instanceof TypeError || issue instanceof RangeError)) throw issue;
    error.textContent = issue.message;
    resetResults();
  }
}

form.addEventListener("input", update);
form.addEventListener("change", update);
form.addEventListener("submit", (event) => event.preventDefault());
updateTariffFields();

copyButton.addEventListener("click", async () => {
  if (!currentResult) return;
  const result = currentResult;
  const share = (value) => value === null ? "non calculable (total nul)" : `${formatNumber(value)} %`;
  const text = [
    "Estimation de facture électrique WattCombien",
    `Consommation : ${formatEuro(result.annualEnergyCost)} / an (${share(result.energyShare)})`,
    `Abonnement : ${formatEuro(result.annualSubscription)} / an (${share(result.subscriptionShare)})`,
    `Frais supplémentaires : ${formatEuro(result.annualExtraFees)} / an (${share(result.extraFeesShare)})`,
    `Total annuel : ${formatEuro(result.annualTotal)}`,
    `Total mensuel moyen : ${formatEuro(result.monthlyTotal)}`,
    "Estimation fondée uniquement sur les montants saisis, pas une facture contractuelle."
  ].join("\n");
  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = "Résumé copié dans le presse-papiers.";
  } catch {
    copyStatus.textContent = "Copie indisponible : vérifiez les autorisations du presse-papiers.";
  }
});

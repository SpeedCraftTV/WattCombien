import { calculateChargingCost, formatEuro, formatNumber } from "./calculations.js";
import "./seo.js";

const form = document.querySelector("#charging-form");
const error = document.querySelector("#charging-error");
const fields = Object.fromEntries([
  "capacity",
  "capacityUnit",
  "initialPercent",
  "targetPercent",
  "pricePerKwh",
  "efficiencyPercent",
  "chargesPerPeriod",
  "period"
].map((key) => [key, form.elements.namedItem(key)]));
const numericFields = [
  fields.capacity,
  fields.initialPercent,
  fields.targetPercent,
  fields.pricePerKwh,
  fields.efficiencyPercent,
  fields.chargesPerPeriod
];
const outputIds = [
  "energy-added",
  "grid-energy",
  "energy-loss",
  "cost-per-charge",
  "monthly-cost",
  "annual-cost"
];

function resetResults() {
  for (const id of outputIds) document.querySelector(`#${id}`).textContent = "En attente";
}

function update() {
  let invalidField;
  for (const field of numericFields) {
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
      ? "Complétez les champs obligatoires pour afficher le coût."
      : `Vérifiez le champ « ${invalidField.field.labels[0]?.textContent.trim() || invalidField.field.name} ».`;
    resetResults();
    return;
  }

  const values = {
    capacity: Number(fields.capacity.value),
    capacityUnit: fields.capacityUnit.value,
    initialPercent: Number(fields.initialPercent.value),
    targetPercent: Number(fields.targetPercent.value),
    pricePerKwh: Number(fields.pricePerKwh.value),
    efficiencyPercent: Number(fields.efficiencyPercent.value),
    chargesPerPeriod: Number(fields.chargesPerPeriod.value),
    period: fields.period.value
  };

  try {
    const result = calculateChargingCost(values);
    error.textContent = "";
    fields.targetPercent.removeAttribute("aria-invalid");
    document.querySelector("#energy-added").textContent = `${formatNumber(result.energyAddedKwh, 4)} kWh`;
    document.querySelector("#grid-energy").textContent = `${formatNumber(result.gridEnergyKwh, 4)} kWh`;
    document.querySelector("#energy-loss").textContent = `${formatNumber(result.energyLossKwh, 4)} kWh`;
    document.querySelector("#cost-per-charge").textContent = formatEuro(result.costPerCharge, 4);
    document.querySelector("#monthly-cost").textContent = formatEuro(result.monthlyCost, 4);
    document.querySelector("#annual-cost").textContent = formatEuro(result.annualCost, 4);
  } catch (issue) {
    if (values.targetPercent < values.initialPercent) {
      fields.targetPercent.setAttribute("aria-invalid", "true");
    }
    error.textContent = issue.message;
    resetResults();
  }
}

form.addEventListener("input", update);
fields.capacityUnit.addEventListener("change", update);
fields.period.addEventListener("change", update);

const categoryExamples = {
  car: { capacity: 60, unit: "kWh" },
  bike: { capacity: 500, unit: "Wh" },
  laptop: { capacity: 60, unit: "Wh" },
  phone: { capacity: 15, unit: "Wh" },
  powerBank: { capacity: 20, unit: "Wh" }
};

form.elements.namedItem("categoryExample").addEventListener("change", (event) => {
  const example = categoryExamples[event.currentTarget.value];
  if (!example) return;
  fields.capacity.value = String(example.capacity);
  fields.capacityUnit.value = example.unit;
  update();
});

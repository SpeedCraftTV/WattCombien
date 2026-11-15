import { calculateTimeOfUse, formatEuro, formatNumber } from "./calculations.js";
import "./seo.js";

const form = document.querySelector("#time-of-use-form");
const error = document.querySelector("#time-of-use-error");
const fields = Object.fromEntries(
  ["annualKwh", "basePrice", "peakPrice", "offPeakPrice", "offPeakPercent", "baseSubscription", "timeOfUseSubscription"]
    .map((key) => [key, form.elements.namedItem(key)])
);

function resetResults() {
  for (const id of ["base-annual-cost", "time-of-use-annual-cost", "annual-difference", "monthly-difference"]) {
    document.querySelector(`#${id}`).textContent = "En attente";
  }
  document.querySelector("#cheaper-option").textContent = "Renseignez les champs obligatoires pour comparer les options.";
  document.querySelector("#break-even-threshold").textContent = "En attente";
}

function describeBreakEven(values, result) {
  if (result.breakEvenOffPeakPercent === null) {
    return values.annualKwh === 0
      ? "Seuil non calculable avec une consommation annuelle nulle."
      : "Les tarifs HP et HC sont identiques : la part en heures creuses ne change pas le coût.";
  }

  const threshold = result.breakEvenOffPeakPercent;
  const formattedThreshold = `${formatNumber(Math.abs(threshold))} %`;
  if (values.peakPrice > values.offPeakPrice) {
    if (threshold < 0) return "L’option HP/HC est déjà moins coûteuse à 0 % en heures creuses.";
    if (threshold > 100) {
      return `Il faudrait ${formattedThreshold} en heures creuses, au-delà de 100 % : l’option HP/HC ne peut pas être rentabilisée avec ces données.`;
    }
    return `L’option HP/HC devient au moins aussi économique à partir de ${formatNumber(threshold)} % en heures creuses.`;
  }

  if (threshold < 0) {
    return "Avec ces tarifs, aucune part en heures creuses ne rend l’option HP/HC plus économique.";
  }
  if (threshold > 100) {
    return "L’option HP/HC reste plus économique pour toute part en heures creuses de 0 à 100 %.";
  }
  return `Avec un prix HC supérieur au prix HP, l’option HP/HC reste au moins aussi économique jusqu’à ${formatNumber(threshold)} % en heures creuses.`;
}

function update() {
  let invalidField;
  for (const [key, field] of Object.entries(fields)) {
    const missing = field.required && field.value.trim() === "";
    if (missing || !field.checkValidity()) {
      field.setAttribute("aria-invalid", "true");
      invalidField ??= { key, field, missing };
    } else {
      field.removeAttribute("aria-invalid");
    }
  }

  if (invalidField) {
    error.textContent = invalidField.missing
      ? "Complétez les champs obligatoires pour afficher une comparaison."
      : `Vérifiez le champ « ${invalidField.field.labels[0]?.textContent.trim() || invalidField.key} ».`;
    resetResults();
    return;
  }

  const values = {
    annualKwh: Number(fields.annualKwh.value),
    basePrice: Number(fields.basePrice.value),
    peakPrice: Number(fields.peakPrice.value),
    offPeakPrice: Number(fields.offPeakPrice.value),
    offPeakPercent: Number(fields.offPeakPercent.value),
    baseSubscription: fields.baseSubscription.value.trim() ? Number(fields.baseSubscription.value) : 0,
    timeOfUseSubscription: fields.timeOfUseSubscription.value.trim()
      ? Number(fields.timeOfUseSubscription.value)
      : 0
  };

  try {
    const result = calculateTimeOfUse(values);
    error.textContent = "";
    document.querySelector("#base-annual-cost").textContent = formatEuro(result.annualBaseCost);
    document.querySelector("#time-of-use-annual-cost").textContent = formatEuro(result.annualTimeOfUseCost);
    document.querySelector("#annual-difference").textContent = `${result.annualDifference > 0 ? "+" : ""}${formatEuro(result.annualDifference)}`;
    document.querySelector("#monthly-difference").textContent = `${result.monthlyDifference > 0 ? "+" : ""}${formatEuro(result.monthlyDifference)}`;

    const baseDisplay = formatEuro(result.annualBaseCost);
    const timeOfUseDisplay = formatEuro(result.annualTimeOfUseCost);
    const cheaperOption = document.querySelector("#cheaper-option");
    if (baseDisplay === timeOfUseDisplay) {
      cheaperOption.textContent = "Les options ont le même coût à l’arrondi près.";
    } else if (result.annualDifference < 0) {
      cheaperOption.textContent = `L’option heures pleines / heures creuses est moins coûteuse de ${formatEuro(Math.abs(result.annualDifference))} par an.`;
    } else {
      cheaperOption.textContent = `L’option Base est moins coûteuse de ${formatEuro(result.annualDifference)} par an.`;
    }
    document.querySelector("#break-even-threshold").textContent = describeBreakEven(values, result);
  } catch (issue) {
    error.textContent = issue.message;
    resetResults();
  }
}

form.addEventListener("input", update);

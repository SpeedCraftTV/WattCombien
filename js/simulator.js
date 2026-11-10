import { calculate, formatEuro, formatNumber } from "./calculations.js";
import "./seo.js";

const form = document.querySelector("#simulator-form");
const error = document.querySelector("#simulator-error");
const output = document.querySelector("#simulator-output");
const fields = Object.fromEntries(["power", "hours", "days", "price", "quantity"].map((key) => [key, form.elements.namedItem(key)]));

function update() {
  try {
    for (const [key, field] of Object.entries(fields)) {
      if (field.value.trim() === "" || !field.checkValidity()) throw new RangeError(`Vérifiez la valeur « ${key} ».`);
    }
    const result = calculate(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, Number(field.value)])));
    error.textContent = "";
    output.innerHTML = `<strong>${formatEuro(result.annualCost)} / an</strong><p>${formatNumber(result.annualKwh)} kWh/an · ${formatEuro(result.monthlyCost)} sur 30 jours · ${formatEuro(result.weeklyCost)} par semaine</p>`;
  } catch (issue) {
    error.textContent = issue.message;
    output.innerHTML = "<strong>Corrigez les valeurs</strong><p>Une estimation apparaîtra dès que les champs seront valides.</p>";
  }
}

form.addEventListener("input", update);
update();

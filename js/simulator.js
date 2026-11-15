import { calculate, formatEuro, formatNumber } from "./calculations.js";
import "./seo.js";

const form = document.querySelector("#simulator-form");
const error = document.querySelector("#simulator-error");
const output = document.querySelector("#simulator-output");
const fields = Object.fromEntries(["power", "hours", "days", "price", "quantity"].map((key) => [key, form.elements.namedItem(key)]));

for (const field of Object.values(fields)) {
  const descriptions = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  if (!descriptions.includes(error.id)) descriptions.push(error.id);
  field.setAttribute("aria-describedby", descriptions.join(" "));
}

function update() {
  let firstInvalid;
  for (const field of Object.values(fields)) {
    if (field.value.trim() === "" || !field.checkValidity()) {
      field.setAttribute("aria-invalid", "true");
      firstInvalid ??= field;
    } else {
      field.removeAttribute("aria-invalid");
    }
  }
  if (firstInvalid) {
    error.textContent = `Vérifiez le champ « ${firstInvalid.labels[0]?.textContent.trim() || firstInvalid.name} ».`;
    output.innerHTML = "<strong>Corrigez les valeurs</strong><p>Une estimation apparaîtra dès que les champs seront valides.</p>";
    return;
  }
  const result = calculate(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, Number(field.value)])));
  error.textContent = "";
  output.innerHTML = `<strong>${formatEuro(result.annualCost)} / an</strong><p>${formatNumber(result.annualKwh)} kWh/an · ${formatEuro(result.monthlyCost)} sur 30 jours · ${formatEuro(result.weeklyCost)} par semaine</p>`;
}

form.addEventListener("input", update);
update();

import { config } from "./config.js";

for (const element of document.querySelectorAll("[data-legal-field]")) {
  const field = element.dataset.legalField;
  const value = config.legal[field];
  if (typeof value === "string" && value.trim()) {
    element.textContent = value.trim();
  } else if (Number.isInteger(value) && value > 0) {
    element.textContent = field === "contactRetentionDays" ? `${value} jours` : String(value);
  }
}

export function calculate({ power, hours, days, price, quantity = 1 }) {
  const values = { power, hours, days, price, quantity };
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new TypeError(`${key} doit être un nombre valide.`);
  }
  if (power < 0) throw new RangeError("La puissance ne peut pas être négative.");
  if (hours < 0 || hours > 24) throw new RangeError("Les heures d’utilisation doivent être comprises entre 0 et 24.");
  if (!Number.isInteger(days) || days < 0 || days > 7) throw new RangeError("Les jours d’utilisation doivent être un nombre entier compris entre 0 et 7.");
  if (price < 0) throw new RangeError("Le prix du kWh ne peut pas être négatif.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError("Le nombre d’appareils doit être un entier supérieur ou égal à 1.");

  const dailyKwh = power * hours * days * quantity / 7 / 1000;
  const dailyCost = dailyKwh * price;
  return {
    dailyKwh,
    weeklyKwh: dailyKwh * 7,
    monthlyKwh: dailyKwh * 30,
    annualKwh: dailyKwh * 365,
    dailyCost,
    weeklyCost: dailyCost * 7,
    monthlyCost: dailyCost * 30,
    annualCost: dailyCost * 365
  };
}

export function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
}

export function formatEuro(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

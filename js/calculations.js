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

export function calculateTimeOfUse({
  annualKwh,
  basePrice,
  peakPrice,
  offPeakPrice,
  offPeakPercent,
  baseSubscription = 0,
  timeOfUseSubscription = 0
}) {
  const values = {
    annualKwh,
    basePrice,
    peakPrice,
    offPeakPrice,
    offPeakPercent,
    baseSubscription,
    timeOfUseSubscription
  };
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new TypeError(`${key} doit être un nombre valide.`);
  }
  if (annualKwh < 0) throw new RangeError("La consommation annuelle ne peut pas être négative.");
  for (const key of ["basePrice", "peakPrice", "offPeakPrice", "baseSubscription", "timeOfUseSubscription"]) {
    if (values[key] < 0) throw new RangeError(`${key} ne peut pas être négatif.`);
  }
  if (offPeakPercent < 0 || offPeakPercent > 100) {
    throw new RangeError("La part en heures creuses doit être comprise entre 0 et 100 %.");
  }

  const offPeakShare = offPeakPercent / 100;
  const annualBaseCost = annualKwh * basePrice + baseSubscription;
  const annualTimeOfUseCost = annualKwh * (
    (1 - offPeakShare) * peakPrice + offPeakShare * offPeakPrice
  ) + timeOfUseSubscription;
  const annualDifference = annualTimeOfUseCost - annualBaseCost;
  const rateDifference = peakPrice - offPeakPrice;
  const breakEvenOffPeakPercent = annualKwh === 0 || rateDifference === 0
    ? null
    : (
      annualKwh * (peakPrice - basePrice) + timeOfUseSubscription - baseSubscription
    ) / (annualKwh * rateDifference) * 100;

  if (![annualBaseCost, annualTimeOfUseCost, annualDifference].every(Number.isFinite)
    || (breakEvenOffPeakPercent !== null && !Number.isFinite(breakEvenOffPeakPercent))) {
    throw new RangeError("Les valeurs saisies produisent un résultat hors limites.");
  }

  return {
    annualBaseCost,
    annualTimeOfUseCost,
    annualDifference,
    monthlyDifference: annualDifference / 12,
    breakEvenOffPeakPercent
  };
}

export function calculateChargingCost({
  capacity,
  capacityUnit,
  initialPercent,
  targetPercent,
  pricePerKwh,
  efficiencyPercent,
  chargesPerPeriod,
  period
}) {
  const values = {
    capacity,
    initialPercent,
    targetPercent,
    pricePerKwh,
    efficiencyPercent,
    chargesPerPeriod
  };
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new TypeError(`${key} doit être un nombre valide.`);
  }
  if (!["Wh", "kWh"].includes(capacityUnit)) throw new RangeError("L’unité de capacité doit être Wh ou kWh.");
  if (!["week", "month"].includes(period)) throw new RangeError("La fréquence doit être exprimée par semaine ou par mois.");
  if (capacity <= 0) throw new RangeError("La capacité de batterie doit être supérieure à zéro.");
  if (initialPercent < 0 || initialPercent > 100) {
    throw new RangeError("Le niveau initial doit être compris entre 0 et 100 %.");
  }
  if (targetPercent < initialPercent || targetPercent > 100) {
    throw new RangeError("Le niveau souhaité doit être compris entre le niveau initial et 100 %.");
  }
  if (pricePerKwh < 0) throw new RangeError("Le prix du kWh ne peut pas être négatif.");
  if (efficiencyPercent <= 0 || efficiencyPercent > 100) {
    throw new RangeError("Le rendement doit être supérieur à 0 et inférieur ou égal à 100 %.");
  }
  if (chargesPerPeriod < 0) throw new RangeError("Le nombre de recharges ne peut pas être négatif.");

  const capacityKwh = capacityUnit === "Wh" ? capacity / 1000 : capacity;
  const energyAddedKwh = capacityKwh * (targetPercent - initialPercent) / 100;
  const gridEnergyKwh = energyAddedKwh / (efficiencyPercent / 100);
  const energyLossKwh = gridEnergyKwh - energyAddedKwh;
  const costPerCharge = gridEnergyKwh * pricePerKwh;
  const annualCharges = chargesPerPeriod * (period === "week" ? 52 : 12);
  const monthlyCost = costPerCharge * annualCharges / 12;
  const annualCost = costPerCharge * annualCharges;

  if (![capacityKwh, energyAddedKwh, gridEnergyKwh, energyLossKwh, costPerCharge, monthlyCost, annualCost]
    .every(Number.isFinite)) {
    throw new RangeError("Les valeurs saisies produisent un résultat hors limites.");
  }

  return {
    capacityKwh,
    energyAddedKwh,
    gridEnergyKwh,
    energyLossKwh,
    costPerCharge,
    monthlyCost,
    annualCost
  };
}

export function calculateSolar({
  capacityKwp, annualYield, selfConsumptionPercent, purchasePrice,
  saleEnabled, salePrice = 0, installationCost = null
}) {
  const values = { capacityKwp, annualYield, selfConsumptionPercent, purchasePrice };
  if (typeof saleEnabled !== "boolean") throw new TypeError("Indiquez si la vente du surplus est activée.");
  if (saleEnabled) values.salePrice = salePrice;
  if (installationCost !== null) values.installationCost = installationCost;
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new TypeError(`${key} doit être un nombre valide.`);
    if (value < 0) throw new RangeError(`${key} ne peut pas être négatif.`);
  }
  if (selfConsumptionPercent > 100) throw new RangeError("Le taux d’autoconsommation doit être compris entre 0 et 100 %.");

  const productionKwh = capacityKwp * annualYield;
  const selfConsumedKwh = productionKwh * (selfConsumptionPercent / 100);
  const surplusKwh = productionKwh - selfConsumedKwh;
  const savings = selfConsumedKwh * purchasePrice;
  const saleRevenue = saleEnabled ? surplusKwh * salePrice : 0;
  const annualGrossGain = savings + saleRevenue;
  const paybackYears = installationCost !== null && annualGrossGain > 0
    ? installationCost / annualGrossGain : null;
  if (![productionKwh, selfConsumedKwh, surplusKwh, savings, saleRevenue, annualGrossGain].every(Number.isFinite)
    || (paybackYears !== null && !Number.isFinite(paybackYears))) {
    throw new RangeError("Les valeurs saisies produisent un résultat hors limites.");
  }
  return { productionKwh, selfConsumedKwh, surplusKwh, savings, saleRevenue, annualGrossGain, paybackYears };
}

export function calculateElectricityBill({
  consumption,
  consumptionPeriod,
  tariff,
  basePrice,
  peakPrice,
  offPeakPrice,
  offPeakPercent,
  subscription,
  subscriptionPeriod,
  extraFees = 0,
  extraFeesPeriod
}) {
  const amounts = { consumption, subscription, extraFees };
  if (tariff === "base") {
    amounts.basePrice = basePrice;
  } else if (tariff === "hp-hc") {
    Object.assign(amounts, { peakPrice, offPeakPrice, offPeakPercent });
  } else {
    throw new RangeError("Choisissez une option tarifaire valide.");
  }
  for (const [key, value] of Object.entries(amounts)) {
    if (!Number.isFinite(value)) throw new TypeError(`${key} doit être un nombre valide.`);
    if (value < 0) throw new RangeError(`${key} ne peut pas être négatif.`);
  }
  if (tariff === "hp-hc" && offPeakPercent > 100) {
    throw new RangeError("La part en heures creuses doit être comprise entre 0 et 100 %.");
  }
  for (const period of [consumptionPeriod, subscriptionPeriod, extraFeesPeriod]) {
    if (!["month", "year"].includes(period)) throw new RangeError("Choisissez une période valide.");
  }

  const annualConsumption = consumption * (consumptionPeriod === "month" ? 12 : 1);
  const offPeakShare = tariff === "hp-hc" ? offPeakPercent / 100 : 0;
  const annualEnergyCost = tariff === "base"
    ? annualConsumption * basePrice
    : annualConsumption * ((1 - offPeakShare) * peakPrice + offPeakShare * offPeakPrice);
  const annualSubscription = subscription * (subscriptionPeriod === "month" ? 12 : 1);
  const annualExtraFees = extraFees * (extraFeesPeriod === "month" ? 12 : 1);
  const annualTotal = annualEnergyCost + annualSubscription + annualExtraFees;
  if (![annualConsumption, annualEnergyCost, annualSubscription, annualExtraFees, annualTotal].every(Number.isFinite)) {
    throw new RangeError("Les valeurs saisies produisent un résultat hors limites.");
  }

  return {
    annualEnergyCost,
    annualSubscription,
    annualExtraFees,
    annualTotal,
    monthlyTotal: annualTotal / 12,
    energyShare: annualTotal === 0 ? null : annualEnergyCost / annualTotal * 100,
    subscriptionShare: annualTotal === 0 ? null : annualSubscription / annualTotal * 100,
    extraFeesShare: annualTotal === 0 ? null : annualExtraFees / annualTotal * 100
  };
}

export function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits, minimumFractionDigits: 0 }).format(value);
}

export function formatEuro(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(value);
}

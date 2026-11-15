import test from "node:test";
import assert from "node:assert/strict";
import { calculate, calculateChargingCost, calculateElectricityBill, calculateSolar, calculateTimeOfUse, formatEuro } from "../js/calculations.js";

const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should be within 1e-12 of ${expected}`);

test("solaire : calcule production, autoconsommation, vente et retour simple", () => {
  const result = calculateSolar({
    capacityKwp: 3, annualYield: 1100, selfConsumptionPercent: 40,
    purchasePrice: 0.25, saleEnabled: true, salePrice: 0.1, installationCost: 6000
  });
  assert.equal(result.productionKwh, 3300);
  assert.equal(result.selfConsumedKwh, 1320);
  assert.equal(result.surplusKwh, 1980);
  assert.equal(result.savings, 330);
  assert.equal(result.saleRevenue, 198);
  assert.equal(result.annualGrossGain, 528);
  approximately(result.paybackYears, 6000 / 528);
});

test("solaire : gère la vente désactivée, les limites et le gain nul", () => {
  const values = { capacityKwp: 3, annualYield: 1100, selfConsumptionPercent: 0, purchasePrice: 0.25, saleEnabled: false, salePrice: -1 };
  const noSale = calculateSolar(values);
  assert.equal(noSale.surplusKwh, 3300);
  assert.equal(noSale.saleRevenue, 0);
  assert.equal(noSale.paybackYears, null);
  assert.equal(calculateSolar({ ...values, installationCost: 100 }).paybackYears, null);
  const full = calculateSolar({ ...values, selfConsumptionPercent: 100, installationCost: 0 });
  assert.equal(full.surplusKwh, 0);
  assert.equal(full.paybackYears, 0);
  const zero = calculateSolar({ ...values, capacityKwp: 0, saleEnabled: true, salePrice: 0.1 });
  assert.equal(zero.productionKwh, 0);
  assert.equal(zero.annualGrossGain, 0);
});

test("solaire : refuse les valeurs invalides et les résultats non finis", () => {
  const values = { capacityKwp: 3, annualYield: 1100, selfConsumptionPercent: 40, purchasePrice: 0.25, saleEnabled: true, salePrice: 0.1 };
  for (const key of ["capacityKwp", "annualYield", "selfConsumptionPercent", "purchasePrice", "salePrice", "installationCost"]) {
    assert.throws(() => calculateSolar({ ...values, [key]: -1 }), RangeError);
    assert.throws(() => calculateSolar({ ...values, [key]: NaN }), TypeError);
  }
  assert.throws(() => calculateSolar({ ...values, selfConsumptionPercent: 101 }), RangeError);
  assert.throws(() => calculateSolar({ ...values, saleEnabled: "yes" }), TypeError);
  assert.throws(() => calculateSolar({ ...values, capacityKwp: 1e308, annualYield: 1e308 }), RangeError);
  assert.throws(() => calculateSolar({ ...values, capacityKwp: Number.MIN_VALUE, annualYield: 1, selfConsumptionPercent: 100, purchasePrice: 1, installationCost: 100 }), RangeError);
});

test("1000 W pendant une heure par jour donne 1 kWh par jour et 7 par semaine", () => {
  const result = calculate({ power: 1000, hours: 1, days: 7, price: 0.2 });
  assert.equal(result.dailyKwh, 1);
  assert.equal(result.weeklyKwh, 7);
});

test("300 W pendant 24 heures par jour donne 7,2 kWh", () => {
  const result = calculate({ power: 300, hours: 24, days: 7, price: 0.2 });
  assert.equal(result.dailyKwh, 7.2);
});

test("les jours actifs sont moyennés sur sept jours sans perdre la cohérence hebdomadaire", () => {
  const result = calculate({ power: 300, hours: 4, days: 5, price: 0.2 });
  approximately(result.dailyKwh * 7, 6);
  assert.equal(result.weeklyKwh, 6);
});

test("7,2 kWh au tarif saisi de 0,20 €/kWh coûtent 1,44 €", () => {
  const result = calculate({ power: 300, hours: 24, days: 7, price: 0.2 });
  approximately(result.dailyCost, 1.44);
  assert.equal(formatEuro(result.dailyCost).replace(/[\u00a0\u202f]/g, " "), "1,44 €");
});

test("le format de prix peut conserver les fractions utiles aux petites batteries", () => {
  assert.equal(formatEuro(0.0027, 4).replace(/[\u00a0\u202f]/g, " "), "0,0027 €");
});

test("zéro watt donne une consommation et un coût nuls", () => {
  const result = calculate({ power: 0, hours: 24, days: 7, price: 0.2 });
  assert.equal(result.annualKwh, 0);
  assert.equal(result.annualCost, 0);
});

test("rejette une puissance négative", () => {
  assert.throws(() => calculate({ power: -1, hours: 1, days: 7, price: 0.2 }), RangeError);
});

test("rejette plus de 24 heures par jour et les jours incohérents", () => {
  assert.throws(() => calculate({ power: 1, hours: 24.01, days: 7, price: 0.2 }), RangeError);
  assert.throws(() => calculate({ power: 1, hours: 1, days: 7.5, price: 0.2 }), RangeError);
  assert.throws(() => calculate({ power: 1, hours: 1, days: 8, price: 0.2 }), RangeError);
});

test("calcule sans arrondir les valeurs intermédiaires", () => {
  const result = calculate({ power: 1, hours: 1, days: 7, price: 0.2 });
  assert.equal(result.dailyKwh, 0.001);
  assert.equal(result.annualKwh, 0.365);
  approximately(result.annualCost, 0.073);
});

test("refuse les nombres non finis et les quantités non entières", () => {
  assert.throws(() => calculate({ power: Number.NaN, hours: 1, days: 7, price: 0.2 }), TypeError);
  assert.throws(() => calculate({ power: 1, hours: 1, days: 7, price: 0.2, quantity: 1.5 }), RangeError);
});

test("compare les coûts Base et heures creuses avec les abonnements annuels", () => {
  const result = calculateTimeOfUse({
    annualKwh: 6000,
    basePrice: 0.2,
    peakPrice: 0.23,
    offPeakPrice: 0.15,
    offPeakPercent: 40,
    baseSubscription: 150,
    timeOfUseSubscription: 180
  });
  assert.equal(result.annualBaseCost, 1350);
  assert.equal(result.annualTimeOfUseCost, 1368);
  assert.equal(result.annualDifference, 18);
  assert.equal(result.monthlyDifference, 1.5);
  approximately(result.breakEvenOffPeakPercent, 43.75);
});

test("calcule le seuil à zéro ou au-delà de 100 % selon les abonnements et tarifs", () => {
  const alreadyWorthwhile = calculateTimeOfUse({
    annualKwh: 1000, basePrice: 0.2, peakPrice: 0.25, offPeakPrice: 0.15,
    offPeakPercent: 0, baseSubscription: 100, timeOfUseSubscription: 0
  });
  approximately(alreadyWorthwhile.breakEvenOffPeakPercent, -50);
  assert.equal(alreadyWorthwhile.annualDifference, -50);

  const unreachable = calculateTimeOfUse({
    annualKwh: 1000, basePrice: 0.2, peakPrice: 0.3, offPeakPrice: 0.25,
    offPeakPercent: 100
  });
  assert.equal(unreachable.breakEvenOffPeakPercent, 200);
  assert.equal(unreachable.annualDifference, 50);
});

test("retourne aucun seuil quand la consommation est nulle ou les tarifs HP et HC égaux", () => {
  const noConsumption = calculateTimeOfUse({
    annualKwh: 0, basePrice: 0.2, peakPrice: 0.3, offPeakPrice: 0.1,
    offPeakPercent: 50, baseSubscription: 120, timeOfUseSubscription: 100
  });
  assert.equal(noConsumption.annualBaseCost, 120);
  assert.equal(noConsumption.annualTimeOfUseCost, 100);
  assert.equal(noConsumption.breakEvenOffPeakPercent, null);

  const identicalRates = calculateTimeOfUse({
    annualKwh: 4000, basePrice: 0.2, peakPrice: 0.2, offPeakPrice: 0.2,
    offPeakPercent: 50
  });
  assert.equal(identicalRates.breakEvenOffPeakPercent, null);
});

test("accepte les limites de 0 et 100 % et les abonnements omis", () => {
  const zero = calculateTimeOfUse({
    annualKwh: 1000, basePrice: 0.2, peakPrice: 0.2, offPeakPrice: 0.1,
    offPeakPercent: 0
  });
  const full = calculateTimeOfUse({
    annualKwh: 1000, basePrice: 0.2, peakPrice: 0.3, offPeakPrice: 0.1,
    offPeakPercent: 100
  });
  assert.equal(zero.annualBaseCost, 200);
  assert.equal(zero.annualTimeOfUseCost, 200);
  assert.equal(full.annualTimeOfUseCost, 100);
});

test("calcule un seuil maximal lorsque le prix HC dépasse le prix HP", () => {
  const result = calculateTimeOfUse({
    annualKwh: 1000,
    basePrice: 0.2,
    peakPrice: 0.15,
    offPeakPrice: 0.25,
    offPeakPercent: 0
  });
  assert.equal(result.annualDifference, -50);
  approximately(result.breakEvenOffPeakPercent, 50);
});

test("rejette les consommations, tarifs et parts HP/HC invalides", () => {
  const valid = {
    annualKwh: 1000, basePrice: 0.2, peakPrice: 0.3, offPeakPrice: 0.1,
    offPeakPercent: 50
  };
  assert.throws(() => calculateTimeOfUse({ ...valid, annualKwh: -1 }), RangeError);
  for (const key of ["basePrice", "peakPrice", "offPeakPrice", "baseSubscription", "timeOfUseSubscription"]) {
    assert.throws(() => calculateTimeOfUse({ ...valid, [key]: -0.1 }), RangeError);
  }
  assert.throws(() => calculateTimeOfUse({ ...valid, offPeakPercent: 100.1 }), RangeError);
  assert.throws(() => calculateTimeOfUse({ ...valid, offPeakPercent: Number.NaN }), TypeError);
  assert.throws(() => calculateTimeOfUse({ ...valid, timeOfUseSubscription: Number.POSITIVE_INFINITY }), TypeError);
  assert.throws(() => calculateTimeOfUse({
    ...valid, annualKwh: Number.MAX_VALUE, peakPrice: Number.MAX_VALUE
  }), RangeError);
});

test("calcule l’énergie prélevée, les pertes et les coûts d’une recharge de voiture", () => {
  const result = calculateChargingCost({
    capacity: 60,
    capacityUnit: "kWh",
    initialPercent: 20,
    targetPercent: 80,
    pricePerKwh: 0.2,
    efficiencyPercent: 90,
    chargesPerPeriod: 2,
    period: "week"
  });
  assert.equal(result.capacityKwh, 60);
  assert.equal(result.energyAddedKwh, 36);
  assert.equal(result.gridEnergyKwh, 40);
  approximately(result.energyLossKwh, 4);
  assert.equal(result.costPerCharge, 8);
  approximately(result.monthlyCost, 69.33333333333333);
  assert.equal(result.annualCost, 832);
});

test("convertit les Wh et annualise une fréquence mensuelle", () => {
  const result = calculateChargingCost({
    capacity: 500,
    capacityUnit: "Wh",
    initialPercent: 10,
    targetPercent: 80,
    pricePerKwh: 0.4,
    efficiencyPercent: 70,
    chargesPerPeriod: 3,
    period: "month"
  });
  assert.equal(result.capacityKwh, 0.5);
  approximately(result.energyAddedKwh, 0.35);
  approximately(result.gridEnergyKwh, 0.5);
  approximately(result.energyLossKwh, 0.15);
  assert.equal(result.costPerCharge, 0.2);
  assert.equal(result.monthlyCost, 0.6);
  assert.equal(result.annualCost, 7.2);
});

test("gère les limites de rendement, les recharges nulles et une fréquence nulle", () => {
  const noLoss = calculateChargingCost({
    capacity: 20,
    capacityUnit: "kWh",
    initialPercent: 50,
    targetPercent: 50,
    pricePerKwh: 0.3,
    efficiencyPercent: 100,
    chargesPerPeriod: 0,
    period: "month"
  });
  assert.equal(noLoss.energyAddedKwh, 0);
  assert.equal(noLoss.gridEnergyKwh, 0);
  assert.equal(noLoss.energyLossKwh, 0);
  assert.equal(noLoss.costPerCharge, 0);
  assert.equal(noLoss.monthlyCost, 0);
  assert.equal(noLoss.annualCost, 0);
});

test("rejette les valeurs de recharge hors limites et les résultats non finis", () => {
  const valid = {
    capacity: 10,
    capacityUnit: "kWh",
    initialPercent: 20,
    targetPercent: 80,
    pricePerKwh: 0.2,
    efficiencyPercent: 90,
    chargesPerPeriod: 1,
    period: "week"
  };
  for (const patch of [
    { capacity: 0 },
    { capacity: -1 },
    { initialPercent: -1 },
    { initialPercent: 101 },
    { targetPercent: 19 },
    { targetPercent: 101 },
    { pricePerKwh: -0.1 },
    { efficiencyPercent: 0 },
    { efficiencyPercent: 100.1 },
    { chargesPerPeriod: -1 },
    { capacityUnit: "MWh" },
    { period: "day" }
  ]) {
    assert.throws(() => calculateChargingCost({ ...valid, ...patch }), RangeError);
  }
  assert.throws(() => calculateChargingCost({ ...valid, pricePerKwh: Number.NaN }), TypeError);
  assert.throws(() => calculateChargingCost({ ...valid, capacity: Number.MAX_VALUE }), RangeError);
});

test("facture Base : annualise séparément consommation, abonnement et frais", () => {
  const result = calculateElectricityBill({
    consumption: 200, consumptionPeriod: "month", tariff: "base", basePrice: 0.25,
    subscription: 120, subscriptionPeriod: "year", extraFees: 5, extraFeesPeriod: "month"
  });
  assert.equal(result.annualEnergyCost, 600);
  assert.equal(result.annualSubscription, 120);
  assert.equal(result.annualExtraFees, 60);
  assert.equal(result.annualTotal, 780);
  assert.equal(result.monthlyTotal, 65);
  approximately(result.energyShare, 600 / 780 * 100);
  approximately(result.subscriptionShare, 120 / 780 * 100);
  approximately(result.extraFeesShare, 60 / 780 * 100);
});

test("facture HP/HC : applique la répartition à la consommation annuelle", () => {
  const result = calculateElectricityBill({
    consumption: 6000, consumptionPeriod: "year", tariff: "hp-hc",
    peakPrice: 0.25, offPeakPrice: 0.15, offPeakPercent: 40,
    subscription: 15, subscriptionPeriod: "month", extraFeesPeriod: "year"
  });
  assert.equal(result.annualEnergyCost, 1260);
  assert.equal(result.annualSubscription, 180);
  assert.equal(result.annualExtraFees, 0);
  assert.equal(result.annualTotal, 1440);
  assert.equal(result.monthlyTotal, 120);
  for (const share of [0, 100]) {
    const boundary = calculateElectricityBill({
      consumption: 1000, consumptionPeriod: "year", tariff: "hp-hc",
      peakPrice: 0.25, offPeakPrice: 0.15, offPeakPercent: share,
      subscription: 0, subscriptionPeriod: "year", extraFeesPeriod: "year"
    });
    assert.equal(boundary.annualEnergyCost, share === 0 ? 250 : 150);
  }
});

test("facture nulle : les parts sont indéterminées, sans division par zéro", () => {
  const result = calculateElectricityBill({
    consumption: 0, consumptionPeriod: "year", tariff: "base", basePrice: 0,
    subscription: 0, subscriptionPeriod: "month", extraFeesPeriod: "month"
  });
  assert.equal(result.annualTotal, 0);
  assert.equal(result.monthlyTotal, 0);
  assert.equal(result.energyShare, null);
  assert.equal(result.subscriptionShare, null);
  assert.equal(result.extraFeesShare, null);
});

test("facture : rejette les valeurs non finies, négatives, périodes et répartitions invalides", () => {
  const valid = {
    consumption: 100, consumptionPeriod: "year", tariff: "hp-hc",
    peakPrice: 0.25, offPeakPrice: 0.15, offPeakPercent: 40,
    subscription: 10, subscriptionPeriod: "month", extraFees: 1, extraFeesPeriod: "year"
  };
  for (const patch of [
    { consumption: -1 }, { subscription: -1 }, { extraFees: -1 },
    { peakPrice: -1 }, { offPeakPrice: -1 }, { offPeakPercent: -1 }, { offPeakPercent: 101 },
    { consumptionPeriod: "week" }, { subscriptionPeriod: "week" }, { extraFeesPeriod: "week" },
    { tariff: "other" }, { consumption: Number.MAX_VALUE, consumptionPeriod: "month" }
  ]) {
    assert.throws(() => calculateElectricityBill({ ...valid, ...patch }), RangeError);
  }
  assert.throws(() => calculateElectricityBill({ ...valid, peakPrice: NaN }), TypeError);
  assert.throws(() => calculateElectricityBill({ ...valid, tariff: "base", basePrice: -1 }), RangeError);
});

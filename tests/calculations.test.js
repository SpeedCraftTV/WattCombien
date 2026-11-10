import test from "node:test";
import assert from "node:assert/strict";
import { calculate, formatEuro } from "../js/calculations.js";

const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should be within 1e-12 of ${expected}`);

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

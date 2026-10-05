import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nomeDaCopia } from '../scripts/templates.js';
import { avisoLimite } from '../scripts/calculo.js';

test('nomeDaCopia sem template mantém o formato antigo', () => {
  assert.equal(nomeDaCopia('Sacerdote da Tormenta', '15', []), 'Sacerdote da Tormenta (ND 15)');
});

test('nomeDaCopia com Chefe Final usa só a tag "Chefe Final", sem o ND', () => {
  assert.equal(nomeDaCopia('Sacerdote da Tormenta', '10', ['chefeFinal']), 'Sacerdote da Tormenta (Chefe Final)');
});

test('nomeDaCopia lista os templates sempre na mesma ordem', () => {
  assert.equal(nomeDaCopia('Lobo', '4', ['chefeFinal', 'bando', 'enxame']), 'Lobo (Bando, Enxame, Chefe Final)');
});

test('nomeDaCopia não empilha o sufixo de um ajuste anterior', () => {
  assert.equal(nomeDaCopia('Sacerdote da Tormenta (ND 15)', '10', ['chefeFinal']), 'Sacerdote da Tormenta (Chefe Final)');
  assert.equal(nomeDaCopia('Sacerdote da Tormenta (Chefe Final)', '12', []), 'Sacerdote da Tormenta (ND 12)');
  assert.equal(nomeDaCopia('Sacerdote da Tormenta (Chefe Final)', '12', ['chefeFinal']), 'Sacerdote da Tormenta (Chefe Final)');
  assert.equal(nomeDaCopia('Lobo (Bando, Chefe Final)', '5', []), 'Lobo (ND 5)');
});

test('nomeDaCopia mantém parênteses que não são de ND', () => {
  assert.equal(nomeDaCopia('Lobo (alfa)', '4', []), 'Lobo (alfa) (ND 4)');
});

test('o aviso de limite de ataques não diz mais "não bloqueia"', () => {
  const aviso = avisoLimite([{ ataques: 3, alternativa: false }], '10');
  assert.equal(aviso, 'São 3 ataques por rodada, mas o limite do ND 10 é 2.');
  const fontes = readFileSync(new URL('../scripts/calculo.js', import.meta.url), 'utf8');
  assert.doesNotMatch(fontes, /não bloqueia/);
});

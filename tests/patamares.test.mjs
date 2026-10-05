import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patamarDoND, faixaDeHabilidades, avisosDePatamar } from '../scripts/patamares.js';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const ajustar = (f, nd, papel = f.system.detalhes.role, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel, medir: criarMedidor(f), ...extra });

test('patamarDoND: limites de cada patamar', () => {
  const esperado = {
    '1/4': 'Iniciante', '1': 'Iniciante', '4': 'Iniciante',
    '5': 'Veterano', '10': 'Veterano',
    '11': 'Campeão', '16': 'Campeão',
    '17': 'Lenda', '20': 'Lenda', S: 'Lenda', 'S+': 'Lenda',
  };
  for (const [nd, patamar] of Object.entries(esperado)) assert.equal(patamarDoND(nd), patamar, `ND ${nd}`);
});

test('faixaDeHabilidades lê a coluna Hab da tabela de cada papel', () => {
  assert.deepEqual(faixaDeHabilidades(tabelas, 'solo', '3'), { min: 1, max: 2, texto: '1–2' });
  assert.deepEqual(faixaDeHabilidades(tabelas, 'lackey', '12'), { min: 3, max: 6, texto: '3–6' });
  assert.deepEqual(faixaDeHabilidades(tabelas, 'special', '10'), { min: 4, max: 6, texto: '4–6' });
  assert.deepEqual(faixaDeHabilidades(tabelas, 'special', 'S+'), { min: 8, max: 12, texto: '8–12' });
});

test('as faixas da tabela coincidem com os patamares combinados (Solo/Lacaio e Especial)', () => {
  const combinado = {
    solo: { Iniciante: '1–2', Veterano: '2–4', Campeão: '3–6', Lenda: '4–8' },
    special: { Iniciante: '2–3', Veterano: '4–6', Campeão: '6–9', Lenda: '8–12' },
  };
  const representante = { Iniciante: '2', Veterano: '7', Campeão: '14', Lenda: '19' };
  for (const [papel, faixas] of Object.entries(combinado)) {
    for (const [patamar, texto] of Object.entries(faixas)) {
      assert.equal(faixaDeHabilidades(tabelas, papel, representante[patamar]).texto, texto, `${papel} ${patamar}`);
    }
  }
  for (const [patamar, texto] of Object.entries(combinado.solo)) {
    assert.equal(faixaDeHabilidades(tabelas, 'lackey', representante[patamar]).texto, texto, `lackey ${patamar}`);
  }
});

test('avisosDePatamar na mudança: patamar, ataques e poderes abaixo da faixa', () => {
  const avisos = avisosDePatamar({
    ndAntes: '10', ndDepois: '15', papel: 'special', ataques: 3, poderes: 3,
    faixa: { min: 6, max: 9, texto: '6–9' },
  });
  assert.equal(avisos.length, 3);
  assert.match(avisos[0], /Veterano → Campeão/);
  assert.match(avisos[1], /até 3.*a ficha tem 3/);
  assert.match(avisos[2], /Especial.*6–9.*a ficha tem 3.*adicionar de 3 a 6/);
});

test('avisosDePatamar sem mudança só avisa o que está fora da faixa', () => {
  const dentro = avisosDePatamar({
    ndAntes: '15', ndDepois: '15', papel: 'special', ataques: 3, poderes: 7, faixa: { min: 6, max: 9, texto: '6–9' } });
  assert.deepEqual(dentro, []);
  const fora = avisosDePatamar({
    ndAntes: '15', ndDepois: '15', papel: 'solo', ataques: 3, poderes: 9, faixa: { min: 3, max: 6, texto: '3–6' } });
  assert.equal(fora.length, 1);
  assert.match(fora[0], /Solo.*3–6.*a ficha tem 9.*simplificar/);
});

test('avisosDePatamar na mudança com poderes dentro da faixa diz que está dentro', () => {
  const avisos = avisosDePatamar({
    ndAntes: '4', ndDepois: '5', papel: 'solo', ataques: 2, poderes: 3, faixa: { min: 2, max: 4, texto: '2–4' } });
  assert.match(avisos[0], /Iniciante → Veterano/);
  assert.match(avisos.at(-1), /dentro da faixa/);
});

test('Sacerdote 10 → 15 (Especial): muda para Campeão e tem 3 poderes, abaixo de 6–9', () => {
  const r = ajustar(ficha('sacerdote'), '15');
  assert.match(r.patamar[0], /Veterano → Campeão/);
  assert.ok(r.patamar.some(a => /6–9.*a ficha tem 3/.test(a)));
});

test('Dragão 15 → 15: sem mudança de patamar, só avisa se estiver fora da faixa', () => {
  const r = ajustar(ficha('dragao'), '15'); // Solo, Campeão: faixa 3–6; a ficha tem 9 poderes
  assert.equal(r.patamar.length, 1);
  assert.match(r.patamar[0], /Solo.*3–6.*a ficha tem 9.*acima da faixa.*simplificar/);
});

test('reduzir o ND de Lenda para Veterano avisa o patamar e a nova faixa', () => {
  const r = ajustar(ficha('dragao'), '8');
  assert.match(r.patamar[0], /Campeão → Veterano/);
});

test('trocar o papel sem mudar o ND mostra só o que ficou fora da faixa', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '10', 'solo'); // Especial → Solo: faixa 2–4, a ficha tem 3 poderes
  assert.ok(r.patamar.every(a => !/→/.test(a)));
  assert.deepEqual(r.patamar, []);
});

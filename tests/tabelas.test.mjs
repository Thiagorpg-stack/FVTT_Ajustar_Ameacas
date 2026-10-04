import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consultar, normalizarND, valorND, maxAtaques, chaveTabelaDoPapel } from '../scripts/tabelas.js';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));

test('tables.json tem 24 NDs para cada um dos 3 papéis', () => {
  for (const papel of ['solo', 'lacaio', 'especial']) {
    assert.equal(tabelas[papel].length, 24, papel);
  }
});

test('consultar usa o papel do Foundry (lackey) e devolve a linha do ND', () => {
  const l = consultar(tabelas, 'lackey', '1/2');
  assert.deepEqual(
    { atk: l.Ataque, dano: l.Dano, def: l.Defesa, pv: l.PV, cd: l.CD },
    { atk: 9, dano: 11, def: 13, pv: 6, cd: 13 }
  );
});

test('consultar Solo ND 12 bate com a tabela da calculadora', () => {
  const l = consultar(tabelas, 'solo', '12');
  assert.equal(l.Ataque, 36);
  assert.equal(l.Dano, 144);
  assert.equal(l.Defesa, 43);
  assert.deepEqual([l.ResForte, l.ResMedia, l.ResFraca], [26, 20, 12]);
});

test('consultar lança erro claro para ND ou papel inexistente', () => {
  assert.throws(() => consultar(tabelas, 'solo', '99'), /ND/);
  assert.throws(() => consultar(tabelas, 'chefao', '5'), /papel/i);
});

test('chaveTabelaDoPapel mapeia os papéis do Foundry para os da tabela', () => {
  assert.equal(chaveTabelaDoPapel('solo'), 'solo');
  assert.equal(chaveTabelaDoPapel('lackey'), 'lacaio');
  assert.equal(chaveTabelaDoPapel('special'), 'especial');
});

test('normalizarND mantém o texto que o sistema entende (S, S+, frações e números)', () => {
  assert.equal(normalizarND('S'), 'S');
  assert.equal(normalizarND(' S+ '), 'S+');
  assert.equal(normalizarND('5'), '5');
  assert.equal(normalizarND(5), '5');
  assert.equal(normalizarND('1/4'), '1/4');
});

test('valorND converte para número (frações e S)', () => {
  assert.equal(valorND('1/4'), 0.25);
  assert.equal(valorND('1/2'), 0.5);
  assert.equal(valorND('10'), 10);
  assert.equal(valorND('S'), 21);
  assert.equal(valorND('22'), 22);
});

test('maxAtaques segue os patamares 1/2/3/4', () => {
  assert.equal(maxAtaques('1/4'), 1);
  assert.equal(maxAtaques('4'), 1);
  assert.equal(maxAtaques('5'), 2);
  assert.equal(maxAtaques('10'), 2);
  assert.equal(maxAtaques('11'), 3);
  assert.equal(maxAtaques('16'), 3);
  assert.equal(maxAtaques('17'), 4);
  assert.equal(maxAtaques('S'), 4);
});

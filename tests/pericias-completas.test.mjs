import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completarPericias } from '../scripts/ajuste.js';
import { ficha } from './helpers.mjs';

// O sistema Tormenta20 (1.6.6) preenche com valores padrão os campos que faltam de uma perícia atualizada por
// caminho parcial: a ficha perdia atributo, treino etc. A atualização direta leva o system.pericias inteiro.

test('completarPericias: troca os caminhos parciais por system.pericias inteiro, com os valores atuais', () => {
  const troll = ficha('troll');
  const original = structuredClone(troll);
  const r = completarPericias(troll, {
    'system.attributes.cd': 20, 'system.pericias.fort.outros': 11, 'system.pericias.luta.outros': 12,
  });
  assert.deepEqual(Object.keys(r).sort(), ['system.attributes.cd', 'system.pericias']);
  assert.equal(r['system.attributes.cd'], 20);
  assert.deepEqual(r['system.pericias'].fort, { ...troll.system.pericias.fort, outros: 11 });
  assert.equal(r['system.pericias'].fort.atributo, 'con'); // o atributo da perícia não se perde
  assert.equal(r['system.pericias'].luta.outros, 12);
  assert.equal(r['system.pericias'].luta.treinado, true);
  assert.deepEqual(r['system.pericias'].refl, troll.system.pericias.refl);
  assert.deepEqual(Object.keys(r['system.pericias']), Object.keys(troll.system.pericias));
  assert.deepEqual(troll, original); // não altera a ficha recebida
});

test('completarPericias: sem caminhos de perícia, a atualização fica como está', () => {
  const update = { 'system.attributes.cd': 20, 'system.tracos.resistencias.dano.base': 10 };
  assert.deepEqual(completarPericias(ficha('troll'), update), update);
});

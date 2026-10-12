import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularAjuste, gruposDasArmas } from '../scripts/ajuste.js';
import { ficha, criarMedidor } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));

function dragaoComSopro() {
  const a = ficha('dragao');
  a.items.find(i => i.type === 'poder' && i.name === 'Sopro').flags = { 'tormenta20-ajuste-nd': { danoPoder: { ajustar: true, efeito: true } } };
  return a;
}
const ajustar = (a, nd) => calcularAjuste({ dados: a, tabelas, nd, papel: 'solo', medir: criarMedidor(a) });

test('gruposDasArmas: o Sopro cortado pelo limite (ND 20) fica de fora do selo e do total das armas', () => {
  const r = ajustar(dragaoComSopro(), '20');
  const grupos = r.plano.dano.grupos;
  assert.equal(grupos.length, 2);
  assert.ok(grupos.some(g => g.alerta !== 'equilibrado'), 'o Sopro está abaixo do alvo');
  const dasArmas = gruposDasArmas(grupos, r.poderesPrevia);
  assert.equal(dasArmas.length, 1);
  assert.equal(dasArmas[0].alerta, 'equilibrado');
});

test('gruposDasArmas: sem poderes ajustados nada sai; poder fora do padrão (divide com as armas) continua no grupo', () => {
  const a = ficha('dragao');
  const r = ajustar(a, '11');
  assert.deepEqual(gruposDasArmas(r.plano.dano.grupos, r.poderesPrevia), r.plano.dano.grupos);
  const grupo = [{ ids: ['arma', 'poderLivre'], obtido: 100, alerta: 'equilibrado' }];
  const previa = [{ id: 'poderLivre', padrao: false, ajustar: true }];
  assert.deepEqual(gruposDasArmas(grupo, previa), grupo);
});

// Até a 0.11.0 as imunidades dos templates iam também em rótulos para tracos.ic.custom, e a ficha mostrava as duas versões.
// Agora só o texto de resistências as guarda; o ic.custom de fichas antigas é limpo ao reajustar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor, gravarResultado } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const ajustar = (f, nd, templates) => calcularAjuste({ dados: f, tabelas, nd, papel: 'solo', medir: criarMedidor(f), templates });
const ROTULOS = 'Acertos críticos, Dano de precisão, Flanqueamento, Manobras de combate';

test('ficha criada com a 0.11.0 (rótulos em ic.custom): ao reajustar com o Enxame, o ic.custom volta ao que era', () => {
  const f = ficha('sacerdote');
  const ajustada = gravarResultado(f, ajustar(f, '10', { enxame: true }));
  ajustada.system.tracos.ic.custom = ROTULOS; // como a 0.11.0 deixava
  const r = ajustar(ajustada, '10', { enxame: true });
  assert.equal(r.update['system.tracos.ic.custom'], '');
});

test('ficha com o template e um ic.custom que o mestre escreveu: não é apagado ao reajustar', () => {
  const f = ficha('sacerdote');
  const ajustada = gravarResultado(f, ajustar(f, '10', { enxame: true }));
  ajustada.system.tracos.ic.custom = 'Veneno de aranha';
  const r = ajustar(ajustada, '10', { enxame: true });
  assert.equal('system.tracos.ic.custom' in r.update, false);
});

test('tirar o Enxame de uma ficha antiga limpa os rótulos antigos e tira as frases do texto', () => {
  const f = ficha('sacerdote');
  const ajustada = gravarResultado(f, ajustar(f, '10', { enxame: true }));
  ajustada.system.tracos.ic.custom = ROTULOS;
  const r = ajustar(ajustada, '10', {});
  assert.equal(r.update['system.tracos.ic.custom'], '');
  assert.equal(r.update['system.detalhes.resistencias'], f.system.detalhes.resistencias);
});

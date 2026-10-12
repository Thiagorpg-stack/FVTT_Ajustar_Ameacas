import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor, gravarResultado } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const FLAG = 'tormenta20-ajuste-nd';
const ajustar = (f, nd, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel: 'solo', medir: criarMedidor(f), ...extra });

function comPoder(nome, danoPoder, mudar = () => {}) {
  const a = ficha('dragao');
  const item = a.items.find(i => i.type === 'poder' && i.name === nome);
  if (danoPoder) item.flags = { [FLAG]: { danoPoder } };
  mudar(item);
  return a;
}
const poder = (a, nome) => a.items.find(i => i.type === 'poder' && i.name === nome);
const mudancaDe = (r, a, nome) => r.itemUpdates.find(u => u._id === poder(a, nome)._id);
const duasPartes = (i) => {
  i.system.rolls = [{ name: 'Dano', type: 'dano', parts: [['3d8', 'impacto', ''], ['2d6', 'fogo', '']] }];
  i.system.description.value = 'Criaturas na área sofrem 13 (3d8) de dano de impacto e 7 (2d6) de dano de fogo (Ref CD 40).';
};

test('calcularAjuste: Sopro marcado vira 12d12 no ND 11 (rolagem e texto), com a CD nova', () => {
  const a = comPoder('Sopro', { ajustar: true, efeito: true });
  const r = ajustar(a, '11');
  const m = mudancaDe(r, a, 'Sopro');
  assert.deepEqual(m['system.rolls'][0].parts[0], ['12d12', 'fogo', '']);
  assert.match(m['system.description.value'], /sofrem 12d12 pontos de dano de fogo/);
  assert.match(m['system.description.value'], new RegExp(`CD ${r.plano.alvos.cd}\\b`));
  assert.deepEqual(r.plano.revisar, []);
});

test('calcularAjuste: Sopro sem a flag não tem a rolagem nem a fórmula do texto alteradas', () => {
  const a = ficha('dragao');
  const r = ajustar(a, '11');
  const m = mudancaDe(r, a, 'Sopro');
  assert.equal(m['system.rolls'], undefined);
  assert.match(m['system.description.value'], /16d12/);
  assert.deepEqual(r.plano.revisar, ['Sopro']);
});

test('calcularAjuste: não altera a ficha recebida', () => {
  const a = comPoder('Sopro', { ajustar: true, efeito: true });
  const copia = structuredClone(a);
  ajustar(a, '11');
  assert.deepEqual(a, copia);
});

test('calcularAjuste: poder de ação livre com dano divide a rodada e tem rolagem e texto reescritos', () => {
  const a = comPoder('Varrer', { ajustar: true, efeito: false }, (i) => {
    i.system.rolls = [{ name: 'Dano', type: 'dano', parts: [['2d6', 'impacto', '']] }];
    i.system.description.value = 'O dragão varre e causa mais 2d6 pontos de dano.';
  });
  const m = mudancaDe(ajustar(a, '11'), a, 'Varrer');
  const nova = m['system.rolls'][0].parts[0][0];
  assert.notEqual(nova, '2d6');
  assert.equal(m['system.description.value'], `O dragão varre e causa mais ${nova} pontos de dano.`);
});

test('calcularAjuste: duas partes de dano mantêm o dado de cada uma, no texto também (ND 5)', () => {
  const a = comPoder('Sopro', { ajustar: true, efeito: true }, duasPartes);
  const m = mudancaDe(ajustar(a, '5'), a, 'Sopro');
  assert.deepEqual(m['system.rolls'][0].parts.map(p => p[0]), ['4d8', '2d6']);
  assert.match(m['system.description.value'], /18 \(4d8\) de dano de impacto e 7 \(2d6\) de dano de fogo/);
});

test('calcularAjuste: reajustar o ator já ajustado dá o mesmo resultado (uma e duas partes)', () => {
  for (const mudar of [() => {}, duasPartes]) {
    const a = comPoder('Sopro', { ajustar: true, efeito: true }, mudar);
    const uma = gravarResultado(a, ajustar(a, '5'));
    const duas = gravarResultado(uma, ajustar(uma, '5'));
    assert.deepEqual(poder(duas, 'Sopro').system.rolls, poder(uma, 'Sopro').system.rolls);
    assert.equal(poder(duas, 'Sopro').system.description.value, poder(uma, 'Sopro').system.description.value);
  }
});

test('calcularAjuste: com Bando os poderes não são ajustados e ficam na lista de revisão', () => {
  const a = comPoder('Sopro', { ajustar: true, efeito: true });
  const r = ajustar(a, '5', { templates: { bando: { escala: '10-20', aumentoND: 2 } } });
  assert.equal(mudancaDe(r, a, 'Sopro')['system.rolls'], undefined);
  assert.ok(r.plano.revisar.includes('Sopro'));
});

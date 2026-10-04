import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reescreverRolls, calcularAjuste } from '../scripts/ajuste.js';
import { ficha, nomesDasFichas, criarMedidor } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const arma = (a, nome) => a.items.find(i => i.type === 'arma' && i.name === nome);
const ajustar = (f, nd, papel, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel, medir: criarMedidor(f), ...extra });

test('reescreverRolls: zera termos numéricos do ataque e escreve a fórmula de dano', () => {
  const garra = arma(ficha('vampiro'), 'Garra');
  const novas = reescreverRolls(garra.system.rolls, { indiceRollDano: 1, formula: '6d6+40' });
  assert.deepEqual(novas[0].parts[2], ['0', '', '']);        // era "11"
  assert.deepEqual(novas[1].parts[0], ['6d6+40', 'corte', '']); // tipo de dano mantido
  assert.deepEqual(novas[1].parts[2], ['2d10', 'trevas', '']); // dano secundário intacto
});

test('reescreverRolls: mantém os rótulos dos termos (Dragão)', () => {
  const mordida = arma(ficha('dragao'), 'Mordida');
  const novas = reescreverRolls(mordida.system.rolls, { indiceRollDano: 1, formula: '8d6+60' });
  assert.deepEqual(novas[0].parts[2], ['0', '', 'weaponbonus']);
  assert.deepEqual(novas[1].parts[0], ['8d6+60', 'perfuracao', 'weapon']);
});

test('reescreverRolls: não altera o original e deixa a rolagem de cura quieta (Aparição)', () => {
  const toque = arma(ficha('aparicao'), 'Toque drenante');
  const antes = structuredClone(toque.system.rolls);
  const novas = reescreverRolls(toque.system.rolls, { indiceRollDano: 1, formula: '4d6+26' });
  assert.deepEqual(toque.system.rolls, antes);
  assert.deepEqual(novas[2], antes[2]); // PV Temporário (curatpv)
});

test('reescreverRolls: termo de ataque que não é número fica como está', () => {
  const rolls = [
    { type: 'ataque', parts: [['1d20', '', ''], ['luta', '', ''], ['@bonus', '', '']] },
    { type: 'dano', parts: [['1d6', 'corte', '']] },
  ];
  assert.equal(reescreverRolls(rolls, { indiceRollDano: 1, formula: '2d6' })[0].parts[2][0], '@bonus');
});

test('calcularAjuste: Goblin → ND 1/4 Lacaio (defesa.base 7 para o total ser 10)', () => {
  const r = ajustar(ficha('goblin'), '1/4', 'lackey');
  assert.equal(r.update['system.attributes.pv.max'], 4);
  assert.equal(r.update['system.attributes.pv.value'], 4);
  assert.equal(r.update['system.attributes.cd'], 12);
  assert.equal(r.update['system.attributes.defesa.base'], 7);
  assert.equal(r.update['system.attributes.nd'], '1/4');
  assert.equal(r.update['system.detalhes.role'], 'lackey');
  assert.equal(r.depois.defesa, 10);
});

test('calcularAjuste: Recruta → ND 1/2 Lacaio (Luta +9, defesa 13 com cota de malha)', () => {
  const r = ajustar(ficha('recruta'), '1/2', 'lackey');
  assert.equal(r.update['system.pericias.luta.outros'], 5);
  assert.equal(r.update['system.attributes.defesa.base'], 7);
  assert.equal(r.antes.defesa, 16);
  assert.equal(r.depois.defesa, 13);
  assert.equal(r.depois.pericias.luta, 9);
});

test('calcularAjuste: Golem de Ferro ao próprio ND mantém defesa.base 37 (idempotente)', () => {
  const r = ajustar(ficha('golem'), '10', 'solo');
  assert.equal(r.update['system.attributes.defesa.base'], 37);
  assert.equal(r.update['system.attributes.pv.max'], 400);
  assert.equal(r.depois.pericias.luta, 29);
  assert.deepEqual(
    [r.depois.pericias.fort, r.depois.pericias.refl, r.depois.pericias.vont], [22, 16, 10]);
});

test('calcularAjuste: Vampiro com armadura completa → defesa.base 33 no ND 12 Solo', () => {
  const r = ajustar(ficha('vampiro'), '12', 'solo');
  assert.equal(r.update['system.attributes.defesa.base'], 33);
});

test('calcularAjuste: atualiza as armas (rolagens e system.ataques)', () => {
  const v = ficha('vampiro');
  const r = ajustar(v, '12', 'solo');
  const garra = r.itemUpdates.find(u => u._id === 'WujAqyrLbw0W7frD');
  assert.equal(garra['system.ataques'], 1);
  assert.equal(garra['system.rolls'][0].parts[2][0], '0');
  assert.equal(garra['system.rolls'][1].parts[0][0], '6d6+40');
});

test('calcularAjuste: não altera os dados recebidos', () => {
  const g = ficha('goblin');
  const copia = structuredClone(g);
  ajustar(g, '3', 'solo');
  assert.deepEqual(g, copia);
});

test('calcularAjuste: o mestre sobrescreve ataques por arma e a ordem das resistências', () => {
  const t = ficha('troll');
  const r = ajustar(t, '5', 'solo', {
    ataquesPorArma: { '5wbhh4vyqNJXYIm5': 1, cp3i4dKB7PGNNtXn: 1 },
    ordemResistencias: ['vont', 'refl', 'fort'],
  });
  assert.deepEqual(r.plano.avisos, []);
  assert.deepEqual([r.depois.pericias.vont, r.depois.pericias.refl, r.depois.pericias.fort], [17, 11, 5]);
});

test('calcularAjuste: falha se a calibração não convergir', () => {
  const g = ficha('goblin');
  assert.throws(() => calcularAjuste({
    dados: g, tabelas, nd: '3', papel: 'solo', medir: () => ({
      pericias: { luta: 0, pont: 0, fort: 0, refl: 0, vont: 0 }, defesa: 0 }),
  }), /calibra/i);
});

// Propriedade central: em qualquer ficha e qualquer ND/papel, o que a ficha mostra bate com a tabela.
const alvosDeTeste = [['1/4', 'lackey'], ['1/2', 'solo'], ['5', 'special'], ['12', 'solo'], ['20', 'lackey'], ['S', 'solo']];
for (const nome of nomesDasFichas()) {
  for (const [nd, papel] of alvosDeTeste) {
    test(`propriedade: ${nome} → ND ${nd} ${papel} bate com a tabela`, () => {
      const f = ficha(nome);
      const r = ajustar(f, nd, papel);
      const { alvos, resistencias } = r.plano;
      assert.equal(r.depois.defesa, alvos.defesa);
      for (const k of ['fort', 'refl', 'vont']) assert.equal(r.depois.pericias[k], resistencias[k], k);
      const usadas = new Set(f.items.filter(i => i.type === 'arma').map(i =>
        i.system.rolls.find(x => x.type === 'ataque')?.parts?.[1]?.[0] || 'luta'));
      for (const k of usadas) assert.equal(r.depois.pericias[k], alvos.ataque, k);
    });
  }
}

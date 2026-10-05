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
  assert.equal(garra['system.rolls'][1].parts[0][0], '5d6+42');
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

test('textos: Centauro Xamã → ND 7 Especial troca a CD escrita no poder Magias e nada mais nele', () => {
  const c = ficha('centauro');
  const r = ajustar(c, '7', 'special');
  const magias = r.itemUpdates.find(u => u._id === 'xL83OWwOqqw80wzl');
  assert.equal(magias['system.description.value'],
    'O centauro xamã lança magias como um clérigo de 3º nível (CD 26)');
  assert.deepEqual(Object.keys(magias).sort(), ['_id', 'system.description.value']);
  assert.deepEqual(r.textos.cds, [{ nome: 'Magias', antigas: [17], para: 26 }]);
  assert.equal(r.itemUpdates.some(u => u._id === 'IseSV7ZmgqkbCKMx'), false); // Medo de Altura não tem CD
});

test('textos: o PM e as magias com dano não são tocados', () => {
  const r = ajustar(ficha('centauro'), '7', 'special');
  assert.equal('system.attributes.pm.max' in r.update, false);
  const ids = new Set(r.itemUpdates.map(u => u._id));
  for (const nome of ['Controlar Plantas', 'Curar Ferimentos', 'Armamento da Natureza']) {
    const item = ficha('centauro').items.find(i => i.name === nome);
    assert.equal(ids.has(item._id), false, nome);
  }
});

test('textos: a linha de ataques (Corpo a Corpo) é atualizada', () => {
  const r = ajustar(ficha('centauro'), '7', 'special');
  assert.equal(r.update['system.detalhes.ataquescac'], 'Bordão +22 (3d6+21) e cascos +22 (3d6+21).');
  assert.deepEqual(r.textos.ataques, [{
    campo: 'ataquescac',
    antes: 'Bordão +11 (1d8+4) e cascos +11 (1d8+4).',
    depois: 'Bordão +22 (3d6+21) e cascos +22 (3d6+21).',
  }]);
  assert.equal('system.detalhes.ataquesad' in r.update, false); // campo vazio não é preenchido
});

test('textos: CD dentro da descrição da arma e dentro da linha de ataques (Aparição)', () => {
  const r = ajustar(ficha('aparicao'), '5', 'solo');
  const toque = r.itemUpdates.find(u => u._id === '1dUkvjqGzvhL4L2M');
  assert.match(toque['system.description.value'], /Fortitude \(CD 20\)/);
  assert.ok(toque['system.rolls']); // as rolagens vêm no mesmo update
  assert.match(r.update['system.detalhes.ataquescac'], /^Toque drenante \+17 \(4d6\+26 de trevas\)\./);
  assert.match(r.update['system.detalhes.ataquescac'], /Fortitude \(CD 20\)\. Se falhar/);
});

test('textos: dá para desligar a troca de CD e a de linhas de ataque', () => {
  const c = ficha('centauro');
  const semCD = ajustar(c, '7', 'special', { atualizarCDs: false });
  assert.equal(semCD.itemUpdates.some(u => 'system.description.value' in u), false);
  assert.deepEqual(semCD.textos.cds, []);
  const semAtaques = ajustar(c, '7', 'special', { atualizarTextoAtaques: false });
  assert.equal('system.detalhes.ataquescac' in semAtaques.update, false);
  assert.deepEqual(semAtaques.textos.ataques, []);
});

test('proporção: Sacerdote da Tormenta ND 10 → ND 15 mantém corrente com quase o dobro da mordida', () => {
  const s = ficha('sacerdote');
  const r = ajustar(s, '15', 'special');
  const corrente = r.itemUpdates.find(u => u._id === '65aJVp8OY7wU4c7I');
  const mordida = r.itemUpdates.find(u => u._id === 'beHzVw8I80nr1KUo');
  assert.equal(corrente['system.ataques'], 2);
  assert.equal(mordida['system.ataques'], 1);
  assert.equal(corrente['system.rolls'][1].parts[0][0], '7d6+46');
  assert.equal(corrente['system.rolls'][1].parts[2][0], '1d6'); // ácido continua igual
  assert.equal(mordida['system.rolls'][1].parts[0][0], '3d6+28');
  assert.equal(r.update['system.detalhes.ataquescac'],
    'Duas correntes de espinhos aberrantes +41 (7d6+46 mais 1d6 de ácido) e mordida +41 (3d6+28).');
});

test('proporção: manterProporcao false dá a mesma fórmula às duas armas do Sacerdote', () => {
  const r = ajustar(ficha('sacerdote'), '15', 'special', { manterProporcao: false });
  const formulas = r.itemUpdates.map(u => u['system.rolls']?.[1].parts[0][0]).filter(Boolean);
  assert.deepEqual(formulas, ['5d6+42', '5d6+42']);
});

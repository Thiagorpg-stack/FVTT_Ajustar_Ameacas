import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formulaSoDados, limiteDados, balancearDano, mediaFormula } from '../scripts/dano.js';

const d = (faces) => ({ faces, media: (faces + 1) / 2 });

test('limiteDados: ND + 1 dados, e ND 1/4 e 1/2 contam como 0', () => {
  assert.equal(limiteDados('1/4'), 1);
  assert.equal(limiteDados('1/2'), 1);
  assert.equal(limiteDados('5'), 6);
  assert.equal(limiteDados(20), 21);
  assert.equal(limiteDados('S'), 22);
});

// Sopro dos dragões oficiais (solo, d12): 0,6 × tabela, limite ND+1
for (const [nome, nd, tabela, esperado] of [
  ['Filhote', 3, 21, '2d12'],
  ['Jovem', 7, 62, '6d12'],
  ['Adulto', 11, 130, '12d12'],
  ['Venerável', 15, 186, '16d12'],
  ['Rei', 20, 324, '21d12'],
]) {
  test(`formulaSoDados: sopro do Dragão ${nome} (ND ${nd}) → ${esperado}`, () => {
    const r = formulaSoDados({ alvo: 0.6 * tabela, partes: [d(12)], limite: limiteDados(nd) });
    assert.equal(r.formula, esperado);
  });
}

test('formulaSoDados: Otyugh ND 5 com efeito → 5d8; sem efeito → 6d8', () => {
  assert.equal(formulaSoDados({ alvo: 0.6 * 40, partes: [d(8)], limite: 6 }).formula, '5d8');
  assert.equal(formulaSoDados({ alvo: 0.7 * 40, partes: [d(8)], limite: 6 }).formula, '6d8');
});

test('formulaSoDados: sem dado na origem usa d12', () => {
  assert.equal(formulaSoDados({ alvo: 24, limite: 6 }).formula, '4d12');
});

test('formulaSoDados: no mínimo 1 dado, mesmo com alvo minúsculo', () => {
  assert.equal(formulaSoDados({ alvo: 0.5, partes: [d(8)], limite: 1 }).formula, '1d8');
});

test('formulaSoDados: duas partes repartem o alvo na proporção das médias (3d8 + 2d6)', () => {
  const r = formulaSoDados({ alvo: 24, partes: [{ faces: 8, media: 13.5 }, { faces: 6, media: 7 }], limite: 6 });
  assert.deepEqual(r.formulas, ['4d8', '2d6']);
  assert.equal(r.formula, '4d8+2d6');
});

test('formulaSoDados: o limite vale para o total e corta a parte maior primeiro', () => {
  const r = formulaSoDados({ alvo: 24, partes: [{ faces: 8, media: 13.5 }, { faces: 6, media: 7 }], limite: 3 });
  assert.deepEqual(r.formulas, ['1d8', '2d6']);
});

const tentaculos = { id: 't', ataques: 1, secundario: 0, alternativa: true, estilo: 'dados', fator: 0.6, partes: [d(8)] };

test('balancearDano: poder padrão com efeito recebe 0,6 × tabela só em dados; a arma continua com o alvo cheio', () => {
  const r = balancearDano({
    danoAlvo: 40, limiteDados: 6,
    armas: [{ id: 'a', ataques: 1, secundario: 0 }, tentaculos],
  });
  assert.equal(r.porArma.t.formula, '5d8');
  assert.equal(r.porArma.a.formula, '4d6+26');
});

test('balancearDano: poder sem efeito usa fator 0,7', () => {
  const r = balancearDano({ danoAlvo: 40, limiteDados: 6, armas: [{ ...tentaculos, fator: 0.7 }] });
  assert.equal(r.porArma.t.formula, '6d8');
});

test('balancearDano: poder sem partes usa d12', () => {
  const r = balancearDano({ danoAlvo: 40, limiteDados: 6, armas: [{ ...tentaculos, partes: undefined }] });
  assert.equal(r.porArma.t.formula, '4d12');
});

test('balancearDano: limite corta o sopro (Dragão Venerável) e avisa que ficou abaixo do alvo', () => {
  const r = balancearDano({ danoAlvo: 186, limiteDados: 16, armas: [{ ...tentaculos, partes: [d(12)] }] });
  assert.equal(r.porArma.t.formula, '16d12');
  assert.ok(r.avisos.some(a => /limite/i.test(a)));
  assert.equal(r.grupos[0].alerta, 'equilibrado'); // 104 contra 0,6 × 186 = 111,6
});

test('balancearDano: reajustar o poder já ajustado dá o mesmo resultado', () => {
  const primeiro = balancearDano({ danoAlvo: 40, limiteDados: 6, armas: [tentaculos] });
  const media = mediaFormula(primeiro.porArma.t.formula);
  const segundo = balancearDano({
    danoAlvo: 40, limiteDados: 6, armas: [{ ...tentaculos, partes: [{ faces: 8, media }] }],
  });
  assert.equal(segundo.porArma.t.formula, primeiro.porArma.t.formula);
});

test('balancearDano: poder não padrão entra no grupo das armas e a soma da rodada continua igual ao alvo', () => {
  const sozinha = balancearDano({ danoAlvo: 40, armas: [{ id: 'a', ataques: 1, secundario: 0, principal: 20 }] });
  const comPoder = balancearDano({
    danoAlvo: 40,
    armas: [{ id: 'a', ataques: 1, secundario: 0, principal: 20 }, { id: 'p', ataques: 1, secundario: 0, principal: 20 }],
  });
  assert.equal(sozinha.porArma.a.danoPorGolpe, 40);
  assert.equal(comPoder.porArma.a.danoPorGolpe, 20);
  assert.equal(comPoder.grupos[0].obtido, 40);
});

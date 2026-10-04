import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  mediaFormula, gerarFormulaDano, analisarDanoArma, balancearDano, alertaEquilibrio,
} from '../scripts/dano.js';

const pasta = new URL('./fixtures/', import.meta.url);
function ficha(nome) {
  const arq = readdirSync(pasta).find(f => f.includes(nome));
  return JSON.parse(readFileSync(new URL(arq, pasta), 'utf8'));
}
const arma = (a, nome) => a.items.find(i => i.type === 'arma' && i.name === nome);

test('mediaFormula: dados, bônus e espaços', () => {
  assert.equal(mediaFormula('1d6'), 3.5);
  assert.equal(mediaFormula('3d8+12'), 25.5);
  assert.equal(mediaFormula('1d10+1d12+18'), 30);
  assert.equal(mediaFormula('2d6-1'), 6);
  assert.equal(mediaFormula('1d12 +10'), 16.5); // Anão Veterano
  assert.equal(mediaFormula('d4'), 2.5);
  assert.equal(mediaFormula('20'), 20);
});

test('mediaFormula devolve null para o que não é fórmula', () => {
  assert.equal(mediaFormula(''), null);
  assert.equal(mediaFormula('@Tormenta'), null); // Sacerdote
  assert.equal(mediaFormula('padrao'), null);
  assert.equal(mediaFormula(undefined), null);
});

test('gerarFormulaDano segue os exemplos do auto-balanceamento da calculadora', () => {
  assert.equal(gerarFormulaDano(15), '1d6+12');
  assert.equal(gerarFormulaDano(18), '1d6+15');
  assert.equal(gerarFormulaDano(20), '2d6+13');
  assert.equal(gerarFormulaDano(34), '3d6+24');
  assert.equal(gerarFormulaDano(130 / 3), '4d6+29');
  assert.equal(gerarFormulaDano(67.5), '6d6+47');
  assert.equal(gerarFormulaDano(81), '8d6+53');
  assert.equal(gerarFormulaDano(8), '1d6+5');
  assert.equal(gerarFormulaDano(52.5), '5d6+35');
});

test('gerarFormulaDano: bônus zero, bônus negativo e nada sobrando', () => {
  assert.equal(gerarFormulaDano(3), '1d6');
  assert.equal(gerarFormulaDano(2), '1d6-1');
  assert.equal(gerarFormulaDano(0), '0');
  assert.equal(gerarFormulaDano(-4), '0');
});

test('analisarDanoArma: Vampiro tem 2d10 de trevas como dano secundário', () => {
  const espada = arma(ficha('vampiro'), 'Espada longa x2');
  const r = analisarDanoArma(espada.system.rolls);
  assert.equal(espada.system.rolls[r.indiceRoll].type, 'dano');
  assert.equal(r.secundario, 11);
});

test('analisarDanoArma: Aparição ignora a rolagem de cura (curatpv) e escolhe o dano', () => {
  const toque = arma(ficha('aparicao'), 'Toque drenante');
  const r = analisarDanoArma(toque.system.rolls);
  assert.equal(toque.system.rolls[r.indiceRoll].name, 'Dano');
  assert.equal(r.secundario, 0);
});

test('analisarDanoArma: partes vazias ou com rótulo ability não contam (Dragão)', () => {
  const mordida = arma(ficha('dragao'), 'Mordida');
  assert.equal(analisarDanoArma(mordida.system.rolls).secundario, 0);
});

test('analisarDanoArma: arma sem rolagem de dano devolve null', () => {
  assert.equal(analisarDanoArma([{ type: 'ataque', parts: [] }]), null);
});

test('balancearDano: Golem de Ferro ND 12 Solo, 3 ataques → 4d6+34', () => {
  const r = balancearDano({ danoAlvo: 144, armas: [{ id: 'g', ataques: 3, secundario: 0 }] });
  assert.equal(r.porArma.g.formula, '4d6+34');
  assert.equal(r.porArma.g.danoPorGolpe, 48);
});

test('balancearDano: desconta o dano secundário (Vampiro ND 12 → 6d6+40)', () => {
  const r = balancearDano({
    danoAlvo: 144,
    armas: [
      { id: 'espada', ataques: 1, secundario: 11 },
      { id: 'garra', ataques: 1, secundario: 11 },
    ],
  });
  assert.equal(r.porArma.espada.formula, '6d6+40');
  assert.equal(r.porArma.garra.formula, '6d6+40');
});

test('balancearDano: Glop de Sangue ND 5 Lacaio (3d6 existente) → 4d6+32', () => {
  const r = balancearDano({ danoAlvo: 56, armas: [{ id: 'p', ataques: 1, secundario: 10.5 }] });
  assert.equal(r.porArma.p.formula, '4d6+32');
});

test('balancearDano: arma com 0 ataques não recebe fórmula', () => {
  const r = balancearDano({
    danoAlvo: 40,
    armas: [{ id: 'a', ataques: 1, secundario: 0 }, { id: 'b', ataques: 0, secundario: 0 }],
  });
  assert.ok(r.porArma.a);
  assert.equal(r.porArma.b, undefined);
});

test('balancearDano: armas alternativas são balanceadas cada uma contra o alvo todo (Anão ND 2)', () => {
  const r = balancearDano({
    danoAlvo: 18,
    armas: [
      { id: 'besta', ataques: 1, secundario: 0, alternativa: true },
      { id: 'machado', ataques: 1, secundario: 0, alternativa: true },
    ],
  });
  assert.equal(r.porArma.besta.formula, '1d6+15');
  assert.equal(r.porArma.machado.formula, '1d6+15');
});

test('balancearDano: dano existente acima do alvo gera fórmula 0 com aviso', () => {
  const r = balancearDano({ danoAlvo: 10, armas: [{ id: 'a', ataques: 1, secundario: 30 }] });
  assert.equal(r.porArma.a.formula, '0');
  assert.ok(r.avisos.some(a => /excede|passa/i.test(a)));
});

test('balancearDano: sem nenhuma arma ativa lança erro', () => {
  assert.throws(() => balancearDano({ danoAlvo: 10, armas: [{ id: 'a', ataques: 0, secundario: 0 }] }), /ataque/i);
});

test('alertaEquilibrio usa margem = max(5, 10% do alvo)', () => {
  assert.equal(alertaEquilibrio(144, 144), 'equilibrado');
  assert.equal(alertaEquilibrio(144 + 14, 144), 'equilibrado');
  assert.equal(alertaEquilibrio(144 + 15, 144), 'alto');
  assert.equal(alertaEquilibrio(144 - 15, 144), 'baixo');
  assert.equal(alertaEquilibrio(18 + 5, 18), 'equilibrado'); // piso de 5
  assert.equal(alertaEquilibrio(18 + 6, 18), 'alto');
});

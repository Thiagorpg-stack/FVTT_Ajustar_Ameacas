import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { atualizarNivelConjurador } from '../scripts/textos.js';
import { nivelDoND, circuloMaximo, sugerirCirculos } from '../scripts/circulos.js';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const ajustar = (f, nd, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel: f.system.detalhes.role, medir: criarMedidor(f), ...extra });

test('atualizarNivelConjurador troca o nível e devolve classe, nível antigo e novo', () => {
  const r = atualizarNivelConjurador('O sacerdote de Aharadak lança magias como um clérigo de 10º nível (CD 30)', 15);
  assert.equal(r.texto, 'O sacerdote de Aharadak lança magias como um clérigo de 15º nível (CD 30)');
  assert.deepEqual(r.trocas, [{ classe: 'clérigo', de: 10, para: 15 }]);
});

test('atualizarNivelConjurador aceita "uma", "conjurador" e HTML ao redor', () => {
  assert.equal(
    atualizarNivelConjurador('<p>A bruxa lança magias como uma feiticeira de 5º nível.</p>', 9).texto,
    '<p>A bruxa lança magias como uma feiticeira de 9º nível.</p>');
  assert.equal(
    atualizarNivelConjurador('O dragão lança magias como um conjurador de 15º nível (CD 40).', 20).texto,
    'O dragão lança magias como um conjurador de 20º nível (CD 40).');
});

test('atualizarNivelConjurador só mexe em "magias como" e deixa o resto igual', () => {
  const original = 'Ataca como um guerreiro de 5º nível e resiste como um monge de 3º nível.';
  const r = atualizarNivelConjurador(original, 12);
  assert.equal(r.texto, original);
  assert.deepEqual(r.trocas, []);
  assert.deepEqual(atualizarNivelConjurador('', 5), { texto: '', trocas: [] });
  assert.deepEqual(atualizarNivelConjurador(undefined, 5), { texto: '', trocas: [] });
});

test('nivelDoND: ND fracionário vale 1, S e S+ valem 20, número vale ele mesmo e passa de 20 não', () => {
  assert.equal(nivelDoND('1/4'), 1);
  assert.equal(nivelDoND('1/2'), 1);
  assert.equal(nivelDoND('15'), 15);
  assert.equal(nivelDoND('S'), 20);
  assert.equal(nivelDoND('S+'), 20);
});

test('circuloMaximo segue a tabela de cada classe', () => {
  assert.equal(circuloMaximo('clérigo', 12), 3);
  assert.equal(circuloMaximo('clérigo', 13), 4);
  assert.equal(circuloMaximo('Feiticeira', 17), 5);
  assert.equal(circuloMaximo('conjurador', 15), 4);
  assert.equal(circuloMaximo('bardo', 13), 3);
  assert.equal(circuloMaximo('bardo', 14), 4);
  assert.equal(circuloMaximo('paladino', 3), 0);
  assert.equal(circuloMaximo('paladino', 16), 4);
  assert.equal(circuloMaximo('guerreiro', 15), null); // classe fora da tabela
});

test('sugerirCirculos avisa círculo liberado, círculo acima do permitido e fica quieto no resto', () => {
  assert.match(sugerirCirculos({ classe: 'clérigo', nivel: 15, maiorCirculoNaFicha: 3 })[0],
    /Clérigo 15º.*4º círculo.*até o 3º/);
  assert.match(sugerirCirculos({ classe: 'clérigo', nivel: 12, maiorCirculoNaFicha: 4 })[0],
    /3º círculo.*4º círculo/);
  assert.deepEqual(sugerirCirculos({ classe: 'conjurador', nivel: 15, maiorCirculoNaFicha: 4 }), []);
  assert.deepEqual(sugerirCirculos({ classe: 'guerreiro', nivel: 15, maiorCirculoNaFicha: 1 }), []);
});

test('ajuste do Sacerdote 10 → 15: troca o nível no texto e sugere o 4º círculo', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '15');
  const magias = f.items.find(i => i.name === 'Magias');
  assert.match(r.itemUpdates.find(u => u._id === magias._id)['system.description.value'],
    /clérigo de 15º nível \(CD \d+\)/);
  assert.deepEqual(r.textos.conjurador, [{ nome: 'Magias', classe: 'clérigo', de: 10, para: 15 }]);
  assert.equal(r.sugestoes.length, 1);
  assert.match(r.sugestoes[0], /4º círculo/);
});

test('ajuste do Dragão 15 → 15: nível já igual, nenhuma sugestão', () => {
  const r = ajustar(ficha('dragao'), '15');
  assert.deepEqual(r.sugestoes, []);
});

test('ajuste com atualizarNivelConjurador desligado não mexe no nível nem sugere nada', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '15', { atualizarNivelConjurador: false });
  const magias = f.items.find(i => i.name === 'Magias');
  const mudanca = r.itemUpdates.find(u => u._id === magias._id);
  assert.match(mudanca['system.description.value'], /clérigo de 10º nível/);
  assert.deepEqual(r.textos.conjurador, []);
  assert.deepEqual(r.sugestoes, []);
});

test('reduzir o ND do Dragão avisa círculos acima do permitido', () => {
  const r = ajustar(ficha('dragao'), '8');
  assert.ok(r.sugestoes.some(s => /4º círculo/.test(s)));
});

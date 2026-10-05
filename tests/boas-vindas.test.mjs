import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decidirMensagem, montarMensagem, NOVIDADES } from '../scripts/boas-vindas.js';

const textos = JSON.parse(readFileSync(new URL('../lang/pt-BR.json', import.meta.url), 'utf8'));
const t = (chave) => textos[chave] ?? chave;

test('decidirMensagem: sem versão guardada mostra a mensagem completa', () => {
  assert.equal(decidirMensagem('', '0.4.0'), 'completa');
  assert.equal(decidirMensagem(undefined, '0.4.0'), 'completa');
});

test('decidirMensagem: versão nova com novidades cadastradas mostra só as novidades', () => {
  assert.ok('0.4.0' in NOVIDADES);
  assert.equal(decidirMensagem('0.3.1', '0.4.0'), 'novidades');
  assert.equal(decidirMensagem('0.3.9', '0.4.0'), 'novidades');
});

test('decidirMensagem: não repete na mesma versão, em versão sem novidades nem em retrocesso', () => {
  assert.equal(decidirMensagem('0.4.0', '0.4.0'), null);
  assert.equal(decidirMensagem('0.4.0', '0.4.1'), null); // 0.4.1 não tem novidades cadastradas
  assert.equal(decidirMensagem('0.5.0', '0.4.0'), null);
});

test('decidirMensagem compara versões como números (0.10.0 vem depois de 0.9.0)', () => {
  const antes = { ...NOVIDADES };
  NOVIDADES['0.10.0'] = ['T20AJND.Novidade040Conjurador'];
  try {
    assert.equal(decidirMensagem('0.9.0', '0.10.0'), 'novidades');
    assert.equal(decidirMensagem('0.10.0', '0.9.0'), null);
  } finally {
    for (const k of Object.keys(NOVIDADES)) if (!(k in antes)) delete NOVIDADES[k];
  }
});

test('montarMensagem completa explica onde fica o botão, o que ajusta e que o ajuste cria uma cópia', () => {
  const html = montarMensagem('completa', '0.4.0', t);
  assert.match(html, /Ajustar ND/);
  assert.match(html, /cabeçalho da ficha/);
  assert.match(html, /diretório de Atores/);
  assert.match(html, /cópia/);
  assert.doesNotMatch(html, /T20AJND\./, 'sobrou chave de tradução sem texto');
});

test('montarMensagem de novidades lista só as novidades da versão', () => {
  const html = montarMensagem('novidades', '0.4.0', t);
  assert.match(html, /0\.4\.0/);
  assert.match(html, /nível de conjurador/i);
  assert.doesNotMatch(html, /diretório de Atores/);
  assert.doesNotMatch(html, /T20AJND\./);
});

test('montarMensagem escapa HTML vindo do texto de tradução', () => {
  const html = montarMensagem('completa', '0.4.0', (chave) => `<script>${chave}</script>`);
  assert.doesNotMatch(html, /<script>/);
});

test('a v0.5.0 anuncia os avisos de patamar', () => {
  assert.equal(decidirMensagem('0.4.0', '0.5.0'), 'novidades');
  assert.match(montarMensagem('novidades', '0.5.0', t), /patamar/i);
});

test('a v0.6.0 anuncia o template Chefe Final', () => {
  assert.equal(decidirMensagem('0.5.0', '0.6.0'), 'novidades');
  assert.match(montarMensagem('novidades', '0.6.0', t), /Chefe Final/);
});

test('a v0.7.0 anuncia o template Enxame', () => {
  assert.equal(decidirMensagem('0.6.0', '0.7.0'), 'novidades');
  assert.match(montarMensagem('novidades', '0.7.0', t), /Enxame/);
});

test('a v0.8.0 anuncia o template Bando', () => {
  assert.equal(decidirMensagem('0.7.0', '0.8.0'), 'novidades');
  assert.match(montarMensagem('novidades', '0.8.0', t), /Bando/);
});

test('a v0.8.1 anuncia Bando e Enxame juntos e as correções', () => {
  assert.equal(decidirMensagem('0.8.0', '0.8.1'), 'novidades');
  assert.match(montarMensagem('novidades', '0.8.1', t), /juntos/);
});

test('a v0.8.2 anuncia o dano extra do Bando e a correção dos ataques com o Enxame', () => {
  assert.equal(decidirMensagem('0.8.1', '0.8.2'), 'novidades');
  assert.match(montarMensagem('novidades', '0.8.2', t), /dano extra/);
});

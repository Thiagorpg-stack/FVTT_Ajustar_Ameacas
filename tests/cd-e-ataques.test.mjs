import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atualizarCDs, atualizarTextoAtaques } from '../scripts/textos.js';
import { ficha } from './helpers.mjs';

test('atualizarCDs troca só o número da CD e conta as trocas', () => {
  const r = atualizarCDs('O centauro xamã lança magias como um clérigo de 3º nível (CD 17)', 26);
  assert.equal(r.texto, 'O centauro xamã lança magias como um clérigo de 3º nível (CD 26)');
  assert.deepEqual(r.antigas, [17]);
});

test('atualizarCDs troca todas as CDs do texto (Vampiro)', () => {
  const r = atualizarCDs('a vítima (Von CD 29 evita). Quem ataca deve passar em Vontade (CD 29).', 33);
  assert.equal(r.texto, 'a vítima (Von CD 33 evita). Quem ataca deve passar em Vontade (CD 33).');
  assert.deepEqual(r.antigas, [29, 29]);
});

test('atualizarCDs não mexe em texto sem número depois de CD', () => {
  const original = 'dissipadas as magias com CD menor que o resultado do teste, até o 3º círculo';
  const r = atualizarCDs(original, 26);
  assert.equal(r.texto, original);
  assert.deepEqual(r.antigas, []);
});

test('atualizarCDs funciona dentro de HTML e aceita texto vazio', () => {
  assert.equal(atualizarCDs('<p>Fortitude <strong>CD 30</strong> reduz</p>', 31).texto, '<p>Fortitude <strong>CD 31</strong> reduz</p>');
  assert.deepEqual(atualizarCDs('', 20), { texto: '', antigas: [] });
  assert.deepEqual(atualizarCDs(undefined, 20), { texto: '', antigas: [] });
});

test('atualizarTextoAtaques: troca o bônus e a fórmula (Centauro)', () => {
  const texto = atualizarTextoAtaques('Bordão +11 (1d8+4) e cascos +11 (1d8+4).', [
    { nome: 'Bordão', ataque: 22, formula: '3d6+21' },
    { nome: 'Cascos', ataque: 22, formula: '3d6+21' },
  ]);
  assert.equal(texto, 'Bordão +22 (3d6+21) e cascos +22 (3d6+21).');
});

test('atualizarTextoAtaques: mantém dano secundário e crítico (Vampiro)', () => {
  const texto = atualizarTextoAtaques(
    'Espada longa x2 +25 (2d8+25 mais 2d10 de trevas, 17) e garra +36 (2d6+25 mais 2d10 de trevas).', [
      { nome: 'Espada longa x2', ataque: 36, formula: '6d6+40' },
      { nome: 'Garra', ataque: 36, formula: '6d6+40' },
    ]);
  assert.equal(texto, 'Espada longa x2 +36 (6d6+40 mais 2d10 de trevas, 17) e garra +36 (6d6+40 mais 2d10 de trevas).');
});

test('atualizarTextoAtaques: mantém o resto do texto (Aparição)', () => {
  const texto = atualizarTextoAtaques(
    'Toque drenante +18 (3d8+6 de trevas). Uma criatura viva atingida deve fazer um teste de Fortitude (CD 21).',
    [{ nome: 'Toque drenante', ataque: 17, formula: '4d6+26' }]);
  assert.equal(texto,
    'Toque drenante +17 (4d6+26 de trevas). Uma criatura viva atingida deve fazer um teste de Fortitude (CD 21).');
});

test('atualizarTextoAtaques: acha a arma no plural (Sacerdote, Hidra, Troll)', () => {
  assert.equal(
    atualizarTextoAtaques('Duas correntes de espinhos aberrantes +30 (4d6+12 mais 1d6 de ácido) e mordida +30 (1d6+12).', [
      { nome: 'Corrente de espinhos aberrantes', ataque: 27, formula: '2d6+17' },
      { nome: 'Mordida', ataque: 27, formula: '2d6+17' },
    ]),
    'Duas correntes de espinhos aberrantes +27 (2d6+17 mais 1d6 de ácido) e mordida +27 (2d6+17).');
  assert.equal(
    atualizarTextoAtaques('Cinco mordidas +34 (3d6+16).', [{ nome: 'Mordida', ataque: 41, formula: '4d6+30' }]),
    'Cinco mordidas +41 (4d6+30).');
  assert.equal(
    atualizarTextoAtaques('Mordida +17 (1d8+6) e duas garras +17 (1d6+6).', [
      { nome: 'Mordida', ataque: 17, formula: '1d6+10' },
      { nome: 'Garras', ataque: 17, formula: '1d6+10' },
    ]),
    'Mordida +17 (1d6+10) e duas garras +17 (1d6+10).');
});

test('atualizarTextoAtaques: mantém o crítico em x (Alabarda) e a fórmula antiga se não há nova', () => {
  assert.equal(
    atualizarTextoAtaques('Alabarda +8 (1d10+5, x3)', [{ nome: 'Alabarda', ataque: 17, formula: '4d6+26' }]),
    'Alabarda +17 (4d6+26, x3)');
  assert.equal(
    atualizarTextoAtaques('Alabarda +8 (1d10+5, x3)', [{ nome: 'Alabarda', ataque: 17 }]),
    'Alabarda +17 (1d10+5, x3)');
});

test('atualizarTextoAtaques: texto vazio ou arma que não aparece no texto não muda nada', () => {
  assert.equal(atualizarTextoAtaques('', [{ nome: 'Garra', ataque: 20, formula: '2d6' }]), '');
  assert.equal(
    atualizarTextoAtaques('Alabarda +8 (1d10+5)', [{ nome: 'Garra', ataque: 20, formula: '2d6' }]),
    'Alabarda +8 (1d10+5)');
});

test('fichas reais: o texto de ataque gerado a partir dos dados originais reproduz o texto da ficha', () => {
  const v = ficha('vampiro');
  const texto = atualizarTextoAtaques(v.system.detalhes.ataquescac, [
    { nome: 'Espada longa x2', ataque: 25, formula: '2d8+25' },
    { nome: 'Garra', ataque: 36, formula: '2d6+25' },
  ]);
  assert.equal(texto, v.system.detalhes.ataquescac);
});

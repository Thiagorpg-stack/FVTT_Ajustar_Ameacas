import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atualizarDanoPoder } from '../scripts/textos.js';

test('atualizarDanoPoder: texto no estilo 5e "16 (3d8 + 3 Bludgeoning)" troca média e fórmula e normaliza espaços', () => {
  const r = atualizarDanoPoder('Each creature takes 16 (3d8 + 3 Bludgeoning) damage.', [{ de: '3d8 + 3', para: '5d8' }]);
  assert.equal(r, 'Each creature takes 22 (5d8 Bludgeoning) damage.');
});

test('atualizarDanoPoder: estilo 5e com duas partes troca cada uma', () => {
  const r = atualizarDanoPoder('13 (3d8) Bludgeoning plus 7 (2d6) Fire damage', [
    { de: '3d8', para: '4d8' }, { de: '2d6', para: '2d6' },
  ]);
  assert.equal(r, '18 (4d8) Bludgeoning plus 7 (2d6) Fire damage');
});

test('atualizarDanoPoder: estilo T20 (fórmula solta) troca só a fórmula e deixa a CD e o resto', () => {
  const r = atualizarDanoPoder('Todas as criaturas sofrem 16d12 pontos de dano de fogo (Ref CD 40 reduz à metade).', [{ de: '16d12', para: '12d12' }]);
  assert.equal(r, 'Todas as criaturas sofrem 12d12 pontos de dano de fogo (Ref CD 40 reduz à metade).');
});

test('atualizarDanoPoder: acha a fórmula com ou sem espaços ("2d6 + 6" e "2d6+6")', () => {
  assert.equal(atualizarDanoPoder('causa mais 2d6+6 pontos de dano', [{ de: '2d6 + 6', para: '3d6+10' }]), 'causa mais 3d6+10 pontos de dano');
});

test('atualizarDanoPoder: não troca dentro de outra fórmula (12d6 não é 2d6; 3d8+30 não é 3d8+3)', () => {
  assert.equal(atualizarDanoPoder('12d6 e 2d6', [{ de: '2d6', para: '3d6' }]), '12d6 e 3d6');
  assert.equal(atualizarDanoPoder('3d8+30', [{ de: '3d8+3', para: '5d8' }]), '3d8+30');
});

test('atualizarDanoPoder: trocas em uma passada só (3d8→4d8 e 4d8→2d8 não se encadeiam)', () => {
  const r = atualizarDanoPoder('x 3d8 y 4d8', [{ de: '3d8', para: '4d8' }, { de: '4d8', para: '2d8' }]);
  assert.equal(r, 'x 4d8 y 2d8');
});

test('atualizarDanoPoder: multiplicador (Bando) entra como "×N" e na média do estilo 5e', () => {
  assert.equal(atualizarDanoPoder('causa 2d6', [{ de: '2d6', para: '3d6', multiplicador: 2 }]), 'causa 3d6 ×2');
  assert.equal(atualizarDanoPoder('7 (2d6) fire', [{ de: '2d6', para: '3d6', multiplicador: 2 }]), '21 (3d6 ×2) fire');
});

test('atualizarDanoPoder: texto sem a fórmula, vazio ou sem partes fica igual', () => {
  assert.equal(atualizarDanoPoder('nada de dano aqui', [{ de: '2d6', para: '3d6' }]), 'nada de dano aqui');
  assert.equal(atualizarDanoPoder('', [{ de: '2d6', para: '3d6' }]), '');
  assert.equal(atualizarDanoPoder(undefined, []), '');
  assert.equal(atualizarDanoPoder('causa 2d6', []), 'causa 2d6');
});

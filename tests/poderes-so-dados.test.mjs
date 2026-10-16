// Poder cujo dano principal é só dados continua só dados quando é ajustado, qualquer que seja a ação:
// o sopro do golem (ação de movimento) saía como "3d6+26" em vez de dados d12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerPoderes } from '../scripts/calculo.js';
import { balancearDano } from '../scripts/dano.js';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const FLAG = 'tormenta20-ajuste-nd';
const ajustar = (f, nd) => calcularAjuste({ dados: f, tabelas, nd, papel: 'solo', medir: criarMedidor(f) });

// Sopro do dragão com a ação e a fórmula trocadas, e ligado para ajuste.
function sopro({ execucao = 'move', formula = '6d12' } = {}) {
  const a = ficha('dragao');
  const item = a.items.find(i => i.type === 'poder' && i.name === 'Sopro');
  item.system.ativacao.execucao = execucao;
  item.system.rolls = [{ name: 'Dano', type: 'dano', parts: [[formula, 'fogo', '']] }];
  item.flags = { [FLAG]: { danoPoder: { ajustar: true, efeito: true } } };
  return { a, item };
}
const formulaDe = (r, item) => r.itemUpdates.find(u => u._id === item._id)['system.rolls'][0].parts[0][0];

test('lerPoderes: soDados vale para dano principal só em dados (com as faces) e não para bônus fixo ou variável', () => {
  const de = (formula) => lerPoderes(sopro({ formula }).a.items)[0];
  assert.deepEqual([de('6d12').soDados, de('6d12').faces], [true, 12]);
  assert.deepEqual([de(' 1d20 ').soDados, de(' 1d20 ').faces], [true, 20]);
  assert.equal(de('4d6+26').soDados, false);
  assert.equal(de('3d8 + 3').soDados, false);
  assert.deepEqual(lerPoderes(sopro({ formula: '2d6+@mod' }).a.items), []); // dano com variável nem entra na lista (já era assim)
});

test('balancearDano: poder só de dados que divide a rodada recebe dados das mesmas faces, sem bônus', () => {
  const armas = [
    { id: 'arma', ataques: 1, secundario: 0, principal: 20 },
    { id: 'poder', ataques: 1, secundario: 0, principal: 39, faces: 12 },
  ];
  for (const manterProporcao of [true, false]) {
    const { porArma } = balancearDano({ danoAlvo: 40, armas, manterProporcao });
    assert.match(porArma.poder.formula, /^\d+d12$/, `manterProporcao ${manterProporcao}`);
    assert.doesNotMatch(porArma.arma.formula, /d12/); // a arma segue o formato Nd6+B de sempre
  }
  const igual = balancearDano({ danoAlvo: 40, armas, manterProporcao: false }).porArma;
  assert.equal(igual.poder.formula, '3d12'); // fatia de 20: 20 / 6,5 = 3,1 dados
});

test('balancearDano: o teto de dados vale para o poder só de dados e avisa quando corta', () => {
  const armas = [{ id: 'poder', ataques: 1, secundario: 0, principal: 39, faces: 12 }];
  const r = balancearDano({ danoAlvo: 324, armas, limiteDados: 6 });
  assert.equal(r.porArma.poder.formula, '6d12');
  assert.match(r.avisos.join(' '), /limite de 6 dados/);
});

test('balancearDano: poder sem `faces` (com bônus) segue o formato de sempre', () => {
  const armas = [{ id: 'poder', ataques: 1, secundario: 0, principal: 30 }];
  assert.match(balancearDano({ danoAlvo: 40, armas }).porArma.poder.formula, /^\d+d6[+-]\d+$/);
});

test('calcularAjuste: Sopro de movimento só de dados vira só dados d12 (nada de d6 com bônus)', () => {
  const { a, item } = sopro();
  const formula = formulaDe(ajustar(a, '5'), item);
  assert.match(formula, /^\d+d12$/);
});

test('calcularAjuste: poder de movimento com bônus fixo continua Nd6+B; ação padrão continua só dados com o fator da tabela', () => {
  const com = sopro({ formula: '4d10+30' });
  assert.match(formulaDe(ajustar(com.a, '5'), com.item), /^\d+d6[+-]\d+$/);
  const padrao = sopro({ execucao: 'action' });
  assert.match(formulaDe(ajustar(padrao.a, '5'), padrao.item), /^\d+d12$/);
});

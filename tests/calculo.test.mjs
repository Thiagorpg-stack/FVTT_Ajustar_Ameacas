import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  contarAtaques, lerArmas, atribuirResistencias, ordenarResistencias, avisoLimite, revisarItens, planejarAjuste,
} from '../scripts/calculo.js';
import { ficha, totaisResistencias, totalPericia } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const arma = (a, nome) => a.items.find(i => i.type === 'arma' && i.name === nome);
const ataquescac = (a) => a.system.detalhes.ataquescac;

test('helper de teste: Luta calculada bate com o ataque impresso nas fichas', () => {
  assert.equal(totalPericia(ficha('recruta'), 'luta'), 8);
  assert.equal(totalPericia(ficha('goblin'), 'luta'), 7);
  assert.equal(totalPericia(ficha('vampiro'), 'luta'), 25);
  assert.equal(totalPericia(ficha('hidra'), 'luta'), 34);
});

test('contarAtaques: system.ataques maior que zero vale (Anão)', () => {
  const a = ficha('anao');
  assert.equal(contarAtaques(arma(a, 'Machado anão'), ataquescac(a)), 1);
});

test('contarAtaques: lê a quantidade da descrição da arma', () => {
  assert.equal(contarAtaques(arma(ficha('goblin'), 'Adaga'), ''), 2);          // "Duas adagas"
  assert.equal(contarAtaques(arma(ficha('hidra'), 'Mordida'), ''), 5);         // "Cinco mordidas"
  assert.equal(contarAtaques(arma(ficha('golem'), 'Pancada'), ''), 2);         // "Duas pancadas"
  assert.equal(contarAtaques(arma(ficha('dragao'), 'Garras'), ''), 2);         // "duas garras"
});

test('contarAtaques: sem quantidade na descrição, procura em ataquescac (Troll)', () => {
  const t = ficha('troll');
  assert.equal(contarAtaques(arma(t, 'Garras'), ataquescac(t)), 2);            // "duas garras"
  assert.equal(contarAtaques(arma(t, 'Mordida'), ataquescac(t)), 1);
});

test('contarAtaques: plural do primeiro nome (Sacerdote: "Duas correntes de espinhos")', () => {
  const s = ficha('sacerdote');
  assert.equal(contarAtaques(arma(s, 'Corrente de espinhos aberrantes'), ataquescac(s)), 2);
  assert.equal(contarAtaques(arma(s, 'Mordida'), ataquescac(s)), 1);
});

test('contarAtaques: sem nenhuma pista vale 1 (Aparição)', () => {
  const a = ficha('aparicao');
  assert.equal(contarAtaques(arma(a, 'Toque drenante'), ataquescac(a)), 1);
});

test('lerArmas: devolve id, ataques sugeridos, perícia, rolagem de dano e dano secundário', () => {
  const v = ficha('vampiro');
  const armas = lerArmas(v.items, ataquescac(v));
  const garra = armas.find(a => a.nome === 'Garra');
  assert.equal(garra.id, 'WujAqyrLbw0W7frD');
  assert.equal(garra.ataques, 1);
  assert.equal(garra.pericia, 'luta');
  assert.equal(garra.secundario, 11);
  assert.equal(v.items.find(i => i._id === garra.id).system.rolls[garra.indiceRollDano].type, 'dano');
});

test('lerArmas: usa a perícia indicada na rolagem (besta do Anão usa luta)', () => {
  const a = ficha('anao');
  const besta = lerArmas(a.items, ataquescac(a)).find(x => x.nome === 'Besta pesada');
  assert.equal(besta.pericia, 'luta');
});

test('atribuirResistencias: maior total recebe a Forte, depois Média e Fraca', () => {
  const linha = { ResForte: 26, ResMedia: 20, ResFraca: 12 };
  // Vampiro: Fort 12, Refl 26, Vont 20
  assert.deepEqual(atribuirResistencias({ fort: 12, refl: 26, vont: 20 }, linha), { fort: 12, refl: 26, vont: 20 });
  // Goblin (ND 1/4 Lacaio): Fort 2, Refl 3, Vont -1 → Refl forte, Fort média, Vont fraca
  assert.deepEqual(
    atribuirResistencias({ fort: 2, refl: 3, vont: -1 }, { ResForte: 2, ResMedia: 0, ResFraca: -1 }),
    { fort: 0, refl: 2, vont: -1 });
});

test('atribuirResistencias: empate segue Fortitude, Reflexos, Vontade', () => {
  const linha = { ResForte: 10, ResMedia: 5, ResFraca: 0 };
  assert.deepEqual(atribuirResistencias({ fort: 4, refl: 4, vont: 4 }, linha), { fort: 10, refl: 5, vont: 0 });
});

test('ordenarResistencias: do maior para o menor total, empate Fort > Refl > Vont', () => {
  assert.deepEqual(ordenarResistencias({ fort: 12, refl: 26, vont: 20 }), ['refl', 'vont', 'fort']);
  assert.deepEqual(ordenarResistencias({ fort: 4, refl: 4, vont: 4 }), ['fort', 'refl', 'vont']);
});

test('atribuirResistencias: o mestre pode trocar a ordem', () => {
  const linha = { ResForte: 10, ResMedia: 5, ResFraca: 0 };
  const r = atribuirResistencias({ fort: 4, refl: 4, vont: 4 }, linha, ['vont', 'fort', 'refl']);
  assert.deepEqual(r, { vont: 10, fort: 5, refl: 0 });
});

test('avisoLimite: soma passa do patamar? (Troll ND 5 tem 3 ataques, limite 2)', () => {
  assert.match(avisoLimite([{ ataques: 1 }, { ataques: 2 }], '5'), /3.*2/);
  assert.equal(avisoLimite([{ ataques: 1 }, { ataques: 1 }], '5'), null);
});

test('avisoLimite: armas alternativas contam só a maior (Anão ND 2, limite 1)', () => {
  assert.equal(avisoLimite([{ ataques: 1, alternativa: true }, { ataques: 1, alternativa: true }], '2'), null);
  assert.ok(avisoLimite([{ ataques: 1 }, { ataques: 1, alternativa: true }], '2'));
});

test('revisarItens: lista poderes e magias com dano, sem curas', () => {
  const nomes = (n) => revisarItens(ficha(n).items);
  assert.deepEqual(nomes('troll'), ['Dilacerar']);
  assert.deepEqual(nomes('golem'), ['Sopro']);
  assert.deepEqual(nomes('dragao'), ['Sopro']);       // Curar Ferimentos é cura
  assert.deepEqual(nomes('vampiro'), ['Drenar Sangue']);
  assert.deepEqual(nomes('sacerdote'), ['Sangue Ácido']); // @Tormenta também entra
  assert.deepEqual(nomes('aparicao'), []);            // o curatpv fica na arma
});

function planoDe(nome, papel, nd, extra = {}) {
  const a = ficha(nome);
  const armas = lerArmas(a.items, ataquescac(a));
  return planejarAjuste({
    tabelas, papel, nd, totais: totaisResistencias(a), armas, itens: a.items, ...extra,
  });
}

test('planejarAjuste: Goblin → ND 1/4 Lacaio (valores da tabela)', () => {
  const p = planoDe('goblin', 'lackey', '1/4', { ataquesPorArma: { '18o2kTrHoNvzp7jY': 1 } });
  assert.deepEqual(p.alvos, { pv: 4, cd: 12, defesa: 10, ataque: 7 });
  assert.deepEqual(p.resistencias, { fort: 0, refl: 2, vont: -1 });
  assert.equal(p.dano.porArma['18o2kTrHoNvzp7jY'].formula, '1d6+6');
});

test('planejarAjuste: Recruta → ND 1/2 Lacaio', () => {
  const p = planoDe('recruta', 'lackey', '1/2', { ataquesPorArma: { rlQmvssUqFVYEFr2: 1 } });
  assert.deepEqual(p.alvos, { pv: 6, cd: 13, defesa: 13, ataque: 9 });
  assert.deepEqual(p.resistencias, { fort: 5, refl: 3, vont: 0 });
  assert.equal(p.dano.porArma.rlQmvssUqFVYEFr2.formula, '1d6+8');
});

test('planejarAjuste: troca de papel Lacaio → Solo muda os alvos', () => {
  const p = planoDe('recruta', 'solo', '1/2', { ataquesPorArma: { rlQmvssUqFVYEFr2: 1 } });
  assert.deepEqual(p.alvos, { pv: 15, cd: 13, defesa: 14, ataque: 7 });
});

test('planejarAjuste: Vampiro ND 12 Solo → 6d6+40 nas duas armas, sem avisos de patamar', () => {
  const p = planoDe('vampiro', 'solo', '12');
  assert.equal(p.dano.porArma.P42NmIP3WqZtXdNV.formula, '6d6+40');
  assert.equal(p.dano.porArma.WujAqyrLbw0W7frD.formula, '6d6+40');
  assert.deepEqual(p.avisos, []);
  assert.deepEqual(p.revisar, ['Drenar Sangue']);
});

test('planejarAjuste: Troll ND 5 avisa que 3 ataques passam do limite 2', () => {
  const p = planoDe('troll', 'solo', '5');
  assert.ok(p.avisos.some(a => /limite/i.test(a)));
});

test('planejarAjuste: o mestre pode sobrescrever os ataques por arma', () => {
  const p = planoDe('troll', 'solo', '5', {
    ataquesPorArma: { '5wbhh4vyqNJXYIm5': 1, cp3i4dKB7PGNNtXn: 1 },
  });
  assert.deepEqual(p.avisos, []);
});

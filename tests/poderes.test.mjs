import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerArmas, lerPoderes, planejarAjuste, revisarItens } from '../scripts/calculo.js';
import { ficha, totaisResistencias } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const FLAG = 'tormenta20-ajuste-nd';

// Ficha com a configuração danoPoder gravada num poder (e, se pedido, outras mudanças no item).
function comPoder(nome, poder, danoPoder, mudar = () => {}) {
  const a = ficha(nome);
  const item = a.items.find(i => i.type === 'poder' && i.name === poder);
  if (danoPoder) item.flags = { [FLAG]: { danoPoder } };
  mudar(item);
  return a;
}
const idDe = (a, poder) => a.items.find(i => i.name === poder).id ?? a.items.find(i => i.name === poder)._id;

function plano(a, nd, extra = {}) {
  const armas = lerArmas(a.items, a.system.detalhes.ataquescac ?? '');
  return planejarAjuste({
    tabelas, papel: 'solo', nd, totais: totaisResistencias(a), armas, itens: a.items,
    poderes: lerPoderes(a.items), ...extra,
  });
}

test('lerPoderes: poder sem a flag não é lido (Sopro do Dragão)', () => {
  assert.deepEqual(lerPoderes(ficha('dragao').items), []);
});

test('lerPoderes: flag com ajustar false também não é lido', () => {
  const a = comPoder('dragao', 'Sopro', { ajustar: false, efeito: true });
  assert.deepEqual(lerPoderes(a.items), []);
});

test('lerPoderes: Sopro (ação padrão, 16d12 de fogo) devolve partes, onde reescrever e o efeito', () => {
  const a = comPoder('dragao', 'Sopro', { ajustar: true, efeito: true });
  const [sopro] = lerPoderes(a.items);
  assert.equal(sopro.id, idDe(a, 'Sopro'));
  assert.equal(sopro.padrao, true);
  assert.equal(sopro.efeito, true);
  assert.deepEqual(sopro.partes, [{ faces: 12, media: 104, indiceRoll: 0, indiceParte: 0 }]);
});

test('lerPoderes: ação completa conta como padrão; livre não', () => {
  const dano = (item) => { item.system.rolls = [{ name: 'Dano', type: 'dano', parts: [['2d6', 'fogo', '']] }]; };
  const completa = comPoder('dragao', 'Varrer', { ajustar: true, efeito: false }, (i) => { dano(i); i.system.ativacao.execucao = 'full'; });
  assert.equal(lerPoderes(completa.items)[0].padrao, true);
  const livre = comPoder('dragao', 'Varrer', { ajustar: true, efeito: false }, (i) => { dano(i); i.system.ativacao.execucao = 'free'; });
  assert.equal(lerPoderes(livre.items)[0].padrao, false);
});

test('lerPoderes: duas partes de dano (3d8 + 2d6) viram duas partes com o dado de cada uma', () => {
  const a = comPoder('dragao', 'Sopro', { ajustar: true, efeito: true }, (i) => {
    i.system.rolls = [{ name: 'Dano', type: 'dano', parts: [['3d8', 'impacto', ''], ['2d6', 'fogo', '']] }];
  });
  assert.deepEqual(lerPoderes(a.items)[0].partes.map(({ faces, media }) => ({ faces, media })), [
    { faces: 8, media: 13.5 }, { faces: 6, media: 7 },
  ]);
});

test('lerPoderes: poder sem dado na fórmula usa d12 (dano fixo "20")', () => {
  const a = comPoder('dragao', 'Sopro', { ajustar: true, efeito: true }, (i) => {
    i.system.rolls = [{ name: 'Dano', type: 'dano', parts: [['20', 'fogo', '']] }];
  });
  assert.equal(lerPoderes(a.items)[0].partes[0].faces, 12);
});

test('lerPoderes: poder cujo dano não é número (@Tormenta) é ignorado', () => {
  const a = comPoder('sacerdote', 'Sangue Ácido', { ajustar: true, efeito: false });
  assert.deepEqual(lerPoderes(a.items), []);
});

test('planejarAjuste: Sopro do Dragão ND 11 com efeito → 12d12 (0,6 × 130); as armas seguem com 130', () => {
  const a = comPoder('dragao', 'Sopro', { ajustar: true, efeito: true });
  const p = plano(a, '11');
  assert.equal(p.dano.porArma[idDe(a, 'Sopro')].formula, '12d12');
  assert.equal(p.dano.grupos.find(g => !g.ids.includes(idDe(a, 'Sopro'))).alerta, 'equilibrado');
});

test('planejarAjuste: sem efeito o Sopro usa 0,7 × 62 (ND 7) → 7d12; com efeito 0,6 × 62 → 6d12', () => {
  const sem = comPoder('dragao', 'Sopro', { ajustar: true, efeito: false });
  assert.equal(plano(sem, '7').dano.porArma[idDe(sem, 'Sopro')].formula, '7d12');
  const com = comPoder('dragao', 'Sopro', { ajustar: true, efeito: true });
  assert.equal(plano(com, '7').dano.porArma[idDe(com, 'Sopro')].formula, '6d12');
});

test('planejarAjuste: ND 15 corta no limite (16d12) e avisa', () => {
  const a = comPoder('dragao', 'Sopro', { ajustar: true, efeito: true });
  const p = plano(a, '15');
  assert.equal(p.dano.porArma[idDe(a, 'Sopro')].formula, '16d12');
  assert.ok(p.avisos.some(m => /dados/.test(m)));
});

test('planejarAjuste: poder ajustado sai da lista de revisão; poder sem flag continua nela', () => {
  assert.deepEqual(plano(comPoder('dragao', 'Sopro', { ajustar: true, efeito: true }), '11').revisar, []);
  assert.deepEqual(plano(ficha('dragao'), '11').revisar, ['Sopro']);
});

test('planejarAjuste: poder sem a flag não recebe fórmula', () => {
  const a = ficha('dragao');
  assert.equal(plano(a, '11').dano.porArma[idDe(a, 'Sopro')], undefined);
});

test('planejarAjuste: poder não padrão com dano divide a rodada com as armas e a soma continua igual à tabela', () => {
  const sem = ficha('dragao');
  const com = comPoder('dragao', 'Varrer', { ajustar: true, efeito: false }, (i) => {
    i.system.rolls = [{ name: 'Dano', type: 'dano', parts: [['2d6', 'impacto', '']] }];
  });
  const base = plano(sem, '11');
  const dividido = plano(com, '11');
  const mordida = lerArmas(com.items).find(x => x.nome === 'Mordida').id;
  assert.ok(dividido.dano.porArma[mordida].danoPorGolpe < base.dano.porArma[mordida].danoPorGolpe);
  assert.ok(dividido.dano.porArma[idDe(com, 'Varrer')]);
  assert.ok(Math.abs(dividido.dano.grupos[0].obtido - 130) <= 6);
});

test('planejarAjuste: sem armas, só com poder padrão, calcula o poder e não avisa "sem armas"', () => {
  const a = comPoder('dragao', 'Sopro', { ajustar: true, efeito: true });
  const armas = lerArmas(a.items).map(x => x.id);
  const p = plano(a, '11', { ataquesPorArma: Object.fromEntries(armas.map(id => [id, 0])) });
  assert.equal(p.dano.porArma[idDe(a, 'Sopro')].formula, '12d12');
  assert.deepEqual(p.avisos, []);
});

test('revisarItens: ids ajustados não são listados', () => {
  const a = ficha('dragao');
  assert.deepEqual(revisarItens(a.items, [idDe(a, 'Sopro')]), []);
});

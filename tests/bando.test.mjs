import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularAjuste } from '../scripts/ajuste.js';
import { consultar } from '../scripts/tabelas.js';
import { resolverBando, aumentoPadrao } from '../scripts/templates.js';
import { ficha, criarMedidor, gravarResultado } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const FLAG = 'tormenta20-ajuste-nd';
const ajustar = (f, nd, templates = {}, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel: f.system.detalhes.role, medir: criarMedidor(f), templates, ...extra });
const bando = (escala = '10-20', aumentoND = aumentoPadrao(escala)) => ({ bando: { escala, aumentoND } });
const armas = (f) => f.items.filter(i => i.type === 'arma');
const formulaDe = (f, id) => armas(f).find(a => a._id === id).system.rolls.find(r => r.type === 'dano').parts[0][0];
let contador = 0;
const ids = () => `idBando${String(++contador).padStart(9, '0')}`;

test('aumento padrão por escala: 10-20 e 20-40 sobem 2 NDs; 50-70, 4; 80-100, 6', () => {
  assert.deepEqual(['10-20', '20-40', '50-70', '80-100'].map(aumentoPadrao), [2, 2, 4, 6]);
});

test('resolverBando: ND efetivo, tamanho e multiplicador por patamares de diferença', () => {
  assert.deepEqual(resolverBando({ nd: '3', tamanho: 'med', bando: { escala: '10-20', aumentoND: 2 } }),
    { ndEfetivo: '5', tamanho: 'gra', mult: 2 }); // Iniciante → Veterano: ×2
  assert.deepEqual(resolverBando({ nd: '1', tamanho: 'med', bando: { escala: '10-20', aumentoND: 2 } }),
    { ndEfetivo: '3', tamanho: 'gra', mult: 1 }); // mesmo patamar: ×1
  assert.deepEqual(resolverBando({ nd: '3', tamanho: 'peq', bando: { escala: '80-100', aumentoND: 8 } }),
    { ndEfetivo: '11', tamanho: 'col', mult: 4 }); // Iniciante → Campeão: ×4; Pequeno +4 = Colossal
  assert.deepEqual(resolverBando({ nd: '3', tamanho: 'med', bando: { escala: '80-100', aumentoND: 16 } }),
    { ndEfetivo: '19', tamanho: 'col', mult: 6 }); // Iniciante → Lenda: ×6
});

test('resolverBando: tamanho não passa de Colossal e o ND efetivo não passa de S+', () => {
  assert.equal(resolverBando({ nd: '20', tamanho: 'eno', bando: { escala: '20-40', aumentoND: 5 } }).ndEfetivo, 'S+');
  assert.equal(resolverBando({ nd: '19', tamanho: 'eno', bando: { escala: '20-40', aumentoND: 2 } }).tamanho, 'col');
});

test('resolverBando: ND 1/4 e 1/2 contam como os primeiros da lista', () => {
  assert.equal(resolverBando({ nd: '1/4', tamanho: 'med', bando: { escala: '10-20', aumentoND: 2 } }).ndEfetivo, '1');
});

test('Bando no Anão Veterano ND 2 (Especial): usa a linha do ND 6, sobe o tamanho e multiplica o dano por 2', () => {
  const f = ficha('anao');
  const r = ajustar(f, '2', bando('50-70', 4));
  const linha = consultar(tabelas, 'special', '6');
  assert.equal(r.update['system.attributes.nd'], '6');
  assert.equal(r.update['system.attributes.pv.max'], linha.PV);
  assert.equal(r.update['system.attributes.cd'], linha.CD);
  assert.equal(f.system.tracos.tamanho, 'med');
  assert.equal(r.update['system.tracos.tamanho'], 'col'); // escala 50-70: +3 categorias
  assert.equal(r.templates.multDano, 2);
});

test('Bando: cada golpe vira "(fórmula) * N" e o total do bando bate com a tabela do ND efetivo', () => {
  const f = ficha('anao');
  const r = ajustar(f, '2', bando('10-20', 4));
  const nova = gravarResultado(f, r);
  for (const a of armas(nova)) {
    const formula = a.system.rolls.find(r2 => r2.type === 'dano').parts[0][0];
    assert.match(formula, /^\(.+\) \* 2$/, formula);
  }
  assert.ok(r.plano.dano.grupos.every(g => g.alerta === 'equilibrado'));
  const total = Math.max(...r.plano.dano.grupos.map(g => g.obtido)) * r.templates.multDano;
  assert.ok(Math.abs(total - r.plano.linha.Dano) / r.plano.linha.Dano < 0.1, `${total} vs ${r.plano.linha.Dano}`);
});

test('Bando cria os três poderes, acrescenta as imunidades e usa ic.custom', () => {
  const f = ficha('anao');
  const r = ajustar(f, '2', bando(), { gerarId: ids });
  assert.deepEqual(r.itensCriar.map(i => i.name), ['Dano Esmagador', 'Dano Inescapável', 'Ataques Adicionais contra o Bando']);
  for (const item of r.itensCriar) assert.equal(item.flags[FLAG].origem, 'bando');
  const texto = r.update['system.detalhes.resistencias'];
  for (const termo of ['imunidade a manobras de combate', 'imunidade a efeitos que afetam apenas uma criatura e não causam dano', 'vulnerabilidade a dano de área']) {
    assert.match(texto, new RegExp(termo));
  }
  assert.equal(r.update['system.tracos.ic.custom'], 'Manobras de combate, Efeitos de alvo único sem dano');
});

test('o marcador guarda a configuração do bando, o ND individual, o tamanho e as rolagens originais', () => {
  const f = ficha('anao');
  const marcador = ajustar(f, '2', bando('20-40', 2)).update[`flags.${FLAG}.templates`];
  assert.deepEqual(marcador.ativos, ['bando']);
  assert.deepEqual(marcador.bando, { escala: '20-40', aumentoND: 2, ndIndividual: '2' });
  assert.equal(marcador.base.tamanho, f.system.tracos.tamanho);
  assert.deepEqual(marcador.base.rolls, Object.fromEntries(armas(f).map(a => [a._id, a.system.rolls])));
});

test('prévia: linhas do ND do bando, do tamanho e do multiplicador, e a nota do bando', () => {
  const r = ajustar(ficha('anao'), '2', bando('50-70', 4));
  assert.deepEqual(r.templates.linhas.map(l => l.rotulo), ['ND do bando', 'Tamanho', 'Dano do bando']);
  assert.equal(r.templates.linhas[0].depois, '6');
  assert.equal(r.templates.linhas[2].depois, '×2');
  assert.match(r.templates.notas.join(' '), /Bando: PV, ataque, defesa, CD e resistências do ND 6/);
});

test('reaplicar o Bando não multiplica de novo, não sobe o tamanho outra vez e não duplica poderes', () => {
  const f = ficha('anao');
  const primeira = ajustar(f, '2', bando('10-20', 4), { gerarId: ids });
  const gravada = gravarResultado(f, primeira);
  const segunda = ajustar(gravada, '2', bando('10-20', 4), { gerarId: ids });
  const final = gravarResultado(gravada, segunda);
  assert.equal(final.system.tracos.tamanho, gravada.system.tracos.tamanho);
  assert.equal(final.system.attributes.nd, '6');
  for (const a of armas(final)) assert.match(formulaDe(final, a._id), /^\([^()]+\) \* 2$/);
  assert.equal(segunda.itensRemover.length, 3);
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem === 'bando').length, 3);
});

test('desmarcar o Bando devolve ND, tamanho, fórmulas, imunidades e remove os poderes', () => {
  const f = ficha('anao');
  const gravada = gravarResultado(f, ajustar(f, '2', bando('10-20', 4), { gerarId: ids }));
  const r = ajustar(gravada, '2', {});
  const final = gravarResultado(gravada, r);
  assert.equal(final.system.attributes.nd, '2');
  assert.equal(final.system.tracos.tamanho, f.system.tracos.tamanho);
  for (const a of armas(final)) assert.doesNotMatch(formulaDe(final, a._id), /\*/);
  assert.equal(final.system.detalhes.resistencias, f.system.detalhes.resistencias);
  assert.equal(final.system.tracos.ic.custom, f.system.tracos.ic.custom ?? '');
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem).length, 0);
  assert.deepEqual(final.flags[FLAG].templates, { ativos: [], base: null });
});

test('as linhas de ataque do texto mostram o multiplicador do bando', () => {
  const f = ficha('sacerdote'); // Veterano → Campeão: ×2; o Anão não tem linha de ataque escrita
  const r = ajustar(f, '10', bando('50-70', 4));
  assert.match(r.update['system.detalhes.ataquescac'], /\(\d+d6\+\d+ ×2 mais 1d6 de ácido\)/);
});

test('Bando com Chefe Final: PV ×2 sobre o ND efetivo, PM e RD pelo ND efetivo', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '10', { ...bando('10-20', 2), chefeFinal: true }); // ND efetivo 12, Campeão
  assert.equal(r.update['system.attributes.nd'], '12');
  assert.equal(r.update['system.attributes.pv.max'], consultar(tabelas, 'special', '12').PV * 2);
  assert.equal(r.update['system.attributes.pm.max'], 56 + 24);
  assert.equal(r.update['system.tracos.resistencias.dano.base'], 10);
  assert.deepEqual(r.update[`flags.${FLAG}.templates`].ativos, ['bando', 'chefeFinal']);
});

test('Bando com Enxame: o poder Enxame usa o dano da linha do ND efetivo, sem dividir pelo multiplicador', () => {
  const f = ficha('anao');
  const r = ajustar(f, '2', { ...bando('50-70', 4), enxame: true }, { gerarId: ids });
  const enxame = r.itensCriar.find(i => i.name === 'Enxame');
  const dano = consultar(tabelas, 'special', '6').Dano;
  const [n, b] = /^(\d+)d6\+(\d+)$/.exec(enxame.system.rolls[0].parts[0][0]).slice(1).map(Number);
  assert.ok(Math.abs(n * 3.5 + b - dano) <= 1);
});

test('patamar no Bando usa o ND efetivo: Iniciante → Veterano', () => {
  const r = ajustar(ficha('anao'), '2', bando('50-70', 4));
  assert.match(r.patamar[0], /Iniciante → Veterano/);
});

test('o nível de conjurador continua seguindo o ND individual, não o do bando', () => {
  const r = ajustar(ficha('sacerdote'), '10', bando('50-70', 4));
  const magias = ficha('sacerdote').items.find(i => i.name === 'Magias');
  assert.match(r.itemUpdates.find(u => u._id === magias._id)['system.description.value'], /clérigo de 10º nível/);
});

test('sem Bando o resultado não traz multiplicador', () => {
  const r = ajustar(ficha('anao'), '2');
  assert.equal(r.templates.multDano, 1);
  assert.equal('system.tracos.tamanho' in r.update, false);
});

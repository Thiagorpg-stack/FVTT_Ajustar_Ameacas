import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor, gravarResultado } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const FLAG = 'tormenta20-ajuste-nd';
const ajustar = (f, nd, templates = {}, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel: f.system.detalhes.role, medir: criarMedidor(f), templates, ...extra });
const enxame = { enxame: true };
const armas = (f) => f.items.filter(i => i.type === 'arma');
const NOMES = ['Enxame', 'Movimentação Tática', 'Resistência a Armas', 'Vulnerabilidade a Área', 'Interações Mágicas'];
let contador = 0;
const ids = () => `idEnxame${String(++contador).padStart(8, '0')}`;

test('Enxame cria o poder de dano automático e os quatro poderes passivos, todos marcados', () => {
  const r = ajustar(ficha('sacerdote'), '10', enxame, { gerarId: ids });
  assert.deepEqual(r.itensCriar.map(i => i.name), NOMES);
  for (const item of r.itensCriar) {
    assert.equal(item.type, 'poder');
    assert.equal(item.system.ativacao.execucao, 'passive');
    assert.equal(item.flags[FLAG].origem, 'enxame');
  }
  const poder = r.itensCriar[0];
  assert.deepEqual(poder.system.rolls[0].parts[0], ['8d6+52', 'dano', '']); // Dano 80 do ND 10 Especial
  assert.equal(poder.system.rolls[0].type, 'dano');
  assert.match(poder.system.description.value, /mesmo espaço/);
});

test('Enxame remove as armas da ficha (a aba Estatísticas lista toda arma, mesmo com 0 ataques)', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '10', enxame);
  for (const arma of armas(f)) assert.ok(r.itensRemover.includes(arma._id), arma.name);
  assert.equal(r.itemUpdates.some(u => armas(f).some(a => a._id === u._id)), false); // não atualiza o que vai sair
  assert.equal(r.avisos.some(a => /Nenhuma arma com ataques/.test(a)), false);
  const final = gravarResultado(f, r);
  assert.equal(armas(final).length, 0);
  assert.ok(final.items.some(i => i.name === 'Símbolo Sagrado')); // só as armas saem
});

test('Enxame esvazia a linha de Corpo a Corpo (o poder Enxame já descreve o ataque)', () => {
  const r = ajustar(ficha('sacerdote'), '10', enxame);
  assert.equal(r.update['system.detalhes.ataquescac'], '');
});

test('Enxame acrescenta as imunidades ao texto e aos campos estruturados (ic.custom)', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '10', enxame);
  const texto = r.update['system.detalhes.resistencias'];
  assert.ok(texto.startsWith(f.system.detalhes.resistencias));
  for (const termo of ['imunidade a acertos críticos', 'imunidade a dano de precisão', 'imunidade a flanqueamento', 'imunidade a manobras de combate']) {
    assert.match(texto, new RegExp(termo));
  }
  assert.equal(r.update['system.tracos.ic.custom'], 'Acertos críticos, Dano de precisão, Flanqueamento, Manobras de combate');
});

test('ic.custom não repete o que a ficha já tem (Glop de Sangue já é imune a críticos)', () => {
  const r = ajustar(ficha('glop'), '5', enxame);
  assert.equal(r.update['system.tracos.ic.custom'], 'Acertos críticos, Dano de precisão, Flanqueamento, Manobras de combate');
});

test('o marcador guarda as armas inteiras, o texto de ataque e o ic.custom originais', () => {
  const f = ficha('sacerdote');
  const marcador = ajustar(f, '10', enxame).update[`flags.${FLAG}.templates`];
  assert.deepEqual(marcador.ativos, ['enxame']);
  assert.deepEqual(marcador.base.armas, armas(f));
  assert.equal(marcador.base.ataquescac, f.system.detalhes.ataquescac);
  assert.equal(marcador.base.icCustom, '');
});

test('prévia: nota com a fórmula, a média e o aviso de que as armas saem', () => {
  const r = ajustar(ficha('sacerdote'), '10', enxame);
  assert.match(r.templates.notas.join(' '), /Enxame: dano automático de 8d6\+52 \(média 80\)/);
  assert.match(r.templates.notas.join(' '), /armas.*removidas/);
});

test('reaplicar o Enxame não duplica os poderes e mantém as armas originais guardadas', () => {
  const f = ficha('sacerdote');
  const primeira = ajustar(f, '10', enxame, { gerarId: ids });
  const gravada = gravarResultado(f, primeira);
  const segunda = ajustar(gravada, '10', enxame, { gerarId: ids });
  assert.equal(segunda.itensRemover.length, 5); // só os poderes: as armas já não estão na ficha
  assert.equal(segunda.itensCriar.length, 5);
  assert.deepEqual(segunda.update[`flags.${FLAG}.templates`].base.armas, armas(f));
  const final = gravarResultado(gravada, segunda);
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem === 'enxame').length, 5);
  assert.equal(armas(final).length, 0);
});

test('desmarcar o Enxame recria as armas (mesmos ids, dano e ataques recalculados) e remove os poderes', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '10', enxame, { gerarId: ids }));
  const r = ajustar(gravada, '10', {});
  const final = gravarResultado(gravada, r);
  const semTemplate = gravarResultado(f, ajustar(f, '10')); // o que o ajuste normal escreveria
  assert.deepEqual(armas(final).map(a => a._id).sort(), armas(f).map(a => a._id).sort());
  for (const a of armas(f)) {
    const esperado = armas(semTemplate).find(i => i._id === a._id);
    const obtido = armas(final).find(i => i._id === a._id);
    assert.ok(esperado.system.ataques > 0);
    assert.equal(obtido.system.ataques, esperado.system.ataques);
    assert.deepEqual(obtido.system.rolls, esperado.system.rolls);
    assert.equal(obtido.name, a.name);
  }
  assert.equal(final.system.detalhes.resistencias, f.system.detalhes.resistencias);
  assert.equal(final.system.tracos.ic.custom, '');
  assert.equal(final.system.detalhes.ataquescac, semTemplate.system.detalhes.ataquescac);
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem).length, 0);
  assert.deepEqual(final.flags[FLAG].templates, { ativos: [], base: null });
});

test('Enxame junto com Chefe Final: PV ×2, RD, imunidades e as duas listas de poderes', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '10', { enxame: true, chefeFinal: true }, { gerarId: ids });
  assert.equal(r.update['system.attributes.pv.max'], 560);
  assert.equal(r.update['system.tracos.resistencias.dano.base'], 5);
  assert.match(r.update['system.detalhes.resistencias'], /imunidade a acertos críticos.*, redução de dano 5$/);
  assert.equal(r.itensCriar.length, 6);
  assert.deepEqual(r.update[`flags.${FLAG}.templates`].ativos, ['enxame', 'chefeFinal']);
});

test('desmarcar só o Enxame com o Chefe Final marcado mantém o Chefe Final e devolve as armas', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '10', { enxame: true, chefeFinal: true }, { gerarId: ids }));
  const r = ajustar(gravada, '10', { chefeFinal: true }, { gerarId: ids });
  const final = gravarResultado(gravada, r);
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem === 'enxame').length, 0);
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem === 'chefeFinal').length, 1);
  assert.equal(armas(final).length, armas(f).length);
  assert.doesNotMatch(final.system.detalhes.resistencias, /acertos críticos/);
  assert.match(final.system.detalhes.resistencias, /redução de dano 5$/);
  assert.equal(final.system.attributes.pv.max, 560);
});

test('uma ficha com o marcador da v0.7.0 (armas ainda na ficha, ataques guardados) continua funcionando', () => {
  const f = ficha('sacerdote');
  const antiga = structuredClone(f);
  antiga.flags[FLAG] = {
    templates: {
      ativos: ['enxame'],
      base: {
        pmMax: 56, pmValue: 56, rdBase: 0, resistenciasTexto: f.system.detalhes.resistencias,
        ataques: Object.fromEntries(armas(f).map(a => [a._id, a.system.ataques])),
        ataquescac: f.system.detalhes.ataquescac, icCustom: '',
      },
    },
  };
  for (const a of armas(antiga)) a.system.ataques = 0;
  const r = ajustar(antiga, '10', {});
  assert.deepEqual(r.itemUpdates.filter(u => armas(f).some(a => a._id === u._id)).map(u => u['system.ataques']), [2, 1]);
});

test('com Enxame o aviso de patamar não fala de ataques por rodada', () => {
  const r = ajustar(ficha('sacerdote'), '15', enxame);
  assert.ok(r.patamar.length > 0);
  assert.equal(r.patamar.some(a => /Ataques por rodada/.test(a)), false);
});

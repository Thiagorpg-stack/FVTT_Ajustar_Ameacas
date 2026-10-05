import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor, gravarResultado } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const FLAG = 'tormenta20-ajuste-nd';
const ajustar = (f, nd, templates = {}, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel: f.system.detalhes.role, medir: criarMedidor(f), templates, ...extra });
const chefe = { chefeFinal: true };

test('Chefe Final no Sacerdote ND 15: PV ×2, PM + 2×ND e RD 10 do Campeão', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '15', chefe);
  assert.equal(r.update['system.attributes.pv.max'], 1050);
  assert.equal(r.update['system.attributes.pv.value'], 1050);
  assert.equal(r.update['system.attributes.pm.max'], 86); // 56 + 2×15
  assert.equal(r.update['system.attributes.pm.value'], 86);
  assert.equal(r.update['system.tracos.resistencias.dano.base'], 10);
  assert.match(r.update['system.detalhes.resistencias'], /, redução de dano 10$/);
  assert.match(r.update['system.detalhes.resistencias'], /^imunidade a confusão, redução de ácido/);
});

test('Chefe Final cria o poder "Maior que a Morte" marcado como do módulo e grava o marcador', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '15', chefe, { gerarId: () => 'idFixo0000000001' });
  assert.equal(r.itensCriar.length, 1);
  const poder = r.itensCriar[0];
  assert.equal(poder._id, 'idFixo0000000001');
  assert.equal(poder.name, 'Maior que a Morte');
  assert.equal(poder.type, 'poder');
  assert.equal(poder.system.ativacao.execucao, 'passive');
  assert.equal(poder.flags[FLAG].origem, 'chefeFinal');
  assert.match(poder.system.description.value, /morte instantânea/);
  assert.deepEqual(r.itensRemover, []);
  const marcador = r.update[`flags.${FLAG}.templates`];
  assert.deepEqual(marcador.ativos, ['chefeFinal']);
  assert.deepEqual(marcador.base, {
    pmMax: 56, pmValue: 56, rdBase: 0, resistenciasTexto: f.system.detalhes.resistencias,
  });
});

test('RD por patamar: Iniciante não ganha RD; Veterano 5; Lenda 20', () => {
  const f = ficha('centauro'); // PM 20, sem RD
  assert.equal(ajustar(f, '3', chefe).update['system.tracos.resistencias.dano.base'], undefined);
  assert.equal(ajustar(f, '7', chefe).update['system.tracos.resistencias.dano.base'], 5);
  assert.equal(ajustar(f, '19', chefe).update['system.tracos.resistencias.dano.base'], 20);
});

test('RD maior que a do patamar fica como está (Golem de Ferro tem RD 10 no value)', () => {
  const r = ajustar(ficha('golem'), '8', chefe); // Veterano: 5 < 10
  assert.equal(r.update['system.tracos.resistencias.dano.base'], 10);
  assert.equal(r.update['system.detalhes.resistencias'], undefined); // o texto já diz "redução de dano 10"
});

test('RD escrita no texto menor que a do patamar é trocada, não duplicada (Dragão: 15 → 20 no ND 18)', () => {
  const r = ajustar(ficha('dragao'), '18', chefe);
  assert.equal(r.update['system.tracos.resistencias.dano.base'], 20);
  assert.match(r.update['system.detalhes.resistencias'], /redução de dano 20/);
  assert.doesNotMatch(r.update['system.detalhes.resistencias'], /redução de dano 15/);
});

test('sem PM a ficha não ganha PM', () => {
  const r = ajustar(ficha('troll'), '8', chefe);
  assert.equal('system.attributes.pm.max' in r.update, false);
});

test('ND S e S+ entram no PM como 21 e 22', () => {
  const f = ficha('sacerdote');
  assert.equal(ajustar(f, 'S', chefe).update['system.attributes.pm.max'], 56 + 42);
  assert.equal(ajustar(f, 'S+', chefe).update['system.attributes.pm.max'], 56 + 44);
});

test('prévia: linhas de PM e RD e a nota de XP (ND + 2; ND menor que 1 conta como 2)', () => {
  const r = ajustar(ficha('sacerdote'), '15', chefe);
  assert.deepEqual(r.templates.linhas.map(l => l.rotulo), ['PM', 'RD']);
  assert.deepEqual(r.templates.linhas[0], { rotulo: 'PM', antes: 56, depois: 86 });
  assert.match(r.templates.notas.join(' '), /XP de ND 17/);
  assert.match(ajustar(ficha('goblin'), '1/4', chefe).templates.notas.join(' '), /XP de ND 2/);
});

test('reaplicar o Chefe Final numa ficha que já o tem não soma de novo nem duplica o poder', () => {
  const f = ficha('sacerdote');
  const primeira = ajustar(f, '15', chefe, { gerarId: () => 'idPrimeiro000001' });
  const gravada = gravarResultado(f, primeira);
  const segunda = ajustar(gravada, '15', chefe, { gerarId: () => 'idSegundo000002' });
  assert.equal(segunda.update['system.attributes.pm.max'], 86);
  assert.equal(segunda.update['system.tracos.resistencias.dano.base'], 10);
  assert.deepEqual(segunda.itensRemover, ['idPrimeiro000001']);
  assert.equal(segunda.itensCriar.length, 1);
  const final = gravarResultado(gravada, segunda);
  assert.equal(final.items.filter(i => i.name === 'Maior que a Morte').length, 1);
});

test('desmarcar o Chefe Final devolve PM, RD e texto e remove o poder', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '15', chefe, { gerarId: () => 'idPrimeiro000001' }));
  const r = ajustar(gravada, '15', {});
  assert.equal(r.update['system.attributes.pv.max'], 525);
  assert.equal(r.update['system.attributes.pm.max'], 56);
  assert.equal(r.update['system.attributes.pm.value'], 56);
  assert.equal(r.update['system.tracos.resistencias.dano.base'], 0);
  assert.equal(r.update['system.detalhes.resistencias'], f.system.detalhes.resistencias);
  assert.deepEqual(r.itensRemover, ['idPrimeiro000001']);
  assert.deepEqual(r.itensCriar, []);
  assert.deepEqual(r.update[`flags.${FLAG}.templates`], { ativos: [], base: null });
});

test('sem template e sem marcador o ajuste não escreve nada de template', () => {
  const r = ajustar(ficha('sacerdote'), '15');
  assert.equal(`flags.${FLAG}.templates` in r.update, false);
  assert.equal('system.attributes.pm.max' in r.update, false);
  assert.equal('system.tracos.resistencias.dano.base' in r.update, false);
  assert.deepEqual(r.itensCriar, []);
  assert.deepEqual(r.itensRemover, []);
  assert.deepEqual(r.templates.linhas, []);
});

test('o poder do template não conta na faixa de poderes sugeridos', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '15', chefe));
  const r = ajustar(gravada, '15', chefe);
  assert.ok(r.patamar.some(a => /a ficha tem 3\b/.test(a)), r.patamar.join(' | '));
});

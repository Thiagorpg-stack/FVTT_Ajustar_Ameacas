import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularAjuste } from '../scripts/ajuste.js';
import { ficha, criarMedidor, gravarResultado } from './helpers.mjs';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const FLAG = 'tormenta20-ajuste-nd';
const ajustar = (f, nd, templates = {}, extra = {}) =>
  calcularAjuste({ dados: f, tabelas, nd, papel: f.system.detalhes.role, medir: criarMedidor(f), templates, ...extra });
const BANDO = { escala: '50-70', aumentoND: 4 }; // Sacerdote ND 10 → 14: Veterano → Campeão, ×2
const juntos = { bando: BANDO, enxame: true };
const soBando = { bando: BANDO };
const soEnxame = { enxame: true };
const armas = (f) => f.items.filter(i => i.type === 'arma');
const doDano = (f, id) => armas(f).find(a => a._id === id).system.rolls.find(r => r.type === 'dano').parts[0][0];
let contador = 0;
const ids = () => `idJuntos${String(++contador).padStart(9, '0')}`;

test('Bando junto com Enxame: as armas ficam na ficha e recebem o mesmo ajuste do Bando sozinho', () => {
  const f = ficha('sacerdote');
  const r = ajustar(f, '10', juntos, { gerarId: ids });
  const referencia = ajustar(f, '10', soBando, { gerarId: ids });
  for (const arma of armas(f)) assert.equal(r.itensRemover.includes(arma._id), false, arma.name);
  const dasArmas = (resultado) => resultado.itemUpdates.filter(u => armas(f).some(a => a._id === u._id));
  assert.equal(dasArmas(r).length, 2);
  assert.deepEqual(dasArmas(r), dasArmas(referencia));
  assert.ok(dasArmas(r).every(u => u['system.ataques'] > 0));
});

test('Bando junto com Enxame: a linha de Corpo a Corpo continua (atualizada pelo Bando) e não é esvaziada', () => {
  const f = ficha('sacerdote');
  const juntosR = ajustar(f, '10', juntos);
  const soBandoR = ajustar(f, '10', soBando);
  assert.notEqual(juntosR.update['system.detalhes.ataquescac'], '');
  assert.equal(juntosR.update['system.detalhes.ataquescac'], soBandoR.update['system.detalhes.ataquescac']);
});

test('Bando junto com Enxame: o poder Enxame, os poderes e as imunidades dos dois entram', () => {
  const r = ajustar(ficha('sacerdote'), '10', juntos, { gerarId: ids });
  assert.equal(r.itensCriar.length, 8); // 3 do Bando + 5 do Enxame
  assert.deepEqual(r.update[`flags.${FLAG}.templates`].ativos, ['bando', 'enxame']);
  assert.match(r.templates.notas.join(' '), /Enxame: dano automático/);
  assert.match(r.templates.notas.join(' '), /armas ficam/);
});

test('Bando junto com Enxame: o marcador não guarda armas (nada saiu da ficha), só a linha de ataque original', () => {
  const f = ficha('sacerdote');
  const base = ajustar(f, '10', juntos).update[`flags.${FLAG}.templates`].base;
  assert.equal('armas' in base, false);
  assert.equal(base.ataquescac, f.system.detalhes.ataquescac);
  assert.ok(base.rolls);
});

test('com os dois templates o aviso de patamar volta a falar de ataques por rodada', () => {
  const r = ajustar(ficha('sacerdote'), '10', juntos);
  assert.ok(r.patamar.some(a => /Ataques por rodada/.test(a)), r.patamar.join(' | '));
});

test('Enxame sozinho → Bando e Enxame: as armas voltam à ficha já com o ajuste do Bando', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '10', soEnxame, { gerarId: ids }));
  assert.equal(armas(gravada).length, 0);
  const r = ajustar(gravada, '10', juntos, { gerarId: ids });
  const final = gravarResultado(gravada, r);
  const referencia = gravarResultado(f, ajustar(f, '10', soBando, { gerarId: ids }));
  assert.deepEqual(armas(final).map(a => a._id).sort(), armas(f).map(a => a._id).sort());
  for (const a of armas(f)) {
    assert.equal(doDano(final, a._id), doDano(referencia, a._id));
    assert.match(doDano(final, a._id), /^\(.+\) \* 2$/);
  }
  assert.notEqual(final.system.detalhes.ataquescac, '');
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem === 'enxame').length, 5);
});

test('Bando e Enxame → só Enxame: as armas saem e ficam guardadas com as rolagens ORIGINAIS', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '10', juntos, { gerarId: ids }));
  assert.equal(armas(gravada).length, 2);
  const r = ajustar(gravada, '10', soEnxame, { gerarId: ids });
  const final = gravarResultado(gravada, r);
  assert.equal(armas(final).length, 0);
  const guardadas = r.update[`flags.${FLAG}.templates`].base.armas;
  assert.deepEqual(guardadas.map(a => a._id).sort(), armas(f).map(a => a._id).sort());
  for (const a of armas(f)) assert.deepEqual(guardadas.find(g => g._id === a._id).system.rolls, a.system.rolls);
  assert.equal(r.update['system.detalhes.ataquescac'], '');
});

test('desmarcar os dois: armas, dano, tamanho e textos voltam ao que o ajuste normal escreveria', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '10', juntos, { gerarId: ids }));
  const final = gravarResultado(gravada, ajustar(gravada, '10', {}));
  const normal = gravarResultado(f, ajustar(f, '10'));
  for (const a of armas(f)) assert.equal(doDano(final, a._id), doDano(normal, a._id));
  assert.doesNotMatch(doDano(final, armas(f)[0]._id), /\*/);
  assert.equal(final.system.tracos.tamanho, f.system.tracos.tamanho);
  assert.equal(final.system.detalhes.resistencias, f.system.detalhes.resistencias);
  assert.equal(final.system.tracos.ic.custom, '');
  assert.equal(final.system.detalhes.ataquescac, normal.system.detalhes.ataquescac);
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem).length, 0);
});

test('reaplicar Bando e Enxame não multiplica de novo nem duplica poderes', () => {
  const f = ficha('sacerdote');
  const gravada = gravarResultado(f, ajustar(f, '10', juntos, { gerarId: ids }));
  const final = gravarResultado(gravada, ajustar(gravada, '10', juntos, { gerarId: ids }));
  const referencia = gravarResultado(f, ajustar(f, '10', soBando, { gerarId: ids }));
  for (const a of armas(f)) assert.equal(doDano(final, a._id), doDano(referencia, a._id));
  assert.equal(final.items.filter(i => i.flags?.[FLAG]?.origem).length, 8);
});

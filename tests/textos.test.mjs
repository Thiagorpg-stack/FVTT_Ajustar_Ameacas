import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');
const textos = JSON.parse(ler('lang/pt-BR.json'));
const manifesto = JSON.parse(ler('module.json'));

test('toda chave T20AJND usada no template, nos scripts e no módulo existe no arquivo de textos', () => {
  const fontes = ['templates/dialogo.hbs', 'scripts/main.js', 'scripts/dialogo.js', 'scripts/boas-vindas.js'].map(ler).join('\n');
  const usadas = new Set(fontes.match(/T20AJND\.\w+/g));
  const faltando = [...usadas].filter(chave => !(chave in textos));
  assert.deepEqual(faltando, []);
});

test('o arquivo de textos é carregado também quando o Foundry está em inglês', () => {
  const idiomas = manifesto.languages.map(l => l.lang);
  assert.ok(idiomas.includes('pt-BR'));
  assert.ok(idiomas.includes('en'), 'sem o idioma "en", quem usa o Foundry em inglês vê só as chaves');
});

test('todo idioma declarado aponta para um arquivo que existe', () => {
  for (const { path } of manifesto.languages) assert.doesNotThrow(() => ler(path), path);
});

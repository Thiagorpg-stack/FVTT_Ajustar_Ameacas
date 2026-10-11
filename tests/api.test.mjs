import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarApi, VERSAO_API } from '../scripts/api.js';

const tabelas = JSON.parse(readFileSync(new URL('../data/tables.json', import.meta.url), 'utf8'));
const dependencias = {
  abrirAjusteND: () => {},
  obterTabelas: async () => tabelas,
  simular: async () => ({}),
  aplicarAjuste: async () => ({}),
};

test('a API expõe as funções combinadas', () => {
  const api = criarApi(dependencias);
  assert.equal(api.versaoApi, VERSAO_API);
  for (const nome of ['abrirAjusteND', 'obterTabelas', 'consultarTabela', 'valorND', 'maxAtaques', 'simular', 'aplicarAjuste']) {
    assert.equal(typeof api[nome], 'function', nome);
  }
});

test('consultarTabela devolve a linha do papel e do ND', async () => {
  const api = criarApi(dependencias);
  assert.equal((await api.consultarTabela('solo', '10')).PV, 400);
  assert.equal((await api.consultarTabela('lackey', '5')).PV, 40);
  assert.equal((await api.consultarTabela('special', '1/2')).PV, 11);
  assert.equal((await api.consultarTabela('solo', 'S+')).PV, 4000);
});

test('consultarTabela usa os códigos de papel do sistema (lackey, special), não os nomes da tabela', async () => {
  const api = criarApi(dependencias);
  await assert.rejects(() => api.consultarTabela('lacaio', '5'), /Papel desconhecido/);
  await assert.rejects(() => api.consultarTabela('solo', '99'), /não existe na tabela/);
});

test('valorND e maxAtaques', () => {
  const api = criarApi(dependencias);
  assert.equal(api.valorND('1/4'), 0.25);
  assert.equal(api.valorND('S+'), 22);
  assert.equal(api.maxAtaques('4'), 1);
  assert.equal(api.maxAtaques('10'), 2);
  assert.equal(api.maxAtaques('11'), 3);
  assert.equal(api.maxAtaques('S'), 4);
});

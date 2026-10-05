import { readFileSync, readdirSync } from 'node:fs';

const pasta = new URL('./fixtures/', import.meta.url);

export function ficha(nome) {
  const arq = readdirSync(pasta).find(f => f.includes(nome));
  return JSON.parse(readFileSync(new URL(arq, pasta), 'utf8'));
}

export const nomesDasFichas = () => readdirSync(pasta).filter(f => f.endsWith('.json')).map(f => f.split('-')[2]);

// Regra do sistema (menace.mjs, v1.5.015): S e S+ valem nível 20; número vale nível; o resto vale 1.
const nivelSistema = (nd) => (['S', 'S+'].includes(String(nd)) ? 20 : Number(nd) || 1);

export function totalPericia(a, chave) {
  const nivel = nivelSistema(a.system.attributes.nd);
  const treino = nivel > 14 ? 6 : nivel > 6 ? 4 : 2;
  const p = a.system.pericias[chave];
  const atributo = a.system.atributos[p.atributo]?.base ?? 0;
  return Math.floor(nivel / 2) + atributo + (p.treinado ? treino : 0) + (p.outros ?? 0);
}

// Defesa como prepareDefense do sistema: base + DES (exceto armadura pesada) + armadura + escudo + outros + condi.
export function totalDefesa(a) {
  const d = a.system.attributes.defesa;
  const equipados = a.items.filter(i => i.type === 'equipamento' && i.system.equipado);
  const armadura = equipados.find(i => ['leve', 'pesada'].includes(i.system.tipo));
  const escudo = equipados.find(i => i.system.tipo === 'escudo');
  const acessorios = equipados.filter(i => !['escudo', 'leve', 'pesada'].includes(i.system.tipo));
  const atributo = a.system.atributos[d.atributo]?.base ?? 0;
  const maxAtr = armadura ? armadura.system.armadura.maxAtr : 0;
  return d.base
    + acessorios.reduce((s, i) => s + i.system.armadura.value, 0)
    + (armadura?.system.tipo !== 'pesada' ? atributo : Math.min(Math.max(atributo, 0), maxAtr))
    + (armadura?.system.armadura.value ?? 0)
    + (escudo?.system.armadura.value ?? 0)
    + (d.outros || 0) + (d.condi || 0);
}

export const totaisResistencias = (a) => ({
  fort: totalPericia(a, 'fort'),
  refl: totalPericia(a, 'refl'),
  vont: totalPericia(a, 'vont'),
});

function definir(obj, caminho, valor) {
  const chaves = caminho.split('.');
  const ultima = chaves.pop();
  const alvo = chaves.reduce((o, k) => o[k], obj);
  alvo[ultima] = valor;
}

// Imita o clone preparado do Foundry: aplica o update numa cópia e mede o que a ficha mostraria.
export function criarMedidor(original) {
  return (update = {}) => {
    const f = structuredClone(original);
    for (const [caminho, valor] of Object.entries(update)) definir(f, caminho, valor);
    const pericias = {};
    for (const k of ['luta', 'pont', 'fort', 'refl', 'vont']) pericias[k] = totalPericia(f, k);
    return { pericias, defesa: totalDefesa(f) };
  };
}

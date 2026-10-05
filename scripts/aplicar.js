// Ponte com o Foundry: mede a ficha por um clone preparado, simula e grava o ajuste.
import { calcularAjuste } from './ajuste.js';
import { carregarTabelas } from './tabelas.js';

export const ID_MODULO = 'tormenta20-ajuste-nd';

let tabelasEmCache;
export async function obterTabelas() {
  tabelasEmCache ??= await carregarTabelas(`modules/${ID_MODULO}/data/tables.json`);
  return tabelasEmCache;
}

// Mede o que a ficha mostraria depois de um update, sem gravar nada: o clone roda o prepareData do sistema.
export function criarMedidor(actor) {
  return (update = {}) => {
    const clone = actor.clone(foundry.utils.expandObject(update), { keepId: true });
    const pericias = Object.fromEntries(
      Object.entries(clone.system.pericias).map(([chave, p]) => [chave, p.value]));
    return { pericias, defesa: clone.system.attributes.defesa.value };
  };
}

export async function simular(actor, opcoes) {
  return calcularAjuste({
    dados: actor.toObject(),
    tabelas: await obterTabelas(),
    medir: criarMedidor(actor),
    gerarId: () => foundry.utils.randomID(),
    ...opcoes,
  });
}

// Grava o ajuste. Com `copiar`, cria um ator novo com o ajuste e deixa o original intacto.
export async function aplicarAjuste(actor, resultado, { copiar = true } = {}) {
  const { update, itemUpdates, itensCriar = [], itensRemover = [] } = resultado;
  console.info(`${ID_MODULO} | Ajustando ${actor.name}`, { update, itemUpdates, copiar });

  if (!copiar) {
    await actor.update(update);
    await actor.updateEmbeddedDocuments('Item', itemUpdates);
    if (itensRemover.length) await actor.deleteEmbeddedDocuments('Item', itensRemover);
    if (itensCriar.length) await actor.createEmbeddedDocuments('Item', itensCriar, { keepId: true });
    return actor;
  }

  const dados = actor.toObject();
  foundry.utils.mergeObject(dados, foundry.utils.expandObject(update));
  for (const mudanca of itemUpdates) {
    const item = dados.items.find(i => i._id === mudanca._id);
    foundry.utils.mergeObject(item, foundry.utils.expandObject(mudanca));
  }
  const remover = new Set(itensRemover);
  dados.items = dados.items.filter(i => !remover.has(i._id)).concat(itensCriar);
  delete dados._id;
  delete dados._stats;
  dados.name = `${actor.name} (ND ${update['system.attributes.nd']})`;
  return Actor.create(dados);
}

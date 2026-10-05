// Monta e calibra o ajuste de uma ficha. Sem dependência do Foundry: quem mede o que a ficha
// mostra (o clone preparado, no Foundry) entra como a função `medir`.
import { lerArmas, planejarAjuste } from './calculo.js';
import { normalizarND } from './tabelas.js';
import { atualizarCDs as trocarCDs, atualizarTextoAtaques as trocarTextoAtaques } from './textos.js';

const NUMERO = /^[+-]?\d+(\.\d+)?$/;
const TIPOS_COM_CD = ['poder', 'magia', 'arma'];
const CAMPOS_DE_ATAQUE = ['ataquescac', 'ataquesad'];

// Zera os termos numéricos do ataque (o bônus todo passa a vir da perícia) e escreve a fórmula de
// dano na rolagem principal. Não altera o array recebido. Sem `formula`, só mexe no ataque.
export function reescreverRolls(rolls, { indiceRollDano, formula }) {
  const novas = structuredClone(rolls);
  for (const roll of novas.filter(r => r.type === 'ataque')) {
    roll.parts.slice(2).forEach((parte) => {
      if (NUMERO.test(String(parte[0]).trim())) parte[0] = '0';
    });
  }
  if (formula !== undefined) novas[indiceRollDano].parts[0][0] = formula;
  return novas;
}

const caminhoOutros = (pericia) => `system.pericias.${pericia}.outros`;
const CAMINHO_DEFESA = 'system.attributes.defesa.base';

// Ajusta `outros` das perícias e `defesa.base` até o que a ficha mostra bater com os alvos.
function calibrar({ dados, update, alvosPericias, alvoDefesa, medir }) {
  const medido = medir(update);
  for (const [pericia, alvo] of Object.entries(alvosPericias)) {
    const atual = dados.system.pericias[pericia].outros ?? 0;
    update[caminhoOutros(pericia)] = atual + alvo - medido.pericias[pericia];
  }
  update[CAMINHO_DEFESA] = dados.system.attributes.defesa.base + alvoDefesa - medido.defesa;

  const conferido = medir(update);
  const erros = [
    ...Object.entries(alvosPericias).filter(([p, alvo]) => conferido.pericias[p] !== alvo)
      .map(([p, alvo]) => `${p}: ${conferido.pericias[p]} em vez de ${alvo}`),
    ...(conferido.defesa !== alvoDefesa ? [`defesa: ${conferido.defesa} em vez de ${alvoDefesa}`] : []),
  ];
  if (erros.length) throw new Error(`A calibração não convergiu (${erros.join('; ')}).`);
  return conferido;
}

export function calcularAjuste({
  dados, tabelas, nd, papel, medir,
  ataquesPorArma = {}, alternativas = {}, ordemResistencias,
  atualizarCDs = true, atualizarTextoAtaques = true, manterProporcao = true,
}) {
  const antes = medir({});
  const armas = lerArmas(dados.items, dados.system.detalhes.ataquescac ?? '');
  const plano = planejarAjuste({
    tabelas, papel, nd, armas, itens: dados.items,
    totais: { fort: antes.pericias.fort, refl: antes.pericias.refl, vont: antes.pericias.vont },
    ataquesPorArma, alternativas, ordemResistencias, manterProporcao,
  });
  const { alvos } = plano;

  const update = {
    'system.attributes.nd': normalizarND(nd),
    'system.detalhes.role': papel,
    'system.attributes.pv.max': alvos.pv,
    'system.attributes.pv.value': alvos.pv,
    'system.attributes.cd': alvos.cd,
  };

  const alvosPericias = { ...plano.resistencias };
  for (const arma of armas) alvosPericias[arma.pericia] = alvos.ataque;

  const depois = calibrar({ dados, update, alvosPericias, alvoDefesa: alvos.defesa, medir });

  const avisos = [...plano.avisos];
  if (update[CAMINHO_DEFESA] !== alvos.defesa) {
    avisos.push(`A defesa soma atributo/armadura da ficha: defesa.base ficou ${update[CAMINHO_DEFESA]} para o total ser ${alvos.defesa}.`);
  }

  const itemUpdates = armas.map((arma) => {
    const item = dados.items.find(i => i._id === arma.id);
    const ataques = ataquesPorArma[arma.id] ?? arma.ataques;
    const formula = ataques > 0 ? plano.dano?.porArma[arma.id]?.formula : undefined;
    return {
      _id: arma.id,
      'system.ataques': ataques,
      'system.rolls': reescreverRolls(item.system.rolls, { indiceRollDano: arma.indiceRollDano, formula }),
    };
  });

  const textos = { cds: [], ataques: [] };

  // Troca só o número da CD escrita nas descrições (poderes, magias e armas); o resto do texto fica igual.
  if (atualizarCDs) {
    for (const item of dados.items.filter(i => TIPOS_COM_CD.includes(i.type))) {
      const original = item.system.description?.value;
      const { texto, antigas } = trocarCDs(original, alvos.cd);
      if (texto === original) continue;
      textos.cds.push({ nome: item.name, antigas, para: alvos.cd });
      let mudanca = itemUpdates.find(u => u._id === item._id);
      if (!mudanca) itemUpdates.push(mudanca = { _id: item._id });
      mudanca['system.description.value'] = texto;
    }
  }

  // Atualiza as linhas de ataque (Corpo a Corpo / À Distância) que já têm texto.
  if (atualizarTextoAtaques) {
    const armasNoTexto = armas.map((arma) => ({
      nome: arma.nome,
      ataque: alvos.ataque,
      formula: (ataquesPorArma[arma.id] ?? arma.ataques) > 0 ? plano.dano?.porArma[arma.id]?.formula : undefined,
    }));
    for (const campo of CAMPOS_DE_ATAQUE) {
      const antesTexto = dados.system.detalhes[campo];
      if (!antesTexto) continue;
      let depoisTexto = trocarTextoAtaques(antesTexto, armasNoTexto);
      if (atualizarCDs) depoisTexto = trocarCDs(depoisTexto, alvos.cd).texto;
      if (depoisTexto === antesTexto) continue;
      update[`system.detalhes.${campo}`] = depoisTexto;
      textos.ataques.push({ campo, antes: antesTexto, depois: depoisTexto });
    }
  }

  return { plano, update, itemUpdates, antes, depois, avisos, textos };
}

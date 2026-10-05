// Monta e calibra o ajuste de uma ficha. Sem dependência do Foundry: quem mede o que a ficha
// mostra (o clone preparado, no Foundry) entra como a função `medir`.
import { lerArmas, planejarAjuste, totalAtaques } from './calculo.js';
import { normalizarND } from './tabelas.js';
import {
  atualizarCDs as trocarCDs, atualizarTextoAtaques as trocarTextoAtaques,
  atualizarNivelConjurador as trocarNivelConjurador,
} from './textos.js';
import { nivelDoND, sugerirCirculos } from './circulos.js';
import { faixaDeHabilidades, avisosDePatamar } from './patamares.js';
import { aplicarTemplates, ehItemDeTemplate, idAleatorio } from './templates.js';

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
  atualizarCDs = true, atualizarTextoAtaques = true, atualizarNivelConjurador = true, manterProporcao = true,
  templates = {}, gerarId = idAleatorio,
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
    'system.attributes.pv.max': alvos.pv * (templates.chefeFinal ? 2 : 1),
    'system.attributes.pv.value': alvos.pv * (templates.chefeFinal ? 2 : 1),
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

  const textos = { cds: [], ataques: [], conjurador: [] };
  const nivelConjurador = nivelDoND(nd);
  const sugestoes = [];

  // Troca só o número da CD e o nível de conjurador escritos nas descrições (poderes, magias e armas);
  // o resto do texto fica igual. Cada item recebe uma única gravação da descrição.
  if (atualizarCDs || atualizarNivelConjurador) {
    const classesVistas = new Set();
    const maiorCirculoNaFicha = Math.max(0, ...dados.items
      .filter(i => i.type === 'magia').map(i => Number(i.system.circulo) || 0));
    for (const item of dados.items.filter(i => TIPOS_COM_CD.includes(i.type))) {
      const original = item.system.description?.value;
      let texto = original;
      if (atualizarNivelConjurador) {
        const nivel = trocarNivelConjurador(texto, nivelConjurador);
        texto = nivel.texto;
        for (const { classe, de, para } of nivel.trocas) {
          if (de !== para) textos.conjurador.push({ nome: item.name, classe, de, para });
          if (classesVistas.has(classe.toLowerCase())) continue;
          classesVistas.add(classe.toLowerCase());
          sugestoes.push(...sugerirCirculos({ classe, nivel: para, maiorCirculoNaFicha }));
        }
      }
      if (atualizarCDs) {
        const cd = trocarCDs(texto, alvos.cd);
        if (cd.texto !== texto) textos.cds.push({ nome: item.name, antigas: cd.antigas, para: alvos.cd });
        texto = cd.texto;
      }
      if (texto === original) continue;
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

  // Mudança de patamar: só informa o que muda para ataques por rodada e quantidade de poderes.
  const armasFinais = armas.map(a => ({
    ...a,
    ataques: ataquesPorArma[a.id] ?? a.ataques,
    alternativa: alternativas[a.id] ?? a.alternativa ?? false,
  }));
  const patamar = avisosDePatamar({
    ndAntes: dados.system.attributes.nd,
    ndDepois: nd,
    papel,
    ataques: totalAtaques(armasFinais.filter(a => a.ataques > 0)),
    poderes: dados.items.filter(i => i.type === 'poder' && !ehItemDeTemplate(i)).length,
    faixa: faixaDeHabilidades(tabelas, papel, nd),
  });

  // Templates (Chefe Final...): PM, RD e itens próprios; sempre calculados a partir do estado base.
  const modelo = aplicarTemplates({ dados, nd, ativos: templates, gerarId });
  Object.assign(update, modelo.update);

  return {
    plano, update, itemUpdates, antes, depois, avisos, textos, sugestoes, patamar,
    itensCriar: modelo.itensCriar, itensRemover: modelo.itensRemover,
    templates: { linhas: modelo.linhas, notas: modelo.notas },
  };
}

// Monta e calibra o ajuste de uma ficha. Sem dependência do Foundry: quem mede o que a ficha
// mostra (o clone preparado, no Foundry) entra como a função `medir`.
import { lerArmas, planejarAjuste, totalAtaques, AVISO_SEM_ARMAS } from './calculo.js';
import { normalizarND } from './tabelas.js';
import {
  atualizarCDs as trocarCDs, atualizarTextoAtaques as trocarTextoAtaques,
  atualizarNivelConjurador as trocarNivelConjurador,
} from './textos.js';
import { nivelDoND, sugerirCirculos } from './circulos.js';
import { faixaDeHabilidades, avisosDePatamar } from './patamares.js';
import {
  aplicarMudancas, aplicarTemplates, ehItemDeTemplate, idAleatorio, lerMarcador, resolverBando, restaurarDados,
} from './templates.js';

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
  dados: dadosReais, tabelas, nd, papel, medir,
  ataquesPorArma = {}, alternativas = {}, ordemResistencias,
  atualizarCDs = true, atualizarTextoAtaques = true, atualizarNivelConjurador = true, manterProporcao = true,
  templates = {}, gerarId = idAleatorio,
}) {
  // O que o Enxame alterou (ataques das armas, linha de ataque) volta ao original antes do cálculo.
  const dados = restaurarDados(dadosReais);
  const antes = medir({});
  const armas = lerArmas(dados.items, dados.system.detalhes.ataquescac ?? '');
  // O Enxame sozinho tira as armas da ficha; junto com o Bando elas ficam e são ajustadas como no Bando.
  const semArmas = Boolean(templates.enxame && !templates.bando);
  if (semArmas) ataquesPorArma = Object.fromEntries(armas.map(a => [a.id, 0]));
  // Bando: o ND da tabela é o efetivo (o individual mais o aumento) e o tamanho sobe pela escala.
  const marcador = lerMarcador(dadosReais);
  const tamanhoBase = (marcador?.ativos?.includes('bando') ? marcador.base?.tamanho : undefined) ?? dados.system.tracos.tamanho;
  const bando = templates.bando
    ? { ...templates.bando, ...resolverBando({ nd, tamanho: tamanhoBase, bando: templates.bando }), ndIndividual: nd }
    : null;
  const ndTabela = bando?.ndEfetivo ?? nd;
  const mult = bando?.mult ?? 1;
  const plano = planejarAjuste({
    tabelas, papel, nd: ndTabela, multiplicadorDano: mult, armas, itens: dados.items,
    totais: { fort: antes.pericias.fort, refl: antes.pericias.refl, vont: antes.pericias.vont },
    ataquesPorArma, alternativas, ordemResistencias, manterProporcao,
  });
  const { alvos } = plano;

  const update = {
    'system.attributes.nd': normalizarND(ndTabela),
    'system.detalhes.role': papel,
    'system.attributes.pv.max': alvos.pv * (templates.chefeFinal ? 2 : 1),
    'system.attributes.pv.value': alvos.pv * (templates.chefeFinal ? 2 : 1),
    'system.attributes.cd': alvos.cd,
  };

  // O tamanho entra antes da calibração: o sistema soma o modificador de tamanho em algumas perícias.
  if (bando) update['system.tracos.tamanho'] = bando.tamanho;
  else if (marcador?.ativos?.includes('bando')) update['system.tracos.tamanho'] = tamanhoBase;

  const alvosPericias = { ...plano.resistencias };
  for (const arma of armas) alvosPericias[arma.pericia] = alvos.ataque;

  const depois = calibrar({ dados, update, alvosPericias, alvoDefesa: alvos.defesa, medir });

  const avisos = plano.avisos.filter(a => !(semArmas && a === AVISO_SEM_ARMAS));
  if (update[CAMINHO_DEFESA] !== alvos.defesa) {
    avisos.push(`A defesa soma atributo/armadura da ficha: defesa.base ficou ${update[CAMINHO_DEFESA]} para o total ser ${alvos.defesa}.`);
  }

  // Com o Enxame as armas saem da ficha: não há o que atualizar nelas.
  const itemUpdates = (semArmas ? [] : armas).map((arma) => {
    const item = dados.items.find(i => i._id === arma.id);
    const ataques = ataquesPorArma[arma.id] ?? arma.ataques;
    const formula = ataques > 0 ? plano.dano?.porArma[arma.id]?.formula : undefined;
    const formulaFinal = formula !== undefined && mult > 1 ? `(${formula}) * ${mult}` : formula;
    return {
      _id: arma.id,
      'system.ataques': ataques,
      'system.rolls': reescreverRolls(item.system.rolls, { indiceRollDano: arma.indiceRollDano, formula: formulaFinal }),
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
    for (const item of dados.items.filter(i => TIPOS_COM_CD.includes(i.type) && !(semArmas && i.type === 'arma'))) {
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
      formula: (ataquesPorArma[arma.id] ?? arma.ataques) > 0
        ? [plano.dano?.porArma[arma.id]?.formula, mult > 1 ? ` ×${mult}` : ''].join('')
        : undefined,
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
    ndDepois: ndTabela,
    papel,
    ataques: semArmas ? null : totalAtaques(armasFinais.filter(a => a.ataques > 0)),
    poderes: dados.items.filter(i => i.type === 'poder' && !ehItemDeTemplate(i)).length,
    faixa: faixaDeHabilidades(tabelas, papel, ndTabela),
  });

  // Templates (Chefe Final...): PM, RD e itens próprios; sempre calculados a partir do estado base.
  const modelo = aplicarTemplates({ dados: dadosReais, nd: ndTabela, ativos: templates, bando, danoND: plano.linha.Dano, gerarId });
  Object.assign(update, modelo.update);
  // O que cada arma vai ter depois (para a prévia), antes de mover as atualizações das armas recriadas.
  const armasUpdates = itemUpdates.filter(u => armas.some(a => a.id === u._id)).map(u => ({ ...u }));
  // Armas devolvidas depois do Enxame não existem no ator: entram como itens novos, já com o ajuste aplicado.
  const recriadas = new Map(modelo.armasParaRecriar.map(a => [a._id, a]));
  for (let i = itemUpdates.length - 1; i >= 0; i--) {
    if (!recriadas.has(itemUpdates[i]._id)) continue;
    aplicarMudancas(recriadas.get(itemUpdates[i]._id), itemUpdates[i]);
    itemUpdates.splice(i, 1);
  }
  // Sem o Enxame, a linha de ataque original tem de voltar mesmo que o texto novo seja igual a ela.
  const textoGuardado = lerMarcador(dadosReais)?.base?.ataquescac !== undefined;
  if (textoGuardado && !semArmas && !('system.detalhes.ataquescac' in update)) {
    update['system.detalhes.ataquescac'] = dados.system.detalhes.ataquescac;
  }

  return {
    plano, update, itemUpdates, antes, depois, avisos, textos, sugestoes, patamar,
    armasUpdates,
    itensCriar: [...recriadas.values(), ...modelo.itensCriar], itensRemover: modelo.itensRemover,
    templates: { linhas: modelo.linhas, notas: modelo.notas, multDano: mult },
  };
}

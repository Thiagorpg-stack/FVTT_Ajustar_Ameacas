// Plano de ajuste de ND a partir de dados "achatados" do ator. Sem dependência do Foundry.
import { consultar, maxAtaques } from './tabelas.js';
import { analisarDanoArma, balancearDano, ehCura, limiteDados, mediaFormula } from './dano.js';
import { padraoDoNome } from './textos.js';
import { FLAG } from './templates.js';

const QUANTIDADES = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, 'três': 3, quatro: 4, cinco: 5, seis: 6 };
const PALAVRA_QTD = 'um|uma|dois|duas|tr[eê]s|quatro|cinco|seis';
const quantidade = (palavra) => QUANTIDADES[palavra.toLowerCase()] ?? 1;

// Ataques por rodada propostos para uma arma: system.ataques, senão a palavra de quantidade
// na descrição ("Cinco mordidas") ou em detalhes.ataquescac ("... e duas garras"), senão 1.
export function contarAtaques(arma, ataquescac = '') {
  const declarado = arma.system?.ataques;
  if (declarado > 0) return declarado;

  const secreto = /<section class="secret">([\s\S]*?)<\/section>/.exec(arma.system?.description?.value ?? '');
  const inicio = secreto && new RegExp(`^\\s*(${PALAVRA_QTD})\\b`, 'i').exec(secreto[1]);
  if (inicio) return quantidade(inicio[1]);

  const citada = new RegExp(`(?:\\b(${PALAVRA_QTD})\\s+)?${padraoDoNome(arma.name)}`, 'i').exec(ataquescac);
  return citada?.[1] ? quantidade(citada[1]) : 1;
}

// Armas com rolagem de dano, no formato que o plano usa.
export function lerArmas(items, ataquescac = '') {
  const armas = [];
  for (const item of items.filter(i => i.type === 'arma')) {
    const dano = analisarDanoArma(item.system.rolls);
    if (!dano) continue;
    const ataque = item.system.rolls.find(r => r.type === 'ataque');
    armas.push({
      id: item._id,
      nome: item.name,
      ataques: contarAtaques(item, ataquescac),
      alternativa: false,
      pericia: ataque?.parts?.[1]?.[0] || 'luta',
      indiceRollDano: dano.indiceRoll,
      principal: dano.principal,
      secundario: dano.secundario,
    });
  }
  return armas;
}

// Fator sobre o dano da tabela para poder de ação padrão/completa: com efeito (condição, teste de
// resistência ou área) ou sem efeito (0,7 é provisório, escolha do mestre).
export const FATOR_COM_EFEITO = 0.6;
export const FATOR_SEM_EFEITO = 0.7;
const EXECUCOES_PADRAO = ['action', 'full'];

// Sinais de que o poder tem efeito além do dano (condição, teste de resistência, metade, área). É só o
// padrão: o mestre confere e muda no diálogo.
const SINAIS_DE_EFEITO = new RegExp([
  String.raw`\bCD\s*\d+`, String.raw`\bDC\s*\d+`, 'saving throw', 'metade', 'todas as criaturas',
  String.raw`\b(?:cone|esfera|linha|cubo|cilindro|explos[ãa]o|[áa]rea)\b`,
  String.raw`(?<!\p{L})(?:abalad|alquebrad|apavorad|atordoad|caíd|cego|confus|debilitad|desprevenid|enjoad|enredad|`
    + 'envenenad|esmorecid|exaust|fascinad|fatigad|frustrad|imóve|inconscient|indefes|lent[oa]|ofuscad|'
    + 'paralisad|pasm|petrificad|sangrando|surd|vulneráve|em chamas|agarrad|derrubad|'
    + 'prone|stunned|blinded|poisoned|frightened|paralyzed|restrained|grappled)',
].join('|'), 'iu');
export const detectarEfeito = (texto) => SINAIS_DE_EFEITO.test(texto ?? '');

// Poderes com dano numérico, cada um com a escolha de ajustar ("ajustar") e se tem efeito ("efeito"). A
// escolha vem de `escolhas[id]` (o diálogo) ou da flag do item (flags.<módulo>.danoPoder = { ajustar, efeito });
// sem nenhuma das duas o poder não é ajustado e o efeito é detectado pelo texto. `partes` guarda, para cada
// parte de dano, o dado e a média originais e onde ela mora em system.rolls. Poder cujo dano não é
// número (@Tormenta...) fica de fora.
export function lerPoderes(items, escolhas = {}) {
  const poderes = [];
  for (const item of items.filter(i => i.type === 'poder')) {
    const flag = item.flags?.[FLAG]?.danoPoder;
    const config = { ...flag, ...escolhas[item._id] };
    const dano = analisarDanoArma(item.system.rolls ?? []);
    if (!dano || dano.principal == null) continue;
    // Dano principal só em dados ("6d12"): ao ajustar, continua só em dados com as mesmas faces, sem bônus fixo.
    const formulaPrincipal = item.system.rolls[dano.indiceRoll].parts[0]?.[0] ?? '';
    const soDados = /^\s*\d*d\d+\s*$/i.test(formulaPrincipal);
    const partes = [];
    item.system.rolls.forEach((roll, indiceRoll) => {
      if (roll.type !== 'dano' || ehCura(roll)) return;
      roll.parts.forEach(([formula], indiceParte) => {
        const media = mediaFormula(formula);
        if (media > 0) partes.push({ faces: Number(/d(\d+)/i.exec(formula)?.[1] ?? 12), media, indiceRoll, indiceParte });
      });
    });
    poderes.push({
      id: item._id,
      nome: item.name,
      padrao: EXECUCOES_PADRAO.includes(item.system.ativacao?.execucao),
      ajustar: Boolean(config.ajustar),
      efeito: config.efeito ?? detectarEfeito(item.system.description?.value),
      temFlag: Boolean(flag),
      soDados,
      faces: soDados ? Number(/d(\d+)/i.exec(formulaPrincipal)[1]) : undefined,
      indiceRollDano: dano.indiceRoll,
      principal: dano.principal,
      secundario: dano.secundario,
      partes,
    });
  }
  return poderes;
}

const ORDEM_EMPATE = ['fort', 'refl', 'vont'];

// Testes do maior para o menor total (empate: Fortitude, Reflexos, Vontade).
export function ordenarResistencias(totais) {
  return [...ORDEM_EMPATE].sort(
    (a, b) => totais[b] - totais[a] || ORDEM_EMPATE.indexOf(a) - ORDEM_EMPATE.indexOf(b));
}

// O teste mais alto recebe a resistência Forte, o seguinte a Média e o mais baixo a Fraca.
// `ordem` ([forte, média, fraca]) permite ao mestre trocar a atribuição.
export function atribuirResistencias(totais, linha, ordem) {
  const valores = [linha.ResForte, linha.ResMedia, linha.ResFraca];
  return Object.fromEntries((ordem ?? ordenarResistencias(totais)).map((chave, i) => [chave, valores[i]]));
}

// Ataques por rodada: armas compartilhadas somam; entre as alternativas vale a que mais ataca.
export function totalAtaques(armas) {
  const soma = armas.filter(a => !a.alternativa).reduce((s, a) => s + a.ataques, 0);
  const alternativa = Math.max(0, ...armas.filter(a => a.alternativa).map(a => a.ataques));
  return soma + alternativa;
}

export function avisoLimite(armas, nd) {
  const total = totalAtaques(armas);
  const limite = maxAtaques(nd);
  return total > limite
    ? `São ${total} ataques por rodada, mas o limite do ND ${nd} é ${limite}.`
    : null;
}

// Poderes e magias com dano que não serão alterados, listados para o mestre revisar (`ajustados`: ids que o ajuste cobre).
export function revisarItens(items, ajustados = []) {
  return items
    .filter(i => ['poder', 'magia'].includes(i.type) && !ajustados.includes(i._id))
    .filter(i => i.system.rolls?.some(r => r.type === 'dano' && !ehCura(r)))
    .map(i => i.name);
}

export const AVISO_SEM_ARMAS = 'Nenhuma arma com ataques por rodada maior que zero: o dano não será alterado.';

export function planejarAjuste({
  tabelas, papel, nd, totais, armas, poderes = [], itens = [],
  ataquesPorArma = {}, alternativas = {}, ordemResistencias, manterProporcao = true, multiplicadorDano = 1,
}) {
  const linha = consultar(tabelas, papel, nd);
  const armasFinais = armas.map(a => ({
    ...a,
    ataques: ataquesPorArma[a.id] ?? a.ataques,
    alternativa: alternativas[a.id] ?? a.alternativa ?? false,
  }));

  const avisos = [];
  let dano = null;
  // Poder de ação padrão/completa é alternativo, só em dados; os demais dividem a rodada com as armas, 1 uso cada.
  const ajustados = poderes.filter(p => p.ajustar);
  const entradasPoderes = ajustados.map(p => (p.padrao
    ? { id: p.id, ataques: 1, secundario: 0, estilo: 'dados', fator: p.efeito ? FATOR_COM_EFEITO : FATOR_SEM_EFEITO, partes: p.partes }
    : { id: p.id, ataques: 1, secundario: p.secundario, principal: p.principal, faces: p.faces }));
  if (armasFinais.some(a => a.ataques > 0) || entradasPoderes.length) {
    // No Bando cada golpe é multiplicado depois (×2, ×4, ×6), então o alvo de cada arma é a fração do dano da tabela.
    dano = balancearDano({
      danoAlvo: linha.Dano / multiplicadorDano, armas: [...armasFinais, ...entradasPoderes], manterProporcao,
      limiteDados: limiteDados(nd),
    });
    avisos.push(avisoLimite(armasFinais.filter(a => a.ataques > 0), nd), ...dano.avisos);
  } else {
    avisos.push(AVISO_SEM_ARMAS);
  }

  return {
    alvos: { pv: linha.PV, cd: linha.CD, defesa: linha.Defesa, ataque: linha.Ataque },
    resistencias: atribuirResistencias(totais, linha, ordemResistencias),
    dano,
    avisos: avisos.filter(Boolean),
    revisar: revisarItens(itens, ajustados.map(p => p.id)),
    linha,
  };
}

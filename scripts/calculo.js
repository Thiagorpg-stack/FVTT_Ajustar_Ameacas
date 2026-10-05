// Plano de ajuste de ND a partir de dados "achatados" do ator. Sem dependência do Foundry.
import { consultar, maxAtaques } from './tabelas.js';
import { analisarDanoArma, balancearDano, ehCura } from './dano.js';
import { padraoDoNome } from './textos.js';

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

// Poderes e magias com dano: não são alterados, só listados para o mestre revisar.
export function revisarItens(items) {
  return items
    .filter(i => ['poder', 'magia'].includes(i.type))
    .filter(i => i.system.rolls?.some(r => r.type === 'dano' && !ehCura(r)))
    .map(i => i.name);
}

export const AVISO_SEM_ARMAS = 'Nenhuma arma com ataques por rodada maior que zero: o dano não será alterado.';

export function planejarAjuste({
  tabelas, papel, nd, totais, armas, itens = [],
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
  if (armasFinais.some(a => a.ataques > 0)) {
    // No Bando cada golpe é multiplicado depois (×2, ×4, ×6), então o alvo de cada arma é a fração do dano da tabela.
    dano = balancearDano({ danoAlvo: linha.Dano / multiplicadorDano, armas: armasFinais, manterProporcao });
    avisos.push(avisoLimite(armasFinais.filter(a => a.ataques > 0), nd), ...dano.avisos);
  } else {
    avisos.push(AVISO_SEM_ARMAS);
  }

  return {
    alvos: { pv: linha.PV, cd: linha.CD, defesa: linha.Defesa, ataque: linha.Ataque },
    resistencias: atribuirResistencias(totais, linha, ordemResistencias),
    dano,
    avisos: avisos.filter(Boolean),
    revisar: revisarItens(itens),
    linha,
  };
}

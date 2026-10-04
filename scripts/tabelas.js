// Consulta às tabelas de ND por papel. Sem dependência do Foundry nas funções puras.

const PAPEL_PARA_TABELA = { solo: 'solo', lackey: 'lacaio', special: 'especial' };
const ND_ESPECIAIS = { 'S': 21, 'S+': 22 };

export function chaveTabelaDoPapel(papel) {
  const chave = PAPEL_PARA_TABELA[papel];
  if (!chave) throw new Error(`Papel desconhecido: "${papel}"`);
  return chave;
}

// O sistema guarda o ND como texto e entende "S" e "S+" (nível 20) por conta própria.
export function normalizarND(nd) {
  return String(nd).trim();
}

export function valorND(nd) {
  const texto = String(nd).trim();
  if (texto === '1/4') return 0.25;
  if (texto === '1/2') return 0.5;
  if (texto in ND_ESPECIAIS) return ND_ESPECIAIS[texto];
  const n = parseInt(texto, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function maxAtaques(nd) {
  const v = valorND(nd);
  if (v <= 4) return 1;
  if (v <= 10) return 2;
  if (v <= 16) return 3;
  return 4;
}

export function consultar(tabelas, papel, nd) {
  const linhas = tabelas[chaveTabelaDoPapel(papel)];
  // "21" e "22" são o mesmo ND que "S" e "S+" na tabela
  const alvo = valorND(nd);
  const linha = linhas.find(l => valorND(l.ND) === alvo);
  if (!linha) throw new Error(`ND "${nd}" não existe na tabela`);
  return linha;
}

export async function carregarTabelas(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Não foi possível carregar ${url}`);
  return resposta.json();
}

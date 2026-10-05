// Nível de conjurador e círculos de magia liberados por classe. Sem dependência do Foundry.

// Nível mínimo da classe para cada círculo (1º, 2º, ...). Tabelas do Tormenta20; "conjurador" (usado
// em criaturas sem classe definida) segue a tabela dos conjuradores completos.
const COMPLETOS = [1, 5, 9, 13, 17];
const TABELAS = {
  arcanista: COMPLETOS, mago: COMPLETOS, feiticeiro: COMPLETOS, feiticeira: COMPLETOS,
  bruxo: COMPLETOS, bruxa: COMPLETOS, 'clérigo': COMPLETOS, clerigo: COMPLETOS, druida: COMPLETOS,
  conjurador: COMPLETOS, conjuradora: COMPLETOS,
  bardo: [1, 6, 10, 14, 18],
  paladino: [4, 8, 12, 16], 'guardião': [4, 8, 12, 16], 'guardiã': [4, 8, 12, 16],
};

const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// O sistema trata ND fracionário como nível 1 e S/S+ como nível 20. Aqui o nível nunca passa de 20.
export function nivelDoND(nd) {
  const texto = String(nd).trim();
  if (['S', 'S+'].includes(texto)) return 20;
  return Math.min(20, Math.max(1, parseInt(texto, 10) || 1));
}

// Maior círculo que a classe alcança no nível. null quando a classe não está na tabela.
export function circuloMaximo(classe, nivel) {
  const tabela = TABELAS[String(classe).trim().toLowerCase()];
  return tabela ? tabela.filter(minimo => nivel >= minimo).length : null;
}

// Avisos para a prévia: círculos que o novo nível libera e magias acima do que o nível permite.
export function sugerirCirculos({ classe, nivel, maiorCirculoNaFicha }) {
  const maximo = circuloMaximo(classe, nivel);
  if (maximo === null) return [];
  const nome = `${maiuscula(classe)} ${nivel}º`;
  if (maximo > maiorCirculoNaFicha) {
    const ficha = maiorCirculoNaFicha > 0
      ? `a ficha só tem magias até o ${maiorCirculoNaFicha}º`
      : 'a ficha ainda não tem magias';
    return [`${nome} libera o ${maximo}º círculo (${ficha}).`];
  }
  if (maximo < maiorCirculoNaFicha) {
    const alcance = maximo > 0 ? `só chega ao ${maximo}º círculo` : 'ainda não lança magias';
    return [`${nome} ${alcance}, mas a ficha tem magias de ${maiorCirculoNaFicha}º círculo.`];
  }
  return [];
}

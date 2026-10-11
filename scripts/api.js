// API pública do módulo, para outros módulos (como o "5e para T20").
// Sem dependência do Foundry: quem monta a API (main.js) injeta as funções que precisam do Foundry.
import { consultar, valorND, maxAtaques } from './tabelas.js';

export const VERSAO_API = 1;

// Objeto exposto em game.modules.get('tormenta20-ajuste-nd').api
export function criarApi({ abrirAjusteND, obterTabelas, simular, aplicarAjuste }) {
  return {
    versaoApi: VERSAO_API,
    abrirAjusteND,
    obterTabelas,
    // `papel` usa os códigos do sistema: 'solo', 'lackey' ou 'special'.
    consultarTabela: async (papel, nd) => consultar(await obterTabelas(), papel, nd),
    valorND,
    maxAtaques,
    simular,
    aplicarAjuste,
  };
}

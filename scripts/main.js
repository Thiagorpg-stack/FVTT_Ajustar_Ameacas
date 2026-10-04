import { abrirAjusteND } from './dialogo.js';
import { ID_MODULO } from './aplicar.js';

const CLASSE_BOTAO = 't20-ajuste-nd';
const podeAjustar = (actor) => game.user.isGM && actor?.type === 'npc';

// Botão no cabeçalho da ficha de ameaça (ficha ApplicationV1 do sistema).
Hooks.on('getActorSheetHeaderButtons', (sheet, botoes) => {
  if (!podeAjustar(sheet.actor) || botoes.some(b => b.class === CLASSE_BOTAO)) return;
  botoes.unshift({
    label: game.i18n.localize('T20AJND.Botao'),
    class: CLASSE_BOTAO,
    icon: 'fas fa-scale-balanced',
    onclick: () => abrirAjusteND(sheet.actor),
  });
});

// Item no menu de contexto do diretório de atores.
Hooks.on('getActorContextOptions', (_diretorio, opcoes) => {
  const nome = game.i18n.localize('T20AJND.Botao');
  if (opcoes.some(o => o.name === nome)) return;
  const atorDe = (li) => {
    const elemento = li instanceof HTMLElement ? li : li[0];
    return game.actors.get(elemento.dataset.entryId ?? elemento.dataset.documentId);
  };
  opcoes.push({
    name: nome,
    icon: '<i class="fas fa-scale-balanced"></i>',
    condition: (li) => podeAjustar(atorDe(li)),
    callback: (li) => abrirAjusteND(atorDe(li)),
  });
});

Hooks.once('ready', () => {
  game.modules.get(ID_MODULO).api = { abrirAjusteND };
});

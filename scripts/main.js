import { abrirAjusteND } from './dialogo.js';
import { ID_MODULO } from './aplicar.js';
import { decidirMensagem, montarMensagem } from './boas-vindas.js';

const CLASSE_BOTAO = 't20-ajuste-nd';
const SETTING_VERSAO_VISTA = 'ultimaVersaoVista';
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

Hooks.once('init', () => {
  game.settings.register(ID_MODULO, SETTING_VERSAO_VISTA, {
    scope: 'world', config: false, type: String, default: '',
  });
});

// Mensagem no chat só para o Mestre: completa na primeira vez no mundo, só as novidades quando a versão sobe.
// Só o GM ativo envia, para não duplicar com dois mestres conectados.
async function avisarNoChat() {
  if (!game.users.activeGM?.isSelf) return;
  const versao = game.modules.get(ID_MODULO).version;
  const tipo = decidirMensagem(game.settings.get(ID_MODULO, SETTING_VERSAO_VISTA), versao);
  if (!tipo) return;
  await ChatMessage.create({
    content: montarMensagem(tipo, versao, chave => game.i18n.localize(chave)),
    whisper: [game.user.id],
  });
  await game.settings.set(ID_MODULO, SETTING_VERSAO_VISTA, versao);
}

Hooks.once('ready', () => {
  game.modules.get(ID_MODULO).api = { abrirAjusteND };
  avisarNoChat().catch(erro => console.error(`${ID_MODULO} |`, erro));
});

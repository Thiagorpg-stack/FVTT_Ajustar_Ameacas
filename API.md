# API para outros módulos

A partir da versão 0.9.0, o Ajustar ND expõe funções para que outros módulos (como o **5e para T20**) usem o mesmo cálculo, sem copiar tabelas nem regras.

```js
const modulo = game.modules.get("tormenta20-ajuste-nd");
if (!modulo?.active || modulo.api?.versaoApi < 1) {
  // módulo ausente, desativado ou antigo
}
const api = modulo.api;
```

A API fica disponível depois do hook `ready`.

## Funções (versaoApi 1)

| Função | O que faz |
|---|---|
| `abrirAjusteND(actor)` | Abre o diálogo de ajuste de um ator de NPC. |
| `obterTabelas()` | Devolve as tabelas por ND e papel (`{ solo, lacaio, especial }`, cada uma com as linhas de 1/4 a S+). |
| `consultarTabela(papel, nd)` | Devolve a linha da tabela. `papel` usa os **códigos do sistema**: `solo`, `lackey` ou `special`. |
| `valorND(nd)` | Converte o ND em número (`1/4` = 0,25; `1/2` = 0,5; `S` = 21; `S+` = 22). |
| `maxAtaques(nd)` | Máximo de ataques por rodada do patamar do ND (1, 2, 3 ou 4). |
| `simular(actor, opcoes)` | Calcula o ajuste sem gravar nada e devolve o resultado (valores novos, prévia e avisos). |
| `aplicarAjuste(actor, resultado, { copiar })` | Grava o resultado. Com `copiar: false` altera o ator; com `copiar: true` (padrão) cria uma cópia. |

### Opções de `simular`

`nd`, `papel` (código do sistema), `ataquesPorArma` (`{ idDaArma: quantidade }`), `alternativas`, `ordemResistencias`, `atualizarCDs`, `atualizarTextoAtaques`, `atualizarNivelConjurador`, `manterProporcao` e `templates` (`chefeFinal`, `enxame`, `bando`). Os mesmos campos do diálogo.

## Exemplo

```js
const api = game.modules.get("tormenta20-ajuste-nd").api;

const resultado = await api.simular(actor, {
  nd: "5",
  papel: "solo",
  ataquesPorArma: { [armaId]: 2 },
});
await api.aplicarAjuste(actor, resultado, { copiar: false });
```

## Cuidados

- `simular` mede a ficha por um clone do ator, então o ator precisa existir (de preferência já criado no mundo).
- Os papéis da API são os do sistema (`lackey`, `special`); as chaves das tabelas são `lacaio` e `especial`.
- Só o Mestre deve chamar essas funções.
- Mudanças que quebrem a API aumentam `versaoApi`.

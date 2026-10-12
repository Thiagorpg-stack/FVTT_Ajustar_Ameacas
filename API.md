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

## Funções (versaoApi 2)

A `versaoApi` 2 (Ajustar ND 0.10.0) acrescenta o dano dos poderes: `simular` aceita `escolhasPoderes` e devolve `poderesPrevia` (abaixo). As funções da versão 1 não mudaram.

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

`nd`, `papel` (código do sistema), `ataquesPorArma` (`{ idDaArma: quantidade }`), `alternativas`, `ordemResistencias`, `atualizarCDs`, `atualizarTextoAtaques`, `atualizarNivelConjurador`, `manterProporcao`, `templates` (`chefeFinal`, `enxame`, `bando`) e `escolhasPoderes` (`{ idDoPoder: { ajustar, efeito } }`, versão 2). Os mesmos campos do diálogo.

### Dano dos poderes (versaoApi 2)

Um poder só é ajustado se estiver marcado: pela flag do item `flags["tormenta20-ajuste-nd"].danoPoder = { ajustar, efeito }` ou por `escolhasPoderes` (que vale mais que a flag). Sem nenhuma das duas, o poder não é tocado. Quem cria poderes por código (como o 5e para T20) grava a flag. O resultado de `simular` traz `poderesPrevia`: `[{ id, nome, padrao, ajustar, efeito, antes, depois }]`, com as fórmulas antes e depois (`depois` é `null` se o poder não é ajustado). Os `itemUpdates` do resultado também gravam a flag dos poderes marcados. Com o template Bando os poderes não são ajustados.

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

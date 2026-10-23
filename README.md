# J-3911 — Emergência Operacional Concept V2.3

## Correção solicitada — dinâmica do LIC-39152

- A falha da circulação J-3911 provoca inicialmente redução do inventário da E-3901 no modelo, associada à perda de refrigeração/condensação de pesados.
- Abrir HV-39157 **com rota disponível** altera progressivamente o balanço de condensação/massa e pode deter a queda ou produzir uma recuperação lenta. Uma válvula aberta sem vazão disponível não recupera nível.
- Reduzir/parar a carga reduz a geração de vapores; entrada da reserva recupera a circulação; pumpout aumenta saída de líquido; trip altera a energia residual.
- O indicador de tendência acompanha o **saldo atual**, e não fica preso ao estado de falha da bomba.
- Todos os valores e tempos de resposta são **ilustrativos, não calibrados em planta**. A capacidade da HV-39157 não foi validada: não usar a resposta do simulador como garantia de segurança ou instrução operacional.

## Publicação no GitHub Pages

Envie **todo o conteúdo** da pasta `J-3911-Emergencia-Concept` para a raiz do repositório; `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest` e `assets/`. A V2.3 substitui a V2.2 apenas após publicação manual. O código do app fica disponível offline após a primeira visita online em navegador compatível.

## Validação proposta

Teste o estado inicial após falha sem HV; depois HV em 100% com rota disponível; repita com rota indisponível; reduza a carga; inicie a reserva; ative/desative pumpout; confira o sentido do saldo e a curva do nível.

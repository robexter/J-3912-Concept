# J-3912 Concept — V1.2 • Malha completa + CAS/AUTO/MAN no FIC-A de nível, vazão e fluxo mínimo

One-page responsiva e PWA para estudo da malha integrada do fundo da fracionadora E-3901 e bombas J-3912A/B.

## Estrutura que já foi confirmada

- LT-39152 mede o nível do fundo da E-3901 e alimenta simultaneamente LIC-39152 e LIC-39152A, ambos em AUTO durante operação normal.
- LIC-39152 atua na LV-39152, válvula que controla o nível no circuito de borra.
- LIC-39152A envia sua saída como referência (SET) ao FIC-39164A, que atua no controle por rotação da J-3912A/B.
- LV-39152 e controle de rotação atuam sobre uma **mesma linha de retirada de borra**, sem caminhos diferentes à armazenagem.
- FT-39164A e FT-39164B são redundantes. O bloco SS-DUAL FS-39164A seleciona a PV a ser fornecida aos dois controladores de vazão. Em AUTO, a qualidade BAD do FT em operação permite seleção de outro FT GOOD; em MAN o operador define o canal.
- FIC-39164B controla FV-39164 (recirculação de mínimo).
- FIC-39164A: PB 60, I 15. FIC-39164B: PB 300, I 20.

## Alteração pontual V1.2 — FIC-39164A

- No simulador **Malha completa · Interativa**, o FIC-39164A agora oferece **CAS, AUTO e MAN**. O modo inicial é **CAS**, mantendo a arquitetura de cascata da V1.1.
- **CAS**: SP remoto é a saída calculada do LIC-39152A (mestre de nível). **AUTO**: o FIC-A regula a vazão com **SP local independente**, ajustável na interface. **MAN**: o operador ajusta a rotação e a correção automática do FIC-A fica desabilitada.
- O indicador de modo no diagrama, o SP ativo, o diagnóstico e as tendências seguem o SP realmente utilizado. O SP calculado pelo LIC-A permanece disponível para observação mesmo em AUTO local.
- A troca CAS ↔ AUTO possui rastreamento didático do SP para minimizar degraus. **Não confirma a configuração real de tracking do CENTUM**.
- Todos os outros controladores, SS-DUAL, falhas, cenários e conteúdo técnico foram preservados sem alteração funcional.

## Melhorias V1.1

- Nova aba principal **Malha completa · Interativa**, com LT, os dois LICs, LV, cascata de rotação, SS-DUAL e FV em uma única bancada dinâmica.
- Simulador com duas malhas de nível inicialmente em AUTO, SPs ajustáveis exclusivamente didáticos, variações de entrada e perda de carga, tendência de nível, vazões, rotação, LV e FV.
- SS-DUAL com modo AUTO/MAN, qualidade GOOD/BAD independente para FT-A/FT-B, erro de medição não diagnosticado e registro de eventos da seleção.
- Testes predefinidos: nível subindo, nível caindo, SPs de LICs diferentes, maior resistência, FT-A BAD, seleção MAN com FT BAD e mínimo travado fechado.
- Documentação funcional reescrita considerando a malha completa; diagramas, análise de interação/compensação entre controle de nível por LV e rotação e explicações sobre o balanço de massa.
- Bancada hidráulica anterior preservada em aba própria para exercícios isolados, **identificada como modelo reduzido e não como malha real completa**.
- Inclusão de captura completa do SDCD, conteúdos de Mecânica dos Fluidos, questões adicionais de avaliação CIC e atualização do cache PWA.

## Informações não confirmadas (não inventadas)

Setpoints e ganhos dos dois LICs, localização dos FT-A/B relativamente ao reciclo, destino físico do retorno, unidade real do parâmetro integral I, prioridade quando ambos os FT estão GOOD, respostas exatas de falhas BAD em MAN e lógica de coordenação das malhas. Para fins didáticos, o PI assume I em segundos e as curvas de bombeamento, limites e ganhos dos LICs são arbitrados. Nunca utilizar números ou respostas do simulador como autorização para manobras na refinaria.

## Como publicar no GitHub Pages

1. Extraia o ZIP e abra a pasta `J-3912-Concept`.
2. Envie **todo o conteúdo INTERNO dessa pasta** para a raiz do repositório `robexter/J-3912-Concept`, substituindo os arquivos com os mesmos nomes: `index.html`, `app.js`, `app.css`, `sw.js`, `manifest.webmanifest`, `README.md`, `integrado.js`, `integrado.css` e pasta `assets`.
3. Confirme que `integrado.js`, `integrado.css` e `assets/malha-completa-j3912.jpg` realmente estão na raiz / subpasta indicada.
4. Aguarde a publicação do GitHub Pages e acesse `https://robexter.github.io/J-3912-Concept/`.
5. Se o app já estiver instalado, abra o módulo, toque em **↻ Atualizar** e recarregue. O Service Worker usa `CACHE_VERSION` = `j3912-concept-v1-2-20261023-01`.

## Responsividade e instalação

HTML/CSS/JS locais, ícones 192×192 / 512×512, manifesto standalone e SW cache de assets essenciais. Os novos controles usam empilhamento responsivo e a interface não depende de bibliotecas remotas. Em navegador compatível, a instalação é disponibilizada conforme condições do próprio sistema.


## V1.2.1 — responsividade de Operações Unitárias e Mecânica dos Fluidos

- Melhoria localizada nos cartões técnicos do módulo **Operações unitárias** para larguras móveis entre 320 e 780 px.
- Gráfico de curvas hidráulicas adaptativo; indicadores de leis de afinidade refluem em telas estreitas.
- Fórmulas legíveis com proteção contra transbordamento horizontal.
- Navegação rápida dentro da seção (Bombeamento, Curvas e afinidade, Baixa vazão, Controle integrado).
- Preservados os 12 tópicos, seus textos técnicos, a interatividade do controle de rotação, os modos CAS/AUTO/MAN, o simulador integrado, cenários e quizzes.
- Identificador do cache PWA atualizado para disparar nova instalação de recursos após a publicação.

# J-3912 Concept — One-page / PWA

Aplicativo offline e responsivo para estudo da estratégia de controle associada à J-3912, FIC-39164A e FIC-39164B.

## Conteúdo

- Tela original do SDCD com leitura comentada.
- Estratégia de mesma PV do FT bifurcada para dois controladores com setpoints diferentes.
- Simulador animado de bomba, vazão do processo, recirculação, PI de velocidade e PI de mínimo.
- Bancada: demanda, restrição de descarga, sucção, SP-A/SP-B, MAN/AUTO, MVs, válvula travada, FT congelado, medição antes/depois do ramal e coordenação versus PIDs independentes.
- Tendências temporais de vazões, setpoints, rotação, válvula e diagnóstico com eventos.
- Operações Unitárias, Mecânica dos Fluidos, curvas de bombas, continuidade, balanço de energia, leis de afinidade, cavitação e proteção hidráulica.
- Nove cenários de treinamento CIC, 14 questões de avaliação embaralhadas, checklist de confirmação da filosofia real e fontes.

## Publicar no GitHub Pages

1. Crie um repositório chamado `J-3912-Concept` (ou use outro nome).
2. Envie **o conteúdo desta pasta** para a raiz do repositório (index.html, app.css, app.js, sw.js, manifest.webmanifest e pasta assets). Não envie apenas o ZIP, nem acrescente uma pasta extra envolvendo tudo.
3. Em Settings > Pages, selecione Deploy from a branch, branch main, pasta /(root).
4. Abra `https://SEU-USUARIO.github.io/J-3912-Concept/` substituindo seu usuário; o PWA funciona via HTTPS.
5. No navegador compatível, use **Instalar App** ou Adicionar à tela inicial.

## Atualizações e cache

O Service Worker usa uma identificação de versão no começo do arquivo `sw.js`. Em atualizações, altere `CACHE_VERSION` (ex.: `j3912-concept-v2-...`), publique todos os arquivos e use **↻ Atualizar** no aplicativo. As páginas e scripts usam política de rede primeiro, com retorno ao cache no modo offline. Em celulares, ao reabrir o aplicativo, uma checagem de atualização também é solicitada.

## Premissas e limitações

**Os valores demonstrativos não são setpoints autorizados de operação.** A captura confirma dois FICs em MAN e o usuário confirmou um FT compartilhado com dois SPs. A interpretação de A como rotação e B como recirculação é a hipótese operacional adotada. Falta confirmação da posição do FT e dos blocos de lógica do SDCD. A coordenação por prioridade selecionável no simulador é uma hipótese pedagógica, não uma alegação de que existe override na planta.

O modelo usa uma curva simplificada `H = H0(N) - kQ²`, resistências hidráulicas nos dois ramos, dinâmica de primeira ordem e controles PI discretos. Serve para ilustrar respostas e interações, não reproduz controles reais, intertravamentos, margens de NPSH nem a resposta transitória do equipamento.

## Fontes gerais

- Hydraulic Institute / Pumps & Systems — https://www.pumpsandsystems.com/article/hydraulic-institute-pump-faqs-april-2010/
- KSB — https://www.ksb.com/en-global/centrifugal-pump-lexicon/article/operating-behaviour-1118222
- Chemical Processing — https://www.chemicalprocessing.com/processing-equipment/fluid-handling/article/11374851/solids-and-fluid-handling-watch-out-with-variable-speed-pumping-chemical-processing

Nenhuma fonte externa utilizada descreve a lógica real da J-3912. O modelo é de estudo e não se conecta ao equipamento.

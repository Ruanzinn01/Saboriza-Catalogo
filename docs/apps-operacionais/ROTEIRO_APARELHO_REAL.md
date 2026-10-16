# Roteiro curto: teste em aparelho real (Android e iOS)

Pré-requisitos: front de homologação acessível por URL (Preview ou `npm run dev` exposto na rede local), banco de homologação `dfynvpieyvvameftrent`, usuário de teste `separador@homolog.test` (senha em `C:\Users\rruan\homolog-credenciais.txt`, fora do repositório). Registre PASSOU/FALHOU e anexe captura de tela sem dados sensíveis.

| # | Caso | Android | iOS |
|---|------|---------|-----|
| 1 | Login com o separador; só o app Separa Confere aparece | | |
| 2 | Instalar na tela inicial (PWA); ícone correto e maskable no Android | | |
| 3 | Abrir pelo ícone: abre em tela cheia, sem barra do navegador | | |
| 4 | Câmera: ler código de barras de um item | | |
| 5 | Leitor externo (Bluetooth/HID), se houver: bipar item | | |
| 6 | Separar e conferir um pedido sintético até o fim | | |
| 7 | Modo avião no meio da conferência: mensagem clara, nada perdido | | |
| 8 | Voltar online: sincroniza sem duplicar | | |
| 9 | Registrar falta de item; aparece para o gestor | | |
| 10 | Contagem de inventário (`/operacao/separa-confere/inventario`) | | |
| 11 | Alvos de toque confortáveis (44px), sem zoom indevido nos campos | | |
| 12 | Logout e login com outro perfil: nada do anterior aparece | | |

Se algo falhar: anote o passo, o aparelho e o sistema operacional, e envie a captura.

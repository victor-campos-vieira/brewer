---
name: cafeteria-assets
description: Fluxo automático para gerar, recortar e cadastrar novos móveis, métodos, prateleiras, decorações, pisos e paredes da Cafeteria Customizável do Brewer no padrão isométrico de 30°. Use sempre que o usuário pedir para criar, corrigir ou atualizar itens visuais da cafeteria.
---

# Pipeline Automático de Assets da Cafeteria (`assets/cafe/v2/`)

Esta skill garante que qualquer chat (novo ou antigo) gere, recorte e atualize itens da Cafeteria automaticamente, sem precisar reexplicar estilo, ângulo ou código.

---

## 1. Contrato Automático entre o Chat de Design e o Chat de Engenharia (`assets/cafe/v2/catalog.js`)
- O usuário organiza o trabalho em **chats separados por área** (ex.: um chat fixo para **Design & Catálogo da Cafeteria** e outro chat para **Engenharia/Implementação**).
- A ponte automática entre os dois chats é o arquivo `assets/cafe/v2/catalog.js`:
  - **Papel do Chat de Design**: Gerar/ajustar imagens, recortar fundo magenta para `assets/cafe/v2/*.png`, validar no `prototipos/cafeteria-mockup.html` e **cadastrar imediatamente o item em `assets/cafe/v2/catalog.js`** (com `nm`, `cat`, `src`, `price`, `lv`, `w`, `d`, `iw`, `ih`, `ax`, `ay`, `sc`).
  - **Papel do Chat de Engenharia**: Construir o motor interativo (`preview-cafeteria.html` e depois `js/views/colecao.js`) lendo **100% dos itens dinamicamente de `window.CAFE_V2` (`assets/cafe/v2/catalog.js`)**, sem nunca travar nomes de itens fixos no código do motor.
- **Resultado**: Sempre que o Chat de Design adicionar ou atualizar um item em `assets/cafe/v2/catalog.js`, o item **já aparece funcionando automaticamente na loja e na sala do jogo**, sem precisar pedir nada no Chat de Engenharia!

---

## 2. Regras Visuais Obrigatórias (Para o Subagente `image-generator`)

1. **Estilo de Desenho**:
   - Ilustração vetorial cartoon limpa, contornos grossos em marrom-escuro (`#2A1D14`), veios de madeira desenhados suavemente, sombreamento cel-shading de 2 a 3 tons (face superior mais clara, face direita média, face esquerda mais escura).
   - **Proibido**: pixel art, pintura realista/esfumada, sombras projetadas no chão, textos cortados ou fundos com degradê.

2. **Dois Tipos de Projeção**:
   - **Tipo A — Objetos 3D de Chão, Bancada, Prateleiras e Luminárias (`30° Isométrico`)**:
     - Câmera isométrica de **30° (`K = 0.573`)**.
     - Fundo **100% magenta sólido puro (`#FF00FF`)**, objeto centralizado com **margem folgada em todos os 4 lados** para NUNCA cortar bordas.
     - Móveis `2×1` (balcões, bancadas, prateleiras de parede): lado longo (2 quadrados) descendo da esquerda-superior para a direita-inferior.
   - **Tipo B — Texturas de Piso, Parede, Janelas e Quadros Retos (`2D Ortográfico Frontal`)**:
     - O motor aplica a matriz isométrica de 30° via SVG (`matrix(...)`).
     - Pisos e paredes: imagem quadrada preenchendo de ponta a ponta (sem margem).
     - Janelas e quadros de parede: vista frontal 2D centralizada em fundo magenta `#FF00FF` com margem folgada (assim a matriz da parede inclina o quadro perfeitamente sem nunca cortar a moldura).

---

## 3. Passo a Passo Automático ao Gerar ou Atualizar um Item

1. **Chamar o subagente `image-generator`** com o prompt padronizado acima (1 item por imagem, margem ampla para não cortar nada).
2. **Recortar automaticamente o fundo magenta** rodando no terminal:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools/recorte-magenta.ps1 -In "<caminho_da_imagem_gerada.jpg>" -Out "assets/cafe/v2/<nome_do_item>.png"
   ```
3. **Atualizar `assets/cafe/v2/catalog.js`** com as dimensões (`iw`, `ih`), ponto de apoio (`ax`, `ay`), preço e nível do item.

---

## 4. Fila de Itens Pendentes / Para Refinar (Assim que houver cota do `image-generator`)

Quando o usuário pedir *"gere os itens pendentes da cafeteria"*, gere e recorte na ordem abaixo:

1. **`prateleira_parede.png` (Prateleira Suspensa de Madeira 2×1)**:
   - *Prompt*: `"30-degree isometric wooden wall-mounted floating shelf (2 tiles wide, long side running from upper-left to lower-right matching balcao_reto angle), warm brown wood plank with two dark iron/wood support brackets underneath, completely EMPTY on top, thick #2A1D14 outlines, centered with generous margin on flat solid #FF00FF magenta background, no shadows."`
2. **`quadro_grao.png` e `lousa_parede.png` (Versões Alta Resolução Sem Corte — Ortográfico 2D)**:
   - *Prompt Quadro*: `"Flat front-on 2D orthographic framed café wall poster: warm wooden rectangular frame with cream mat board and a cute minimalist coffee bean illustration in the center, thick #2A1D14 outlines, centered with generous margin on flat solid #FF00FF magenta background."`
   - *Prompt Lousa*: `"Flat front-on 2D orthographic framed café menu chalkboard: warm wooden rectangular frame with dark slate board showing a cute white chalk steaming cup icon and menu lines, thick #2A1D14 outlines, centered with generous margin on flat solid #FF00FF magenta background."`
3. **`luminaria_teto.png` (Luminária Pendente Inteira Sem Corte)**:
   - *Prompt*: `"30-degree isometric vintage industrial café pendant ceiling lamp: round ceiling mount, thin vertical dark cord, dome-shaped bronze/charcoal shade, and warm glowing Edison bulb underneath, completely visible from top mount to bottom bulb with generous margin around all sides on flat solid #FF00FF magenta background, thick #2A1D14 outlines."`
4. **`insumo_graos_pacotes.png` (Pacote de Café + Pote de Grãos)**:
   - *Prompt*: `"30-degree isometric coffee beans set: one craft paper stand-up coffee bag with a small coffee bean emblem next to a clear glass airtight jar with a wooden lid filled with dark roasted coffee beans, thick #2A1D14 outlines, centered with generous margin on flat solid #FF00FF magenta background."`
5. **`deco_placa_cavalete.png` (Placa Cavalete de Chão 1×1)**:
   - *Prompt*: `"30-degree isometric 1x1 wooden A-frame sidewalk café chalkboard sign with a cute white chalk drawing of a steaming coffee cup, thick #2A1D14 outlines, centered with generous margin on flat solid #FF00FF magenta background."`

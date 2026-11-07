---
trigger: always_on
description: Padrões visuais, tipografia, paleta e regras de estilo do Brewer.
---

# Regras do Design System do Brewer

1. **Tokens de Cores e Temas**:
   - Sempre utilize as variáveis CSS declaradas no `:root` em `style.css`:
     - `--bg`: cor de fundo principal (ex: `#F6EFE4` no tema claro).
     - `--surface`: cor de cartões e superfícies destacadas (ex: `#FFFBF4`).
     - `--ink`: cor da tipografia e ícones ativos (`#2A1D14`).
     - `--muted`: cor de textos secundários e metadados (`#6B5848`).
     - `--line`: cor de bordas e divisores (`#E0D3C0`).
     - `--sea` e `--sun`: cores de destaque primário e secundário de ação.
   - O app suporta 10 fases de torra via atributo `body[data-theme="0"]` a `[data-theme="9"]` (da torra clara à escura). Mantenha sempre contraste de texto mínimo de 4.5:1.

2. **Tipografia Oficial**:
   - Títulos e destaques: `"Bricolage Grotesque"`, `sans-serif` (peso 600, 700 e 800).
   - Corpo, rótulos e botões: `"Figtree"`, `sans-serif` (peso 400, 500, 600).
   - Nunca insira fontes externas não declaradas no `index.html`.

3. **Responsividade e Formato Mobile-First**:
   - Todo layout deve ser projetado pensando no uso vertical em celulares (largura de tela até 440px com contêiner `.wrap` de até 520px).
   - Respeite as margens de segurança para iOS (`env(safe-area-inset-bottom)` e `env(safe-area-inset-top)`).

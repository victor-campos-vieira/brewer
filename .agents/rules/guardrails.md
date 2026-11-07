---
trigger: always_on
description: Regras de segurança para controle de versão, cache PWA e proteção do código de produção do Brewer.
---

# Regras de Segurança e Controle de Versão (Guardrails)

1. **Controle de Deploy (Git Push)**:
   - NUNCA realize `git push origin main` ou publique nada no repositório remoto sem que o usuário escreva explicitamente autorizando o envio.
   - Sempre certifique-se de que a árvore de trabalho (`git status`) está limpa e testada antes de sugerir o push.

2. **Gerenciamento do Cache PWA**:
   - Sempre que houver uma alteração destinada à produção (`index.html`, `js/*`, `style.css`), a versão do cache DEVE ser incrementada no Service Worker (`sw.js`, ex: `brewer-v35`) e sincronizada com as query strings dos assets no `index.html` (ex: `style.css?v=35`).
   - Sem essa sincronização, navegadores mobile (especialmente iOS Safari) continuam servindo a versão velha em cache.

3. **Ambiente Isolado para Ideação e Testes**:
   - Como o repositório é publicado diretamente no GitHub Pages a partir da branch `main`, qualquer teste visual em andamento deve ser desenvolvido em uma branch de funcionalidade (`feature/...`).
   - Somente após validação completa e aprovação do usuário na branch de teste é que o merge para `main` é realizado.

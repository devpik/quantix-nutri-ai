# Relatório de Viabilidade e Roadmap de Lançamento

## 1. Lançamento nas Lojas (Android, iOS/Mac)

### Android (Google Play Store)
**Caminho:** Trusted Web Activity (TWA).
**Viabilidade:** Alta.
**Esforço:** Baixo/Médio.

*   **Tecnologia:** O Google recomenda o uso de TWAs para publicar PWAs na Play Store. Isso envolve "envelopar" a aplicação web existente em um container nativo leve.
*   **Ferramentas:** `Bubblewrap` (CLI do Google) ou PWABuilder.
*   **Requisitos Atuais:**
    *   O `manifest.json` precisa estar completo (ícones, cores, escopo).
    *   O site precisa ser servido via HTTPS (já atendido pelo GitHub Pages).
    *   Necessário criar uma conta de desenvolvedor na Play Console (taxa única de $25).
    *   Configurar o `assetlinks.json` no domínio para provar propriedade.

### iOS (App Store) & Mac
**Caminho:** Capacitor ou Cordova.
**Viabilidade:** Média.
**Esforço:** Médio/Alto.

*   **Tecnologia:** A Apple não aceita TWAs. É necessário usar um framework como o **Capacitor** (recomendado) para criar um projeto Xcode nativo que carrega a aplicação web em uma WebView (WKWebView).
*   **Requisitos:**
    *   Mac com Xcode instalado para compilar o app.
    *   Conta Apple Developer (taxa anual de $99).
    *   Adaptações no código para lidar com a "Safe Area" do iPhone (o "notch") e gestos de voltar nativos.
*   **Mac App Store:** O projeto do Capacitor pode ser configurado para compilar também para macOS (Mac Catalyst ou Electron), permitindo a publicação na loja de desktop.

---

## 2. Internacionalização (Multi-língua / i18n)

**Status Atual:** Strings "hardcoded" (fixas) em Português espalhadas por `index.html`, `js/app.js`, `js/ui/*.js`.
**Caminho:** Implementação de Sistema de Locales.
**Esforço:** Médio (Trabalhoso, mas tecnicamente simples).

### Plano de Ação:
1.  **Extração:** Criar arquivos de dicionário, ex: `js/lang/pt-BR.js` e `js/lang/en-US.js`.
2.  **Helper:** Criar uma classe utilitária `I18n.t('chave')` que busca o texto baseada na língua do navegador (`navigator.language`).
3.  **Refatoração:** Substituir todo texto fixo no código por chamadas a esse helper.
    *   *Ex:* De `<h1>Diário</h1>` para `<h1 data-i18n="tracker.title"></h1>`.
4.  **Automação:** Atualizar a UI automaticamente quando a língua mudar.

**Estimativa:** 3 a 5 dias de trabalho focado para cobrir todo o app.

---

## 3. Monetização e Sistema de Créditos

**Status Atual:** Cliente-Side (Inseguro para monetização).
*   Atualmente, os dados ficam no `localStorage`.
*   A API Key é inserida pelo usuário (Modelo "Traga sua própria chave").

**Desafio:** Para vender créditos, você não pode pedir que o usuário traga a chave dele, nem pode confiar no navegador para contar os créditos (o usuário poderia limpar o cache e "zerar" a contagem).

### Arquitetura Necessária (Backend as a Service)

Para implementar um plano Grátis vs Premium seguro, é obrigatória uma migração de arquitetura:

1.  **Backend (Firebase / Supabase):**
    *   Necessário para autenticação de usuários (Login/Senha ou Social).
    *   Banco de dados na nuvem para persistir o saldo de créditos do usuário de forma segura.

2.  **Proxy de API:**
    *   O Frontend não chamaria mais o Google Gemini diretamente.
    *   O Frontend chamaria seu Backend (ex: `POST /api/analyze`).
    *   O Backend verifica se o usuário tem créditos.
    *   Se tiver, o Backend chama o Gemini (usando SUA chave corporativa paga/gerenciada) e desconta o crédito do usuário.
    *   Retorna o resultado para o frontend.

3.  **Integração de Pagamento:**
    *   Integração com Stripe, RevenueCat ou Google Play Billing para vender pacotes de créditos.

**Viabilidade:** Alta, mas requer reescrita da camada de dados (`js/data/database.js` e `js/services/api.js`) e introdução de um servidor/cloud functions.

---

## Resumo das Dificuldades

| Funcionalidade | Dificuldade Técnica | Custo Financeiro | Principal Obstáculo |
| :--- | :--- | :--- | :--- |
| **Android App** | Baixa | $25 (Conta Google) | Configurar assinatura digital e AssetLinks. |
| **iOS App** | Média | $99/ano (Apple) | Exige um Mac para compilar e diretrizes rígidas de design da Apple. |
| **Multi-língua** | Baixa (Repetitivo) | $0 | Tempo para extrair todas as strings manualmente. |
| **Monetização** | Alta (Arquitetura) | Custos de Servidor/API | Migrar de LocalStorage para Backend Seguro (Cloud). |

## Recomendação de Próximos Passos

1.  **Preparação PWA (Imediato):** Refinar o `manifest.json` para garantir que o app seja instalável e pareça nativo.
2.  **Estrutura i18n (Curto Prazo):** Começar a extrair as strings para facilitar a entrada em novos mercados.
3.  **Protótipo de Backend (Médio Prazo):** Se a monetização for prioridade, iniciar um projeto no Firebase para migrar a autenticação e contagem de tokens antes de lançar nas lojas.

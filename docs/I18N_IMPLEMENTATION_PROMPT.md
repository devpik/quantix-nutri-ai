# Prompt para Implementação de Sistema de Internacionalização (i18n)

**Contexto:**
Você é um Engenheiro de Software Sênior trabalhando no projeto "QuantixNutri Ultimate AI". O projeto é um PWA construído com Vanilla JavaScript (ES Modules), HTML5 e Tailwind CSS. Atualmente, todos os textos da interface estão "hardcoded" em Português (pt-BR) diretamente no HTML e nos arquivos JavaScript.

**Objetivo:**
Implementar um sistema de Internacionalização (i18n) robusto, escalável e leve, permitindo que o aplicativo suporte múltiplos idiomas (inicialmente `pt-BR` e `en-US`), com detecção automática do idioma do navegador e persistência da preferência do usuário.

**Arquitetura Solicitada:**

1.  **Serviço de Tradução (`js/services/i18n.js`):**
    *   Deve ser um objeto ou classe estática (Singleton) acessível globalmente (`window.I18n`).
    *   **Propriedades:**
        *   `locale`: Armazena o idioma atual (ex: 'pt-BR').
        *   `translations`: Objeto que armazena os dicionários carregados.
    *   **Métodos:**
        *   `init()`: Detecta o idioma do usuário (`navigator.language` ou `localStorage`), carrega o dicionário apropriado e inicia a tradução da página.
        *   `t(key)`: Recebe uma chave (string) e retorna o texto traduzido. Deve suportar chaves aninhadas (opcional) ou planas (ex: 'header.title'). Se a chave não existir, retorna a própria chave como fallback.
        *   `setLocale(lang)`: Alterna o idioma, salva no `localStorage` e recarrega as traduções na interface.
        *   `translatePage()`: Percorre o DOM buscando elementos com o atributo `data-i18n` e atualiza seu conteúdo (`innerText` ou `placeholder`).

2.  **Dicionários de Idioma (`js/lang/*.js`):**
    *   Criar arquivos separados para cada idioma (ex: `js/lang/pt-BR.js`, `js/lang/en-US.js`).
    *   Cada arquivo deve exportar um objeto constante contendo o mapeamento `chave: "Valor Texto"`.
    *   **Estrutura de Chaves Sugerida:**
        *   `app.*`: Nome do app e sufixos.
        *   `header.*`: Textos do cabeçalho.
        *   `tab.*`: Nomes das abas (Diário, Análise, etc.).
        *   `tracker.*`: Textos da tela principal.
        *   `analytics.*`: Textos dos gráficos.
        *   `profile.*`: Rótulos do perfil.
        *   `modal.*`: Textos de modais (API Key, Adicionar Alimento).
        *   `alert.*`: Mensagens de erro e confirmação do JS.

3.  **Refatoração do HTML (`index.html`):**
    *   Substituir os textos fixos por atributos `data-i18n="chave.do.texto"`.
    *   Importar o script `js/services/i18n.js` como módulo antes do `app.js`.

4.  **Refatoração do JavaScript (`js/app.js`, `js/ui/*.js`):**
    *   Substituir strings hardcoded em `alert()`, `confirm()` e gerações dinâmicas de DOM pela função `I18n.t("chave")`.

**Passo a Passo da Execução:**

1.  **Criação dos Arquivos de Idioma:**
    *   Extraia *todo* o texto visível do `index.html` para o arquivo `js/lang/pt-BR.js`.
    *   Crie o arquivo `js/lang/en-US.js` com as traduções correspondentes em Inglês.

2.  **Implementação do Core:**
    *   Escreva o `js/services/i18n.js` importando os dicionários criados.

3.  **Atualização da Interface:**
    *   Modifique o `index.html` para usar `data-i18n`.
    *   No `index.html`, adicione um bloco `<script type="module">` que importa `I18n` e o expõe no `window` para depuração, se necessário.

4.  **Inicialização:**
    *   No método `App.init()` em `js/app.js`, chame `I18n.init()` antes de qualquer renderização de interface.
    *   Configure bibliotecas de terceiros (como `moment.js`) para usar o locale definido pelo `I18n`.

**Critérios de Aceite:**
*   O app deve carregar em Inglês se o navegador estiver em Inglês, ou Português caso contrário (fallback para pt-BR).
*   Deve ser possível trocar o idioma via console (`I18n.setLocale('en-US')`) e a interface atualizar instantaneamente (ou após reload).
*   Nenhum texto visível deve restar "hardcoded" no HTML principal.

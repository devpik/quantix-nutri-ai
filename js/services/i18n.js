import ptBR from '../lang/pt-BR.js';
import enUS from '../lang/en-US.js';

export const I18n = {
    locale: 'pt-BR',
    translations: {
        'pt-BR': ptBR,
        'en-US': enUS
    },

    init: () => {
        // Detect language
        const stored = localStorage.getItem('quantix_lang');
        if (stored) {
            I18n.locale = stored;
        } else {
            const navLang = navigator.language || navigator.userLanguage;
            if (navLang.startsWith('en')) {
                I18n.locale = 'en-US';
            } else {
                I18n.locale = 'pt-BR'; // Default
            }
        }

        console.log(`[I18n] Initialized with locale: ${I18n.locale}`);
        I18n.translatePage();
    },

    t: (key, params = {}) => {
        const keys = key.split('.');
        let value = I18n.translations[I18n.locale];

        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                // Fallback to pt-BR if not found in current locale
                if (I18n.locale !== 'pt-BR') {
                    let fallback = I18n.translations['pt-BR'];
                    for (const fk of keys) {
                        if (fallback && fallback[fk]) {
                            fallback = fallback[fk];
                        } else {
                            return key;
                        }
                    }
                    value = fallback;
                    break;
                } else {
                    return key;
                }
            }
        }

        if (typeof value !== 'string') return key;

        // Replace params
        Object.keys(params).forEach(p => {
            value = value.replace(`{${p}}`, params[p]);
        });

        return value;
    },

    setLocale: (lang) => {
        if (!I18n.translations[lang]) {
            console.error(`[I18n] Locale ${lang} not supported.`);
            return;
        }
        I18n.locale = lang;
        localStorage.setItem('quantix_lang', lang);
        I18n.translatePage();

        // Update moment locale if loaded
        if (window.moment) {
            window.moment.locale(lang === 'pt-BR' ? 'pt-br' : 'en');
        }
    },

    translatePage: () => {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = I18n.t(key);

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translation;
            } else {
                // Preserve child elements (like icons) if specific attribute is not target
                // Ideally, we should wrap text in spans or be careful.
                // For this implementation, I'll assume textContent is safe or specific handling.
                // If the element has children (icons), we might lose them if we just set innerText.
                // A simple strategy: check if it has children. If only text, replace text.
                // If it has children, maybe we shouldn't use simple data-i18n on the parent container
                // but on the specific text node or span.
                // However, for placeholders it's easy.

                // Let's look at index.html content.
                // Example: <h1 ...>Quantix<span ...>AI</span></h1> -> This is tricky.
                // The key `app.name` is "Quantix". The span is separate.
                // I should only put data-i18n on the text elements.

                el.innerText = translation;
            }
        });
    }
};

window.I18n = I18n; // Expose globally

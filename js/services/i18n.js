import { ptBR } from '../lang/pt-BR.js';
import { enUS } from '../lang/en-US.js';

export const I18n = {
    locale: 'pt-BR',
    translations: {
        'pt-BR': ptBR,
        'en-US': enUS
    },

    init: () => {
        // Detect language or load from storage
        const stored = localStorage.getItem('language');
        if (stored) {
            I18n.locale = stored;
        } else {
            const navLang = navigator.language;
            if (navLang.startsWith('en')) I18n.locale = 'en-US';
            else I18n.locale = 'pt-BR';
        }

        console.log(`[I18n] Initialized with locale: ${I18n.locale}`);
        I18n.translatePage();
    },

    t: (key) => {
        const dict = I18n.translations[I18n.locale] || I18n.translations['pt-BR'];
        return dict[key] || key;
    },

    setLocale: (lang) => {
        if (!I18n.translations[lang]) return;
        I18n.locale = lang;
        localStorage.setItem('language', lang);
        I18n.translatePage();
        // Trigger UI refresh if needed (e.g. re-render charts)
        if (window.App && typeof window.App.refreshUI === 'function') {
            window.App.refreshUI();
        }
        if (window.Analytics && typeof window.Analytics.render === 'function') {
            window.Analytics.render();
        }
    },

    translatePage: () => {
        // Translate elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = I18n.t(key);

            // Handle input placeholders
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = translation;
            } else {
                el.innerText = translation;
            }
        });
    }
};

window.I18n = I18n;

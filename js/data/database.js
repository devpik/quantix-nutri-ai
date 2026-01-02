import { CONFIG } from '../config.js';

// Banco de dados offline para sugestões rápidas (Top Alimentos Brasileiros)
export const OFFLINE_FOOD_DB = [
    { desc: "Café Preto (Sem Açúcar)", cals: 2, p: 0, c: 0, f: 0, fib: 0, cat: "Café da Manhã" },
    { desc: "Pão Francês (1 un)", cals: 135, p: 4, c: 26, f: 1, fib: 1, cat: "Café da Manhã" },
    { desc: "Ovo Cozido", cals: 70, p: 6, c: 0, f: 5, fib: 0, cat: "Café da Manhã" },
    { desc: "Tapioca com Manteiga", cals: 250, p: 1, c: 40, f: 8, fib: 0, cat: "Café da Manhã" },
    { desc: "Banana Prata", cals: 60, p: 1, c: 15, f: 0, fib: 2, cat: "Lanche" },
    { desc: "Arroz Branco (100g)", cals: 130, p: 2, c: 28, f: 0, fib: 0, cat: "Almoço" },
    { desc: "Feijão Carioca (100g)", cals: 76, p: 5, c: 14, f: 0, fib: 8, cat: "Almoço" },
    { desc: "Filé de Frango Grelhado (100g)", cals: 160, p: 32, c: 0, f: 3, fib: 0, cat: "Almoço" },
    { desc: "Whey Protein (Dose)", cals: 120, p: 24, c: 3, f: 1, fib: 0, cat: "Lanche" },
    { desc: "Salada de Alface/Tomate", cals: 30, p: 1, c: 5, f: 0, fib: 3, cat: "Almoço" }
];

// =========================================================================
// 2. DATABASE ENGINE (LOCAL STORAGE WRAPPER)
// =========================================================================
export const DB = {
    // Core helpers
    get: (key, defaultVal) => {
        try {
            const item = localStorage.getItem(CONFIG.dbPrefix + key);
            return item ? JSON.parse(item) : defaultVal;
        } catch (e) { console.error("DB Read Error", e); return defaultVal; }
    },
    set: (key, val) => {
        try {
            localStorage.setItem(CONFIG.dbPrefix + key, JSON.stringify(val));
        } catch (e) { console.error("DB Write Error", e); alert("Memória cheia! Limpe dados."); }
    },

    getTodayKey: () => moment().format('YYYY-MM-DD'), // Usa Moment.js para robustez

    // --- Models ---

    getProfile: () => {
        const p = DB.get('profile', {
            name: '', weight: 70, height: 170, age: 30, gender: 'male',
            target: 2000, fiberTarget: 25, strategy: 'balanced',
            microTargets: { sodium: 2300, sugar: 50, vitamins: { a: 100, c: 100, d: 100 } },
            customMacros: { p: 30, c: 40, f: 30 }, credits: 50, xp: 0,
            level: 1, badges: [], weightHistory: [], measurementsHistory: [], onboardingDone: false
        });
        if (!p.microTargets) p.microTargets = { sodium: 2300, sugar: 50, vitamins: { a: 100, c: 100, d: 100 } };
        if (!p.measurementsHistory) p.measurementsHistory = [];
        if (!p.weightHistory) p.weightHistory = [];
        return p;
    },

    getMeals: () => DB.get('meals', []),
    // Structure: { id, timestamp, dateKey, desc, cals, macros: {p,c,f,fib}, category, type: 'food'|'exercise', score }

    getDayStats: () => {
        const today = DB.getTodayKey();
        const allStats = DB.get('day_stats', {});
        if (!allStats[today]) {
            allStats[today] = {
                water: 0,
                fastingStart: null,
                fastingEnd: null,
                notes: "",
                mood: "neutral"
            };
        }
        return allStats;
    },

    getStreak: () => DB.get('streak', { current: 0, lastLogin: null, max: 0 })
};

import { DB } from '../data/database.js';
import { Gamification } from './gamification.js';
import { App } from '../app.js';

// =========================================================================
// 4. PROFILE & CALCULATOR LOGIC
// =========================================================================
export const Profile = {
    calculateMacros: () => {
        const p = DB.getProfile();

        // 1. Calculate BMR (Mifflin-St Jeor) if target is auto (logic could be added),
        // but here we trust the user set target or default 2000.

        // 2. Define Percentages
        let ratios = { p: 0.30, c: 0.40, f: 0.30 }; // Balanced Default

        if (p.strategy === 'lowcarb') ratios = { p: 0.45, c: 0.15, f: 0.40 };
        else if (p.strategy === 'ketogenic') ratios = { p: 0.25, c: 0.05, f: 0.70 };
        else if (p.strategy === 'custom') {
            ratios.p = p.customMacros.p / 100;
            ratios.c = p.customMacros.c / 100;
            ratios.f = p.customMacros.f / 100;
        }

        // 3. Convert to Grams
        // Protein & Carb = 4kcal/g, Fat = 9kcal/g
        const grams = {
            p: Math.round((p.target * ratios.p) / 4),
            c: Math.round((p.target * ratios.c) / 4),
            f: Math.round((p.target * ratios.f) / 9),
            fib: p.fiberTarget || 25
        };

        return grams;
    },

    updateBMI: () => {
        const w = parseFloat(document.getElementById('prof-weight').value) || 0;
        const h = parseFloat(document.getElementById('prof-height').value) || 0;

        if (w > 0 && h > 0) {
            const bmi = w / Math.pow(h/100, 2);
            const valEl = document.getElementById('bmi-value-text');
            const classEl = document.getElementById('bmi-classification');

            valEl.innerText = bmi.toFixed(1);

            let label = "";
            let colorClass = "";

            if (bmi < 18.5) {
                label = "Abaixo do Peso";
                colorClass = "text-blue-500";
            } else if (bmi < 24.9) {
                label = "Peso Normal";
                colorClass = "text-green-500";
            } else if (bmi < 29.9) {
                label = "Sobrepeso";
                colorClass = "text-yellow-500";
            } else {
                label = "Obesidade";
                colorClass = "text-red-500";
            }

            classEl.innerText = label;
            classEl.className = `text-center text-xs font-bold mt-2 ${colorClass}`;
            valEl.className = `text-xs font-black ${colorClass}`;
        }
    },

    save: (trackWeight = false) => {
        const p = DB.getProfile();

        // Get inputs
        p.name = document.getElementById('prof-name').value;
        p.weight = parseFloat(document.getElementById('prof-weight').value) || p.weight;
        p.height = parseFloat(document.getElementById('prof-height').value) || p.height;
        p.age = parseFloat(document.getElementById('prof-age').value) || p.age;
        p.gender = document.getElementById('prof-gender').value;
        p.strategy = document.getElementById('prof-strategy').value;
        p.target = parseFloat(document.getElementById('prof-target').value) || 2000;
        p.fiberTarget = parseFloat(document.getElementById('prof-fiber').value) || 25;
        // No input for API Key in profile, it is hardcoded or from localstorage default

        // Custom Macros
        if (p.strategy === 'custom') {
            p.customMacros.p = parseFloat(document.getElementById('cus-p').value) || 30;
            p.customMacros.c = parseFloat(document.getElementById('cus-c').value) || 40;
            p.customMacros.f = parseFloat(document.getElementById('cus-f').value) || 30;
        }

        // Weight History
        if (trackWeight) {
            const today = DB.getTodayKey();
            // Remove entry if exists for today to update it
            p.weightHistory = p.weightHistory.filter(h => h.date !== today);
            p.weightHistory.push({ date: today, weight: p.weight });
            p.weightHistory.sort((a,b) => moment(a.date).diff(moment(b.date)));
        }

        // Measurements History
        if (trackWeight) {
            const today = DB.getTodayKey();
            const waist = parseFloat(document.getElementById('prof-waist').value) || null;
            const hip = parseFloat(document.getElementById('prof-hip').value) || 0;
            const fat = parseFloat(document.getElementById('prof-fat').value) || 0;
            p.measurementsHistory = (p.measurementsHistory || []).filter(h => h.date !== today);
            p.measurementsHistory.push({ date: today, waist, hip, fatPct: fat });
        }

        // Removed manual API key saving from UI for now as it is injected.

        DB.set('profile', p);
        Gamification.updateUI(); // Header update
        App.refreshUI(); // Will be defined in Part 4
        alert("Perfil salvo com sucesso!");
    },

    toggleCustomMacros: () => {
        const strat = document.getElementById('prof-strategy').value;
        const area = document.getElementById('custom-macros-area');
        if (strat === 'custom') area.classList.remove('hidden');
        else area.classList.add('hidden');
    },

    loadToUI: () => {
        const p = DB.getProfile();
        document.getElementById('prof-name').value = p.name || '';
        document.getElementById('prof-weight').value = p.weight;
        document.getElementById('prof-height').value = p.height;
        document.getElementById('prof-age').value = p.age;
        document.getElementById('prof-gender').value = p.gender;
        document.getElementById('prof-strategy').value = p.strategy;
        document.getElementById('prof-target').value = p.target;
        document.getElementById('prof-fiber').value = p.fiberTarget;

        document.getElementById('cus-p').value = p.customMacros.p;
        document.getElementById('cus-c').value = p.customMacros.c;
        document.getElementById('cus-f').value = p.customMacros.f;

        // Notifications UI
        const notifBtn = document.getElementById('btn-notif-toggle');
        const notifDot = document.getElementById('notif-toggle-dot');
        notifBtn.classList.toggle('bg-brand-500', p.notificationsEnabled);
        notifDot.style.transform = p.notificationsEnabled ? 'translateX(16px)' : 'translateX(0)';

        // API Usage UI
        const usage = p.apiUsage || { totalTokens: 0, totalRequests: 0 };
        document.getElementById('api-requests').innerText = usage.totalRequests;
        document.getElementById('api-tokens').innerText = usage.totalTokens.toLocaleString();

        const today = DB.getTodayKey();
        const mHistory = p.measurementsHistory || [];
        const mEntry = mHistory.find(h => h.date === today) || mHistory[mHistory.length - 1] || {};
        document.getElementById('prof-waist').value = mEntry.waist || '';
        document.getElementById('prof-hip').value = mEntry.hip || '';
        document.getElementById('prof-fat').value = mEntry.fatPct || '';

        Profile.toggleCustomMacros();
        Profile.updateBMI();
    },

    updateApiUsage: (metadata) => {
        console.log("Gemini API Usage Stats:", metadata);
        const p = DB.getProfile();
        if (!p.apiUsage) p.apiUsage = { totalTokens: 0, totalRequests: 0 };
        p.apiUsage.totalRequests += 1;
        if (metadata) {
            const count = metadata.totalTokenCount || metadata.total_token_count || 0;
            p.apiUsage.totalTokens += count;
        }
        DB.set('profile', p);
        // Força atualização visual se a aba de perfil estiver aberta
        Profile.loadToUI();
    }
};

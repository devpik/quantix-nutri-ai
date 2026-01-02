
    // =========================================================================
    // 1. SYSTEM CONFIGURATION & OFFLINE DB
    // =========================================================================
    const CONFIG = {
        apiKey: localStorage.getItem('quantix_ultimate_v2_api_key'),
        dbPrefix: "quantix_ultimate_v2_",
        version: "2.0.0"
    };

    // Banco de dados offline para sugestões rápidas (Top Alimentos Brasileiros)
    const OFFLINE_FOOD_DB = [
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
    const DB = {
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
                customMacros: { p: 30, c: 40, f: 30 }, credits: 50, xp: 0,
                level: 1, badges: [], weightHistory: [], measurementsHistory: [], onboardingDone: false
            });
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

    // =========================================================================
    // 3. GAMIFICATION ENGINE (RPG LOGIC)
    // =========================================================================
    const Gamification = {
        levels: [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 5000], // XP Table

        addXP: (amount) => {
            const p = DB.getProfile();
            const oldLevel = p.level;
            p.xp += amount;

            // Check Level Up
            const nextLevelXP = Gamification.levels[p.level] || 999999;
            if (p.xp >= nextLevelXP) {
                p.level++;
                p.credits += 5; // Reward
                Gamification.showLevelUpModal(p.level);
            }
            DB.set('profile', p);
            Gamification.updateUI();
        },

        showLevelUpModal: (lvl) => {
            alert(`🎉 LEVEL UP! Você alcançou o Nível ${lvl} e ganhou +5 Créditos IA!`);
        },

        checkStreak: () => {
            const s = DB.getStreak();
            const today = DB.getTodayKey();
            const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');

            if (s.lastLogin !== today) {
                if (s.lastLogin === yesterday) {
                    s.current++;
                } else {
                    s.current = 1; // Reset se pulou um dia
                }
                s.max = Math.max(s.current, s.max);
                s.lastLogin = today;
                DB.set('streak', s);
                Gamification.addXP(10); // Daily Login XP
            }
        },

        checkBadges: () => {
            const p = DB.getProfile();
            const meals = DB.getMeals();
            const streak = DB.getStreak();
            const newBadges = [];

            const rules = [
                { id: 'first_step', icon: 'fa-shoe-prints', name: 'Primeiro Passo', check: () => meals.length >= 1 },
                { id: 'water_master', icon: 'fa-tint', name: 'Hidratado', check: () => DB.getDayStats()[DB.getTodayKey()].water >= 2500 },
                { id: 'streak_3', icon: 'fa-fire', name: 'Focado (3 Dias)', check: () => streak.current >= 3 },
                { id: 'streak_7', icon: 'fa-fire-alt', name: 'Imparável (7 Dias)', check: () => streak.current >= 7 },
                { id: 'expert', icon: 'fa-brain', name: 'Nutri Expert', check: () => meals.length >= 50 }
            ];

            rules.forEach(r => {
                if (r.check() && !p.badges.includes(r.id)) {
                    p.badges.push(r.id);
                    newBadges.push(r.name);
                    Gamification.addXP(50);
                }
            });

            if (newBadges.length > 0) {
                DB.set('profile', p);
                alert(`🏆 Novas Conquistas: ${newBadges.join(', ')}`);
                Gamification.updateUI();
            }
        },

        updateUI: () => {
            const p = DB.getProfile();
            document.getElementById('user-level-badge').innerText = `LVL ${p.level}`;
            document.getElementById('profile-subtitle').innerText = `Nutri Explorer • Nível ${p.level} • ${p.xp} XP`;

            // Name Header
            const headerName = document.getElementById('header-username');
            if(p.name) headerName.innerHTML = `Olá, ${p.name.split(' ')[0]}`;
            else headerName.innerHTML = `Quantix<span class="text-brand-500">AI</span>`;

            // XP Bar Calc
            const currentLevelBase = Gamification.levels[p.level - 1] || 0;
            const nextLevelReq = Gamification.levels[p.level] || (currentLevelBase + 1000);
            const progress = ((p.xp - currentLevelBase) / (nextLevelReq - currentLevelBase)) * 100;
            document.getElementById('xp-bar').style.width = `${Math.min(progress, 100)}%`;

            // Streak & Credits
            document.getElementById('streak-display').innerText = DB.getStreak().current;
            document.getElementById('credits-display').innerText = p.credits;

            // Render Badges in Profile
            const badgeContainer = document.getElementById('badges-grid');
            badgeContainer.innerHTML = '';

            const allBadgesDef = [
                { id: 'first_step', icon: 'fa-shoe-prints', name: 'Início' },
                { id: 'water_master', icon: 'fa-tint', name: 'Hidratado' },
                { id: 'streak_3', icon: 'fa-fire', name: 'Focado' },
                { id: 'streak_7', icon: 'fa-fire-alt', name: 'Imparável' },
                { id: 'expert', icon: 'fa-brain', name: 'Expert' }
            ];

            allBadgesDef.forEach(b => {
                const earned = p.badges.includes(b.id);
                const el = document.createElement('div');
                el.className = `flex flex-col items-center min-w-[70px] p-2 rounded-2xl border ${earned ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20' : 'bg-gray-50 border-gray-100 grayscale opacity-40 dark:bg-gray-800'}`;
                el.innerHTML = `
                    <div class="w-8 h-8 rounded-full ${earned ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-200 text-gray-400'} flex items-center justify-center mb-1">
                        <i class="fas ${b.icon}"></i>
                    </div>
                    <span class="text-[9px] font-bold uppercase truncate w-full text-center">${b.name}</span>
                `;
                badgeContainer.appendChild(el);
            });
        }
    };

    // =========================================================================
    // 4. PROFILE & CALCULATOR LOGIC
    // =========================================================================
    const Profile = {
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
        }
    };

    // =========================================================================
    // 5. INPUT HELPER (UI LOGIC)
    // =========================================================================
    const Input = {
        mode: 'ai', // ai, manual, exercise
        cat: 'Café da Manhã',

        setMode: (m) => {
            Input.mode = m;
            // UI Toggle
            ['ai', 'manual', 'exercise'].forEach(type => {
                const btn = document.getElementById(`btn-mode-${type}`);
                const area = document.getElementById(`inp-area-${type}`);

                if (type === m) {
                    btn.classList.add('bg-brand-500', 'text-white');
                    btn.classList.remove('bg-gray-100', 'text-gray-500', 'bg-blue-50', 'text-blue-500');
                    area.classList.remove('hidden');
                    area.classList.add('animate-fade-in');
                } else {
                    btn.classList.remove('bg-brand-500', 'text-white');
                    btn.classList.add('bg-gray-100', 'text-gray-500');
                    area.classList.add('hidden');
                    area.classList.remove('animate-fade-in');
                }
            });

            // Special styling for Exercise button
            if (m !== 'exercise') {
                document.getElementById('btn-mode-exercise').classList.add('text-blue-500', 'border-blue-100', 'bg-blue-50');
                document.getElementById('btn-mode-exercise').classList.remove('bg-gray-100', 'text-gray-500');
            }
        },

        setCat: (c) => {
            Input.cat = c;
            // Update Chips UI
            document.querySelectorAll('.cat-chip').forEach(el => {
                if (el.innerText.includes(c.split(' ')[0])) { // Simple matching
                    el.classList.add('active', 'bg-brand-100', 'text-brand-700', 'border-brand-200');
                    el.classList.remove('bg-gray-100');
                } else {
                    el.classList.remove('active', 'bg-brand-100', 'text-brand-700', 'border-brand-200');
                    el.classList.add('bg-gray-100');
                }
            });
        }
    };
// =========================================================================
    // 6. MAIN APP CONTROLLER
    // =========================================================================
    const App = {
        init: () => {
            moment.locale('pt-br');
            // Register PWA Service Worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('sw.js').catch(err => console.log("SW error", err));
            }

            // Load Settings
            if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark');

            // Check API Key
            if (!CONFIG.apiKey) {
                setTimeout(() => Modal.open('apikey'), 1000);
            }

            // Render Quick Adds (Offline DB)
            const quickContainer = document.getElementById('quick-add-container');
            OFFLINE_FOOD_DB.forEach(item => {
                const btn = document.createElement('button');
                btn.className = "flex-shrink-0 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-[10px] font-bold shadow-sm hover:border-brand-500 transition text-left";
                btn.innerHTML = `<span class="block text-gray-800 dark:text-gray-200">${item.desc}</span><span class="text-xs text-brand-500">${item.cals} kcal</span>`;
                btn.onclick = () => {
                    App.addMealToDB({ ...item, type: 'food', category: Input.cat, timestamp: Date.now(), macros: {p: item.p, c: item.c, f: item.f, fib: item.fib} });
                    Modal.close('add-food');
                };
                quickContainer.appendChild(btn);
            });

            // ONBOARDING CHECK (Vanilla)
            const p = DB.getProfile();
            if (!p.onboardingDone) {
                document.getElementById('onboarding-overlay').classList.remove('hidden');
                document.getElementById('onboarding-overlay').classList.add('flex');
            }

            Profile.loadToUI();
            Gamification.updateUI();
            App.refreshUI();

            // Start Reminders
            App.scheduleReminders();

            // Ticker for fasting
            setInterval(() => {
                const stats = DB.getDayStats(); const today = DB.getTodayKey();
                if(stats[today] && stats[today].fastingStart) App.refreshUI();
            }, 1000);

            // Event Listener para fechar modal com ESC
            document.addEventListener('keydown', (e) => { if(e.key === 'Escape') Modal.closeAll(); });
        },

        saveApiKey: () => {
            const key = document.getElementById('inp-apikey').value;
            if (key && key.trim() !== "") {
                localStorage.setItem('quantix_ultimate_v2_api_key', key.trim());
                alert("API Key salva com sucesso! O aplicativo será recarregado.");
                location.reload();
            } else {
                alert("Por favor, insira uma chave válida.");
            }
        },

        // --- ONBOARDING LOGIC ---
        finishOnboarding: () => {
            const name = document.getElementById('onb-name').value;
            const w = document.getElementById('onb-weight').value;
            const h = document.getElementById('onb-height').value;
            const age = document.getElementById('onb-age').value;
            const target = document.getElementById('onb-target').value;

            if(!name || !w || !h || !age) return alert("Por favor, preencha todos os campos.");

            const p = DB.getProfile();
            p.name = name;
            p.weight = parseFloat(w);
            p.height = parseFloat(h);
            p.age = parseFloat(age);
            p.target = parseFloat(target) || 2000;
            p.onboardingDone = true;

            DB.set('profile', p);

            // Hide Overlay
            document.getElementById('onboarding-overlay').classList.add('hidden');
            document.getElementById('onboarding-overlay').classList.remove('flex');

            // Refresh UI
            Profile.loadToUI();
            Gamification.updateUI();
            App.refreshUI();
        },

        toggleTheme: () => {
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        },

        switchTab: (tabId) => {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById('tab-' + tabId).classList.remove('hidden');
            document.getElementById('tab-' + tabId).classList.add('animate-fade-in');

            // Update Nav Icons
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            const index = ['tracker', 'analytics', 'profile'].indexOf(tabId);
            document.querySelectorAll('.nav-item')[index].classList.add('active');

            // Render Analytics only if requested (save performance)
            if (tabId === 'analytics') Analytics.render();
            if (tabId === 'profile') Profile.loadToUI();
            // Scroll to top
            document.getElementById('main-scroll').scrollTop = 0;
        },

        // --- CORE: DATA REFRESH ---
        refreshUI: () => {
            if (!App.macroChart) App.initMacroChart();
            const today = DB.getTodayKey();
            const p = DB.getProfile();
            const stats = DB.getDayStats()[today] || { water: 0, fastingStart: null };
            const meals = DB.getMeals().filter(m => m.dateKey === today);

            // 1. Calculate Totals
            let sum = { cals: 0, p: 0, c: 0, f: 0 };
            let burned = 0;

            meals.forEach(m => {
                if (m.type === 'exercise') {
                    burned += m.cals;
                } else {
                    sum.cals += m.cals;
                    sum.p += m.macros.p;
                    sum.c += m.macros.c;
                    sum.f += m.macros.f;
                }
            });

            // 2. Hero Dashboard Updates
            const goals = Profile.calculateMacros();
            const netCals = sum.cals - burned;
            const remaining = p.target - netCals;

            // Animate Numbers
            document.getElementById('hero-cals-left').innerText = Math.round(remaining);
            document.getElementById('hero-target').innerText = p.target;

            App.updateMacroChart(sum.p, sum.c, sum.f);

            // Color Logic for Remaining
            const elRem = document.getElementById('hero-cals-left');
            if (remaining < 0) elRem.className = "text-4xl font-black text-red-500 tracking-tighter";
            else elRem.className = "text-4xl font-black text-gray-800 dark:text-white tracking-tighter";

            // Update Bars
            const updateBar = (id, val, max) => {
                const pct = Math.min((val / max) * 100, 100);
                document.getElementById(`bar-macro-${id}`).style.width = `${pct}%`;
                document.getElementById(`lbl-macro-${id}`).innerText = `${val}/${max}g`;
            };
            updateBar('p', sum.p, goals.p);
            updateBar('c', sum.c, goals.c);
            updateBar('f', sum.f, goals.f);

            // 3. Water & Fasting
            document.getElementById('water-val').innerText = stats.water + 'ml';
            document.getElementById('water-bar-mini').style.width = Math.min((stats.water / 2500) * 100, 100) + '%';

            const fastStatus = document.getElementById('fasting-state-text');
            if (stats.fastingStart) {
                fastStatus.innerText = "ON";
                fastStatus.className = "text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded animate-pulse";
                // Timer Logic
                const diff = Math.floor((Date.now() - stats.fastingStart) / 1000);
                const h = String(Math.floor(diff / 3600)).padStart(2, '0');
                const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
                const s = String(diff % 60).padStart(2, '0');
                document.getElementById('fasting-timer').innerText = `${h}:${m}:${s}`;
            } else {
                fastStatus.innerText = "OFF";
                fastStatus.className = "text-[10px] font-bold bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500";
                document.getElementById('fasting-timer').innerText = "--:--";
            }

            // 4. Render Feed
            const feed = document.getElementById('feed-container');
            feed.innerHTML = '';

            if (meals.length === 0) {
                feed.innerHTML = `<div class="text-center py-10 opacity-50"><i class="fas fa-utensils text-4xl text-gray-300 mb-2"></i><p class="text-xs text-gray-400">Seu diário está vazio hoje.</p></div>`;
            } else {
                // Sort by time (newest first)
                meals.sort((a,b) => b.timestamp - a.timestamp).forEach(m => {
                    const time = moment(m.timestamp).format('HH:mm');
                    const isEx = m.type === 'exercise';

                    const el = document.createElement('div');
                    el.className = "flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-50 dark:border-gray-700 animate-slide-up";
                    el.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full ${isEx ? 'bg-blue-100 text-blue-500' : 'bg-brand-50 text-brand-500'} dark:bg-opacity-20 flex items-center justify-center">
                                <i class="fas ${isEx ? 'fa-running' : (m.category === 'Café da Manhã' ? 'fa-mug-hot' : 'fa-utensils')}"></i>
                            </div>
                            <div>
                                <h4 class="text-xs font-bold text-gray-800 dark:text-white truncate w-32 sm:w-48">${m.desc.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h4>
                                <p class="text-[9px] text-gray-400 font-bold">${m.category || 'Atividade'} • ${time}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="block text-xs font-black ${isEx ? 'text-blue-500' : 'text-gray-800 dark:text-white'}">${isEx ? '-' : '+'}${m.cals}</span>
                            ${!isEx ? `<span class="text-[8px] text-gray-400">P:${m.macros.p} C:${m.macros.c} G:${m.macros.f}</span>` : ''}
                        </div>
                    `;
                    // Long press to delete logic could be added here
                    // Simple delete button for MVP:
                    const delBtn = document.createElement('button');
                    delBtn.className = "ml-2 text-gray-300 hover:text-red-500 p-2";
                    delBtn.innerHTML = "<i class='fas fa-times'></i>";
                    delBtn.onclick = () => { if(confirm('Apagar item?')) App.deleteMeal(m.id); };
                    el.appendChild(delBtn);

                    feed.appendChild(el);
                });
            }

            // Check Gamification
            Gamification.checkBadges();
            Gamification.checkStreak();
        },

        // --- NEW: MACRO CHART LOGIC ---
        macroChart: null,
        initMacroChart: () => {
            const ctx = document.getElementById('chart-macros-today').getContext('2d');
            App.macroChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['P', 'C', 'G'],
                    datasets: [{
                        data: [0, 0, 0],
                        backgroundColor: ['#3b82f6', '#22c55e', '#eab308'],
                        borderWidth: 0,
                        cutout: '75%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: false } }
                }
            });
        },

        updateMacroChart: (p, c, f) => {
            if (App.macroChart) {
                const total = p + c + f;
                if (total === 0) {
                    App.macroChart.data.datasets[0].data = [1, 1, 1]; // Placeholder
                } else {
                    App.macroChart.data.datasets[0].data = [p, c, f];
                }
                App.macroChart.update();
            }
        },

        suggestMeal: async () => {
            const p = DB.getProfile();
            if (p.credits <= 0) return alert("Sem créditos IA!");

            // Calculate remaining macros
            const today = DB.getTodayKey();
            const meals = DB.getMeals().filter(m => m.dateKey === today && m.type === 'food');
            const burned = DB.getMeals().filter(m => m.dateKey === today && m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
            const eaten = meals.reduce((acc, m) => ({
                cals: acc.cals + m.cals,
                p: acc.p + m.macros.p,
                c: acc.c + m.macros.c,
                f: acc.f + m.macros.f
            }), {cals: 0, p: 0, c: 0, f: 0});

            const goals = Profile.calculateMacros();
            const rem = {
                cals: p.target - (eaten.cals - burned),
                p: Math.max(0, goals.p - eaten.p),
                c: Math.max(0, goals.c - eaten.c),
                f: Math.max(0, goals.f - eaten.f)
            };

            try {
                const prompt = `Com base nos macros que faltam (${rem.cals}kcal, ${rem.p}g prot, ${rem.c}g carbo, ${rem.f}g gord), sugira ALIMENTOS SIMPLES e práticos (ex: frango grelhado, ovo cozido, arroz, fruta). NÃO sugira receitas complexas ou pratos gourmet. Seja direto e cite 2 ou 3 opções individuais.`;
                const payload = { contents: [{ parts: [{ text: prompt }] }] };
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${CONFIG.apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                alert("💡 Sugestão IA:\n\n" + json.candidates[0].content.parts[0].text);
            } catch(e) {
                alert("Erro ao obter sugestão.");
            }
        },

        fridgeClearoutAI: async () => {
            const ingredients = document.getElementById('fridge-ingredients').value;
            const imgSrc = document.getElementById('fridge-preview-img').src;
            const hasImg = imgSrc && imgSrc.startsWith('data:image');

            if(!ingredients && !hasImg) return alert("Digite os ingredientes ou tire uma foto.");

            const p = DB.getProfile();
            if (p.credits <= 0) return alert("Sem créditos IA!");

            const btn = document.getElementById('btn-fridge-analyze');
            const load = document.getElementById('fridge-loading');
            const resultArea = document.getElementById('fridge-result');
            const recipeText = document.getElementById('fridge-recipe-text');

            btn.classList.add('hidden');
            load.classList.remove('hidden');
            resultArea.classList.add('hidden');

            // Calculate remaining
            const today = DB.getTodayKey();
            const eaten = DB.getMeals().filter(m => m.dateKey === today && m.type === 'food').reduce((acc, m) => acc + m.cals, 0);
            const burned = DB.getMeals().filter(m => m.dateKey === today && m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
            const rem = p.target - (eaten - burned);

            try {
                let base64 = hasImg ? imgSrc.split(',')[1] : null;
                const prompt = `
                    Atue como um chef nutricionista.
                    Analise os ingredientes fornecidos (via texto: "${ingredients}" ${base64 ? 'e via imagem' : ''}).
                    Sabendo que o usuário ainda pode comer ${rem}kcal hoje, sugira uma receita MUITO SIMPLES e rápida.
                    Cite o nome, ingredientes usados e modo de preparo em 3 passos. Seja direto.
                `;

                const payload = {
                    contents: [{
                        parts: [
                            { text: prompt },
                            ...(base64 ? [{ inlineData: { mimeType: "image/jpeg", data: base64 } }] : [])
                        ]
                    }]
                };

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${CONFIG.apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                App.updateApiUsage(json.usageMetadata);
                const recipe = json.candidates[0].content.parts[0].text;
                recipeText.innerText = recipe;
                resultArea.classList.remove('hidden');

                if (p.notificationsEnabled) {
                    new Notification("Nova Receita Sugerida!", { body: "Confira a sugestão do chef para o seu Limpa Geladeira." });
                }

                p.credits--; DB.set('profile', p);
                Gamification.updateUI();

                App.clearImage('fridge');
                document.getElementById('fridge-ingredients').value = '';

            } catch(e) {
                console.error(e);
                alert("Erro ao gerar receita.");
                btn.classList.remove('hidden');
            } finally {
                load.classList.add('hidden');
            }
        },

        toggleNotifications: async () => {
            const p = DB.getProfile();
            if (!p.notificationsEnabled) {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') return alert("Permissão de notificação negada.");
            }
            p.notificationsEnabled = !p.notificationsEnabled;
            DB.set('profile', p);
            Profile.loadToUI();
            if(p.notificationsEnabled) new Notification("QuantixNutri", { body: "Lembretes ativados com sucesso!" });
        },

        scheduleReminders: () => {
            setInterval(() => {
                const p = DB.getProfile();
                if (!p.notificationsEnabled) return;

                const now = new Date();
                const hour = now.getHours();
                const today = DB.getTodayKey();
                const stats = DB.getDayStats()[today];
                const meals = DB.getMeals().filter(m => m.dateKey === today);

                // Lembrete de Água (se não bebeu nada nas últimas 3 horas e está acordado)
                if (hour >= 8 && hour <= 22 && stats.water < 2000) {
                    if (now.getMinutes() === 0) { // No topo da hora
                        new Notification("Hora de Hidratar!", { body: "Você já bebeu água hoje? Registre seu consumo no Quantix." });
                    }
                }

                // Lembrete de Refeição (Almoço/Jantar)
                if (hour === 12 || hour === 20) {
                    if (now.getMinutes() === 15 && meals.length < 2) {
                        new Notification("Não esqueça de comer!", { body: "Manter a regularidade é a chave para o metabolismo." });
                    }
                }
            }, 60000); // Checa a cada minuto
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
        },

        resetApiUsage: () => {
            if(!confirm("Zerar estatísticas de uso da API?")) return;
            const p = DB.getProfile();
            p.apiUsage = { totalTokens: 0, totalRequests: 0 };
            DB.set('profile', p);
            Profile.loadToUI();
        },

        // --- ACTIONS ---
        addWater: (ml) => {
            const stats = DB.getDayStats(); const today = DB.getTodayKey();
            stats[today].water += ml;
            DB.set('day_stats', stats);
            App.refreshUI();
        },

        toggleFasting: () => {
            const stats = DB.getDayStats(); const today = DB.getTodayKey();
            if (stats[today].fastingStart) {
                if(confirm("Encerrar jejum agora?")) stats[today].fastingStart = null;
            } else {
                stats[today].fastingStart = Date.now();
            }
            DB.set('day_stats', stats);
            App.refreshUI();
        },

        deleteMeal: (id) => {
            let meals = DB.getMeals().filter(m => m.id !== id);
            DB.set('meals', meals);
            App.refreshUI();
        },

        // --- AI & CAMERA LOGIC ---
        stream: null,
        portionSize: 1,
        reviewData: null,
        cameraTarget: 'food',

        openCamera: async (target = 'food') => {
            App.cameraTarget = target;
            try {
                const overlay = document.getElementById('camera-overlay');
                const video = document.getElementById('camera-feed');

                App.stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'environment' }
                });
                video.srcObject = App.stream;
                overlay.classList.add('active');
            } catch (err) {
                console.error(err);
                alert("Erro ao acessar câmera (ou permissão negada). Usando upload de arquivo.");
                if(target === 'food') document.getElementById('inp-image').click();
                else document.getElementById('fridge-image-input').click();
            }
        },

        closeCamera: () => {
            if (App.stream) {
                App.stream.getTracks().forEach(track => track.stop());
                App.stream = null;
            }
            document.getElementById('camera-overlay').classList.remove('active');
        },

        capturePhoto: () => {
            const video = document.getElementById('camera-feed');
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);

            const dataUrl = canvas.toDataURL('image/jpeg');
            if(App.cameraTarget === 'food') {
                document.getElementById('ai-preview-img').src = dataUrl;
                document.getElementById('ai-preview').classList.remove('hidden');
            } else {
                document.getElementById('fridge-preview-img').src = dataUrl;
                document.getElementById('fridge-preview').classList.remove('hidden');
            }

            App.closeCamera();
        },

        handleImagePreview: (input, target = 'food') => {
            if (input.files[0]) {
                const r = new FileReader();
                r.onload = (e) => {
                    if(target === 'food') {
                        document.getElementById('ai-preview-img').src = e.target.result;
                        document.getElementById('ai-preview').classList.remove('hidden');
                    } else {
                        document.getElementById('fridge-preview-img').src = e.target.result;
                        document.getElementById('fridge-preview').classList.remove('hidden');
                    }
                };
                r.readAsDataURL(input.files[0]);
            }
        },

        clearImage: (target = 'food') => {
            if(target === 'food') {
                document.getElementById('inp-image').value = '';
                document.getElementById('ai-preview-img').src = '';
                document.getElementById('ai-preview').classList.add('hidden');
                App.setPortion(1);
            } else {
                document.getElementById('fridge-image-input').value = '';
                document.getElementById('fridge-preview-img').src = '';
                document.getElementById('fridge-preview').classList.add('hidden');
            }
        },

        setPortion: (size, btn = null) => {
            App.portionSize = size;
            if(btn) {
                document.querySelectorAll('.portion-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
        },

        // MODIFIED: Now triggers review mode
        analyzeAI: async () => {
            const p = DB.getProfile();
            if (p.credits <= 0) return alert("Sem créditos IA. Suba de nível para ganhar mais!");

            const desc = document.getElementById('ai-desc').value;
            const imgSrc = document.getElementById('ai-preview-img').src;
            const hasImg = imgSrc && imgSrc.startsWith('data:image');

            if (!desc && !hasImg) return alert("Tire uma foto ou descreva o alimento.");

            // UI Loading
            const btn = document.getElementById('btn-analyze');
            const loadMsg = document.getElementById('ai-loading');
            btn.disabled = true;
            btn.classList.add('opacity-50');
            loadMsg.classList.remove('hidden');

            try {
                let base64 = hasImg ? imgSrc.split(',')[1] : null;

                const prompt = `
                    Atue como um nutricionista experiente e preciso.
                    Analise a seguinte descrição de refeição: "${desc}".
                    Contexto da refeição: ${Input.cat}.

                    IMPORTANTE: Se houver uma imagem, use-a como referência principal. Se não houver, baseie-se inteiramente na descrição textual fornecida para calcular as quantidades.
                    Considere que o usuário indicou um fator de porção de ${App.portionSize}x sobre o que é descrito ou visível.
                    Retorne APENAS um objeto JSON válido, sem formatação markdown, com a seguinte estrutura:
                    { "desc": "Nome curto", "cals": 0, "macros": { "p": 0, "c": 0, "f": 0, "fib": 0 }, "score": 0 }
                `;

                const payload = {
                    contents: [{
                        parts: [
                            { text: prompt },
                            ...(base64 ? [{ inlineData: { mimeType: "image/jpeg", data: base64 } }] : [])
                        ]
                    }]
                };

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${CONFIG.apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const json = await res.json();
                if (!json.candidates || !json.candidates[0]) {
                    console.error("Erro na API Gemini:", json);
                    throw new Error("A IA não conseguiu processar a solicitação.");
                }

                let txt = json.candidates[0].content.parts[0].text;
                // Added Markdown cleanup
                txt = txt.replace(/```json/g, '').replace(/```/g, '');

                const jsonMatch = txt.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Resposta da IA inválida.");
                const result = JSON.parse(jsonMatch[0]);

                App.updateApiUsage(json.usageMetadata);

                // FEATURE: Populate Review Area Instead of Adding Immediately
                App.reviewData = result;

                // Switch Views
                document.getElementById('inp-wrapper-normal').classList.add('hidden');
                document.getElementById('inp-area-review').classList.remove('hidden');

                // Populate Fields
                document.getElementById('rev-desc').value = result.desc;
                document.getElementById('rev-cals').value = result.cals;
                document.getElementById('rev-p').value = result.macros.p;
                document.getElementById('rev-c').value = result.macros.c;
                document.getElementById('rev-f').value = result.macros.f;

                // Deduct Credit
                p.credits--; DB.set('profile', p);

                // Reset Inputs
                App.clearImage();
                document.getElementById('ai-desc').value = '';

            } catch (e) {
                console.error(e);
                alert("Erro na IA. Tente novamente.");
            } finally {
                btn.disabled = false;
                btn.classList.remove('opacity-50');
                loadMsg.classList.add('hidden');
            }
        },

        // NEW: Recalculate based on text edit in review mode
        recalculateReview: async () => {
             const newDesc = document.getElementById('rev-desc').value;
             const btn = document.getElementById('btn-recalc');
             btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

             try {
                const prompt = `
                    Você é um nutricionista preciso.
                    Analise APENAS com base neste texto: "${newDesc}". Contexto: ${Input.cat}.
                    Calcule as calorias e macros para este item.
                    Retorne APENAS um JSON:
                    { "desc": "Nome curto", "cals": 0, "macros": { "p": 0, "c": 0, "f": 0, "fib": 0 }, "score": 0 }
                `;

                const payload = {
                    contents: [{ parts: [{ text: prompt }] }]
                };

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${CONFIG.apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                App.updateApiUsage(json.usageMetadata);
                if (!json.candidates || !json.candidates[0]) {
                    console.error("Erro na API Gemini:", json);
                    throw new Error("A IA não conseguiu processar a solicitação.");
                }

                let txt = json.candidates[0].content.parts[0].text;
                // Added Markdown cleanup
                txt = txt.replace(/```json/g, '').replace(/```/g, '');

                const jsonMatch = txt.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Resposta da IA inválida.");
                const result = JSON.parse(jsonMatch[0]);

                // Update Review Fields
                App.reviewData = result;
                document.getElementById('rev-desc').value = result.desc;
                document.getElementById('rev-cals').value = result.cals;
                document.getElementById('rev-p').value = result.macros.p;
                document.getElementById('rev-c').value = result.macros.c;
                document.getElementById('rev-f').value = result.macros.f;

             } catch(e) {
                 alert("Erro ao recalcular");
             } finally {
                 btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
             }
        },

        confirmReview: () => {
            if(!App.reviewData) return;

            const finalData = {
                desc: document.getElementById('rev-desc').value,
                cals: parseInt(document.getElementById('rev-cals').value) || 0,
                macros: {
                    p: parseInt(document.getElementById('rev-p').value) || 0,
                    c: parseInt(document.getElementById('rev-c').value) || 0,
                    f: parseInt(document.getElementById('rev-f').value) || 0,
                    fib: 0
                },
                score: 5,
                category: Input.cat,
                timestamp: Date.now(),
                type: 'food'
            };

            App.addMealToDB(finalData);

            // Reset UI
            document.getElementById('inp-area-review').classList.add('hidden');
            document.getElementById('inp-wrapper-normal').classList.remove('hidden');
            App.reviewData = null;
            Modal.close('add-food');
            alert(`Registrado: ${finalData.desc}`);
        },

        cancelReview: () => {
             document.getElementById('inp-area-review').classList.add('hidden');
             document.getElementById('inp-wrapper-normal').classList.remove('hidden');
             App.reviewData = null;
        },

        analyzeExerciseAI: async () => {
            const p = DB.getProfile();
            const desc = document.getElementById('exe-desc').value;

            if (!desc) return alert("Descreva a atividade primeiro (ex: Corrida 30min).");
            if (p.credits <= 0) return alert("Sem créditos IA. Suba de nível para ganhar mais!");

            const btn = document.getElementById('btn-analyze-ex');
            const load = document.getElementById('ex-loading');

            btn.disabled = true;
            load.classList.remove('hidden');

            try {
                const prompt = `
                    Atue como fisiologista esportivo.
                    Dados do usuário: Gênero ${p.gender}, ${p.age} anos, ${p.weight}kg, ${p.height}cm.
                    Atividade realizada: "${desc}".
                    Calcule as calorias gastas estimadas considerando o perfil biométrico.
                    Retorne APENAS um JSON: { "cals": 0, "desc": "Nome padronizado da atividade" }
                `;

                const payload = {
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                };

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${CONFIG.apiKey}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const json = await res.json();
                if (!json.candidates || !json.candidates[0]) {
                    console.error("Erro na API Gemini:", json);
                    App.updateApiUsage(json.usageMetadata);
                    throw new Error("A IA não conseguiu processar a solicitação.");
                }

                let txt = json.candidates[0].content.parts[0].text;
                // Added Markdown cleanup
                txt = txt.replace(/```json/g, '').replace(/```/g, '');

                const jsonMatch = txt.match(/\{[\s\S]*\}/);
                if (!jsonMatch) throw new Error("Resposta da IA inválida.");
                const result = JSON.parse(jsonMatch[0]);

                // Populate fields
                document.getElementById('exe-cals').value = result.cals;
                document.getElementById('exe-desc').value = result.desc;

                // Deduct credit
                p.credits--; DB.set('profile', p);
                Gamification.updateUI();

            } catch (e) {
                console.error(e);
                alert("Erro ao calcular esforço com IA.");
            } finally {
                btn.disabled = false;
                load.classList.add('hidden');
            }
        },

        addManual: () => {
            const desc = document.getElementById('man-desc').value;
            const cals = parseInt(document.getElementById('man-cals').value);
            if (!desc || isNaN(cals)) return alert("Preencha nome e calorias.");

            const data = {
                desc, cals,
                macros: {
                    p: parseInt(document.getElementById('man-prot').value) || 0,
                    c: parseInt(document.getElementById('man-carb').value) || 0,
                    f: parseInt(document.getElementById('man-fat').value) || 0,
                    fib: parseInt(document.getElementById('man-fiber').value) || 0
                },
                category: Input.cat,
                timestamp: Date.now(),
                type: 'food',
                score: 5
            };
            App.addMealToDB(data);
            Modal.close('add-food');
            // Clear inputs...
        },

        addExercise: () => {
            const desc = document.getElementById('exe-desc').value;
            const cals = parseInt(document.getElementById('exe-cals').value);
            if (!desc || isNaN(cals)) return alert("Dados inválidos");

            const data = {
                desc, cals,
                category: "Exercício",
                timestamp: Date.now(),
                type: 'exercise',
                macros: { p:0, c:0, f:0, fib:0 }
            };
            App.addMealToDB(data);
            Modal.close('add-food');
        },

        addMealToDB: (data) => {
            const meals = DB.getMeals();
            meals.push({ id: Date.now() + Math.random(), dateKey: DB.getTodayKey(), ...data });
            DB.set('meals', meals);
            Gamification.addXP(20);
            App.refreshUI();
        },

        // --- DATA IO ---
        exportData: () => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localStorage));
            const a = document.createElement('a');
            a.href = dataStr; a.download = `quantix_bkp_${DB.getTodayKey()}.json`;
            a.click();
        },
        importData: (input) => {
            const file = input.files[0];
            if(!file) return;
            const r = new FileReader();
            r.onload = (e) => {
                try {
                    const d = JSON.parse(e.target.result);
                    Object.keys(d).forEach(k => { if(k.startsWith(CONFIG.dbPrefix)) localStorage.setItem(k, d[k]); });
                    location.reload();
                } catch(err) { alert("Arquivo inválido"); }
            };
            r.readAsText(file);
        },
        resetAll: () => {
            if(confirm("ATENÇÃO: Isso apaga tudo. Continuar?")) { localStorage.clear(); location.reload(); }
        }
    };

    // =========================================================================
    // 7. ANALYTICS RENDERER
    // =========================================================================
    const Analytics = {
        charts: {},
        currentRange: 7, // Default

        setRange: (days) => {
            Analytics.currentRange = days;
            // Update UI
            [1, 7, 15, 30].forEach(d => {
                const btn = document.getElementById(`btn-range-${d}`);
                if (d === days) {
                    btn.className = "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition bg-brand-100 text-brand-700";
                } else {
                    btn.className = "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800";
                }
            });
            Analytics.render();
        },

        render: () => {
            const p = DB.getProfile();
            const meals = DB.getMeals();
            const daysToRender = Analytics.currentRange;

            // 1. Heatmap Data (Fixed 30 days for consistency)
            const mapEl = document.getElementById('heatmap-grid');
            mapEl.innerHTML = '';

            // 1.1 Heatmap Header (Month)
            const start = moment().subtract(29, 'days');
            const end = moment();
            const monthStr = start.month() === end.month() ? start.format('MMMM') : `${start.format('MMMM')} - ${end.format('MMMM')}`;
            document.getElementById('heatmap-month').innerText = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

            // 1.2 Weekdays Header
            const wdEl = document.getElementById('heatmap-weekdays');
            wdEl.innerHTML = '';
            ['D','S','T','Q','Q','S','S'].forEach(d => {
                const sp = document.createElement('span');
                sp.className = "text-[8px] font-bold text-gray-300 dark:text-gray-600";
                sp.innerText = d;
                wdEl.appendChild(sp);
            });

            for (let i = 29; i >= 0; i--) {
                const day = moment().subtract(i, 'days');
                const k = day.format('YYYY-MM-DD');

                // Aggregate day data
                const dayMeals = meals.filter(m => m.dateKey === k && m.type === 'food');
                const dayBurn = meals.filter(m => m.dateKey === k && m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
                const cals = dayMeals.reduce((acc, m) => acc + m.cals, 0);
                const net = cals - dayBurn;

                const el = document.createElement('div');
                el.className = "w-full aspect-square rounded-sm text-[8px] flex items-center justify-center text-white font-bold";
                el.innerText = day.date();

                if (cals === 0) el.className += " bg-gray-200 dark:bg-gray-700 text-gray-400";
                else {
                    const diff = Math.abs(net - p.target);
                    if (diff <= p.target * 0.1) el.className += " bg-brand-500"; // Within 10%
                    else if (net < p.target) el.className += " bg-yellow-400"; // Under
                    else el.className += " bg-red-400"; // Over
                }
                mapEl.appendChild(el);
            }

            // Prepare Chart Data
            let chartLabels = [];
            let weightData = [];
            let qualityData = [];
            let hydrationData = [];
            let waistData = [], hipData = [], fatData = [];
            let exerciseData = [];

            if (daysToRender === 1) {
                // Hourly view for Today (Resumo)
                const k = DB.getTodayKey();
                chartLabels = Array.from({length: 24}, (_, i) => `${i}h`);
                exerciseData = Array(24).fill(0);
                qualityData = Array(24).fill(null);
                hydrationData = Array(24).fill(0);

                const dayStats = DB.getDayStats()[k] || { water: 0 };
                hydrationData[new Date().getHours()] = dayStats.water;

                meals.filter(m => m.dateKey === k).forEach(m => {
                    const h = new Date(m.timestamp).getHours();
                    if (m.type === 'exercise') exerciseData[h] += m.cals;
                    else qualityData[h] = m.score || 5;
                });

                const wEntry = p.weightHistory.find(h => h.date === k) || p.weightHistory[p.weightHistory.length - 1];
                weightData = Array(24).fill(wEntry ? wEntry.weight : p.weight);

                const mHistory = p.measurementsHistory || [];
                const mEntry = mHistory.find(h => h.date === k) || mHistory[mHistory.length - 1] || {};
                waistData = Array(24).fill(mEntry.waist || null);
                hipData = Array(24).fill(mEntry.hip || null);
                fatData = Array(24).fill(mEntry.fatPct || null);
            } else {
                // Daily View
                for (let i = daysToRender - 1; i >= 0; i--) {
                    const d = moment().subtract(i, 'days');
                    const k = d.format('YYYY-MM-DD');
                    chartLabels.push(d.format('DD/MM'));

                    const dayMeals = meals.filter(m => m.dateKey === k && m.type === 'food');
                    const avgScore = dayMeals.length ? dayMeals.reduce((acc, m) => acc + (m.score || 5), 0) / dayMeals.length : null;
                    qualityData.push(avgScore);

                    const stats = DB.getDayStats()[k] || { water: 0 };
                    hydrationData.push(stats.water);

                    const mEntry = p.measurementsHistory.find(h => h.date === k);
                    waistData.push(mEntry ? mEntry.waist : null);
                    hipData.push(mEntry ? mEntry.hip : null);
                    fatData.push(mEntry ? mEntry.fatPct : null);

                    const dayBurn = meals.filter(m => m.dateKey === k && m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
                    exerciseData.push(dayBurn);

                    const wEntry = p.weightHistory.find(h => h.date === k);
                    weightData.push(wEntry ? wEntry.weight : null);
                }
                // Fill gaps
                let lastW = p.weight;
                for(let i=0; i<weightData.length; i++) {
                    if(weightData[i]) lastW = weightData[i];
                    else weightData[i] = lastW;
                }
            }

            // 1.5 Quality Score Chart
            const validScores = qualityData.filter(v => v !== null);
            const avgPeriodScore = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '--';
            document.getElementById('avg-quality-label').innerText = `Média: ${avgPeriodScore}`;

            const qualityColors = qualityData.map(v => {
                if (v === null) return '#8b5cf6';
                if (v >= 7) return '#22c55e'; // Verde
                if (v >= 4) return '#eab308'; // Amarelo
                return '#ef4444'; // Vermelho
            });

            Analytics.drawChart('chart-quality', 'line', {
                labels: chartLabels,
                datasets: [{
                    label: 'Qualidade (1-10)',
                    data: qualityData,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    pointBackgroundColor: qualityColors,
                    pointBorderColor: qualityColors,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    fill: true, tension: 0.4, spanGaps: true
                }]
            });

            // 1.6 Hydration Chart
            Analytics.drawChart('chart-hydration', 'bar', {
                labels: chartLabels,
                datasets: [{
                    label: 'Água (ml)',
                    data: hydrationData,
                    backgroundColor: '#0ea5e9',
                    borderRadius: 5
                }]
            }, {
                options: {
                    scales: { y: { display: true, beginAtZero: true } }
                }
            });

            // 1.7 Measurements Chart
            Analytics.drawChart('chart-measurements', 'line', {
                labels: chartLabels,
                datasets: [
                    { label: 'Cintura', data: waistData, borderColor: '#f43f5e', tension: 0.4 },
                    { label: 'Quadril', data: hipData, borderColor: '#ec4899', tension: 0.4 },
                    { label: '% Gordura', data: fatData, borderColor: '#8b5cf6', tension: 0.4 }
                ],
                options: {
                    scales: { y: { display: true } },
                    plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 8 } } } }
                }
            });

            // 2. Weight Chart (Updated with Y-Axis enabled)
            Analytics.drawChart('chart-weight', 'line', {
                labels: chartLabels,
                datasets: [{
                    label: 'Peso (kg)',
                    data: weightData,
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22, 163, 74, 0.1)',
                    fill: true, tension: 0.4
                }],
                options: {
                    scales: {
                         y: { display: true } // Visible Scale requested
                    }
                }
            });

            // 3. Hourly Hunger
            const hours = Array(24).fill(0);
            meals.filter(m => m.type !== 'exercise').forEach(m => {
                const h = new Date(m.timestamp).getHours();
                hours[h] += m.cals;
            });
            Analytics.drawChart('chart-hourly', 'bar', {
                labels: hours.map((_, i) => i),
                datasets: [{
                    label: 'Calorias',
                    data: hours,
                    backgroundColor: '#3b82f6',
                    borderRadius: 3
                }]
            });

             // 4. Exercise Chart (NEW: With data labels plugin inline)
             const ctxEx = document.getElementById('chart-exercise').getContext('2d');
             if (Analytics.charts['chart-exercise']) Analytics.charts['chart-exercise'].destroy();

             // Simple Inline Plugin for Data Labels
             const dataLabelPlugin = {
                  id: 'dataLabels',
                  afterDatasetsDraw(chart) {
                    const {ctx} = chart;
                    chart.data.datasets.forEach((dataset, i) => {
                      const meta = chart.getDatasetMeta(i);
                      meta.data.forEach((bar, index) => {
                        const value = dataset.data[index];
                        if(value > 0){
                            ctx.fillStyle = 'gray';
                            ctx.font = 'bold 10px Inter';
                            ctx.textAlign = 'center';
                            ctx.fillText(value, bar.x, bar.y - 5);
                        }
                      });
                    });
                  }
             };

             Analytics.charts['chart-exercise'] = new Chart(ctxEx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Queima (kcal)',
                        data: exerciseData,
                        backgroundColor: '#f59e0b',
                        borderRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false } },
                        y: { display: false }
                    }
                },
                plugins: [dataLabelPlugin] // Register plugin
            });

            // 4. Projection
            // Simplificado para demo:
            const projectedLoss = 1.2;
            document.getElementById('proj-weight').innerText = (p.weight - projectedLoss).toFixed(1);
            document.getElementById('proj-diff').innerText = `-${projectedLoss} kg`;
        },

        drawChart: (id, type, data, extraOptions = {}) => {
            const ctx = document.getElementById(id).getContext('2d');
            if (Analytics.charts[id]) Analytics.charts[id].destroy();

            const defaultOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { display: false }
                }
            };

            // Merge options deep enough for scales
            const finalOptions = { ...defaultOptions, ...extraOptions.options };
            if(extraOptions.options && extraOptions.options.scales) {
                finalOptions.scales = { ...defaultOptions.scales, ...extraOptions.options.scales };
            }

            Analytics.charts[id] = new Chart(ctx, {
                type: type,
                data: data,
                options: finalOptions
            });
        }
    };

    // =========================================================================
    // 8. HELPERS
    // =========================================================================
    const Voice = {
        recognition: null,
        targetId: null,

        init: () => {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                Voice.recognition = new SpeechRecognition();
                Voice.recognition.lang = 'pt-BR';
                Voice.recognition.continuous = false;
                Voice.recognition.interimResults = false;

                Voice.recognition.onstart = () => {
                    const btn = document.getElementById('btn-mic-' + Voice.targetId);
                    if(btn) btn.classList.add('animate-pulse', 'text-red-500');
                };

                Voice.recognition.onresult = (event) => {
                    const transcript = event.results[0][0].transcript;
                    if (Voice.targetId) {
                        const el = document.getElementById(Voice.targetId);
                        if (el) {
                            const currentVal = el.value ? el.value + " " : "";
                            el.value = (currentVal + transcript).trim();
                        }
                    }
                };

                Voice.recognition.onerror = (event) => {
                    console.error("Voice Error", event.error);
                    alert("Erro no reconhecimento de voz: " + event.error);
                    Voice.stop();
                };

                Voice.recognition.onend = () => {
                    Voice.stop();
                };
            } else {
                alert("Seu navegador não suporta reconhecimento de voz.");
            }
        },

        start: (id) => {
            if (!Voice.recognition) Voice.init();
            if (Voice.recognition) {
                Voice.targetId = id;
                Voice.recognition.start();
            }
        },

        stop: () => {
            if (Voice.targetId) {
                const btn = document.getElementById('btn-mic-' + Voice.targetId);
                if(btn) btn.classList.remove('animate-pulse', 'text-red-500');
                Voice.targetId = null;
            }
        }
    };

    const Modal = {
        open: (id) => {
            document.getElementById('modal-' + id).classList.add('active');
        },
        close: (id) => {
            document.getElementById('modal-' + id).classList.remove('active');
        },
        closeAll: () => {
            document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
        }
    };

    // START APPLICATION
    window.onload = App.init;

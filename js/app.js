import { CONFIG } from './config.js';
import { DB, OFFLINE_FOOD_DB } from './data/database.js';
import { Profile } from './logic/profile.js';
import { Gamification } from './logic/gamification.js';
import { Analytics } from './ui/analytics.js';
import { Modal, Input, Voice, UI } from './ui/interface.js';
import { ChatUI } from './ui/chat.js';
import { API } from './services/api.js';
import { Context } from './services/context.js';
import { Planner } from './ui/planner.js';
import { Shopping } from './ui/shopping.js';
import { Fasting } from './ui/fasting.js';
import { I18n } from './services/i18n.js';

// =========================================================================
// 6. MAIN APP CONTROLLER
// =========================================================================
export const App = {
    reviewItems: [], // New state for multi-item review

    init: () => {
        I18n.init(); // Initialize i18n

        // Load moment locale
        if (window.moment) {
             window.moment.locale(I18n.locale === 'pt-BR' ? 'pt-br' : 'en');
        }

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

        // Init Chat UI
        ChatUI.init();

        // Init Planner
        Planner.init();

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

        // Manual Refresh Trigger
        const profileImg = document.getElementById('header-profile-img');
        if (profileImg) {
            profileImg.onclick = () => {
                if(confirm(I18n.t("alert.update_confirm"))) {
                    window.location.reload(true);
                }
            };
        }

        // Date tracker
        let lastDateCheck = moment().format('YYYY-MM-DD');

        // Ticker for fasting
        setInterval(() => {
            const current = moment().format('YYYY-MM-DD');
            if (current !== lastDateCheck) {
                lastDateCheck = current;
                App.refreshUI();
            }

            const stats = DB.getDayStats(); const today = DB.getTodayKey();
            if(stats[today] && stats[today].fastingStart) App.updateFastingTimer();
        }, 1000);

        // Event Listener para fechar modal com ESC
        document.addEventListener('keydown', (e) => { if(e.key === 'Escape') Modal.closeAll(); });
    },

    saveApiKey: () => {
        const key = document.getElementById('inp-apikey').value;
        if (key && key.trim() !== "") {
            localStorage.setItem('quantix_ultimate_v2_api_key', key.trim());
            alert(I18n.t("alert.api_saved"));
            location.reload();
        } else {
            alert(I18n.t("alert.api_invalid"));
        }
    },

    // --- ONBOARDING LOGIC ---
    finishOnboarding: () => {
        const name = document.getElementById('onb-name').value;
        const w = document.getElementById('onb-weight').value;
        const h = document.getElementById('onb-height').value;
        const age = document.getElementById('onb-age').value;
        const target = document.getElementById('onb-target').value;

        if(!name || !w || !h || !age) return alert(I18n.t("alert.fill_all"));

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
        const index = ['tracker', 'analytics', 'planner', 'profile'].indexOf(tabId);
        if(index >= 0) document.querySelectorAll('.nav-item')[index].classList.add('active');

        // Render Analytics only if requested (save performance)
        if (tabId === 'analytics') Analytics.render();
        if (tabId === 'planner') Planner.render();
        if (tabId === 'profile') Profile.loadToUI();
        // Scroll to top
        document.getElementById('main-scroll').scrollTop = 0;
    },

    // --- CORE: DATA REFRESH ---
    updateFastingTimer: () => {
        const today = DB.getTodayKey();
        const stats = DB.getDayStats()[today];
        if (!stats || !stats.fastingStart) return;

        const diff = Math.floor((Date.now() - stats.fastingStart) / 1000);
        const h = String(Math.floor(diff / 3600)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const s = String(diff % 60).padStart(2, '0');

        const elTimer = document.getElementById('fasting-timer');
        if(elTimer) elTimer.innerText = `${h}:${m}:${s}`;
    },

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
            fastStatus.innerText = I18n.t("tracker.fasting_on");
            fastStatus.className = "text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded animate-pulse";
            // Timer Logic
            const diff = Math.floor((Date.now() - stats.fastingStart) / 1000);
            const h = String(Math.floor(diff / 3600)).padStart(2, '0');
            const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
            const s = String(diff % 60).padStart(2, '0');
            document.getElementById('fasting-timer').innerText = `${h}:${m}:${s}`;
        } else {
            fastStatus.innerText = I18n.t("tracker.fasting_off");
            fastStatus.className = "text-[10px] font-bold bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500";
            document.getElementById('fasting-timer').innerText = "--:--";
        }

        // 4. Render Feed
        const feed = document.getElementById('feed-container');
        feed.innerHTML = '';

        if (meals.length === 0) {
            feed.innerHTML = `<div class="text-center py-10 opacity-50"><i class="fas fa-utensils text-4xl text-gray-300 mb-2"></i><p class="text-xs text-gray-400">${I18n.t("tracker.empty_feed")}</p></div>`;
        } else {
             // Group meals
             const groups = {};
             meals.forEach(m => {
                 const key = m.parent_id || m.timestamp || m.id;
                 if(!groups[key]) groups[key] = { id: key, items: [], time: m.timestamp, name: m.parent_name, cat: m.category };
                 groups[key].items.push(m);
             });

             const sortedGroups = Object.values(groups).sort((a,b) => b.time - a.time);

             sortedGroups.forEach(g => {
                 if (g.items.length === 1 && !g.name) {
                     // Single Item
                     feed.appendChild(App.createMealCard(g.items[0]));
                 } else {
                     // Combo Group
                     feed.appendChild(App.createComboCard(g));
                 }
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

    // Proxy methods to API/UI for access
    suggestMeal: API.suggestMeal,
    fridgeClearoutAI: API.fridgeClearoutAI,
    analyzeAI: API.analyzeAI,
    recalculateReview: API.recalculateReview, // Deprecated, will be overridden
    confirmReview: API.confirmReview, // Deprecated, will be overridden
    cancelReview: API.cancelReview, // Deprecated, will be overridden
    analyzeExerciseAI: API.analyzeExerciseAI,

    // --- NEW: REVIEW LOGIC ---
    initReview: (items) => {
        App.reviewItems = items || [];

        // Hide Normal Input, Show Review
        document.getElementById('inp-wrapper-normal').classList.add('hidden');
        document.getElementById('inp-area-review').classList.remove('hidden');

        App.renderReviewList();
        App.recalculateTotals();
    },

    renderReviewList: () => {
        const list = document.getElementById('review-list');
        list.innerHTML = '';

        if (App.reviewItems.length === 0) {
            list.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">Nenhum item identificado.</p>';
            return;
        }

        App.reviewItems.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = "bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm relative animate-slide-up";

            // Safe helper for macros
            const m = item.macros || {p:0, c:0, f:0};

            el.innerHTML = `
                <div class="flex justify-between items-start mb-2 gap-2">
                    <input type="text" value="${item.desc}"
                        onchange="App.updateReviewItem(${index}, 'desc', this.value)"
                        class="flex-1 bg-transparent font-bold text-sm text-gray-800 dark:text-white border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-brand-500 outline-none pb-1" placeholder="${I18n.t("modal.manual_name_placeholder")}">

                    <button onclick="App.removeReviewItem(${index})" class="text-gray-400 hover:text-red-500 p-1">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="grid grid-cols-2 gap-3 items-center">
                    <div class="relative">
                        <input type="number" value="${item.weight || 0}"
                            onchange="App.updateReviewItem(${index}, 'weight', this.value)"
                            class="w-full bg-gray-50 dark:bg-gray-900 rounded-lg py-1.5 px-2 text-xs font-bold text-gray-600 dark:text-gray-300 outline-none focus:ring-1 focus:ring-brand-500">
                        <span class="absolute right-2 top-1.5 text-[10px] text-gray-400">g</span>
                    </div>

                    <div class="relative">
                        <input type="number" value="${item.cals || 0}"
                             onchange="App.updateReviewItem(${index}, 'cals', this.value)"
                             class="w-full bg-gray-50 dark:bg-gray-900 rounded-lg py-1.5 px-2 text-xs font-black text-brand-600 outline-none focus:ring-1 focus:ring-brand-500">
                        <span class="absolute right-2 top-1.5 text-[10px] text-brand-400">kcal</span>
                    </div>
                </div>
            `;
            list.appendChild(el);
        });
    },

    updateReviewItem: (index, field, value) => {
        if (!App.reviewItems[index]) return;

        if (field === 'cals' || field === 'weight') {
             App.reviewItems[index][field] = parseFloat(value) || 0;
        } else {
             App.reviewItems[index][field] = value;
        }
        App.recalculateTotals();
    },

    removeReviewItem: (index) => {
        App.reviewItems.splice(index, 1);
        App.renderReviewList();
        App.recalculateTotals();
    },

    addManualReviewItem: () => {
        App.reviewItems.push({
             desc: "Novo Item",
             weight: 100,
             cals: 100,
             macros: { p:0, c:0, f:0 },
             micros: { sodium: 0, sugar: 0, potassium: 0, vitamins: {} }
        });
        App.renderReviewList();
        App.recalculateTotals();
    },

    recalculateTotals: () => {
         let total = 0;
         App.reviewItems.forEach(i => total += (parseFloat(i.cals) || 0));
         document.getElementById('review-total-cals').innerText = Math.round(total) + ' kcal';
    },

    toggleSaveCombo: () => {
        const chk = document.getElementById('check-save-combo');
        const inp = document.getElementById('inp-combo-name');
        if (chk.checked) {
            inp.classList.remove('hidden');
            inp.focus();
        } else {
            inp.classList.add('hidden');
        }
    },

    confirmReview: () => {
        if(App.reviewItems.length === 0) return alert(I18n.t("alert.add_item_required"));

        // --- COMBOS LOGIC ---
        const chkCombo = document.getElementById('check-save-combo');
        if (chkCombo.checked) {
            const name = document.getElementById('inp-combo-name').value.trim();
            if (!name) return alert(I18n.t("alert.combo_name_required"));

            // Save Combo
            const combos = DB.getCombos();
            const newCombo = {
                id: Date.now(),
                name: name,
                items: JSON.parse(JSON.stringify(App.reviewItems)) // Deep copy
            };
            combos.push(newCombo);
            DB.set('combos', combos);

            // Reset UI for combo
            chkCombo.checked = false;
            document.getElementById('inp-combo-name').value = '';
            document.getElementById('inp-combo-name').classList.add('hidden');
        }
        // --------------------

        const timestamp = Date.now();
        let totalCals = 0;

        // Determine parent name if saving as combo
        let parentName = null;
        if (chkCombo.checked) {
             parentName = document.getElementById('inp-combo-name').value.trim();
        }

        // Calculate XP Batch
        const actionType = chkCombo.checked ? 'combo_entry' : 'meal_entry';
        const xpRes = Gamification.calculateTransactionXP(actionType, { itemCount: App.reviewItems.length });
        Gamification.addXP(xpRes.xp);

        App.reviewItems.forEach(item => {
             const data = {
                 desc: item.desc,
                 weight: parseFloat(item.weight) || 0,
                 cals: parseFloat(item.cals) || 0,
                 macros: item.macros || {p:0, c:0, f:0, fib:0},
                 micros: item.micros || { sodium: 0, sugar: 0, potassium: 0, vitamins: {} },
                 score: item.score || 5, // Use AI score or default
                 category: Input.cat,
                 timestamp: timestamp, // Grouped by same time
                 parent_id: timestamp,
                 parent_name: parentName,
                 type: 'food'
             };
             App.addMealToDB(data, true);
             totalCals += data.cals;
        });

        // Close and Reset
        document.getElementById('inp-area-review').classList.add('hidden');
        document.getElementById('inp-wrapper-normal').classList.remove('hidden');
        App.reviewItems = [];
        Modal.close('add-food');

        // Custom Feedback
        const msg = App.reviewItems.length > 1
            ? `Registrados ${App.reviewItems.length} itens (${Math.round(totalCals)} kcal)\n${xpRes.message} (+${xpRes.xp} XP)`
            : `Registrado com sucesso!\n${xpRes.message} (+${xpRes.xp} XP)`;

        // Use a small timeout to ensure alert doesn't block UI refresh if any
        setTimeout(() => alert(msg), 100);
    },

    cancelReview: () => {
         document.getElementById('inp-area-review').classList.add('hidden');
         document.getElementById('inp-wrapper-normal').classList.remove('hidden');
         App.reviewItems = [];
    },

    // --- COMBOS MANAGEMENT ---
    renderCombosList: () => {
        const list = document.getElementById('combo-list');
        const combos = DB.getCombos();

        list.innerHTML = '';

        if (combos.length === 0) {
            list.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">${I18n.t("modal.combos_empty")}</p>`;
            return;
        }

        combos.forEach(c => {
            let totalCals = 0;
            let totalP = 0, totalC = 0, totalF = 0;

            c.items.forEach(i => {
                totalCals += (parseFloat(i.cals) || 0);
                if(i.macros) {
                    totalP += (parseFloat(i.macros.p) || 0);
                    totalC += (parseFloat(i.macros.c) || 0);
                    totalF += (parseFloat(i.macros.f) || 0);
                }
            });

            const el = document.createElement('div');
            el.className = "bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex justify-between items-center";
            el.innerHTML = `
                <div>
                    <h5 class="text-sm font-bold text-gray-800 dark:text-white">${c.name}</h5>
                    <p class="text-[10px] text-gray-400 font-bold">${c.items.length} itens • ${Math.round(totalCals)} kcal</p>
                    <p class="text-[9px] text-gray-300 mt-1">P:${Math.round(totalP)} C:${Math.round(totalC)} G:${Math.round(totalF)}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="App.deleteCombo(${c.id})" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                    <button onclick="App.addCombo(${c.id})" class="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition shadow-sm border border-green-100">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                </div>
            `;
            list.appendChild(el);
        });
    },

    addCombo: (id) => {
        const combos = DB.getCombos();
        const combo = combos.find(c => c.id === id);
        if(!combo) return;

        const timestamp = Date.now();

        // XP Batch
        const xpRes = Gamification.calculateTransactionXP('combo_entry', { itemCount: combo.items.length });
        Gamification.addXP(xpRes.xp);

        combo.items.forEach(item => {
             const data = {
                 desc: item.desc,
                 weight: parseFloat(item.weight) || 0,
                 cals: parseFloat(item.cals) || 0,
                 macros: item.macros || {p:0, c:0, f:0, fib:0},
                 micros: item.micros || { sodium: 0, sugar: 0, potassium: 0, vitamins: {} },
                 score: item.score || 5,
                 category: Input.cat,
                 timestamp: timestamp, // All items grouped
                 parent_id: timestamp,
                 parent_name: combo.name,
                 type: 'food'
             };
             App.addMealToDB(data, true);
        });

        Modal.close('add-food');
        alert(I18n.t("alert.combo_added", { name: combo.name, category: Input.cat }) + `\n${xpRes.message} (+${xpRes.xp} XP)`);
    },

    deleteCombo: (id) => {
        if(!confirm(I18n.t("alert.delete_combo_confirm"))) return;
        const combos = DB.getCombos().filter(c => c.id !== id);
        DB.set('combos', combos);
        App.renderCombosList();
    },

    openCamera: UI.openCamera,
    closeCamera: UI.closeCamera,
    capturePhoto: UI.capturePhoto,
    handleImagePreview: UI.handleImagePreview,
    clearImage: UI.clearImage,
    setPortion: UI.setPortion,

    toggleNotifications: async () => {
        const p = DB.getProfile();
        if (!p.notificationsEnabled) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return alert(I18n.t("alert.permission_denied"));
        }
        p.notificationsEnabled = !p.notificationsEnabled;
        DB.set('profile', p);
        Profile.loadToUI();
        if(p.notificationsEnabled) new Notification("QuantixNutri", { body: I18n.t("alert.reminders_enabled") });
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

    resetApiUsage: () => {
        if(!confirm(I18n.t("alert.reset_api_confirm"))) return;
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

    removeWater: (ml) => {
        const stats = DB.getDayStats(); const today = DB.getTodayKey();
        stats[today].water = Math.max(0, stats[today].water - ml);
        DB.set('day_stats', stats);
        App.refreshUI();
    },

    toggleFasting: () => {
        const stats = DB.getDayStats(); const today = DB.getTodayKey();
        if (stats[today].fastingStart) {
            if(confirm(I18n.t("alert.end_fasting_confirm"))) {
                // Calculate duration and add to today's minutes
                const durationMinutes = (Date.now() - stats[today].fastingStart) / 1000 / 60;
                stats[today].fastingMinutes = (stats[today].fastingMinutes || 0) + durationMinutes;
                stats[today].fastingStart = null;
            }
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

    // --- RENDER HELPERS ---
    createMealCard: (m, isChild = false) => {
        const time = moment(m.timestamp).format('HH:mm');
        const isEx = m.type === 'exercise';

        // Badges for High Sodium/Sugar
        let badges = "";
        if (!isEx && m.micros) {
            if (m.micros.sodium > 400) badges += `<span class="inline-block ml-1 w-2 h-2 rounded-full bg-red-500" title="Alto Sódio"></span>`;
            if (m.micros.sugar > 15) badges += `<span class="inline-block ml-1 w-2 h-2 rounded-full bg-orange-500" title="Alto Açúcar"></span>`;
        }

        // Symptom Tags
        let symptomTags = "";
        if (!isEx) {
            symptomTags = UI.getSymptomTags(m.symptoms);
        }

        // Dynamic Icon Color based on Score
        let iconClass = "bg-brand-50 text-brand-500";
        if (!isEx && m.score) {
            if (m.score >= 8) iconClass = "bg-green-100 text-green-500";
            else if (m.score >= 5) iconClass = "bg-yellow-100 text-yellow-600";
            else iconClass = "bg-red-100 text-red-500";
        }
        if (isEx) iconClass = "bg-blue-100 text-blue-500";

        // Score Badge
        let scoreBadge = "";
        if (!isEx && m.score) {
            let scoreColor = m.score >= 8 ? "text-green-600 bg-green-50 border-green-100" :
                                m.score >= 5 ? "text-yellow-600 bg-yellow-50 border-yellow-100" :
                                "text-red-500 bg-red-50 border-red-100";
            scoreBadge = `<span class="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${scoreColor} dark:bg-opacity-10 dark:border-opacity-10">Score: ${m.score}</span>`;
        }

        const el = document.createElement('div');
        // Indentation and styling for Child vs Parent/Single
        if (isChild) {
             // Nested look: indented, lighter bg, left border
             el.className = "flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-xl mb-2 ml-4 border-l-4 border-brand-100 dark:border-brand-900 shadow-sm animate-fade-in";
        } else {
             // Standard Card
             el.className = "flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-50 dark:border-gray-700 animate-slide-up mb-3";
        }

        el.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full ${iconClass} dark:bg-opacity-20 flex items-center justify-center">
                    <i class="fas ${isEx ? 'fa-running' : (m.category === 'Café da Manhã' ? 'fa-mug-hot' : 'fa-utensils')}"></i>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-gray-800 dark:text-white truncate w-32 sm:w-48">
                        ${m.desc.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                        ${badges}
                    </h4>
                    <p class="text-[9px] text-gray-400 font-bold flex items-center gap-2 flex-wrap mt-0.5">
                        ${m.category || 'Atividade'} • ${time}
                        ${scoreBadge}
                    </p>
                    ${symptomTags ? `<div class="mt-1 flex flex-wrap gap-1">${symptomTags}</div>` : ''}
                </div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <div class="text-right">
                    <span class="block text-xs font-black ${isEx ? 'text-blue-500' : 'text-gray-800 dark:text-white'}">${isEx ? '-' : '+'}${m.cals}</span>
                    ${!isEx ? `<span class="text-[8px] text-gray-400">P:${m.macros.p} C:${m.macros.c} G:${m.macros.f}</span>` : ''}
                </div>
                <div id="action-container-${m.id}"></div>
            </div>
        `;

        // Wrapper for delete button
        const rightCol = document.createElement('div');
        rightCol.className = "flex items-center ml-2";

        const delBtn = document.createElement('button');
        delBtn.className = "text-gray-300 hover:text-red-500 p-2";
        delBtn.innerHTML = "<i class='fas fa-times'></i>";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm(I18n.t("alert.delete_item_confirm"))) App.deleteMeal(m.id);
        };
        rightCol.appendChild(delBtn);

        el.appendChild(rightCol);

        // Symptom Button
        if (!isEx) {
            const actionContainer = el.querySelector(`[id="action-container-${m.id}"]`);
            if (actionContainer) {
                const symBtn = document.createElement('button');
                symBtn.className = "text-[10px] text-gray-400 hover:text-brand-500 font-bold flex items-center gap-1 px-1.5 py-0.5 rounded border border-transparent hover:border-brand-200 hover:bg-brand-50 transition";
                symBtn.innerHTML = `<i class="far fa-smile"></i> ${m.symptoms && m.symptoms.length > 0 ? 'Editar' : 'Sentiu?'}`;
                symBtn.onclick = (e) => {
                     e.stopPropagation();
                     App.openSymptoms(m.id);
                };
                actionContainer.appendChild(symBtn);
            }
        }

        return el;
    },

    createComboCard: (group) => {
        let totalCals = 0;
        group.items.forEach(i => totalCals += i.cals);

        const time = moment(group.time).format('HH:mm');
        const title = group.name || `${group.cat} • ${time}`;

        const el = document.createElement('div');
        el.className = "bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-50 dark:border-gray-700 animate-slide-up mb-3 overflow-hidden";

        el.innerHTML = `
            <div onclick="App.toggleGroup('${group.id}')" class="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition select-none">
                <div class="flex items-center gap-3">
                     <div class="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-sm">
                        <i class="fas fa-layer-group"></i>
                     </div>
                     <div>
                        <h4 class="text-sm font-bold text-gray-800 dark:text-white">${title}</h4>
                        <p class="text-[10px] text-gray-400 font-bold">${group.items.length} itens • ${Math.round(totalCals)} kcal</p>
                     </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-sm font-black text-gray-800 dark:text-white">+${Math.round(totalCals)}</span>
                    <div class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                        <i id="chevron-${group.id}" class="fas fa-chevron-down text-gray-500 transition-transform duration-300"></i>
                    </div>
                </div>
            </div>
            <div id="group-${group.id}" class="hidden flex flex-col pb-3 pr-3 pt-1">
                <!-- Children -->
            </div>
        `;

        const container = el.querySelector(`#group-${group.id}`);
        group.items.forEach(item => {
            container.appendChild(App.createMealCard(item, true));
        });

        return el;
    },

    toggleGroup: (id) => {
        const g = document.getElementById(`group-${id}`);
        const c = document.getElementById(`chevron-${id}`);
        if(g) g.classList.toggle('hidden');
        if(c) c.classList.toggle('rotate-180');
    },

    addManual: () => {
        const desc = document.getElementById('man-desc').value;
        const cals = parseInt(document.getElementById('man-cals').value);
        if (!desc || isNaN(cals)) return alert(I18n.t("alert.manual_validation"));

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

        const xpRes = Gamification.calculateTransactionXP('meal_entry');
        Gamification.addXP(xpRes.xp);

        App.addMealToDB(data, true);
        Modal.close('add-food');
    },

    addExercise: () => {
        const desc = document.getElementById('exe-desc').value;
        const cals = parseInt(document.getElementById('exe-cals').value);
        if (!desc || isNaN(cals)) return alert(I18n.t("alert.exercise_validation"));

        const data = {
            desc, cals,
            category: "Exercício",
            timestamp: Date.now(),
            type: 'exercise',
            macros: { p:0, c:0, f:0, fib:0 }
        };

        const xpRes = Gamification.calculateTransactionXP('meal_entry'); // Exercise counts as entry
        Gamification.addXP(xpRes.xp);

        App.addMealToDB(data, true);
        Modal.close('add-food');
    },

    addMealToDB: (data, skipXP = false) => {
        const meals = DB.getMeals();
        meals.push({ id: Date.now() + Math.random(), dateKey: DB.getTodayKey(), ...data });
        DB.set('meals', meals);

        if (!skipXP) {
            Gamification.addXP(50); // Fallback for direct calls (like quick add)
        }
        App.refreshUI();
    },

    // --- SYMPTOMS LOGIC ---
    openSymptoms: (id) => {
        // id is string in HTML attribute, ensure type matching
        const meals = DB.getMeals();
        // Try to find by string comparison or number
        const m = meals.find(x => x.id == id);
        if(!m) return;
        UI.openSymptomModal(m.id, m.symptoms || []);
    },

    saveSymptoms: () => {
        const id = UI.currentMealId;
        const selected = [];
        document.querySelectorAll('.active-symptom').forEach(btn => {
            selected.push(btn.getAttribute('data-id'));
        });

        const meals = DB.getMeals();
        const m = meals.find(x => x.id === id);

        if (m) {
            m.symptoms = selected;
            // Update DB
            if(DB.updateMeal(m)) {
                Modal.close('symptoms');
                App.refreshUI();
                // Feedback
                setTimeout(() => {
                    alert(I18n.t("alert.symptoms_saved"));
                }, 100);
            }
        }
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
            } catch(err) { alert(I18n.t("alert.invalid_file")); }
        };
        r.readAsText(file);
    },
    resetAll: () => {
        if(confirm(I18n.t("alert.reset_all_confirm"))) { localStorage.clear(); location.reload(); }
    }
};

// Expose to window for HTML access
window.App = App;
window.Modal = Modal;
window.Input = Input;
window.Profile = Profile;
window.Analytics = Analytics;
window.Voice = Voice;
window.Gamification = Gamification;
window.ChatUI = ChatUI;
window.Context = Context;
window.Planner = Planner;
window.Shopping = Shopping;
window.Fasting = Fasting;
window.I18n = I18n; // Ensure it's available

// Ensure init is called correctly handling module timing
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // If document is already loaded/interactive, run init immediately
    // Use setTimeout to ensure it runs after the current task (mimic onload)
    setTimeout(App.init, 1);
} else {
    window.addEventListener('load', App.init);
}

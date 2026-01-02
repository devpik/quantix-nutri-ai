import { DB } from '../data/database.js';

// =========================================================================
// 3. GAMIFICATION ENGINE (RPG LOGIC)
// =========================================================================
export const Gamification = {
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

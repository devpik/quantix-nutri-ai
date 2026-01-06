import { DB } from '../data/database.js';
import { I18n } from '../services/i18n.js';

// =========================================================================
// 3. GAMIFICATION ENGINE (RPG LOGIC)
// =========================================================================
export const Gamification = {
    // Leveling Logic: XP required for next level = Level * 500
    getNextLevelXP: (level) => {
        return level * 500;
    },

    // Transaction Engine
    calculateTransactionXP: (actionType, metadata = {}) => {
        let xp = 0;
        let message = "";

        switch (actionType) {
            case 'meal_entry':
                xp = 50;
                message = I18n.t("gamification.meal_bonus");
                break;
            case 'combo_entry':
                xp = 100;
                message = I18n.t("gamification.combo_bonus");
                break;
            case 'daily_streak':
                xp = 100; // Bonus for keeping streak
                message = I18n.t("gamification.streak_bonus");
                break;
            default:
                xp = 0;
        }

        // Bonus: Colorful Plate (Detected > 3 items in a single analysis/entry)
        if (metadata.itemCount && metadata.itemCount >= 3) {
            xp += 30;
            message += I18n.t("gamification.colorful_bonus");
        }

        return { xp, message };
    },

    addXP: (amount) => {
        const p = DB.getProfile();
        const oldLevel = p.level;
        p.xp += amount;

        let nextLevelThreshold = p.level * 500;

        if (p.xp >= nextLevelThreshold) {
            p.level++;
            p.credits += 5; // Reward
            p.xp = 0; // Reset for next level progress
            Gamification.triggerLevelUp(p.level);
        }

        DB.set('profile', p);
        Gamification.updateUI();
    },

    triggerLevelUp: (newLevel) => {
        Gamification.triggerConfetti();
        alert(I18n.t("gamification.level_up", { level: newLevel }));
    },

    checkStreak: () => {
        const p = DB.getProfile();
        const today = moment().format('YYYY-MM-DD');
        const lastActivityDate = p.last_activity_timestamp ? moment(p.last_activity_timestamp).format('YYYY-MM-DD') : null;

        if (lastActivityDate === today) return; // Already logged today

        const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');

        if (lastActivityDate === yesterday) {
            p.streak_days++;
            // Bonus for streak extension
            const { xp, message } = Gamification.calculateTransactionXP('daily_streak');
            p.xp += xp;
        } else {
            // Broken streak (unless it's the very first use)
            if (lastActivityDate) {
                 p.streak_days = 1; // Reset to 1 (today)
            } else {
                 p.streak_days = 1; // First day
            }
        }

        p.last_activity_timestamp = moment().toISOString();
        DB.set('profile', p);
        Gamification.updateUI();
    },

    checkBadges: () => {
        const p = DB.getProfile();
        const meals = DB.getMeals();
        const streak = p.streak_days;
        const newBadges = [];

        const unlocked = p.achievements_unlocked || [];

        const rules = [
            { id: 'first_step', icon: 'fa-shoe-prints', name: 'Primeiro Passo', check: () => meals.length >= 1 },
            { id: 'water_master', icon: 'fa-tint', name: 'Hidratado', check: () => DB.getDayStats()[DB.getTodayKey()].water >= 2500 },
            { id: 'streak_3', icon: 'fa-fire', name: 'Focado (3 Dias)', check: () => streak >= 3 },
            { id: 'streak_7', icon: 'fa-fire-alt', name: 'Imparável (7 Dias)', check: () => streak >= 7 },
            { id: 'expert', icon: 'fa-brain', name: 'Nutri Expert', check: () => meals.length >= 50 }
        ];

        rules.forEach(r => {
            if (r.check() && !unlocked.includes(r.id)) {
                unlocked.push(r.id);
                newBadges.push(r.name);
                Gamification.addXP(50);
            }
        });

        if (newBadges.length > 0) {
            p.achievements_unlocked = unlocked;
            p.badges = unlocked; // Sync for legacy if any
            DB.set('profile', p);
            Gamification.triggerConfetti();
            alert(I18n.t("gamification.new_badges", { badges: newBadges.join(', ') }));
            Gamification.updateUI();
        }
    },

    updateUI: () => {
        const p = DB.getProfile();

        // --- 1. Header Profile Image & Streak Glow ---
        const profileImg = document.getElementById('header-profile-img');
        if (profileImg) {
            if (p.profile_image_url) {
                profileImg.src = p.profile_image_url;
            } else {
                // Default avatar or initials
                profileImg.src = "https://ui-avatars.com/api/?name=" + (p.name || "User") + "&background=random";
            }

            // Streak Glow
            if (p.streak_days > 0) {
                profileImg.classList.add('ring-4', 'ring-orange-400', 'ring-opacity-50', 'animate-pulse-slow');
            } else {
                profileImg.classList.remove('ring-4', 'ring-orange-400', 'ring-opacity-50', 'animate-pulse-slow');
            }
        }

        // --- 2. XP Bar & Level ---
        const elLvl = document.getElementById('user-level-badge');
        if(elLvl) elLvl.innerText = `${I18n.t('header.level_badge')} ${p.level}`;

        const elSub = document.getElementById('profile-subtitle');
        if(elSub) elSub.innerText = `Nível ${p.level} • ${p.xp} / ${Gamification.getNextLevelXP(p.level)} XP`;

        const elName = document.getElementById('header-username');
        if(elName) {
             if(p.name) elName.innerHTML = `Olá, ${p.name.split(' ')[0]}`;
             else elName.innerHTML = `Quantix<span class="text-brand-500">AI</span>`;
        }

        // XP Bar
        const nextReq = Gamification.getNextLevelXP(p.level);
        const progress = (p.xp / nextReq) * 100;
        const elBar = document.getElementById('xp-bar');
        if(elBar) elBar.style.width = `${Math.min(progress, 100)}%`;

        // Streak & Credits
        const elStreak = document.getElementById('streak-display');
        if(elStreak) elStreak.innerText = p.streak_days;

        const elCredits = document.getElementById('credits-display');
        if(elCredits) elCredits.innerText = p.credits;

        // --- 3. Badges ---
        const badgeContainer = document.getElementById('badges-grid');
        if (badgeContainer) {
            badgeContainer.innerHTML = '';
            const allBadgesDef = [
                { id: 'first_step', icon: 'fa-shoe-prints', name: 'Início' },
                { id: 'water_master', icon: 'fa-tint', name: 'Hidratado' },
                { id: 'streak_3', icon: 'fa-fire', name: 'Focado' },
                { id: 'streak_7', icon: 'fa-fire-alt', name: 'Imparável' },
                { id: 'expert', icon: 'fa-brain', name: 'Expert' }
            ];

            const unlocked = p.achievements_unlocked || [];

            allBadgesDef.forEach(b => {
                const earned = unlocked.includes(b.id);
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
    },

    triggerConfetti: () => {
        // Simple confetti implementation
        const count = 200;
        const defaults = {
            origin: { y: 0.7 },
            zIndex: 9999
        };

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9999';
        container.style.overflow = 'hidden';
        document.body.appendChild(container);

        const colors = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#a855f7'];

        for (let i = 0; i < 50; i++) {
            const confetto = document.createElement('div');
            confetto.style.position = 'absolute';
            confetto.style.width = '10px';
            confetto.style.height = '10px';
            confetto.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetto.style.left = Math.random() * 100 + 'vw';
            confetto.style.top = '-10px';
            confetto.style.opacity = Math.random();
            confetto.style.transform = `rotate(${Math.random() * 360}deg)`;

            // Animation
            const duration = Math.random() * 3 + 2;
            confetto.style.transition = `top ${duration}s ease-out, transform ${duration}s linear`;

            container.appendChild(confetto);

            setTimeout(() => {
                confetto.style.top = '110vh';
                confetto.style.transform = `rotate(${Math.random() * 360 + 720}deg)`;
            }, 100);
        }

        setTimeout(() => {
            container.remove();
        }, 5000);
    }
};

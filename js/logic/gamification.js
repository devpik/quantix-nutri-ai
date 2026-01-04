import { DB } from '../data/database.js';

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
                message = "Refeição registrada!";
                break;
            case 'combo_entry':
                xp = 100;
                message = "Combo registrado!";
                break;
            case 'daily_streak':
                xp = 100; // Bonus for keeping streak
                message = "Sequência mantida!";
                break;
            default:
                xp = 0;
        }

        // Bonus: Colorful Plate (Detected > 3 items in a single analysis/entry)
        if (metadata.itemCount && metadata.itemCount >= 3) {
            xp += 30;
            message += " + Bônus Prato Colorido! 🥗";
        }

        return { xp, message };
    },

    addXP: (amount) => {
        const p = DB.getProfile();
        const oldLevel = p.level;
        p.xp += amount;

        // Check Level Up
        // Current logic: We accumulate total XP.
        // We need to calculate if current XP > required for next level.
        // Let's assume cumulative XP.
        // Level 1: 0-500. Level 2: 500-1000 (diff 500? or Level*500 means 2*500=1000 for next?)
        // Interpretation: XP to reach Level N+1 = N * 500.
        // This usually means "XP needed for NEXT level".
        // If I am Level 1, I need 1*500 = 500 XP to reach Level 2.
        // If I am Level 2, I need 2*500 = 1000 XP (total 1500) or just 1000 delta?
        // Let's stick to a simple threshold: Threshold = Level * 500.
        // If p.xp >= (p.level * 500), Level Up.

        let nextLevelThreshold = p.level * 500;

        if (p.xp >= nextLevelThreshold) {
            p.level++;
            p.credits += 5; // Reward
            p.xp = p.xp - nextLevelThreshold; // Optional: Reset XP or Keep Accumulating?
            // "xp_total" suggests accumulating. But visual bars usually reset.
            // Let's Keep Accumulating for "Total XP" but the threshold increases.
            // Wait, if I keep accumulating, then at Level 2 (Total 500), I need 1000 Total to reach Level 3?
            // "Level * 500" as delta or total?
            // Standard RPG: XP Curve.
            // Let's implementation: XP resets on level up (visual bar 0-100%) OR XP is total and we calculate thresholds.
            // Requirement says "XP_Next_Level = Level * 500".
            // Let's assume this is the Delta.
            // So I subtract the threshold from current XP, or I verify against total.
            // Simpler for this PWA: XP resets visual, but maybe we keep a "total_lifetime_xp" hidden if we wanted.
            // The request says "xp_total: Integer".
            // Let's assume we keep accumulating.
            // Level 1 -> 2 requires 500. Total 500.
            // Level 2 -> 3 requires 1000. Total 1500.
            // Formula for Total XP for Level L: 500 * L*(L-1)/2 ? No, that's complex.
            // Let's go with: p.xp is the progress to next level. When it hits target, level++, xp = 0.
            // That's easiest for "Barra de progresso visual (XP atual / XP próximo nível)".

            p.xp = 0; // Reset for next level progress
            Gamification.triggerLevelUp(p.level);
        }

        DB.set('profile', p);
        Gamification.updateUI();
    },

    triggerLevelUp: (newLevel) => {
        Gamification.triggerConfetti();
        alert(`🎉 LEVEL UP! Você subiu para o Nível ${newLevel}!\nGanhou +5 Créditos IA.`);
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
            // We verify if we should add this XP directly (handled inside addXP normally)
            // But we don't want to alert every time.
            p.xp += xp; // Add manually to avoid alert spam or use addXP silent?
            // Let's use addXP but maybe silence it? For now, standard addXP is fine.
            // Actually, let's just increment and save.
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

        // Mapping 'badges' to 'achievements_unlocked'
        // We will maintain p.achievements_unlocked as the source of truth
        // But for compatibility with existing UI that uses p.badges, we might ensure they are synced or UI updated.
        // Existing UI in gamification.js uses p.badges. I will update it to use achievements_unlocked.

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
            alert(`🏆 Novas Conquistas: ${newBadges.join(', ')}`);
            Gamification.updateUI();
        }
    },

    updateUI: () => {
        const p = DB.getProfile();

        // --- 1. Header Profile Image & Streak Glow ---
        const headerContainer = document.querySelector('.header-profile-container') || document.getElementById('header-username').parentNode;

        // Check if we already injected the structure. If not, do it.
        // Existing structure in index.html (inferred):
        // <div> <h1 id="header-username">...</h1> <p id="profile-subtitle">...</p> </div>
        // We want to add the image to the left.

        // I will rely on finding elements by ID and modifying them.
        // Since I cannot rewrite index.html easily to change structure without reading it,
        // I will just update the elements I know exist or add classes.

        // However, the request asks for "Header dinâmico que exiba: Foto circular com borda iluminada se o streak estiver ativo".
        // I'll assume I can manipulate the DOM here.

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
        if(elLvl) elLvl.innerText = `LVL ${p.level}`;

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

        // We can inject a script tag for canvas-confetti if not present, or use a simple CSS fallback.
        // For reliability in this environment without external script loading guarantees,
        // I will create a simple DOM-based confetti.

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

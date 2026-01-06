import { DB } from '../data/database.js';
import { API } from '../services/api.js';
import { App } from '../app.js';
import { Shopping } from './shopping.js';
import { Modal, UI } from './interface.js';
import { I18n } from '../services/i18n.js';

export const Planner = {
    init: () => {
        // Will be called by App.init
        // Can setup listeners here if needed
    },

    render: () => {
        const container = document.getElementById('planner-container');
        if (!container) return; // Should be injected in HTML

        const plan = DB.getPlanner();

        // Header / Actions
        let html = `
            <div class="flex justify-between items-center mb-4 px-2">
                <h3 class="text-xs font-bold text-gray-500 uppercase">${I18n.t("planner.title")}</h3>
                <div class="flex gap-2">
                    ${plan ? `<button onclick="Shopping.generate()" class="text-[10px] font-bold bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 transition">
                        <i class="fas fa-shopping-cart mr-1"></i> ${I18n.t("planner.btn_list")}
                    </button>` : ''}
                    <button onclick="Planner.generate()" class="text-[10px] font-bold bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg hover:bg-brand-200 transition flex items-center gap-1">
                        <i class="fas fa-magic"></i> ${plan ? I18n.t("planner.btn_regenerate") : I18n.t("planner.btn_generate")}
                    </button>
                </div>
            </div>
        `;

        if (!plan) {
            html += `
                <div class="text-center py-10 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div class="w-16 h-16 bg-brand-50 dark:bg-brand-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-500">
                        <i class="fas fa-calendar-alt text-2xl"></i>
                    </div>
                    <h4 class="text-sm font-bold text-gray-800 dark:text-white mb-1">${I18n.t("planner.empty_title")}</h4>
                    <p class="text-xs text-gray-400 mb-4 max-w-[200px] mx-auto">${I18n.t("planner.empty_desc")}</p>
                </div>
            `;
            container.innerHTML = html;
            return;
        }

        // Render Days
        html += `<div class="space-y-3 pb-20">`;
        plan.forEach((day, index) => {
            html += `
                <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden group">
                    <div class="p-4 flex justify-between items-center cursor-pointer bg-gray-50 dark:bg-gray-900/50" onclick="Planner.toggleDay(${index})">
                        <h4 class="font-bold text-sm text-gray-700 dark:text-gray-200">${day.day}</h4>
                        <i id="icon-day-${index}" class="fas fa-chevron-down text-gray-400 text-xs transition-transform"></i>
                    </div>

                    <div id="content-day-${index}" class="hidden p-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
                        ${Planner.renderMealRow(day.meals.breakfast, UI.getCategoryLabel('Café da Manhã'), 'Café da Manhã', 'coffee', index, 'breakfast')}
                        ${Planner.renderMealRow(day.meals.lunch, UI.getCategoryLabel('Almoço'), 'Almoço', 'utensils', index, 'lunch')}
                        ${Planner.renderMealRow(day.meals.snack, UI.getCategoryLabel('Lanche'), 'Lanche', 'apple-alt', index, 'snack')}
                        ${Planner.renderMealRow(day.meals.dinner, UI.getCategoryLabel('Jantar'), 'Jantar', 'moon', index, 'dinner')}
                    </div>
                </div>
            `;
        });
        html += `</div>`;

        container.innerHTML = html;
    },

    renderMealRow: (meal, label, rawCategory, icon, dayIndex, mealKey) => {
        if (!meal) return '';
        // Escape quotes for safety (single and double)
        const descSafe = meal.desc.replace(/"/g, '&quot;').replace(/'/g, "\\'");

        return `
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase">
                    <i class="fas fa-${icon}"></i> ${label}
                </div>
                <div class="pl-2 border-l-2 border-gray-100 dark:border-gray-700">
                    <p id="desc-${dayIndex}-${mealKey}" class="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">${meal.desc}</p>
                    <div class="flex justify-between items-center mt-2">
                        <span class="text-[10px] font-bold text-gray-400">~${meal.estimated_cals} kcal</span>
                        <div class="flex gap-2">
                            <button onclick="Planner.simplify('${descSafe}', ${meal.estimated_cals}, ${dayIndex}, '${mealKey}')"
                                title="${I18n.t("planner.simplify")}"
                                class="text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded hover:bg-yellow-200 transition">
                                <i class="fas fa-bolt"></i>
                            </button>
                            <button onclick="Planner.logMeal('${descSafe}', ${meal.estimated_cals}, '${rawCategory}')"
                                class="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded hover:bg-brand-500 hover:text-white transition">
                                ${I18n.t("planner.log_meal")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    simplify: async (desc, cals, dayIndex, mealKey) => {
        const descEl = document.getElementById(`desc-${dayIndex}-${mealKey}`);
        if(descEl) {
             descEl.innerHTML = `<span class="animate-pulse"><i class="fas fa-spinner fa-spin mr-1"></i> ${I18n.t("planner.simplifying")}</span>`;
        }

        try {
            const newMeal = await API.simplifyMeal(desc, cals);

            const plan = DB.getPlanner();
            if (plan && plan[dayIndex] && plan[dayIndex].meals[mealKey]) {
                plan[dayIndex].meals[mealKey] = newMeal;
                DB.set('planner', plan);
                Planner.render();
            }
        } catch (e) {
            console.error(e);
            alert(e.message || "Erro ao simplificar.");
            Planner.render(); // Restore
        }
    },

    toggleDay: (index) => {
        const content = document.getElementById(`content-day-${index}`);
        const icon = document.getElementById(`icon-day-${index}`);

        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            content.classList.add('animate-slide-down');
            icon.style.transform = 'rotate(180deg)';
        } else {
            content.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
        }
    },

    generate: async () => {
        const container = document.getElementById('planner-container');
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-brand-500 animate-pulse">
            <i class="fas fa-magic text-4xl mb-4"></i>
            <p class="text-xs font-bold">${I18n.t("planner.creating")}</p>
        </div>`;

        try {
            await API.generateWeeklyPlan();
            Planner.render();
        } catch (e) {
            alert(e.message);
            Planner.render(); // Revert to empty or old state
        }
    },

    logMeal: (desc, cals, category) => {
        // Option 1: Quick Add
        // Option 2: Open Modal with pre-filled data (Better for refinement)

        // Let's use Modal open logic but fill the fields
        Modal.open('add-food');

        // Switch to Manual Mode
        setTimeout(() => {
            Input.setMode('manual');
            Input.setCat(category); // Need to make sure Input.setCat handles translated labels correctly if passed

            document.getElementById('man-desc').value = desc;
            document.getElementById('man-cals').value = cals;
            // Macros are unknown, user can adjust or leave 0
        }, 300);
    }
};

window.Planner = Planner;

import { DB } from '../data/database.js';
import { API } from '../services/api.js';
import { I18n } from '../services/i18n.js';

export const Shopping = {
    generate: async () => {
        const plan = DB.getPlanner();
        if (!plan) return alert(I18n.t("shopping.alert_no_plan"));

        const btn = document.querySelector('button[onclick="Shopping.generate()"]');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
            btn.disabled = true;
        }

        try {
            await API.generateShoppingList(plan);
            Shopping.render(); // This assumes we are viewing the shopping list, or opens it
            // Logic to switch view to shopping list modal or section
            Modal.open('shopping-list');
        } catch (e) {
            alert(e.message);
        } finally {
            if(btn) {
                btn.innerHTML = `<i class="fas fa-shopping-cart mr-1"></i> ${I18n.t("planner.btn_list")}`;
                btn.disabled = false;
            }
        }
    },

    render: () => {
        const list = DB.getShoppingList();
        const container = document.getElementById('shopping-list-container');
        if (!container) return;

        if (!list) {
            container.innerHTML = `<p class="text-center text-xs text-gray-400 py-4">${I18n.t("shopping.empty")}</p>`;
            return;
        }

        let html = `<div class="space-y-4 pb-20">`;

        // Share Button
        html += `
            <button onclick="Shopping.share()" class="w-full mb-2 py-3 bg-green-500 text-white rounded-xl font-bold text-xs shadow-lg flex justify-center items-center gap-2">
                <i class="fab fa-whatsapp"></i> ${I18n.t("shopping.btn_share")}
            </button>
        `;

        list.forEach((cat, catIndex) => {
            html += `
                <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div class="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                        <h4 class="text-xs font-bold text-gray-500 uppercase">${cat.category}</h4>
                    </div>
                    <div class="p-2 space-y-1">
            `;

            cat.items.forEach((item, itemIndex) => {
                const isChecked = item.checked ? 'checked' : '';
                const lineThrough = item.checked ? 'line-through text-gray-300' : 'text-gray-800 dark:text-white';

                html += `
                    <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition">
                        <div class="relative flex items-center">
                            <input type="checkbox" ${isChecked}
                                onchange="Shopping.toggleCheck(${catIndex}, ${itemIndex})"
                                class="w-5 h-5 rounded border-gray-300 text-brand-500 focus:ring-brand-500 transition">
                        </div>
                        <div class="flex-1 ${lineThrough} text-xs font-bold transition-colors duration-200">
                            ${item.name} <span class="text-[10px] text-gray-400 font-normal ml-1">(${item.quantity})</span>
                        </div>
                    </label>
                `;
            });

            html += `</div></div>`;
        });

        html += `</div>`;
        container.innerHTML = html;
    },

    toggleCheck: (catIdx, itemIdx) => {
        const list = DB.getShoppingList();
        if (list && list[catIdx] && list[catIdx].items[itemIdx]) {
            list[catIdx].items[itemIdx].checked = !list[catIdx].items[itemIdx].checked;
            DB.set('shopping_list', list);
            Shopping.render();
        }
    },

    share: () => {
        const list = DB.getShoppingList();
        if (!list) return;

        let text = I18n.t("shopping.share_header");
        list.forEach(cat => {
            text += `*${cat.category}*\n`;
            cat.items.forEach(item => {
                const check = item.checked ? "✅" : "⬜";
                text += `${check} ${item.name} (${item.quantity})\n`;
            });
            text += "\n";
        });

        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    }
};

window.Shopping = Shopping;

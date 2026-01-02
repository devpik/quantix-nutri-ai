import { API } from '../services/api.js';
import { Analytics } from './analytics.js';

export const ChatUI = {
    isOpen: false,

    init: () => {
        // 1. Create Floating Button
        const btn = document.createElement('button');
        btn.id = "chat-fab";
        btn.className = "fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-tr from-brand-500 to-emerald-400 rounded-full shadow-lg shadow-brand-500/40 z-50 flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-90 animate-fade-in";
        btn.innerHTML = `<i class="fas fa-comment-medical text-2xl"></i>`;
        btn.onclick = ChatUI.toggle;
        document.body.appendChild(btn);

        // 2. Create Chat Modal
        const modal = document.createElement('div');
        modal.id = "chat-modal";
        modal.className = "fixed inset-0 z-[60] hidden flex-col justify-end sm:justify-center sm:items-center bg-black/50 backdrop-blur-sm animate-fade-in";
        modal.innerHTML = `
            <div class="bg-white dark:bg-dark-card w-full h-[85vh] sm:h-[600px] sm:w-[400px] sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up relative border border-gray-100 dark:border-dark-border">

                <!-- Header -->
                <div class="p-4 bg-brand-500 text-white flex justify-between items-center shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                            <i class="fas fa-robot text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-sm">NutriCoach IA</h3>
                            <div id="chat-context-badge" class="text-[9px] bg-white/20 px-2 py-0.5 rounded-full inline-block mt-1 font-bold">
                                Analisando: Hoje
                            </div>
                        </div>
                    </div>
                    <button onclick="ChatUI.toggle()" class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Messages Area -->
                <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-dark-bg custom-scrollbar scroll-smooth">
                    <!-- Welcome Message -->
                    <div class="flex gap-3">
                        <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 text-xs mt-1">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="bg-white dark:bg-dark-card p-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-dark-border shadow-sm max-w-[85%]">
                            <p class="text-xs text-gray-600 dark:text-gray-300">Olá! Sou seu assistente nutricional. Posso analisar seus dados e te dar dicas. Como posso ajudar?</p>
                        </div>
                    </div>
                </div>

                <!-- Input Area -->
                <div class="p-3 bg-white dark:bg-dark-card border-t border-gray-100 dark:border-dark-border shrink-0">
                    <div class="relative flex items-end gap-2">
                        <textarea id="chat-input" rows="1" placeholder="Pergunte algo..." class="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl py-3 pl-4 pr-10 text-sm outline-none resize-none max-h-32 focus:ring-1 focus:ring-brand-500 text-gray-800 dark:text-white" oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"></textarea>

                        <button onclick="ChatUI.sendMessage()" class="bg-brand-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed" id="btn-chat-send">
                            <i class="fas fa-paper-plane text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Auto update indicator on load
        ChatUI.updateIndicator();
    },

    toggle: () => {
        const modal = document.getElementById('chat-modal');
        ChatUI.isOpen = !ChatUI.isOpen;
        if (ChatUI.isOpen) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            ChatUI.updateIndicator();
            document.getElementById('chat-messages').scrollTop = document.getElementById('chat-messages').scrollHeight;
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    updateIndicator: () => {
        const badge = document.getElementById('chat-context-badge');
        if (!badge) return;

        const days = Analytics.currentRange || 1;
        const text = days === 1 ? "Hoje" : `Últimos ${days} Dias`;
        badge.innerText = `Analisando: ${text}`;
    },

    renderMessage: (text, sender) => {
        const container = document.getElementById('chat-messages');
        const isUser = sender === 'user';

        const div = document.createElement('div');
        div.className = `flex gap-3 ${isUser ? 'justify-end' : ''} animate-fade-in`;

        const avatar = isUser ? '' : `
            <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 text-xs mt-1">
                <i class="fas fa-robot"></i>
            </div>
        `;

        const bubble = `
            <div class="${isUser
                ? 'bg-brand-500 text-white rounded-tr-none'
                : 'bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border text-gray-600 dark:text-gray-300 rounded-tl-none'}
                p-3 rounded-2xl shadow-sm max-w-[85%] text-xs leading-relaxed">
                ${text.replace(/\n/g, '<br>')}
            </div>
        `;

        div.innerHTML = isUser ? bubble : (avatar + bubble);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    renderLoading: () => {
        const container = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.id = "chat-loading";
        div.className = "flex gap-3 animate-fade-in";
        div.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 text-xs mt-1">
                <i class="fas fa-robot"></i>
            </div>
            <div class="bg-white dark:bg-dark-card p-3 rounded-2xl rounded-tl-none border border-gray-100 dark:border-dark-border shadow-sm">
                <div class="flex gap-1">
                    <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                    <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                </div>
            </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    removeLoading: () => {
        const el = document.getElementById('chat-loading');
        if (el) el.remove();
    },

    sendMessage: async () => {
        const inp = document.getElementById('chat-input');
        const btn = document.getElementById('btn-chat-send');
        const text = inp.value.trim();

        if (!text) return;

        ChatUI.renderMessage(text, 'user');
        inp.value = '';
        inp.style.height = 'auto';

        btn.disabled = true;
        ChatUI.renderLoading();

        try {
            const response = await API.sendChatMessage(text);
            ChatUI.removeLoading();
            ChatUI.renderMessage(response, 'ai');
        } catch (e) {
            ChatUI.removeLoading();
            ChatUI.renderMessage("Desculpe, tive um erro ao processar sua mensagem. Tente novamente.", 'ai');
            console.error(e);
        } finally {
            btn.disabled = false;
        }
    }
};

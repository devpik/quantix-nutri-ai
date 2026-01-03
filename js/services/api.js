import { CONFIG } from '../config.js';
import { DB } from '../data/database.js';
import { Profile } from '../logic/profile.js';
import { Input, UI, Modal } from '../ui/interface.js';
import { Gamification } from '../logic/gamification.js';
import { App } from '../app.js';
import { Context } from './context.js';

// reviewData moved to App state (App.reviewItems)

export const API = {
    sendChatMessage: async (userMessage) => {
        const p = DB.getProfile();
        // Check credits or if chat is free (assuming free or same credit pool)
        if (p.credits <= 0) throw new Error("Sem créditos IA!");

        const systemPrompt = Context.generateSystemPrompt();

        const payload = {
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { text: "Mensagem do Usuário: " + userMessage }
                ]
            }]
        };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (!json.candidates || !json.candidates[0]) {
            console.error("Erro na API Chat:", json);
            throw new Error("Erro na comunicação com a IA.");
        }

        Profile.updateApiUsage(json.usageMetadata);
        return json.candidates[0].content.parts[0].text;
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
            const prompt = `
                Com base nos macros que faltam (${rem.cals}kcal, ${rem.p}g prot, ${rem.c}g carbo, ${rem.f}g gord), sugira ALIMENTOS SIMPLES e práticos (ex: frango grelhado, ovo cozido, arroz, fruta).

                IMPORTANTE: O usuário está monitorando saúde metabólica. Priorize alimentos com BAIXO Sódio e BAIXO Açúcar.

                NÃO sugira receitas complexas ou pratos gourmet. Seja direto e cite 2 ou 3 opções individuais.
            `;
            const payload = { contents: [{ parts: [{ text: prompt }] }] };
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
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

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            Profile.updateApiUsage(json.usageMetadata);
            const recipe = json.candidates[0].content.parts[0].text;
            recipeText.innerText = recipe;
            resultArea.classList.remove('hidden');

            if (p.notificationsEnabled) {
                new Notification("Nova Receita Sugerida!", { body: "Confira a sugestão do chef para o seu Limpa Geladeira." });
            }

            p.credits--; DB.set('profile', p);
            Gamification.updateUI();

            UI.clearImage('fridge');
            document.getElementById('fridge-ingredients').value = '';

        } catch(e) {
            console.error(e);
            alert("Erro ao gerar receita.");
            btn.classList.remove('hidden');
        } finally {
            load.classList.add('hidden');
        }
    },

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

                IMPORTANTE: Se houver uma imagem, use-a como referência principal. Analise a imagem e identifique TODOS os componentes distintos visíveis.
                Considere que o usuário indicou um fator de porção de ${UI.portionSize}x sobre o que é descrito ou visível.

                Para cada componente, estime seu peso em gramas, calorias e macros.
                Estime também Sódio (mg) e Açúcar (g) para cada item.

                CALCULE o "score" (Qualidade Alimentar) de 1 a 10 para CADA item, considerando:
                - 1-4: Alimentos ultraprocessados, alto açúcar/sódio, frituras ou embutidos.
                - 5-7: Refeições mistas, "normais" mas com alguns processados ou desequilíbrio leve.
                - 8-10: Alimentos in natura, ricos em fibras, vegetais, frutas, proteínas magras e gorduras boas.

                Retorne APENAS um JSON com a seguinte estrutura de Array:
                {
                  "items": [
                    {
                      "desc": "Nome do Item",
                      "weight": 100,
                      "cals": 0,
                      "macros": { "p": 0, "c": 0, "f": 0, "fib": 0 },
                      "micros": { "sodium": 0, "sugar": 0, "potassium": 0, "vitamins": {} },
                      "score": 5
                    }
                  ],
                  "total_cals": 0
                }
            `;

            const payload = {
                contents: [{
                    parts: [
                        { text: prompt },
                        ...(base64 ? [{ inlineData: { mimeType: "image/jpeg", data: base64 } }] : [])
                    ]
                }]
            };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
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

            Profile.updateApiUsage(json.usageMetadata);

            // Pass results to App for Review
            App.initReview(result.items);

            // Deduct Credit
            p.credits--; DB.set('profile', p);

            // Reset Inputs
            UI.clearImage();
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

    recalculateReview: async () => {
        // Deprecated in favor of client-side recalculation in App.js
        console.warn("Legacy recalculateReview called");
    },

    confirmReview: () => {
        // Handled by App.js
    },

    cancelReview: () => {
        // Handled by App.js
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

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (!json.candidates || !json.candidates[0]) {
                console.error("Erro na API Gemini:", json);
                Profile.updateApiUsage(json.usageMetadata);
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

    generateWeeklyPlan: async () => {
        const p = DB.getProfile();
        if (p.credits <= 0) return alert("Sem créditos IA! Recarregue ou suba de nível.");

        try {
            const prompt = `
                Atue como um Nutricionista e Chef Prático.
                Gere um PLANEJAMENTO SEMANAL (7 dias, Segunda a Domingo) para o usuário.

                Perfil do Usuário:
                - Meta Calórica: ${p.target} kcal/dia
                - Estratégia: ${p.strategy}
                - Restrições/Preferências: ${p.restrictions || 'Nenhuma'}

                Diretrizes:
                1. FOCO EM PRATICIDADE: Repita pratos (ex: jantar de seg = almoço de ter) para facilitar o cozimento.
                2. Use ingredientes acessíveis e comuns no Brasil.
                3. Retorne APENAS um JSON estrito (sem markdown) com a seguinte estrutura:
                {
                    "week": [
                        {
                            "day": "Segunda-feira",
                            "meals": {
                                "breakfast": { "desc": "...", "estimated_cals": 0 },
                                "lunch": { "desc": "...", "estimated_cals": 0 },
                                "snack": { "desc": "...", "estimated_cals": 0 },
                                "dinner": { "desc": "...", "estimated_cals": 0 }
                            }
                        },
                        ... (até Domingo)
                    ]
                }
            `;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (!json.candidates || !json.candidates[0]) throw new Error("Erro na geração.");

            let txt = json.candidates[0].content.parts[0].text;
            txt = txt.replace(/```json/g, '').replace(/```/g, ''); // Clean markdown

            const result = JSON.parse(txt);

            // Persist
            DB.set('planner', result.week);

            // Refresh profile to avoid race condition
            const currentP = DB.getProfile();
            currentP.credits -= 5; // Higher cost for full plan
            DB.set('profile', currentP);

            return result.week;

        } catch (e) {
            console.error(e);
            throw new Error("Não foi possível gerar o plano. Tente novamente.");
        }
    },

    simplifyMeal: async (mealDescription, targetCals) => {
        const p = DB.getProfile();
        if (p.credits <= 0) throw new Error("Sem créditos IA!");

        const prompt = `
            Você é um nutricionista prático. O usuário quer substituir a refeição: "${mealDescription}" (~${targetCals} kcal).
            Sugira uma alternativa ULTRA SIMPLES (ex: "Ovos mexidos e fruta", "Sanduíche rápido") que exija o mínimo de preparo (max 5 min) e mantenha as calorias próximas.
            Retorne apenas JSON: { "desc": "Novo Prato Rápido", "estimated_cals": 0 }
        `;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (!json.candidates || !json.candidates[0]) throw new Error("Erro na simplificação.");

        let txt = json.candidates[0].content.parts[0].text;
        txt = txt.replace(/```json/g, '').replace(/```/g, '');

        const result = JSON.parse(txt);

        Profile.updateApiUsage(json.usageMetadata);
        p.credits--;
        DB.set('profile', p);
        Gamification.updateUI();

        return result;
    },

    generateShoppingList: async (plannerData) => {
        const p = DB.getProfile();
        // Consome menos créditos ou nenhum se já tiver o plano? Vamos cobrar 1 crédito.

        try {
            // Flatten planner meals into a text list
            let allMeals = [];
            plannerData.forEach(d => {
                Object.values(d.meals).forEach(m => allMeals.push(m.desc));
            });

            const prompt = `
                Analise esta lista de refeições de uma semana:
                "${allMeals.join('; ')}"

                Objetivo: Criar uma LISTA DE COMPRAS consolidada e inteligente.

                Ações:
                1. Extraia os ingredientes base necessários.
                2. Estime a quantidade TOTAL aproximada para a semana (ex: se aparece frango 3x, some).
                3. Agrupe por categorias de mercado (Açougue, Hortifruti, Mercearia, Laticínios, Outros).

                Retorne APENAS um JSON estrito com esta estrutura:
                {
                    "shopping_list": [
                        {
                            "category": "Açougue",
                            "items": [
                                { "name": "Peito de Frango", "quantity": "1kg" },
                                ...
                            ]
                        },
                        ...
                    ]
                }
            `;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${CONFIG.apiKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (!json.candidates || !json.candidates[0]) throw new Error("Erro na geração da lista.");

            let txt = json.candidates[0].content.parts[0].text;
            txt = txt.replace(/```json/g, '').replace(/```/g, '');

            const result = JSON.parse(txt);

            // Add checked state to items
            result.shopping_list.forEach(cat => {
                cat.items.forEach(item => item.checked = false);
            });

            DB.set('shopping_list', result.shopping_list);

            // Refresh profile to avoid race condition
            const currentP = DB.getProfile();
            currentP.credits--;
            DB.set('profile', currentP);

            return result.shopping_list;

        } catch (e) {
            console.error(e);
            throw new Error("Erro ao gerar lista de compras.");
        }
    }
};

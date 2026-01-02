import { CONFIG } from '../config.js';
import { DB } from '../data/database.js';
import { Profile } from '../logic/profile.js';
import { Input, UI, Modal } from '../ui/interface.js';
import { Gamification } from '../logic/gamification.js';
import { App } from '../app.js';

let reviewData = null; // Module state

export const API = {
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

                IMPORTANTE: Se houver uma imagem, use-a como referência principal. Se não houver, baseie-se inteiramente na descrição textual fornecida para calcular as quantidades.
                Considere que o usuário indicou um fator de porção de ${UI.portionSize}x sobre o que é descrito ou visível.

                Estime também com precisão científica: Sódio (mg), Açúcar total (g) e principais Vitaminas.
                Se o alimento for industrializado, considere a média de mercado.

                Retorne APENAS um objeto JSON válido, sem formatação markdown, com a seguinte estrutura:
                {
                  "desc": "Nome curto",
                  "cals": 0,
                  "macros": { "p": 0, "c": 0, "f": 0, "fib": 0 },
                  "micros": { "sodium": 0, "sugar": 0, "potassium": 0, "vitamins": { "a": 0, "c": 0, "d": 0 } },
                  "score": 0
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

            Profile.updateApiUsage(json.usageMetadata);

            // FEATURE: Populate Review Area Instead of Adding Immediately
            reviewData = result;

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
         const newDesc = document.getElementById('rev-desc').value;
         const btn = document.getElementById('btn-recalc');
         btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

         try {
            const prompt = `
                Você é um nutricionista preciso.
                Analise APENAS com base neste texto: "${newDesc}". Contexto: ${Input.cat}.
                Calcule as calorias e macros para este item.
                Estime Sódio (mg) e Açúcar (g).
                Retorne APENAS um JSON:
                {
                  "desc": "Nome curto",
                  "cals": 0,
                  "macros": { "p": 0, "c": 0, "f": 0, "fib": 0 },
                  "micros": { "sodium": 0, "sugar": 0, "potassium": 0, "vitamins": {} },
                  "score": 0
                }
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
            Profile.updateApiUsage(json.usageMetadata);
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
            reviewData = result;
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
        if(!reviewData) return;

        const finalData = {
            desc: document.getElementById('rev-desc').value,
            cals: parseInt(document.getElementById('rev-cals').value) || 0,
            macros: {
                p: parseInt(document.getElementById('rev-p').value) || 0,
                c: parseInt(document.getElementById('rev-c').value) || 0,
                f: parseInt(document.getElementById('rev-f').value) || 0,
                fib: 0
            },
            micros: reviewData.micros || { sodium: 0, sugar: 0, potassium: 0, vitamins: {} },
            score: 5,
            category: Input.cat,
            timestamp: Date.now(),
            type: 'food'
        };

        App.addMealToDB(finalData);

        // Reset UI
        document.getElementById('inp-area-review').classList.add('hidden');
        document.getElementById('inp-wrapper-normal').classList.remove('hidden');
        reviewData = null;
        Modal.close('add-food');
        alert(`Registrado: ${finalData.desc}`);
    },

    cancelReview: () => {
         document.getElementById('inp-area-review').classList.add('hidden');
         document.getElementById('inp-wrapper-normal').classList.remove('hidden');
         reviewData = null;
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
    }
};

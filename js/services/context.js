import { DB } from '../data/database.js';
import { Analytics } from '../ui/analytics.js';

export const Context = {
    // Get data filtered by the current global range (Analytics.currentRange)
    getFilteredData: () => {
        const range = Analytics.currentRange || 1;
        const today = moment();
        const start = moment().subtract(range - 1, 'days'); // Inclusive of today

        // Get all raw data
        const allMeals = DB.getMeals();
        const allStats = DB.getDayStats();
        const profile = DB.getProfile();

        // Filter Meals & Exercises
        const filteredMeals = allMeals.filter(m => {
            const mDate = moment(m.timestamp);
            return mDate.isSameOrAfter(start, 'day') && mDate.isSameOrBefore(today, 'day');
        });

        // Calculate Totals for the Period
        let totalCals = 0;
        let totalBurned = 0;
        let totalP = 0, totalC = 0, totalF = 0;
        let totalSodium = 0, totalSugar = 0;
        let foodCount = 0;

        filteredMeals.forEach(m => {
            if (m.type === 'exercise') {
                totalBurned += m.cals;
            } else {
                foodCount++;
                totalCals += m.cals;
                totalP += (m.macros.p || 0);
                totalC += (m.macros.c || 0);
                totalF += (m.macros.f || 0);
                if (m.micros) {
                    totalSodium += (m.micros.sodium || 0);
                    totalSugar += (m.micros.sugar || 0);
                }
            }
        });

        // Filter Water (Day Stats)
        let totalWater = 0;
        for (let i = 0; i < range; i++) {
            const d = moment().subtract(i, 'days').format('YYYY-MM-DD');
            if (allStats[d]) {
                totalWater += (allStats[d].water || 0);
            }
        }

        // Summary Object
        return {
            range: range,
            period: range === 1 ? "Hoje" : `Últimos ${range} dias`,
            totals: {
                intake: totalCals,
                burned: totalBurned,
                macros: { p: totalP, c: totalC, f: totalF },
                micros: { sodium: totalSodium, sugar: totalSugar },
                water: totalWater
            },
            averages: {
                cals: range > 1 ? Math.round(totalCals / range) : totalCals,
                water: range > 1 ? Math.round(totalWater / range) : totalWater,
                score: foodCount > 0 ? (filteredMeals.filter(m => m.type === 'food').reduce((acc, m) => acc + (m.score || 5), 0) / foodCount).toFixed(1) : 'N/A'
            },
            target: {
                cals: profile.target * range, // Total budget for the period
                water: 2500 * range // Assuming 2.5L target
            },
            meals: filteredMeals // Raw list for detailed analysis if needed
        };
    },

    // Generate the System Prompt for the LLM
    generateSystemPrompt: () => {
        const data = Context.getFilteredData();
        const profile = DB.getProfile();

        let prompt = `
        VOCÊ É UM NUTRICIONISTA E COACH DE SAÚDE EXPERIENTE.
        Seu objetivo é analisar os dados do usuário e dar conselhos personalizados.

        CONTEXTO DE ANÁLISE: ${data.period}

        PERFIL DO USUÁRIO:
        - Nome: ${profile.name}
        - Meta Diária: ${profile.target} kcal
        - Objetivo: ${profile.target < 2000 ? 'Perder Peso' : 'Manter/Ganhar Peso'} (Inferido)

        DADOS DO PERÍODO (${data.period}):
        - Total Consumido: ${data.totals.intake} kcal (Meta aprox: ${data.target.cals})
        - Total Gasto (Exercício): ${data.totals.burned} kcal
        - Macros Totais: Proteína ${data.totals.macros.p}g, Carbo ${data.totals.macros.c}g, Gordura ${data.totals.macros.f}g.
        - Média de Qualidade Alimentar (Score 1-10): ${data.averages.score}
        - Água Total: ${data.totals.water}ml (Média: ${data.averages.water}ml/dia)
        - Sódio Total: ${data.totals.micros.sodium}mg
        - Açúcar Total: ${data.totals.micros.sugar}g

        LISTA DE REFEIÇÕES/ATIVIDADES RECENTES (Últimos itens):
        ${data.meals.slice(0, 20).map(m => `- [${moment(m.timestamp).format('DD/MM HH:mm')}] ${m.type === 'exercise' ? '🏃' : '🍽️'} ${m.desc} (${m.cals} kcal)`).join('\n')}

        DIRETRIZES DE RESPOSTA:
        1. Se o período for "Hoje", seja TÁTICO. Diga o que falta para bater a meta hoje ou corrija exageros.
        2. Se o período for longo (7/15/30 dias), seja ESTRATÉGICO. Analise tendências, consistência e dê conselhos de longo prazo.
        3. CITE OS DADOS. Não dê dicas genéricas. Diga "Vi que você comeu X" ou "Sua média de água está baixa".
        4. Seja motivador mas firme quanto à qualidade (Score).
        5. Responda de forma concisa e amigável.
        `;

        return prompt;
    }
};

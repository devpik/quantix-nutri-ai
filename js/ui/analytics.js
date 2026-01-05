import { DB } from '../data/database.js';
import { ChatUI } from './chat.js';

export const Analytics = {
    charts: {},
    currentRange: 7,

    setRange: (days) => {
        Analytics.currentRange = days;
        [1, 7, 15, 30].forEach(d => {
            const btn = document.getElementById(`btn-range-${d}`);
            if (btn) {
                btn.className = d === days
                    ? "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition bg-brand-100 text-brand-700"
                    : "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800";
            }
        });
        if (ChatUI && typeof ChatUI.updateIndicator === 'function') ChatUI.updateIndicator();
        Analytics.render();
    },

    calculateBMR: (p) => {
        const w = parseFloat(p.weight) || 70;
        const h = parseFloat(p.height) || 170;
        const a = parseFloat(p.age) || 30;
        let bmr = (10 * w) + (6.25 * h) - (5 * a);
        bmr += (p.gender === 'female' ? -161 : 5);
        return bmr;
    },

    getDatesInRange: (days) => {
        const dates = [];
        for (let i = days - 1; i >= 0; i--) {
            dates.push(moment().subtract(i, 'days').format('YYYY-MM-DD'));
        }
        return dates;
    },

    // --- HELPER: Dynamic Container Creation ---
    getOrCreateContainer: (id, title, afterElementId, heightClass = 'h-48') => {
        let container = document.getElementById(id);
        if (!container) {
            container = document.createElement('div');
            container.id = id;
            container.className = "glass-panel p-4 rounded-3xl animate-fade-in mb-4";
            container.innerHTML = `
                <h3 class="text-xs font-bold text-gray-500 uppercase mb-4">${title}</h3>
                <div class="${heightClass} w-full relative">
                    <canvas id="canvas-${id}"></canvas>
                </div>
            `;

            const afterEl = document.getElementById(afterElementId);
            if (afterEl) {
                const parentPanel = afterEl.closest('.glass-panel');
                if (parentPanel && parentPanel.parentNode) {
                    parentPanel.parentNode.insertBefore(container, parentPanel.nextSibling);
                } else if (afterEl.parentNode) {
                    afterEl.parentNode.insertBefore(container, afterEl.nextSibling);
                }
            } else {
                const tab = document.getElementById('tab-analytics');
                if (tab) tab.appendChild(container);
            }
        }
        return `canvas-${id}`;
    },

    render: () => {
        const p = DB.getProfile();
        const meals = DB.getMeals();
        const daysToRender = Analytics.currentRange;
        const dateKeys = Analytics.getDatesInRange(daysToRender);

        // --- 1. DATA PREPARATION ---
        let totalIntake = 0;
        let totalBurn = 0;
        let daysWithFood = 0;
        let daysWithExercise = 0;

        const labels = [];
        const dataQuality = [];
        const dataHydration = [];
        const dataWeight = [];
        const dataWaist = [];
        const dataHip = [];
        const dataFat = [];
        const dataBurn = [];

        const dataMacroP = [];
        const dataMacroC = [];
        const dataMacroF = [];

        const hourlySums = Array(24).fill(0);
        const uniqueDaysWithFood = new Set();

        dateKeys.forEach(k => {
            const dayLabel = moment(k).format('DD/MM');
            labels.push(dayLabel);

            const dayMeals = meals.filter(m => m.dateKey === k);
            const foodMeals = dayMeals.filter(m => m.type === 'food');
            const exMeals = dayMeals.filter(m => m.type === 'exercise');

            let dayCals = 0;
            let dayP = 0, dayC = 0, dayF = 0;
            let dayScoreSum = 0;

            if (foodMeals.length > 0) {
                daysWithFood++;
                uniqueDaysWithFood.add(k);
                foodMeals.forEach(m => {
                    dayCals += m.cals;
                    dayP += (m.macros?.p || 0);
                    dayC += (m.macros?.c || 0);
                    dayF += (m.macros?.f || 0);
                    dayScoreSum += (m.score || 5);

                    const h = new Date(m.timestamp).getHours();
                    hourlySums[h] += m.cals;
                });
            }
            totalIntake += dayCals;
            dataMacroP.push(dayP);
            dataMacroC.push(dayC);
            dataMacroF.push(dayF);

            const avgScore = foodMeals.length ? (dayScoreSum / foodMeals.length) : null;
            dataQuality.push(avgScore);

            let dayBurnVal = 0;
            if (exMeals.length > 0) {
                daysWithExercise++;
                dayBurnVal = exMeals.reduce((acc, m) => acc + m.cals, 0);
            }
            totalBurn += dayBurnVal;
            dataBurn.push(dayBurnVal);

            const stats = DB.getDayStats()[k] || { water: 0 };
            dataHydration.push(stats.water);

            const wEntry = p.weightHistory.find(h => h.date === k);
            dataWeight.push(wEntry ? wEntry.weight : null);

            const mEntry = p.measurementsHistory.find(h => h.date === k);
            dataWaist.push(mEntry ? mEntry.waist : null);
            dataHip.push(mEntry ? mEntry.hip : null);
            dataFat.push(mEntry ? mEntry.fatPct : null);
        });

        let lastW = p.weight;
        if(dataWeight.every(v => v === null)) lastW = p.weight;
        for(let i=0; i<dataWeight.length; i++) {
            if(dataWeight[i] !== null) lastW = dataWeight[i];
            else dataWeight[i] = lastW;
        }

        // --- 2. RENDER EXISTING CHARTS ---
        Analytics.renderHeatmap(meals, p);

        const safeDaysDivisor = daysWithFood || 1;
        const avgIntake = Math.round(totalIntake / safeDaysDivisor);
        const targetCals = p.target || 2000;
        const intakePct = Math.min(Math.round((avgIntake / targetCals) * 100), 100);
        const diffTarget = avgIntake - targetCals;
        const trendIcon = diffTarget > 0
            ? '<i class="fas fa-arrow-up text-red-500 text-[10px] ml-1"></i>'
            : '<i class="fas fa-arrow-down text-green-500 text-[10px] ml-1"></i>';

        const avgIntakeValEl = document.getElementById('avg-intake-val');
        if (avgIntakeValEl) {
             avgIntakeValEl.innerHTML = `${avgIntake} <span class="text-xs font-medium text-gray-400">kcal</span> ${Math.abs(diffTarget) > 50 ? trendIcon : ''}`;
             document.getElementById('avg-intake-pct').innerText = `${intakePct}% da meta`;
        }

        Analytics.drawChart('chart-intake', 'doughnut', {
            labels: ['Consumido', 'Restante'],
            datasets: [{
                data: [avgIntake, Math.max(0, targetCals - avgIntake)],
                backgroundColor: [avgIntake > targetCals ? '#ef4444' : '#3b82f6', '#f3f4f6'],
                borderWidth: 0,
                cutout: '75%'
            }]
        }, { plugins: { tooltip: { enabled: true } } });

        const bmr = Analytics.calculateBMR(p);
        const avgBurn = daysToRender > 0 ? (totalBurn / daysToRender) : 0;
        const dailyIntakeHabit = avgIntake;
        const tdee = bmr + avgBurn;
        const dailyDeficit = tdee - dailyIntakeHabit;
        const projectionDays = daysToRender;
        const totalDeficit = dailyDeficit * projectionDays;
        const weightChange = totalDeficit / 7700;
        const projectedWeight = (parseFloat(p.weight) - weightChange).toFixed(1);
        const changeStr = weightChange.toFixed(1);
        const sign = weightChange > 0 ? '-' : '+';

        const projEl = document.getElementById('proj-weight');
        if (projEl) {
            projEl.innerText = projectedWeight;
            document.getElementById('proj-diff').innerHTML = `${sign}${Math.abs(changeStr)} kg <span class="text-[9px] opacity-70 ml-1">(${projectionDays} dias)</span>`;
        }

        const validScores = dataQuality.filter(v => v !== null);
        const avgPeriodScore = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
        const qualityTrend = avgPeriodScore >= 7.5 ? 'text-green-500' : (avgPeriodScore >= 5 ? 'text-yellow-500' : 'text-red-500');

        const qualLabel = document.getElementById('avg-quality-label');
        if (qualLabel) qualLabel.innerHTML = `Média: <span class="${qualityTrend}">${avgPeriodScore.toFixed(1)}</span>`;

        Analytics.drawChart('chart-quality', 'line', {
            labels: labels,
            datasets: [{
                label: 'Qualidade (1-10)',
                data: dataQuality,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                pointBackgroundColor: dataQuality.map(v => v >= 8 ? '#22c55e' : v >= 5 ? '#eab308' : '#ef4444'),
                fill: true, tension: 0.4, spanGaps: true
            }]
        });

        const feedbackEl = document.getElementById('quality-feedback');
        if (feedbackEl) {
            if (validScores.length > 0) {
                let msg = "", icon = "";
                if (avgPeriodScore < 5) {
                    msg = "Sua dieta contém muitos ultraprocessados. Foco em alimentos naturais!";
                    icon = "<i class='fas fa-exclamation-triangle text-red-500 mt-0.5'></i>";
                } else if (avgPeriodScore < 8) {
                    msg = "Bom equilíbrio, mas ainda há espaço para reduzir industrializados.";
                    icon = "<i class='fas fa-info-circle text-yellow-500 mt-0.5'></i>";
                } else {
                    msg = "Excelente! Sua alimentação é rica em nutrientes e comida de verdade.";
                    icon = "<i class='fas fa-award text-green-500 mt-0.5'></i>";
                }
                feedbackEl.innerHTML = `${icon} <span class="text-xs">${msg}</span>`;
            } else {
                feedbackEl.innerHTML = "<span class='text-xs'>Sem dados suficientes.</span>";
            }
        }

        Analytics.drawChart('chart-exercise', 'bar', {
            labels: labels,
            datasets: [{
                label: 'Queima (kcal)',
                data: dataBurn,
                backgroundColor: '#f59e0b',
                borderRadius: 4
            }]
        });

        Analytics.drawChart('chart-hydration', 'bar', {
            labels: labels,
            datasets: [{
                label: 'Água (ml)',
                data: dataHydration,
                backgroundColor: '#0ea5e9',
                borderRadius: 4
            }]
        });

        Analytics.drawChart('chart-weight', 'line', {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)',
                data: dataWeight,
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                fill: true, tension: 0.4
            }]
        });

        Analytics.drawChart('chart-measurements', 'line', {
            labels: labels,
            datasets: [
                { label: 'Cintura', data: dataWaist, borderColor: '#f43f5e', tension: 0.4 },
                { label: 'Quadril', data: dataHip, borderColor: '#ec4899', tension: 0.4 },
                { label: '% Gord', data: dataFat, borderColor: '#8b5cf6', tension: 0.4 }
            ]
        }, { options: { plugins: { legend: { display: true, position: 'bottom' } } } });

        const countActiveDays = uniqueDaysWithFood.size || 1;
        const avgHourly = hourlySums.map(sum => Math.round(sum / countActiveDays));
        let peakVal = 0, peakHour = 0;
        avgHourly.forEach((val, h) => { if(val > peakVal) { peakVal = val; peakHour = h; } });

        const chartHourlyCanvas = document.getElementById('chart-hourly');
        if (chartHourlyCanvas) {
            const hourlyContainer = chartHourlyCanvas.parentElement.parentElement;
            let peakTextEl = document.getElementById('hourly-peak-text');
            if(!peakTextEl) {
                peakTextEl = document.createElement('p');
                peakTextEl.id = 'hourly-peak-text';
                peakTextEl.className = "text-[10px] text-gray-500 mt-2 text-center";
                hourlyContainer.appendChild(peakTextEl);
            }
            peakTextEl.innerHTML = peakVal > 0
                ? `Seu pico de fome é por volta das <span class="font-bold text-brand-600">${peakHour}h:00</span>`
                : "Sem dados suficientes para identificar padrões.";
        }

        Analytics.drawChart('chart-hourly', 'bar', {
            labels: Array.from({length: 24}, (_, i) => i),
            datasets: [{
                label: 'Média Calórica',
                data: avgHourly,
                backgroundColor: avgHourly.map((v, i) => i === peakHour ? '#ef4444' : '#3b82f6'),
                borderRadius: 2
            }]
        });

        Analytics.renderMacroEvolution(labels, dataMacroP, dataMacroC, dataMacroF);
        Analytics.renderMetabolicHealth(p, meals, daysToRender);

        // =========================================================
        // 5. NEW VISUALIZATIONS (REQUESTED)
        // =========================================================

        Analytics.renderMealDistribution(meals, p, daysToRender);
        Analytics.renderEnergyBalance(dateKeys, meals, p);
        Analytics.renderQualityMatrix(meals, daysToRender);
        Analytics.renderTopOffenders(meals, daysToRender);
        Analytics.renderSymptomCorrelation(meals, daysToRender);
    },

    renderHeatmap: (meals, p) => {
        const mapEl = document.getElementById('heatmap-grid');
        if(!mapEl) return;
        mapEl.innerHTML = '';

        const start = moment().subtract(29, 'days');
        const end = moment();
        const monthStr = start.month() === end.month() ? start.format('MMMM') : `${start.format('MMMM')} - ${end.format('MMMM')}`;
        const monthHeader = document.getElementById('heatmap-month');
        if(monthHeader) monthHeader.innerText = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

        const wdEl = document.getElementById('heatmap-weekdays');
        if(wdEl) {
            wdEl.innerHTML = '';
            ['D','S','T','Q','Q','S','S'].forEach(d => {
                const sp = document.createElement('span');
                sp.className = "text-[8px] font-bold text-gray-300 dark:text-gray-600";
                sp.innerText = d;
                wdEl.appendChild(sp);
            });
        }

        for (let i = 29; i >= 0; i--) {
            const day = moment().subtract(i, 'days');
            const k = day.format('YYYY-MM-DD');

            const dayMeals = meals.filter(m => m.dateKey === k && m.type === 'food');
            const dayBurn = meals.filter(m => m.dateKey === k && m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
            const cals = dayMeals.reduce((acc, m) => acc + m.cals, 0);
            const net = cals - dayBurn;

            const el = document.createElement('div');
            el.className = "w-full aspect-square rounded-sm text-[8px] flex items-center justify-center text-white font-bold transition hover:scale-110 cursor-default";
            el.innerText = day.date();
            el.title = `${k}: ${net} kcal`;

            if (cals === 0) el.className += " bg-gray-200 dark:bg-gray-700 text-gray-400";
            else {
                const diff = Math.abs(net - p.target);
                if (diff <= p.target * 0.1) el.className += " bg-brand-500 shadow-sm";
                else if (net < p.target) el.className += " bg-yellow-400 shadow-sm";
                else el.className += " bg-red-400 shadow-sm";
            }
            mapEl.appendChild(el);
        }
    },

    renderMacroEvolution: (labels, pData, cData, fData) => {
        const canvasId = Analytics.getOrCreateContainer('macro-evolution-card', 'Evolução de Macros (g)', 'chart-exercise');
        Analytics.drawChart(canvasId, 'bar', {
            labels: labels,
            datasets: [
                { label: 'Proteína', data: pData, backgroundColor: '#3b82f6', stack: 'Stack 0' },
                { label: 'Carbo', data: cData, backgroundColor: '#22c55e', stack: 'Stack 0' },
                { label: 'Gordura', data: fData, backgroundColor: '#eab308', stack: 'Stack 0' }
            ]
        }, {
            options: {
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, display: true, ticks: { font: { size: 9 } } }
                }
            }
        });
    },

    renderMetabolicHealth: (p, meals, range) => {
        const container = document.getElementById('metabolic-bars-container');
        if (!container) return;
        container.innerHTML = '';

        let totalSodium = 0;
        let totalSugar = 0;
        const dates = Analytics.getDatesInRange(range);
        let activeDays = 0;

        dates.forEach(k => {
             const dayMeals = meals.filter(m => m.dateKey === k && m.type === 'food');
             if(dayMeals.length > 0) {
                 activeDays++;
                 dayMeals.forEach(m => {
                     if (m.micros) {
                         totalSodium += (m.micros.sodium || 0);
                         totalSugar += (m.micros.sugar || 0);
                     }
                 });
             }
        });

        const divisor = activeDays || 1;
        const avgSodium = totalSodium / divisor;
        const avgSugar = totalSugar / divisor;

        const targetSodium = (p.microTargets && p.microTargets.sodium) || 2300;
        const targetSugar = (p.microTargets && p.microTargets.sugar) || 50;

        const getColor = (val, max) => {
            const pct = val / max;
            if (pct < 0.7) return '#22c55e';
            if (pct <= 1.0) return '#eab308';
            return '#ef4444';
        };

        const createBar = (label, val, max, unit) => {
            const wrapper = document.createElement('div');
            wrapper.className = "mb-2";
            wrapper.innerHTML = `
                <div class="flex justify-between text-[10px] font-bold mb-1">
                    <span class="text-gray-500 uppercase">${label}</span>
                    <span class="${val > max ? 'text-red-500' : 'text-gray-500'}">${Math.round(val)} / ${max}${unit}</span>
                </div>
                <div class="h-14 w-full relative">
                    <canvas id="chart-micro-${label.toLowerCase()}"></canvas>
                </div>
            `;
            container.appendChild(wrapper);

            const ctx = wrapper.querySelector('canvas').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Média'],
                    datasets: [{
                        label: label,
                        data: [val],
                        backgroundColor: getColor(val, max),
                        barThickness: 15,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { enabled: true } },
                    scales: {
                        x: { display: true, max: Math.max(val * 1.2, max * 1.2), grid: { display: false }, ticks: { font: { size: 9 } } },
                        y: { display: false }
                    }
                }
            });
        };

        createBar('Sódio', avgSodium, targetSodium, 'mg');
        createBar('Açúcar', avgSugar, targetSugar, 'g');
    },

    renderMealDistribution: (meals, p, range) => {
        const canvasId = Analytics.getOrCreateContainer('chart-meal-dist', 'Distribuição por Refeição', 'chart-intake');
        const categories = ['Café da Manhã', 'Almoço', 'Lanche', 'Jantar'];
        const dataMap = { 'Café da Manhã': 0, 'Almoço': 0, 'Lanche': 0, 'Jantar': 0 };
        const dates = Analytics.getDatesInRange(range);
        let validMeals = meals.filter(m => dates.includes(m.dateKey) && m.type === 'food');

        validMeals.forEach(m => {
            const cat = categories.find(c => m.category && m.category.includes(c)) || 'Lanche';
            if (dataMap[cat] !== undefined) dataMap[cat] += m.cals;
        });

        const totalCals = Object.values(dataMap).reduce((a,b) => a+b, 0) || 1;
        const dataPct = categories.map(c => Math.round((dataMap[c] / totalCals) * 100));
        const ideal = [20, 40, 15, 25];

        Analytics.drawChart(canvasId, 'radar', {
            labels: categories,
            datasets: [
                {
                    label: 'Você (%)',
                    data: dataPct,
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    borderColor: '#22c55e',
                    pointBackgroundColor: '#22c55e'
                },
                {
                    label: 'Ideal (%)',
                    data: ideal,
                    backgroundColor: 'rgba(156, 163, 175, 0.1)',
                    borderColor: '#9ca3af',
                    pointBackgroundColor: '#9ca3af',
                    borderDash: [5, 5]
                }
            ]
        }, {
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        max: Math.max(...dataPct, 45),
                        ticks: { display: false }
                    }
                }
            }
        });
    },

    renderEnergyBalance: (dateKeys, meals, p) => {
        const canvasId = Analytics.getOrCreateContainer('chart-energy-balance', 'Saldo Energético (Déficit/Superávit)', 'chart-exercise');
        const labels = [];
        const dataBalance = [];
        let totalBalance = 0;
        const bmr = Analytics.calculateBMR(p);

        dateKeys.forEach(k => {
            labels.push(moment(k).format('DD/MM'));
            const dayMeals = meals.filter(m => m.dateKey === k);
            const intake = dayMeals.filter(m => m.type === 'food').reduce((acc, m) => acc + m.cals, 0);
            const burn = dayMeals.filter(m => m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
            const balance = (bmr + burn) - intake;
            dataBalance.push(balance);
            totalBalance += balance;
        });

        labels.push('TOTAL');
        dataBalance.push(totalBalance);
        const colors = dataBalance.map(v => v >= 0 ? '#22c55e' : '#ef4444');

        Analytics.drawChart(canvasId, 'bar', {
            labels: labels,
            datasets: [{
                label: 'Saldo (kcal)',
                data: dataBalance,
                backgroundColor: colors,
                borderRadius: 4
            }]
        }, {
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.raw;
                                return v > 0 ? `Déficit: ${Math.round(v)} kcal` : `Superávit: ${Math.round(Math.abs(v))} kcal`;
                            }
                        }
                    }
                }
            }
        });
    },

    renderQualityMatrix: (meals, range) => {
        const canvasId = Analytics.getOrCreateContainer('chart-quality-matrix', 'Matriz: Qualidade vs Calorias', 'chart-quality');
        const dates = Analytics.getDatesInRange(range);
        const dataPoints = [];

        meals.forEach(m => {
            if (dates.includes(m.dateKey) && m.type === 'food') {
                dataPoints.push({
                    x: m.cals,
                    y: m.score || 5,
                    desc: m.desc
                });
            }
        });

        const pointColors = dataPoints.map(p => p.y >= 8 ? '#22c55e' : (p.y >= 5 ? '#eab308' : '#ef4444'));

        Analytics.drawChart(canvasId, 'scatter', {
            datasets: [{
                label: 'Refeições',
                data: dataPoints,
                backgroundColor: pointColors,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        }, {
            options: {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const pt = ctx.raw;
                                return `${pt.desc}: ${pt.x}kcal (Nota ${pt.y})`;
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Calorias' }, beginAtZero: true },
                    y: {
                        title: { display: true, text: 'Score' },
                        min: 0, max: 10,
                        grid: { color: (ctx) => ctx.tick.value === 5 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)', lineWidth: (ctx) => ctx.tick.value === 5 ? 2 : 1 }
                    }
                }
            }
        });
    },

    renderTopOffenders: (meals, range) => {
        const canvasId = Analytics.getOrCreateContainer('chart-top-offenders', 'Top 5 Ofensores (Sódio)', 'metabolic-health-section');
        const dates = Analytics.getDatesInRange(range);
        const sodiumMap = {};

        meals.forEach(m => {
            if (dates.includes(m.dateKey) && m.type === 'food' && m.micros?.sodium) {
                const name = m.desc.split('(')[0].trim();
                sodiumMap[name] = (sodiumMap[name] || 0) + m.micros.sodium;
            }
        });

        const sorted = Object.entries(sodiumMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const labels = sorted.map(i => i[0]);
        const data = sorted.map(i => i[1]);

        Analytics.drawChart(canvasId, 'bar', {
            labels: labels,
            datasets: [{
                label: 'Sódio Total (mg)',
                data: data,
                backgroundColor: '#ef4444',
                borderRadius: 4
            }]
        }, {
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } }
            }
        });
    },

    renderSymptomCorrelation: (meals, range) => {
        const canvasId = Analytics.getOrCreateContainer('chart-symptoms', 'Frequência de Sintomas', 'chart-top-offenders');
        const dates = Analytics.getDatesInRange(range);
        const symptomCounts = {};
        let hasSymptoms = false;

        meals.forEach(m => {
            if (dates.includes(m.dateKey) && m.symptoms && Array.isArray(m.symptoms)) {
                m.symptoms.forEach(s => {
                    symptomCounts[s] = (symptomCounts[s] || 0) + 1;
                    hasSymptoms = true;
                });
            }
        });

        const container = document.getElementById('chart-symptoms');

        if (!hasSymptoms) {
            container.innerHTML = `
                <h3 class="text-xs font-bold text-gray-500 uppercase mb-4">Frequência de Sintomas</h3>
                <p class="text-xs text-center text-gray-400 py-8">Nenhum sintoma registrado no período.</p>
            `;
            return;
        }

        // Restore canvas if it was overwritten by empty state
        if (!document.getElementById(canvasId)) {
            container.innerHTML = `
                <h3 class="text-xs font-bold text-gray-500 uppercase mb-4">Frequência de Sintomas</h3>
                <div class="h-48 w-full relative">
                    <canvas id="${canvasId}"></canvas>
                </div>
            `;
        }

        const sorted = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]);

        Analytics.drawChart(canvasId, 'bar', {
            labels: sorted.map(i => i[0]),
            datasets: [{
                label: 'Ocorrências',
                data: sorted.map(i => i[1]),
                backgroundColor: '#8b5cf6',
                borderRadius: 4
            }]
        });
    },

    drawChart: (id, type, data, extraOptions = {}) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (Analytics.charts[id]) Analytics.charts[id].destroy();

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { size: 10 },
                    bodyFont: { size: 10 },
                    padding: 8,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 9 }, color: '#9ca3af' }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { font: { size: 9 }, color: '#9ca3af' }
                }
            }
        };

        const options = { ...defaultOptions, ...extraOptions.options };
        if(extraOptions.options && extraOptions.options.scales) {
            options.scales = { ...defaultOptions.scales, ...extraOptions.options.scales };
        }
        if(extraOptions.options && extraOptions.options.plugins) {
            options.plugins = { ...defaultOptions.plugins, ...extraOptions.options.plugins };
        }

        Analytics.charts[id] = new Chart(ctx, {
            type: type,
            data: data,
            options: options
        });
    }
};

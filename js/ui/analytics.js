import { DB } from '../data/database.js';
import { ChatUI } from './chat.js';

// =========================================================================
// 7. ANALYTICS RENDERER (REFACTORED)
// =========================================================================
export const Analytics = {
    charts: {},
    currentRange: 7, // Default

    setRange: (days) => {
        Analytics.currentRange = days;
        // Update UI Buttons
        [1, 7, 15, 30].forEach(d => {
            const btn = document.getElementById(`btn-range-${d}`);
            if (btn) {
                if (d === days) {
                    btn.className = "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition bg-brand-100 text-brand-700";
                } else {
                    btn.className = "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800";
                }
            }
        });

        // Update Chat Context Indicator
        if (ChatUI && typeof ChatUI.updateIndicator === 'function') {
            ChatUI.updateIndicator();
        }

        Analytics.render();
    },

    // Helper: Calculate BMR (Harris-Benedict)
    calculateBMR: (p) => {
        // Form: Men: (10 × weight) + (6.25 × height) - (5 × age) + 5
        //       Women: (10 × weight) + (6.25 × height) - (5 × age) - 161
        const w = parseFloat(p.weight) || 70;
        const h = parseFloat(p.height) || 170;
        const a = parseFloat(p.age) || 30;

        let bmr = (10 * w) + (6.25 * h) - (5 * a);
        bmr += (p.gender === 'female' ? -161 : 5);
        return bmr;
    },

    // Helper: Get formatted date range
    getDatesInRange: (days) => {
        const dates = [];
        for (let i = days - 1; i >= 0; i--) {
            dates.push(moment().subtract(i, 'days').format('YYYY-MM-DD'));
        }
        return dates;
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

        // Arrays for Charts
        const labels = [];
        const dataQuality = [];
        const dataHydration = [];
        const dataWeight = [];
        const dataWaist = [];
        const dataHip = [];
        const dataFat = [];
        const dataBurn = [];

        // Macro Evolution Data
        const dataMacroP = [];
        const dataMacroC = [];
        const dataMacroF = [];

        // Hourly Data Aggregation
        const hourlySums = Array(24).fill(0);
        // Track unique days per hour to calculate strict average?
        // Requirement: "Total Calorias na Hora H / Número de Dias com Registros"
        // Interpretation: Divide by total days that have ANY record, or days that have record AT THAT HOUR?
        // Standard analytics usually divide by "active days" (days with any log).
        // Let's count unique days that have at least one food log.
        const uniqueDaysWithFood = new Set();

        dateKeys.forEach(k => {
            const dayLabel = moment(k).format('DD/MM');
            labels.push(dayLabel);

            // Filter Day Data
            const dayMeals = meals.filter(m => m.dateKey === k);
            const foodMeals = dayMeals.filter(m => m.type === 'food');
            const exMeals = dayMeals.filter(m => m.type === 'exercise');

            // Intake & Macros
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

                    // Hourly Sum
                    const h = new Date(m.timestamp).getHours();
                    hourlySums[h] += m.cals;
                });
            }
            totalIntake += dayCals;
            dataMacroP.push(dayP);
            dataMacroC.push(dayC);
            dataMacroF.push(dayF);

            // Quality
            const avgScore = foodMeals.length ? (dayScoreSum / foodMeals.length) : null;
            dataQuality.push(avgScore);

            // Burn
            let dayBurnVal = 0;
            if (exMeals.length > 0) {
                daysWithExercise++;
                dayBurnVal = exMeals.reduce((acc, m) => acc + m.cals, 0);
            }
            totalBurn += dayBurnVal;
            dataBurn.push(dayBurnVal);

            // Hydration
            const stats = DB.getDayStats()[k] || { water: 0 };
            dataHydration.push(stats.water);

            // Measurements & Weight
            const wEntry = p.weightHistory.find(h => h.date === k);
            dataWeight.push(wEntry ? wEntry.weight : null);

            const mEntry = p.measurementsHistory.find(h => h.date === k);
            dataWaist.push(mEntry ? mEntry.waist : null);
            dataHip.push(mEntry ? mEntry.hip : null);
            dataFat.push(mEntry ? mEntry.fatPct : null);
        });

        // Fill Weight Gaps (Carry Forward)
        let lastW = p.weight;
        // If p.weightHistory is empty, use current profile weight
        if(dataWeight.every(v => v === null)) lastW = p.weight;

        for(let i=0; i<dataWeight.length; i++) {
            if(dataWeight[i] !== null) lastW = dataWeight[i];
            else dataWeight[i] = lastW; // Propagate last known weight
        }

        // --- 2. RENDER CARDS & CHARTS ---

        // 2.1 Heatmap (Kept similar but ensured robustness)
        Analytics.renderHeatmap(meals, p);

        // 2.2 Average Intake & Trend
        const safeDaysDivisor = daysWithFood || 1; // Avoid div/0
        const avgIntake = Math.round(totalIntake / safeDaysDivisor);
        const targetCals = p.target || 2000;
        const intakePct = Math.min(Math.round((avgIntake / targetCals) * 100), 100);

        // Trend Calculation: Compare Avg Intake vs Target (Simple) or Previous Period (Complex)
        // User asked for "Trend in cards (arrows indicating up/down vs average)"
        // Let's compare Current Avg vs Target for now as it's the most relevant "baseline".
        // Or better: Compare Today vs Average.
        // Let's implement: "Diff from Target".
        const diffTarget = avgIntake - targetCals;
        const trendIcon = diffTarget > 0
            ? '<i class="fas fa-arrow-up text-red-500 text-[10px] ml-1"></i>'
            : '<i class="fas fa-arrow-down text-green-500 text-[10px] ml-1"></i>';

        document.getElementById('avg-intake-val').innerHTML = `${avgIntake} <span class="text-xs font-medium text-gray-400">kcal</span> ${Math.abs(diffTarget) > 50 ? trendIcon : ''}`;
        document.getElementById('avg-intake-pct').innerText = `${intakePct}% da meta`;

        // Donut Chart
        Analytics.drawChart('chart-intake', 'doughnut', {
            labels: ['Consumido', 'Restante'],
            datasets: [{
                data: [avgIntake, Math.max(0, targetCals - avgIntake)],
                backgroundColor: [avgIntake > targetCals ? '#ef4444' : '#3b82f6', '#f3f4f6'],
                borderWidth: 0,
                cutout: '75%'
            }]
        }, { plugins: { tooltip: { enabled: true } } });

        // 2.3 Weight Projection (DYNAMIC CALCULATION)
        const bmr = Analytics.calculateBMR(p);
        const avgBurn = daysToRender > 0 ? (totalBurn / daysToRender) : 0; // Burn is spread over all days (including rest days)
        // Average Daily Intake (Total / Total Days in range, treating missing days as 0 or strictly days with logs?)
        // To be fair in projection, if user didn't log, we assume 0 intake? No, that breaks projection.
        // We should use "Average Intake on Logged Days" as the representative daily habit.
        const dailyIntakeHabit = avgIntake;

        // Total Daily Expenditure
        const tdee = bmr + avgBurn;

        // Daily Deficit (Expenditure - Intake)
        // Positive = Weight Loss. Negative = Weight Gain.
        const dailyDeficit = tdee - dailyIntakeHabit;

        // Project over the selected range duration (e.g. "In the next 7 days...")
        const projectionDays = daysToRender;
        const totalDeficit = dailyDeficit * projectionDays;
        const weightChange = totalDeficit / 7700; // 1kg fat = 7700kcal

        const projectedWeight = (parseFloat(p.weight) - weightChange).toFixed(1);
        const changeStr = weightChange.toFixed(1);
        const sign = weightChange > 0 ? '-' : '+';
        const colorClass = weightChange > 0 ? 'text-green-200' : 'text-red-200'; // Loss is green usually for weight loss goals

        document.getElementById('proj-weight').innerText = projectedWeight;
        document.getElementById('proj-diff').innerHTML = `${sign}${Math.abs(changeStr)} kg <span class="text-[9px] opacity-70 ml-1">(${projectionDays} dias)</span>`;

        // 2.4 Quality Chart
        // Calculate Trend: Avg Score
        const validScores = dataQuality.filter(v => v !== null);
        const avgPeriodScore = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
        const qualityTrend = avgPeriodScore >= 7.5 ? 'text-green-500' : (avgPeriodScore >= 5 ? 'text-yellow-500' : 'text-red-500');

        document.getElementById('avg-quality-label').innerHTML = `Média: <span class="${qualityTrend}">${avgPeriodScore.toFixed(1)}</span>`;

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

        // Update Feedback Text
        const feedbackEl = document.getElementById('quality-feedback');
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

        // 2.5 Exercise Chart
        Analytics.drawChart('chart-exercise', 'bar', {
            labels: labels,
            datasets: [{
                label: 'Queima (kcal)',
                data: dataBurn,
                backgroundColor: '#f59e0b',
                borderRadius: 4
            }]
        });

        // 2.6 Hydration Chart
        Analytics.drawChart('chart-hydration', 'bar', {
            labels: labels,
            datasets: [{
                label: 'Água (ml)',
                data: dataHydration,
                backgroundColor: '#0ea5e9',
                borderRadius: 4
            }]
        });

        // 2.7 Weight Evolution
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

        // 2.8 Measurements
        Analytics.drawChart('chart-measurements', 'line', {
            labels: labels,
            datasets: [
                { label: 'Cintura', data: dataWaist, borderColor: '#f43f5e', tension: 0.4 },
                { label: 'Quadril', data: dataHip, borderColor: '#ec4899', tension: 0.4 },
                { label: '% Gord', data: dataFat, borderColor: '#8b5cf6', tension: 0.4 }
            ]
        }, { options: { plugins: { legend: { display: true, position: 'bottom' } } } });

        // 2.9 HOURLY HUNGER (Refactored)
        // Calculate Average: Total Cals at Hour / Number of Days with Records
        const countActiveDays = uniqueDaysWithFood.size || 1;
        const avgHourly = hourlySums.map(sum => Math.round(sum / countActiveDays));

        // Find Peak
        let peakVal = 0;
        let peakHour = 0;
        avgHourly.forEach((val, h) => {
            if(val > peakVal) {
                peakVal = val;
                peakHour = h;
            }
        });

        // Add Peak Text
        const chartHourlyCanvas = document.getElementById('chart-hourly');
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

        Analytics.drawChart('chart-hourly', 'bar', {
            labels: Array.from({length: 24}, (_, i) => i),
            datasets: [{
                label: 'Média Calórica',
                data: avgHourly,
                backgroundColor: avgHourly.map((v, i) => i === peakHour ? '#ef4444' : '#3b82f6'), // Highlight peak
                borderRadius: 2
            }]
        });

        // 3. NEW FEATURE: MACRO EVOLUTION CHART
        Analytics.renderMacroEvolution(labels, dataMacroP, dataMacroC, dataMacroF);

        // 4. Metabolic Health (Micros)
        Analytics.renderMetabolicHealth(p, meals, daysToRender);
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
        // Find or create container
        const parent = document.getElementById('tab-analytics');
        let container = document.getElementById('macro-evolution-card');

        if (!container) {
            container = document.createElement('div');
            container.id = 'macro-evolution-card';
            container.className = "glass-panel p-4 rounded-3xl animate-fade-in";
            container.innerHTML = `
                <h3 class="text-xs font-bold text-gray-500 uppercase mb-4">Evolução de Macros (g)</h3>
                <div class="h-48 w-full">
                    <canvas id="chart-macro-evolution"></canvas>
                </div>
            `;
            // Insert after Exercise Chart
            const exerciseCard = document.getElementById('chart-exercise').closest('.glass-panel');
            if(exerciseCard && exerciseCard.parentNode) {
                exerciseCard.parentNode.insertBefore(container, exerciseCard.nextSibling);
            } else {
                parent.appendChild(container);
            }
        }

        Analytics.drawChart('chart-macro-evolution', 'bar', {
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
        let countDays = 0; // Using count of days in range or active days?
        // For averages, use daysInRange to reflect "Average Daily Load",
        // but if user didn't log, it dilutes the average.
        // Standard medical approach: Average over the period assuming valid logs.
        // Let's use active days count from earlier or just range if simple.
        // To be safe and show REAL intake on days ate, use active days.
        // But let's use range to match the requested logic "Average of period".

        // Recalculate using helper to avoid scope issues or reuse?
        // Let's iterate again for simplicity
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
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: true }
                    },
                    scales: {
                        x: {
                            display: true,
                            max: Math.max(val * 1.2, max * 1.2),
                            grid: { display: false },
                            ticks: { font: { size: 9 } }
                        },
                        y: { display: false }
                    }
                }
            });
        };

        createBar('Sódio', avgSodium, targetSodium, 'mg');
        createBar('Açúcar', avgSugar, targetSugar, 'g');
    },

    drawChart: (id, type, data, extraOptions = {}) => {
        const canvas = document.getElementById(id);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (Analytics.charts[id]) Analytics.charts[id].destroy();

        // Base Options with Tooltips Enabled
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
                    display: true, // Default to true for better viz
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { font: { size: 9 }, color: '#9ca3af' }
                }
            }
        };

        // Merge Options
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

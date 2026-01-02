import { DB } from '../data/database.js';

// =========================================================================
// 7. ANALYTICS RENDERER
// =========================================================================
export const Analytics = {
    charts: {},
    currentRange: 7, // Default

    setRange: (days) => {
        Analytics.currentRange = days;
        // Update UI
        [1, 7, 15, 30].forEach(d => {
            const btn = document.getElementById(`btn-range-${d}`);
            if (d === days) {
                btn.className = "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition bg-brand-100 text-brand-700";
            } else {
                btn.className = "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800";
            }
        });
        Analytics.render();
    },

    render: () => {
        const p = DB.getProfile();
        const meals = DB.getMeals();
        const daysToRender = Analytics.currentRange;

        // 1. Heatmap Data (Fixed 30 days for consistency)
        const mapEl = document.getElementById('heatmap-grid');
        mapEl.innerHTML = '';

        // 1.1 Heatmap Header (Month)
        const start = moment().subtract(29, 'days');
        const end = moment();
        const monthStr = start.month() === end.month() ? start.format('MMMM') : `${start.format('MMMM')} - ${end.format('MMMM')}`;
        document.getElementById('heatmap-month').innerText = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);

        // 1.2 Weekdays Header
        const wdEl = document.getElementById('heatmap-weekdays');
        wdEl.innerHTML = '';
        ['D','S','T','Q','Q','S','S'].forEach(d => {
            const sp = document.createElement('span');
            sp.className = "text-[8px] font-bold text-gray-300 dark:text-gray-600";
            sp.innerText = d;
            wdEl.appendChild(sp);
        });

        for (let i = 29; i >= 0; i--) {
            const day = moment().subtract(i, 'days');
            const k = day.format('YYYY-MM-DD');

            // Aggregate day data
            const dayMeals = meals.filter(m => m.dateKey === k && m.type === 'food');
            const dayBurn = meals.filter(m => m.dateKey === k && m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
            const cals = dayMeals.reduce((acc, m) => acc + m.cals, 0);
            const net = cals - dayBurn;

            const el = document.createElement('div');
            el.className = "w-full aspect-square rounded-sm text-[8px] flex items-center justify-center text-white font-bold";
            el.innerText = day.date();

            if (cals === 0) el.className += " bg-gray-200 dark:bg-gray-700 text-gray-400";
            else {
                const diff = Math.abs(net - p.target);
                if (diff <= p.target * 0.1) el.className += " bg-brand-500"; // Within 10%
                else if (net < p.target) el.className += " bg-yellow-400"; // Under
                else el.className += " bg-red-400"; // Over
            }
            mapEl.appendChild(el);
        }

        // Prepare Chart Data
        let chartLabels = [];
        let weightData = [];
        let qualityData = [];
        let hydrationData = [];
        let waistData = [], hipData = [], fatData = [];
        let exerciseData = [];

        if (daysToRender === 1) {
            // Hourly view for Today (Resumo)
            const k = DB.getTodayKey();
            chartLabels = Array.from({length: 24}, (_, i) => `${i}h`);
            exerciseData = Array(24).fill(0);
            qualityData = Array(24).fill(null);
            hydrationData = Array(24).fill(0);

            const dayStats = DB.getDayStats()[k] || { water: 0 };
            hydrationData[new Date().getHours()] = dayStats.water;

            meals.filter(m => m.dateKey === k).forEach(m => {
                const h = new Date(m.timestamp).getHours();
                if (m.type === 'exercise') exerciseData[h] += m.cals;
                else qualityData[h] = m.score || 5;
            });

            const wEntry = p.weightHistory.find(h => h.date === k) || p.weightHistory[p.weightHistory.length - 1];
            weightData = Array(24).fill(wEntry ? wEntry.weight : p.weight);

            const mHistory = p.measurementsHistory || [];
            const mEntry = mHistory.find(h => h.date === k) || mHistory[mHistory.length - 1] || {};
            waistData = Array(24).fill(mEntry.waist || null);
            hipData = Array(24).fill(mEntry.hip || null);
            fatData = Array(24).fill(mEntry.fatPct || null);
        } else {
            // Daily View
            for (let i = daysToRender - 1; i >= 0; i--) {
                const d = moment().subtract(i, 'days');
                const k = d.format('YYYY-MM-DD');
                chartLabels.push(d.format('DD/MM'));

                const dayMeals = meals.filter(m => m.dateKey === k && m.type === 'food');
                const avgScore = dayMeals.length ? dayMeals.reduce((acc, m) => acc + (m.score || 5), 0) / dayMeals.length : null;
                qualityData.push(avgScore);

                const stats = DB.getDayStats()[k] || { water: 0 };
                hydrationData.push(stats.water);

                const mEntry = p.measurementsHistory.find(h => h.date === k);
                waistData.push(mEntry ? mEntry.waist : null);
                hipData.push(mEntry ? mEntry.hip : null);
                fatData.push(mEntry ? mEntry.fatPct : null);

                const dayBurn = meals.filter(m => m.dateKey === k && m.type === 'exercise').reduce((acc, m) => acc + m.cals, 0);
                exerciseData.push(dayBurn);

                const wEntry = p.weightHistory.find(h => h.date === k);
                weightData.push(wEntry ? wEntry.weight : null);
            }
            // Fill gaps
            let lastW = p.weight;
            for(let i=0; i<weightData.length; i++) {
                if(weightData[i]) lastW = weightData[i];
                else weightData[i] = lastW;
            }
        }

        // 1.5 Quality Score Chart
        const validScores = qualityData.filter(v => v !== null);
        const avgPeriodScore = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : '--';
        document.getElementById('avg-quality-label').innerText = `Média: ${avgPeriodScore}`;

        const qualityColors = qualityData.map(v => {
            if (v === null) return '#8b5cf6';
            if (v >= 7) return '#22c55e'; // Verde
            if (v >= 4) return '#eab308'; // Amarelo
            return '#ef4444'; // Vermelho
        });

        Analytics.drawChart('chart-quality', 'line', {
            labels: chartLabels,
            datasets: [{
                label: 'Qualidade (1-10)',
                data: qualityData,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                pointBackgroundColor: qualityColors,
                pointBorderColor: qualityColors,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true, tension: 0.4, spanGaps: true
            }]
        });

        // 1.6 Hydration Chart
        Analytics.drawChart('chart-hydration', 'bar', {
            labels: chartLabels,
            datasets: [{
                label: 'Água (ml)',
                data: hydrationData,
                backgroundColor: '#0ea5e9',
                borderRadius: 5
            }]
        }, {
            options: {
                scales: { y: { display: true, beginAtZero: true } }
            }
        });

        // 1.7 Measurements Chart
        Analytics.drawChart('chart-measurements', 'line', {
            labels: chartLabels,
            datasets: [
                { label: 'Cintura', data: waistData, borderColor: '#f43f5e', tension: 0.4 },
                { label: 'Quadril', data: hipData, borderColor: '#ec4899', tension: 0.4 },
                { label: '% Gordura', data: fatData, borderColor: '#8b5cf6', tension: 0.4 }
            ],
            options: {
                scales: { y: { display: true } },
                plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 8 } } } }
            }
        });

        // 2. Weight Chart (Updated with Y-Axis enabled)
        Analytics.drawChart('chart-weight', 'line', {
            labels: chartLabels,
            datasets: [{
                label: 'Peso (kg)',
                data: weightData,
                borderColor: '#16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                fill: true, tension: 0.4
            }],
            options: {
                scales: {
                     y: { display: true } // Visible Scale requested
                }
            }
        });

        // 3. Hourly Hunger
        const hours = Array(24).fill(0);
        meals.filter(m => m.type !== 'exercise').forEach(m => {
            const h = new Date(m.timestamp).getHours();
            hours[h] += m.cals;
        });
        Analytics.drawChart('chart-hourly', 'bar', {
            labels: hours.map((_, i) => i),
            datasets: [{
                label: 'Calorias',
                data: hours,
                backgroundColor: '#3b82f6',
                borderRadius: 3
            }]
        });

         // 4. Exercise Chart (NEW: With data labels plugin inline)
         const ctxEx = document.getElementById('chart-exercise').getContext('2d');
         if (Analytics.charts['chart-exercise']) Analytics.charts['chart-exercise'].destroy();

         // Simple Inline Plugin for Data Labels
         const dataLabelPlugin = {
              id: 'dataLabels',
              afterDatasetsDraw(chart) {
                const {ctx} = chart;
                chart.data.datasets.forEach((dataset, i) => {
                  const meta = chart.getDatasetMeta(i);
                  meta.data.forEach((bar, index) => {
                    const value = dataset.data[index];
                    if(value > 0){
                        ctx.fillStyle = 'gray';
                        ctx.font = 'bold 10px Inter';
                        ctx.textAlign = 'center';
                        ctx.fillText(value, bar.x, bar.y - 5);
                    }
                  });
                });
              }
         };

         Analytics.charts['chart-exercise'] = new Chart(ctxEx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Queima (kcal)',
                    data: exerciseData,
                    backgroundColor: '#f59e0b',
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { display: false }
                }
            },
            plugins: [dataLabelPlugin] // Register plugin
        });

        // 4. Projection
        // Simplificado para demo:
        const projectedLoss = 1.2;
        document.getElementById('proj-weight').innerText = (p.weight - projectedLoss).toFixed(1);
        document.getElementById('proj-diff').innerText = `-${projectedLoss} kg`;

        // 5. Metabolic Health (Micros)
        Analytics.renderMetabolicHealth(p, meals, daysToRender);
    },

    renderMetabolicHealth: (p, meals, range) => {
        const container = document.getElementById('metabolic-bars-container');
        if (!container) return;
        container.innerHTML = '';

        // Calculate Average Intake for the range (or Today if range=1)
        let totalSodium = 0;
        let totalSugar = 0;
        let countDays = 0;

        // Iterate days in range
        for (let i = range - 1; i >= 0; i--) {
            const d = moment().subtract(i, 'days');
            const k = d.format('YYYY-MM-DD');
            const dayMeals = meals.filter(m => m.dateKey === k && m.type === 'food');

            if (dayMeals.length > 0) {
                countDays++;
                dayMeals.forEach(m => {
                    if (m.micros) {
                        totalSodium += (m.micros.sodium || 0);
                        totalSugar += (m.micros.sugar || 0);
                    }
                });
            }
        }

        const avgSodium = countDays > 0 ? totalSodium / countDays : 0;
        const avgSugar = countDays > 0 ? totalSugar / countDays : 0;

        // Targets
        const targetSodium = (p.microTargets && p.microTargets.sodium) || 2300;
        const targetSugar = (p.microTargets && p.microTargets.sugar) || 50;

        // Render Bars using Canvas (Chart.js Horizontal Bar)
        // Since we want traffic light, we can use a helper to determine color
        const getHealthColor = (val, max) => {
            const pct = val / max;
            if (pct < 0.7) return '#22c55e'; // Green
            if (pct <= 1.0) return '#eab308'; // Yellow
            return '#ef4444'; // Red
        };

        // Create Canvas Elements
        const createBar = (label, val, max, unit) => {
            const wrapper = document.createElement('div');
            wrapper.className = "mb-2";
            wrapper.innerHTML = `
                <div class="flex justify-between text-[10px] font-bold mb-1">
                    <span class="text-gray-500 uppercase">${label}</span>
                    <span class="${val > max ? 'text-red-500' : 'text-gray-500'}">${Math.round(val)} / ${max}${unit}</span>
                </div>
                <div class="h-10 w-full relative">
                    <canvas id="chart-micro-${label.toLowerCase()}"></canvas>
                </div>
            `;
            container.appendChild(wrapper);

            const ctx = wrapper.querySelector('canvas').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Média Diária'],
                    datasets: [{
                        label: label,
                        data: [val],
                        backgroundColor: getHealthColor(val, max),
                        barThickness: 20,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            display: true,
                            max: Math.max(val * 1.2, max * 1.2),
                            grid: { display: false }
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
        const ctx = document.getElementById(id).getContext('2d');
        if (Analytics.charts[id]) Analytics.charts[id].destroy();

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false } },
                y: { display: false }
            }
        };

        // Merge options deep enough for scales
        const finalOptions = { ...defaultOptions, ...extraOptions.options };
        if(extraOptions.options && extraOptions.options.scales) {
            finalOptions.scales = { ...defaultOptions.scales, ...extraOptions.options.scales };
        }

        Analytics.charts[id] = new Chart(ctx, {
            type: type,
            data: data,
            options: finalOptions
        });
    }
};

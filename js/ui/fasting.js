import { DB } from '../data/database.js';
import { Modal } from './interface.js';

export const Fasting = {
    // Opens the modal to edit fasting time
    openEdit: () => {
        Modal.open('fasting-edit');
        const stats = DB.getDayStats();
        const today = DB.getTodayKey();
        const start = stats[today]?.fastingStart;

        // Populate inputs
        const startInput = document.getElementById('inp-fasting-start');
        const endInput = document.getElementById('inp-fasting-end');

        // Set default values for inputs (important for UX)
        if (start) {
             // Use the active start time
            startInput.value = moment(start).format('YYYY-MM-DDTHH:mm');
            endInput.value = ""; // Clear end time to indicate "Active"
        } else {
            // Default to now minus 16h if no active fast
            startInput.value = moment().subtract(16, 'hours').format('YYYY-MM-DDTHH:mm');
            // Default end time to now (assuming they might want to log a completed fast)
            endInput.value = moment().format('YYYY-MM-DDTHH:mm');
        }
    },

    // Saves the manual entry
    save: () => {
        const startVal = document.getElementById('inp-fasting-start').value;
        const endVal = document.getElementById('inp-fasting-end').value;

        if (!startVal) return alert("Por favor, insira o início do jejum.");

        const startTimestamp = new Date(startVal).getTime();
        const endTimestamp = endVal ? new Date(endVal).getTime() : null;

        if (endTimestamp && endTimestamp <= startTimestamp) {
            return alert("O fim do jejum deve ser depois do início.");
        }

        const stats = DB.getDayStats();
        const today = DB.getTodayKey();

        // Initialize if empty (safety check)
        if(!stats[today]) stats[today] = { water: 0, fastingStart: null, fastingMinutes: 0 };

        if (!endTimestamp) {
             // Case 1: Active Fast (User cleared the End Time or didn't set it)
             stats[today].fastingStart = startTimestamp;
             // We do NOT clear fastingMinutes here, as they might have had a previous completed fast today.
             alert("Jejum iniciado/atualizado! Timer rodando.");
        } else {
             // Case 2: Completed Fast (User provided both Start and End)
             const durationMinutes = (endTimestamp - startTimestamp) / 1000 / 60;

             // Accumulate to daily total
             stats[today].fastingMinutes = (stats[today].fastingMinutes || 0) + durationMinutes;

             // If this manual entry "overwrites" the current active fast, we should clear fastingStart
             // Only if the manual entry covers the "active" period or user intended to close it.
             // Since they provided an end time, it implies this specific session is DONE.
             // If there was an active fast, we assume this edit *was* that fast being closed manually.
             stats[today].fastingStart = null;

             alert(`Jejum de ${Math.floor(durationMinutes/60)}h ${Math.floor(durationMinutes%60)}m registrado!`);
        }

        DB.set('day_stats', stats);
        // Use window.App to avoid circular dependency
        if(window.App) window.App.refreshUI();
        Modal.close('fasting-edit');
    }
};

// =========================================================================
// 8. HELPERS
// =========================================================================
export const Voice = {
    recognition: null,
    targetId: null,

    init: () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            Voice.recognition = new SpeechRecognition();
            Voice.recognition.lang = 'pt-BR';
            Voice.recognition.continuous = false;
            Voice.recognition.interimResults = false;

            Voice.recognition.onstart = () => {
                const btn = document.getElementById('btn-mic-' + Voice.targetId);
                if(btn) btn.classList.add('animate-pulse', 'text-red-500');
            };

            Voice.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (Voice.targetId) {
                    const el = document.getElementById(Voice.targetId);
                    if (el) {
                        const currentVal = el.value ? el.value + " " : "";
                        el.value = (currentVal + transcript).trim();
                    }
                }
            };

            Voice.recognition.onerror = (event) => {
                console.error("Voice Error", event.error);
                alert("Erro no reconhecimento de voz: " + event.error);
                Voice.stop();
            };

            Voice.recognition.onend = () => {
                Voice.stop();
            };
        } else {
            alert("Seu navegador não suporta reconhecimento de voz.");
        }
    },

    start: (id) => {
        if (!Voice.recognition) Voice.init();
        if (Voice.recognition) {
            Voice.targetId = id;
            Voice.recognition.start();
        }
    },

    stop: () => {
        if (Voice.targetId) {
            const btn = document.getElementById('btn-mic-' + Voice.targetId);
            if(btn) btn.classList.remove('animate-pulse', 'text-red-500');
            Voice.targetId = null;
        }
    }
};

export const Modal = {
    open: (id) => {
        document.getElementById('modal-' + id).classList.add('active');
    },
    close: (id) => {
        document.getElementById('modal-' + id).classList.remove('active');
    },
    closeAll: () => {
        document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    }
};

export const Input = {
    mode: 'ai', // ai, manual, exercise
    cat: 'Café da Manhã',

    setMode: (m) => {
        Input.mode = m;
        // UI Toggle
        ['ai', 'manual', 'exercise'].forEach(type => {
            const btn = document.getElementById(`btn-mode-${type}`);
            const area = document.getElementById(`inp-area-${type}`);

            if (type === m) {
                btn.classList.add('bg-brand-500', 'text-white');
                btn.classList.remove('bg-gray-100', 'text-gray-500', 'bg-blue-50', 'text-blue-500');
                area.classList.remove('hidden');
                area.classList.add('animate-fade-in');
            } else {
                btn.classList.remove('bg-brand-500', 'text-white');
                btn.classList.add('bg-gray-100', 'text-gray-500');
                area.classList.add('hidden');
                area.classList.remove('animate-fade-in');
            }
        });

        // Special styling for Exercise button
        if (m !== 'exercise') {
            document.getElementById('btn-mode-exercise').classList.add('text-blue-500', 'border-blue-100', 'bg-blue-50');
            document.getElementById('btn-mode-exercise').classList.remove('bg-gray-100', 'text-gray-500');
        }
    },

    setCat: (c) => {
        Input.cat = c;
        // Update Chips UI
        document.querySelectorAll('.cat-chip').forEach(el => {
            if (el.innerText.includes(c.split(' ')[0])) { // Simple matching
                el.classList.add('active', 'bg-brand-100', 'text-brand-700', 'border-brand-200');
                el.classList.remove('bg-gray-100');
            } else {
                el.classList.remove('active', 'bg-brand-100', 'text-brand-700', 'border-brand-200');
                el.classList.add('bg-gray-100');
            }
        });
    }
};

export const UI = {
    stream: null,
    cameraTarget: 'food',
    portionSize: 1,

    openCamera: async (target = 'food') => {
        UI.cameraTarget = target;
        try {
            const overlay = document.getElementById('camera-overlay');
            const video = document.getElementById('camera-feed');

            UI.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            video.srcObject = UI.stream;
            overlay.classList.add('active');
        } catch (err) {
            console.error(err);
            alert("Erro ao acessar câmera (ou permissão negada). Usando upload de arquivo.");
            if(target === 'food') document.getElementById('inp-image').click();
            else document.getElementById('fridge-image-input').click();
        }
    },

    closeCamera: () => {
        if (UI.stream) {
            UI.stream.getTracks().forEach(track => track.stop());
            UI.stream = null;
        }
        document.getElementById('camera-overlay').classList.remove('active');
    },

    capturePhoto: () => {
        const video = document.getElementById('camera-feed');
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg');
        if(UI.cameraTarget === 'food') {
            document.getElementById('ai-preview-img').src = dataUrl;
            document.getElementById('ai-preview').classList.remove('hidden');
        } else {
            document.getElementById('fridge-preview-img').src = dataUrl;
            document.getElementById('fridge-preview').classList.remove('hidden');
        }

        UI.closeCamera();
    },

    handleImagePreview: (input, target = 'food') => {
        if (input.files[0]) {
            const r = new FileReader();
            r.onload = (e) => {
                if(target === 'food') {
                    document.getElementById('ai-preview-img').src = e.target.result;
                    document.getElementById('ai-preview').classList.remove('hidden');
                } else {
                    document.getElementById('fridge-preview-img').src = e.target.result;
                    document.getElementById('fridge-preview').classList.remove('hidden');
                }
            };
            r.readAsDataURL(input.files[0]);
        }
    },

    clearImage: (target = 'food') => {
        if(target === 'food') {
            document.getElementById('inp-image').value = '';
            document.getElementById('ai-preview-img').src = '';
            document.getElementById('ai-preview').classList.add('hidden');
            UI.setPortion(1);
        } else {
            document.getElementById('fridge-image-input').value = '';
            document.getElementById('fridge-preview-img').src = '';
            document.getElementById('fridge-preview').classList.add('hidden');
        }
    },

    setPortion: (size, btn = null) => {
        UI.portionSize = size;
        if(btn) {
            document.querySelectorAll('.portion-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    }
};

/**
 * AI Health Assistant - Dashboard Chat & BMI Calculator
 */

document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chatForm');
    const symptomInput = document.getElementById('symptomInput');
    const chatMessages = document.getElementById('chatMessages');
    const sendBtn = document.getElementById('sendBtn');
    const loadingModal = document.getElementById('loadingModal');
    const loadingModalInstance = loadingModal ? new bootstrap.Modal(loadingModal) : null;

    // Sidebar BMI calculator
    const sidebarHeight = document.getElementById('sidebarHeight');
    const sidebarWeight = document.getElementById('sidebarWeight');
    const calcBmiBtn = document.getElementById('calcBmiBtn');
    const sidebarBmiResult = document.getElementById('sidebarBmiResult');
    const emergencyBanner = document.getElementById('emergencyBanner');

    // Remove welcome message when first message is sent
    function removeWelcomeMessage() {
        const welcome = chatMessages.querySelector('.welcome-message');
        if (welcome) welcome.remove();
    }

    // Add user message to chat
    function addUserMessage(text) {
        removeWelcomeMessage();
        const div = document.createElement('div');
        div.className = 'chat-message user';
        div.innerHTML = `
            <div class="bubble">${escapeHtml(text)}</div>
            <div class="timestamp text-end">${formatTime(new Date())}</div>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Add assistant message to chat (static, for final display)
    function addAssistantMessage(text, isEmergency) {
        removeWelcomeMessage();
        const div = document.createElement('div');
        div.className = 'chat-message assistant' + (isEmergency ? ' emergency' : '');
        const bubbleClass = isEmergency ? 'bubble emergency-highlight' : 'bubble';
        div.innerHTML = `
            <div class="${bubbleClass}">${formatResponse(text)}</div>
            <div class="timestamp">${formatTime(new Date())}</div>
        `;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        if (isEmergency && emergencyBanner) {
            emergencyBanner.classList.remove('d-none');
        }
    }

    // Create a streaming message bubble; returns { bubbleEl, appendText, finalize(isEmergency) }
    function createStreamingMessage() {
        removeWelcomeMessage();
        const div = document.createElement('div');
        div.className = 'chat-message assistant';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTime(new Date());
        div.appendChild(bubble);
        div.appendChild(timestamp);
        chatMessages.appendChild(div);
        let rawText = '';
        function appendText(text) {
            rawText += text;
            bubble.innerHTML = formatResponse(rawText);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        function finalize(isEmergency) {
            if (isEmergency) {
                div.classList.add('emergency');
                bubble.classList.add('emergency-highlight');
                if (emergencyBanner) emergencyBanner.classList.remove('d-none');
            }
        }
        return { bubbleEl: bubble, appendText, finalize };
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatResponse(text) {
        // Convert newlines to <br>
        let html = escapeHtml(text).replace(/\n/g, '<br>');
        // Bold common section headers
        const sections = ['Possible Condition', 'Risk Level', 'Emergency Warning', 'Self-Care Advice', 'Doctor Consultation'];
        sections.forEach(s => {
            const regex = new RegExp('(' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')[:\\s]', 'gi');
            html = html.replace(regex, '<strong>$1:</strong> ');
        });
        return html;
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Send symptoms to API (streaming for fast first response)
    async function sendSymptoms(symptoms) {
        if (!symptoms.trim()) return;

        addUserMessage(symptoms);
        symptomInput.value = '';
        sendBtn.disabled = true;

        if (loadingModalInstance) loadingModalInstance.show();

        try {
            const response = await fetch('/api/analyze/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symptoms: symptoms }),
            });

            if (!response.ok) {
                if (loadingModalInstance) loadingModalInstance.hide();
                const err = await response.json().catch(() => ({}));
                addAssistantMessage(err.error || 'Something went wrong. Please try again.', false);
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const streamMsg = createStreamingMessage();
            let buffer = '';
            let firstChunk = true;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const payload = line.slice(6);
                        try {
                            const obj = JSON.parse(payload);
                            if (obj.done) {
                                streamMsg.finalize(obj.is_emergency || false);
                                break;
                            }
                        } catch (_) {
                            streamMsg.appendText(payload + '\n');
                            if (firstChunk) {
                                firstChunk = false;
                                if (loadingModalInstance) loadingModalInstance.hide();
                            }
                        }
                    }
                }
            }
        } catch (err) {
            addAssistantMessage('Unable to connect. Please check your connection and try again.', false);
        } finally {
            sendBtn.disabled = false;
            if (loadingModalInstance) loadingModalInstance.hide();
        }
    }

    // Chat form submit
    if (chatForm) {
        chatForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const text = symptomInput.value.trim();
            if (text) sendSymptoms(text);
        });
    }

    // BMI Calculator (sidebar)
    function calcBmi(height, weight) {
        if (height <= 0 || weight <= 0) return null;
        const h = height / 100;
        const bmi = (weight / (h * h)).toFixed(1);
        let category = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
        return { bmi, category };
    }
    if (calcBmiBtn && sidebarHeight && sidebarWeight && sidebarBmiResult) {
        calcBmiBtn.addEventListener('click', function() {
            const result = calcBmi(parseFloat(sidebarHeight.value), parseFloat(sidebarWeight.value));
            sidebarBmiResult.innerHTML = result
                ? `<strong>BMI: ${result.bmi}</strong> - ${result.category}`
                : 'Enter valid height and weight';
        });
    }
    // Mobile BMI Calculator
    const mobileCalcBmi = document.getElementById('mobileCalcBmi');
    const mobileHeight = document.getElementById('mobileHeight');
    const mobileWeight = document.getElementById('mobileWeight');
    const mobileBmiResult = document.getElementById('mobileBmiResult');
    if (mobileCalcBmi && mobileHeight && mobileWeight && mobileBmiResult) {
        mobileCalcBmi.addEventListener('click', function() {
            const result = calcBmi(parseFloat(mobileHeight.value), parseFloat(mobileWeight.value));
            mobileBmiResult.textContent = result
                ? `BMI: ${result.bmi} - ${result.category}`
                : 'Enter valid height and weight';
        });
    }
});

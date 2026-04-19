import { state } from '../state.js';
import { api } from '../api.js';
import { showLoading, hideLoading, toast, esc, formatContent } from '../utils.js';

let chatMessages = [];
let isSending = false;

export async function loadChatHistory() {
    if (!state.currentCampaign) return;
    try {
        const history = await api(`/campaigns/${state.currentCampaign.id}/chat/history`);
        chatMessages = history;
        renderChat();
        scrollToBottom();
    } catch (e) {
        console.error('Failed to load chat history', e);
    }
}

export async function sendChatMessage() {
    if (isSending) return;
    const input = document.getElementById('chat-input');
    if (!input) return;
    const message = input.value.trim();
    if (!message || !state.currentCampaign) return;

    isSending = true;
    input.value = '';
    resizeChatInput(input);

    const userMsg = { id: 'tmp-' + Date.now(), campaign_id: state.currentCampaign.id, role: 'user', content: message, created_at: new Date().toISOString() };
    chatMessages.push(userMsg);
    const loadingMsg = { id: 'loading', role: 'assistant', content: '', created_at: new Date().toISOString(), _loading: true };
    chatMessages.push(loadingMsg);
    renderChat();
    scrollToBottom();

    try {
        const response = await api(`/campaigns/${state.currentCampaign.id}/chat`, {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
        chatMessages = chatMessages.filter(m => m.id !== 'loading');
        chatMessages.push(response);
    } catch (e) {
        chatMessages = chatMessages.filter(m => m.id !== 'loading');
    } finally {
        isSending = false;
        renderChat();
        scrollToBottom();
    }
}

export async function approveChatAction(messageId) {
    showLoading('Applying change to campaign...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/chat/approve/${messageId}`, { method: 'POST' });
        const msg = chatMessages.find(m => m.id === messageId);
        if (msg) msg.action_status = 'approved';

        const updated = await api(`/campaigns/${state.currentCampaign.id}`);
        state.currentCampaign = updated;

        renderChat();
        toast('Change applied to campaign!', 'success');
    } catch (e) {
        console.error(e);
    } finally {
        hideLoading();
    }
}

export async function rejectChatAction(messageId) {
    try {
        await api(`/campaigns/${state.currentCampaign.id}/chat/reject/${messageId}`, { method: 'POST' });
        const msg = chatMessages.find(m => m.id === messageId);
        if (msg) msg.action_status = 'rejected';
        renderChat();
    } catch (e) {
        console.error(e);
    }
}

export async function clearChatHistory() {
    if (!confirm('Clear all chat history for this campaign?')) return;
    try {
        await api(`/campaigns/${state.currentCampaign.id}/chat/history`, { method: 'DELETE' });
        chatMessages = [];
        renderChat();
        toast('Chat history cleared');
    } catch (e) {
        console.error(e);
    }
}

function renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    if (!chatMessages.length) {
        container.innerHTML = `<div class="chat-empty">
            <div class="chat-empty-icon">💬</div>
            <p>Ask me anything about <strong>${esc(state.currentCampaign?.name || 'this campaign')}</strong>.</p>
            <p class="chat-hint">Try: "Who are the main NPCs?" or "Add a new location: The Sunken Tavern"</p>
        </div>`;
        return;
    }

    container.innerHTML = chatMessages.map(msg => {
        if (msg._loading) {
            return `<div class="chat-msg chat-msg-assistant">
                <div class="chat-bubble chat-bubble-assistant chat-bubble-loading">
                    <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
                </div>
            </div>`;
        }

        if (msg.role === 'user') {
            return `<div class="chat-msg chat-msg-user">
                <div class="chat-bubble chat-bubble-user">${esc(msg.content)}</div>
            </div>`;
        }

        let actionCard = '';
        if (msg.proposed_action) {
            const a = msg.proposed_action;
            const status = msg.action_status;
            if (status === 'approved') {
                actionCard = `<div class="action-card action-card-approved">
                    <span class="action-status-icon">✓</span>
                    <span>Applied: ${esc(a.description)}</span>
                </div>`;
            } else if (status === 'rejected') {
                actionCard = `<div class="action-card action-card-rejected">
                    <span class="action-status-icon">✗</span>
                    <span>Rejected: ${esc(a.description)}</span>
                </div>`;
            } else {
                actionCard = `<div class="action-card action-card-pending">
                    <div class="action-label">Proposed Change</div>
                    <div class="action-description">${esc(a.description)}</div>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" data-action="approve-action" data-id="${esc(msg.id)}">✓ Apply to Campaign</button>
                        <button class="btn btn-sm btn-danger" data-action="reject-action" data-id="${esc(msg.id)}">✗ Reject</button>
                    </div>
                </div>`;
            }
        }

        return `<div class="chat-msg chat-msg-assistant">
            <div class="chat-bubble chat-bubble-assistant">${formatContent(msg.content)}</div>
            ${actionCard}
        </div>`;
    }).join('');
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
}

export function resizeChatInput(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

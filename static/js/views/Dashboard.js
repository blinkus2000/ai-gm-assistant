import { state } from '../state.js';
import { api } from '../api.js';
import { el } from '../utils.js';
import { renderSidebar } from '../components/Sidebar.js';

export async function loadDashboard() {
    state.campaigns = await api('/campaigns');
    renderDashboard();
    renderSidebar();
}

export function showDashboard() {
    state.currentCampaign = null;
    
    ['view-dashboard', 'view-campaign', 'view-settings'].forEach(id => {
        const viewEl = document.getElementById(id);
        if (viewEl) viewEl.style.display = (id === 'view-dashboard') ? '' : 'none';
    });

    const advDetailView = document.getElementById('adversary-detail-view');
    if (advDetailView) advDetailView.style.display = 'none';
    state.currentAdversaryId = null;

    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-dashboard').classList.add('active');
    
    renderSidebar();
    loadDashboard();
}

export function renderDashboard() {
    const campaigns = state.campaigns;
    const cardsEl = document.getElementById('campaign-cards');
    const emptyEl = document.getElementById('empty-dashboard');

    const totalSessions = campaigns.reduce((a, c) => a + c.session_count, 0);
    const totalNpcs = campaigns.reduce((a, c) => a + c.npc_count, 0);
    document.getElementById('stat-campaigns').textContent = campaigns.length;
    document.getElementById('stat-sessions').textContent = totalSessions;
    document.getElementById('stat-npcs').textContent = totalNpcs;

    if (campaigns.length === 0) {
        cardsEl.innerHTML = '';
        emptyEl.style.display = '';
        return;
    }

    emptyEl.style.display = 'none';
    cardsEl.innerHTML = '';
    
    campaigns.forEach(c => {
        const card = el('div', {
            className: 'card',
            style: 'cursor:pointer;',
            dataset: { action: 'open-campaign', id: c.id }
        }, 
            el('div', { className: 'card-title', textContent: c.name }),
            el('div', { className: 'card-meta' },
                c.game_system ? el('span', { className: 'tag', textContent: c.game_system }) : null,
                el('span', { textContent: `${c.session_count} sessions` }),
                el('span', { textContent: `${c.npc_count} NPCs` })
            ),
            el('div', { className: 'card-description', textContent: c.setting || 'No setting described yet.' })
        );
        cardsEl.appendChild(card);
    });
}

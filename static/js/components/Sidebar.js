import { state } from '../state.js';
import { el } from '../utils.js';

export function renderSidebar() {
    const list = document.getElementById('campaign-list');
    list.innerHTML = '';
    
    state.campaigns.forEach(c => {
        const li = el('li', {
            className: `campaign-list-item ${state.currentCampaign?.id === c.id ? 'active' : ''}`,
            dataset: { action: 'open-campaign', id: c.id }
        },
            el('span', { className: 'dot' }),
            c.name
        );
        list.appendChild(li);
    });
}

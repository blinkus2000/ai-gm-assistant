import { state } from './state.js';
import { loadDashboard, showDashboard } from './views/Dashboard.js';
import { showSettings, saveSettings } from './views/Settings.js';
import { switchTab, closeAdversaryDetail } from './views/Campaign.js';
import {
    showNewCampaignModal, showEditCampaignModal, deleteCampaign,
    showAddSessionModal, editSession, deleteSession,
    showAddNPCModal, editNPC, deleteNPC,
    showAddLocationModal, editLocation, deleteLocation,
    showAddPlotModal, editPlotThread, updatePlotStatus, deletePlotThread,
    showAddAdversaryModal, editAdversary, deleteAdversary
} from './views/CampaignCRUD.js';
import {
    uploadRuleset, generateContent, saveGeneratedContent, generateModule,
    enhanceEntity, generateImage
} from './views/CampaignGenerate.js';
import {
    loadChatHistory, sendChatMessage, approveChatAction, rejectChatAction,
    clearChatHistory, resizeChatInput
} from './views/Chat.js';
import { esc } from './utils.js';

window.addEventListener('error', e => { document.body.innerHTML += '<div style="color:red;z-index:9999;position:fixed;top:0;left:0;background:black;padding:10px;">ERR: ' + e.message + '</div>'; });
window.addEventListener('unhandledrejection', e => { document.body.innerHTML += '<div style="color:red;z-index:9999;position:fixed;top:40px;left:0;background:black;padding:10px;">PROMISE ERR: ' + (e.reason?.message || e.reason) + '</div>'; });

document.getElementById('sidebar').addEventListener('click', e => {
    const btn = e.target.closest('.sidebar-btn, .campaign-list-item');
    if (!btn) return;

    if (btn.id === 'nav-dashboard') showDashboard();
    else if (btn.id === 'nav-settings') showSettings();
    else if (btn.id === 'btn-new-campaign') showNewCampaignModal();
    else if (btn.dataset.action === 'open-campaign') {
        import('./views/Campaign.js').then(m => m.openCampaign(btn.dataset.id));
    }
});

document.getElementById('main-content').addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action], .tab, button');
    if (!actionEl) return;

    if (actionEl.classList.contains('tab') && actionEl.dataset.tab) {
        switchTab(actionEl.dataset.tab);
        if (actionEl.dataset.tab === 'chat') loadChatHistory();
        return;
    }

    if (actionEl.dataset.action) {
        const action = actionEl.dataset.action;
        const id = actionEl.dataset.id;
        switch(action) {
            case 'open-campaign': import('./views/Campaign.js').then(m => m.openCampaign(id)); break;
            // Session
            case 'edit-session': editSession(id); break;
            case 'delete-session': deleteSession(id); break;
            case 'enhance-session': enhanceEntity('sessions', id); break;
            // NPC
            case 'edit-npc': editNPC(id); break;
            case 'delete-npc': deleteNPC(id); break;
            case 'enhance-npc': enhanceEntity('npcs', id); break;
            case 'regen-npc-image': generateImage('npcs', id); break;
            // Location
            case 'edit-location': editLocation(id); break;
            case 'delete-location': deleteLocation(id); break;
            case 'enhance-location': enhanceEntity('locations', id); break;
            case 'regen-location-image': generateImage('locations', id); break;
            // Plot thread
            case 'edit-plot': editPlotThread(id); break;
            case 'delete-plot': deletePlotThread(id); break;
            case 'enhance-plot': enhanceEntity('plot-threads', id); break;
            // Adversary
            case 'view-adversary': import('./views/Campaign.js').then(m => m.openAdversaryDetail(id)); break;
            case 'edit-adversary': editAdversary(id); break;
            case 'delete-adversary': deleteAdversary(id); break;
            // Chat
            case 'approve-action': approveChatAction(id); break;
            case 'reject-action': rejectChatAction(id); break;
        }
        return;
    }

    switch (actionEl.id) {
        case 'btn-new-campaign-main':
        case 'btn-new-campaign-empty': showNewCampaignModal(); break;
        case 'btn-edit-campaign': showEditCampaignModal(); break;
        case 'btn-delete-campaign': deleteCampaign(); break;
        case 'btn-save-settings': saveSettings(); break;
        case 'btn-add-session': showAddSessionModal(); break;
        case 'btn-add-npc': showAddNPCModal(); break;
        case 'btn-add-location': showAddLocationModal(); break;
        case 'btn-add-plot': showAddPlotModal(); break;
        case 'btn-add-adversary': showAddAdversaryModal(); break;
        case 'btn-generate': generateContent(); break;
        case 'btn-save-generated': saveGeneratedContent(); break;
        case 'btn-generate-module': generateModule(); break;
        case 'btn-chat-send': sendChatMessage(); break;
        case 'btn-chat-clear': clearChatHistory(); break;
        
        case 'btn-generate-session':
            switchTab('generate');
            document.getElementById('gen-type').value = 'session';
            document.getElementById('gen-prompt').focus();
            break;
        case 'btn-generate-npc':
            switchTab('generate');
            document.getElementById('gen-type').value = 'npc';
            document.getElementById('gen-prompt').focus();
            break;
        case 'btn-generate-location':
            switchTab('generate');
            document.getElementById('gen-type').value = 'location';
            document.getElementById('gen-prompt').focus();
            break;
        case 'btn-generate-adversary':
            switchTab('generate');
            document.getElementById('gen-type').value = 'adversary';
            document.getElementById('gen-type').dispatchEvent(new Event('change'));
            document.getElementById('gen-prompt').focus();
            break;
    }
});

document.getElementById('main-content').addEventListener('change', e => {
    if (e.target.dataset && e.target.dataset.action === 'update-plot-status') {
        updatePlotStatus(e.target.dataset.id, e.target.value);
    }
    
    if (e.target.id === 'gen-type') {
        const type = e.target.value;
        const extra = document.getElementById('gen-extra-fields');
        if (!state.currentCampaign) return;
        
        if (type === 'session') {
            const npcs = state.currentCampaign.npcs;
            const locs = state.currentCampaign.locations;
            const plots = state.currentCampaign.plot_threads;
            
            let html = '<div class="form-group"><label class="form-label">Include NPCs</label><select multiple class="form-select" id="gen-session-npcs" style="height:80px">';
            npcs.forEach(n => html += '<option value="'+n.id+'">'+esc(n.name)+'</option>');
            html += '</select></div>';
            
            html += '<div class="form-group"><label class="form-label">Include Locations</label><select multiple class="form-select" id="gen-session-locs" style="height:80px">';
            locs.forEach(l => html += '<option value="'+l.id+'">'+esc(l.name)+'</option>');
            html += '</select></div>';
            
            html += '<div class="form-group"><label class="form-label">Include Plot Threads</label><select multiple class="form-select" id="gen-session-plots" style="height:80px">';
            plots.forEach(p => html += '<option value="'+p.id+'">'+esc(p.title)+'</option>');
            html += '</select></div>';
            
            extra.innerHTML = html;
        } else if (type === 'adversary') {
            const npcs = state.currentCampaign.npcs;
            const locs = state.currentCampaign.locations;
            const plots = state.currentCampaign.plot_threads;
            
            let html = `
                <div class="grid grid-2 gap-sm">
                    <div class="form-group">
                        <label class="form-label">Adventure Type</label>
                        <select class="form-select" id="gen-adv-adventure-type">
                            <option value="thwarting">Thwarting</option>
                            <option value="collecting">Collecting</option>
                            <option value="delivering">Delivering</option>
                            <option value="discovery">Discovery</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Adversary Type</label>
                        <select class="form-select" id="gen-adv-type">
                            <option value="heavy_hitter">Heavy Hitter</option>
                            <option value="racer">Racer</option>
                            <option value="chaser">Chaser</option>
                            <option value="shadow">Shadow</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Connect NPCs</label>
                    <select multiple class="form-select" id="gen-adv-npcs" style="height:80px">
                        ${npcs.map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Connect Locations</label>
                    <select multiple class="form-select" id="gen-adv-locs" style="height:80px">
                        ${locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Connect Plot Threads</label>
                    <select multiple class="form-select" id="gen-adv-plots" style="height:80px">
                        ${plots.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}
                    </select>
                </div>
            `;
            extra.innerHTML = html;
        } else {
            extra.innerHTML = '';
        }
    }
});

const area = document.getElementById('ruleset-upload-area');
const input = document.getElementById('ruleset-file-input');
if (area && input) {
    area.addEventListener('click', () => input.click());
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files.length) uploadRuleset(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => {
        if (input.files.length) {
            uploadRuleset(input.files[0]);
            input.value = '';
        }
    });
}

document.getElementById('adversary-detail-view').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    switch(btn.id) {
        case 'btn-close-adversary-detail': closeAdversaryDetail(); break;
        case 'btn-detail-edit': editAdversary(state.currentAdversaryId); break;
        case 'btn-detail-gen-image': generateImage('adversaries', state.currentAdversaryId); break;
    }
});

document.getElementById('main-content').addEventListener('keydown', e => {
    if (e.target.id === 'chat-input') {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    }
});

document.getElementById('main-content').addEventListener('input', e => {
    if (e.target.id === 'chat-input') resizeChatInput(e.target);
});

loadDashboard();

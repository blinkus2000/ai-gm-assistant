import { state } from '../state.js';
import { api } from '../api.js';
import { showModal, toast, esc } from '../utils.js';
import { openCampaign, closeAdversaryDetail, openAdversaryDetail } from './Campaign.js';
import { showDashboard } from './Dashboard.js';

export function showNewCampaignModal() {
    showModal('New Campaign', `
        <div class="form-group">
            <label class="form-label">Campaign Name</label>
            <input class="form-input" id="new-campaign-name" placeholder="e.g., Curse of the Crimson Throne">
        </div>
        <div class="form-group">
            <label class="form-label">Game System</label>
            <input class="form-input" id="new-campaign-system" placeholder="e.g., D&D 5e, Pathfinder 2e">
        </div>
        <div class="form-group">
            <label class="form-label">Setting</label>
            <textarea class="form-textarea" id="new-campaign-setting" placeholder="Describe the world and setting..."></textarea>
        </div>
    `, async (overlay) => {
        const name = overlay.querySelector('#new-campaign-name').value.trim();
        if (!name) { toast('Campaign name is required', 'error'); return; }
        await api('/campaigns', {
            method: 'POST',
            body: JSON.stringify({
                name,
                game_system: overlay.querySelector('#new-campaign-system').value.trim(),
                setting: overlay.querySelector('#new-campaign-setting').value.trim(),
            }),
        });
        toast('Campaign created!', 'success');
        showDashboard(); // Will reload campaigns and render
    }, 'Create Campaign');
}

export function showEditCampaignModal() {
    const c = state.currentCampaign;
    showModal('Edit Campaign', `
        <div class="form-group">
            <label class="form-label">Campaign Name</label>
            <input class="form-input" id="edit-campaign-name" value="${esc(c.name)}">
        </div>
        <div class="form-group">
            <label class="form-label">Game System</label>
            <input class="form-input" id="edit-campaign-system" value="${esc(c.game_system)}">
        </div>
        <div class="form-group">
            <label class="form-label">Setting</label>
            <textarea class="form-textarea" id="edit-campaign-setting">${esc(c.setting)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" id="edit-campaign-notes">${esc(c.notes)}</textarea>
        </div>
    `, async (overlay) => {
        await api(`/campaigns/${c.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: overlay.querySelector('#edit-campaign-name').value.trim(),
                game_system: overlay.querySelector('#edit-campaign-system').value.trim(),
                setting: overlay.querySelector('#edit-campaign-setting').value.trim(),
                notes: overlay.querySelector('#edit-campaign-notes').value.trim(),
            }),
        });
        toast('Campaign updated!', 'success');
        await openCampaign(c.id);
    });
}

export async function deleteCampaign() {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    const c = state.currentCampaign;
    await api(`/campaigns/${c.id}`, { method: 'DELETE' });
    toast('Campaign deleted', 'success');
    showDashboard();
}

// ============== SESSIONS ==============

export function showAddSessionModal() {
    const c = state.currentCampaign;
    const nextNum = c.sessions.length + 1;
    showModal('Add Session', `
        <div class="form-group">
            <label class="form-label">Session Number</label>
            <input class="form-input" id="add-session-number" type="number" value="${nextNum}">
        </div>
        <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="add-session-title" placeholder="Session title">
        </div>
        <div class="form-group">
            <label class="form-label">Summary</label>
            <textarea class="form-textarea" id="add-session-summary" placeholder="What happened..."></textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="add-session-status">
                <option value="draft">Draft</option>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
            </select>
        </div>
    `, async (overlay) => {
        await api(`/campaigns/${c.id}/sessions`, {
            method: 'POST',
            body: JSON.stringify({
                number: parseInt(overlay.querySelector('#add-session-number').value) || nextNum,
                title: overlay.querySelector('#add-session-title').value.trim(),
                summary: overlay.querySelector('#add-session-summary').value.trim(),
                status: overlay.querySelector('#add-session-status').value,
            }),
        });
        toast('Session added!', 'success');
        await openCampaign(c.id);
    });
}

export function editSession(sessionId) {
    const c = state.currentCampaign;
    const s = c.sessions.find(x => x.id === sessionId);
    if (!s) return;

    showModal('Edit Session', `
        <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="edit-session-title" value="${esc(s.title)}">
        </div>
        <div class="form-group">
            <label class="form-label">Summary</label>
            <textarea class="form-textarea" id="edit-session-summary">${esc(s.summary)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Plan</label>
            <textarea class="form-textarea" id="edit-session-plan" style="min-height:200px;">${esc(s.plan)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="edit-session-status">
                <option value="draft" ${s.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="planned" ${s.status === 'planned' ? 'selected' : ''}>Planned</option>
                <option value="completed" ${s.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
        </div>
    `, async (overlay) => {
        await api(`/campaigns/${c.id}/sessions/${sessionId}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: overlay.querySelector('#edit-session-title').value.trim(),
                summary: overlay.querySelector('#edit-session-summary').value.trim(),
                plan: overlay.querySelector('#edit-session-plan').value.trim(),
                status: overlay.querySelector('#edit-session-status').value,
            }),
        });
        toast('Session updated!', 'success');
        await openCampaign(c.id);
    });
}

export async function deleteSession(sessionId) {
    if (!confirm('Delete this session?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/sessions/${sessionId}`, { method: 'DELETE' });
    toast('Session deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// ============== NPCS ==============

export function showAddNPCModal() {
    showModal('Add NPC', `
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="add-npc-name" placeholder="NPC name">
        </div>
        <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="add-npc-role">
                <option value="neutral">Neutral</option>
                <option value="ally">Ally</option>
                <option value="villain">Villain</option>
                <option value="patron">Patron</option>
                <option value="rival">Rival</option>
                <option value="other">Other</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="add-npc-desc" placeholder="Appearance, personality, background..."></textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" id="add-npc-notes" placeholder="GM-facing notes..."></textarea>
        </div>
    `, async (overlay) => {
        const name = overlay.querySelector('#add-npc-name').value.trim();
        if (!name) { toast('Name is required', 'error'); return; }
        await api(`/campaigns/${state.currentCampaign.id}/npcs`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                role: overlay.querySelector('#add-npc-role').value,
                description: overlay.querySelector('#add-npc-desc').value.trim(),
                notes: overlay.querySelector('#add-npc-notes').value.trim(),
            }),
        });
        toast('NPC added!', 'success');
        await openCampaign(state.currentCampaign.id);
    });
}

export function editNPC(npcId) {
    const npc = state.currentCampaign.npcs.find(n => n.id === npcId);
    if (!npc) return;

    showModal('Edit NPC', `
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="edit-npc-name" value="${esc(npc.name)}">
        </div>
        <div class="form-group">
            <label class="form-label">Role</label>
            <select class="form-select" id="edit-npc-role">
                ${['neutral','ally','villain','patron','rival','other'].map(r =>
                    `<option value="${r}" ${npc.role === r ? 'selected' : ''}>${r}</option>`
                ).join('')}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="edit-npc-desc">${esc(npc.description)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" id="edit-npc-notes">${esc(npc.notes)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Stats (JSON Format)</label>
            <textarea class="form-textarea" id="edit-npc-stats" style="font-family: monospace; font-size: 0.8rem; height: 120px;">${esc(JSON.stringify(npc.stats || {}, null, 2))}</textarea>
        </div>
    `, async (overlay) => {
        let parsedStats;
        try {
            parsedStats = JSON.parse(overlay.querySelector('#edit-npc-stats').value.trim());
        } catch (e) {
            toast('Invalid JSON in Stats field.', 'error');
            return;
        }
        await api(`/campaigns/${state.currentCampaign.id}/npcs/${npcId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: overlay.querySelector('#edit-npc-name').value.trim(),
                role: overlay.querySelector('#edit-npc-role').value,
                description: overlay.querySelector('#edit-npc-desc').value.trim(),
                notes: overlay.querySelector('#edit-npc-notes').value.trim(),
                stats: parsedStats,
            }),
        });
        toast('NPC updated!', 'success');
        await openCampaign(state.currentCampaign.id);
    });
}

export async function deleteNPC(npcId) {
    if (!confirm('Delete this NPC?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/npcs/${npcId}`, { method: 'DELETE' });
    toast('NPC deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// ============== LOCATIONS ==============

export function showAddLocationModal() {
    showModal('Add Location', `
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="add-loc-name" placeholder="Location name">
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="add-loc-desc" placeholder="Describe the location..."></textarea>
        </div>
    `, async (overlay) => {
        const name = overlay.querySelector('#add-loc-name').value.trim();
        if (!name) { toast('Name is required', 'error'); return; }
        await api(`/campaigns/${state.currentCampaign.id}/locations`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                description: overlay.querySelector('#add-loc-desc').value.trim(),
            }),
        });
        toast('Location added!', 'success');
        await openCampaign(state.currentCampaign.id);
    });
}

export function editLocation(locationId) {
    const loc = state.currentCampaign.locations.find(l => l.id === locationId);
    if (!loc) return;

    showModal('Edit Location', `
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="edit-loc-name" value="${esc(loc.name)}">
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="edit-loc-desc">${esc(loc.description)}</textarea>
        </div>
    `, async (overlay) => {
        await api(`/campaigns/${state.currentCampaign.id}/locations/${locationId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: overlay.querySelector('#edit-loc-name').value.trim(),
                description: overlay.querySelector('#edit-loc-desc').value.trim(),
            }),
        });
        toast('Location updated!', 'success');
        await openCampaign(state.currentCampaign.id);
    });
}

export async function deleteLocation(locationId) {
    if (!confirm('Delete this location?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/locations/${locationId}`, { method: 'DELETE' });
    toast('Location deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// ============== PLOT THREADS ==============

export function showAddPlotModal() {
    const npcs = state.currentCampaign.npcs;
    const locs = state.currentCampaign.locations;

    const npcOptions = npcs.map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('');
    const locOptions = locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');

    showModal('Add Plot Thread', `
        <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="add-plot-title" placeholder="Plot thread title">
        </div>
        <div class="form-group">
            <label class="form-label">Related NPCs</label>
            <select multiple class="form-select" id="add-plot-npcs" style="height:80px">
                ${npcOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Related Locations</label>
            <select multiple class="form-select" id="add-plot-locs" style="height:80px">
                ${locOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="add-plot-desc" placeholder="Describe this plot thread..."></textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" id="add-plot-notes" placeholder="GM notes..."></textarea>
        </div>
    `, async (overlay) => {
        const title = overlay.querySelector('#add-plot-title').value.trim();
        if (!title) { toast('Title is required', 'error'); return; }

        const getSelected = (id) => Array.from(overlay.querySelector(id).selectedOptions).map(o => o.value);

        await api(`/campaigns/${state.currentCampaign.id}/plot-threads`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                description: overlay.querySelector('#add-plot-desc').value.trim(),
                notes: overlay.querySelector('#add-plot-notes').value.trim(),
                related_npcs: getSelected('#add-plot-npcs'),
                related_locations: getSelected('#add-plot-locs')
            }),
        });
        toast('Plot thread added!', 'success');
        await openCampaign(state.currentCampaign.id);
    });
}

export function editPlotThread(threadId) {
    const pt = state.currentCampaign.plot_threads.find(x => x.id === threadId);
    if (!pt) return;

    const npcs = state.currentCampaign.npcs;
    const locs = state.currentCampaign.locations;

    const npcOptions = npcs.map(n => 
        `<option value="${n.id}" ${pt.related_npcs.includes(n.id) ? 'selected' : ''}>${esc(n.name)}</option>`
    ).join('');
    const locOptions = locs.map(l => 
        `<option value="${l.id}" ${pt.related_locations.includes(l.id) ? 'selected' : ''}>${esc(l.name)}</option>`
    ).join('');

    showModal('Edit Plot Thread', `
        <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-input" id="edit-plot-title" value="${esc(pt.title)}">
        </div>
        <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="edit-plot-status">
                <option value="active" ${pt.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="dormant" ${pt.status === 'dormant' ? 'selected' : ''}>Dormant</option>
                <option value="resolved" ${pt.status === 'resolved' ? 'selected' : ''}>Resolved</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Related NPCs</label>
            <select multiple class="form-select" id="edit-plot-npcs" style="height:80px">
                ${npcOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Related Locations</label>
            <select multiple class="form-select" id="edit-plot-locs" style="height:80px">
                ${locOptions}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="edit-plot-desc">${esc(pt.description)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-textarea" id="edit-plot-notes">${esc(pt.notes)}</textarea>
        </div>
    `, async (overlay) => {
        const getSelected = (id) => Array.from(overlay.querySelector(id).selectedOptions).map(o => o.value);

        await api(`/campaigns/${state.currentCampaign.id}/plot-threads/${threadId}`, {
            method: 'PUT',
            body: JSON.stringify({
                title: overlay.querySelector('#edit-plot-title').value.trim(),
                status: overlay.querySelector('#edit-plot-status').value,
                description: overlay.querySelector('#edit-plot-desc').value.trim(),
                notes: overlay.querySelector('#edit-plot-notes').value.trim(),
                related_npcs: getSelected('#edit-plot-npcs'),
                related_locations: getSelected('#edit-plot-locs')
            }),
        });
        toast('Plot thread updated!', 'success');
        await openCampaign(state.currentCampaign.id);
    });
}

export async function updatePlotStatus(threadId, status) {
    await api(`/campaigns/${state.currentCampaign.id}/plot-threads/${threadId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
    toast('Status updated', 'success');
    await openCampaign(state.currentCampaign.id);
}

export async function deletePlotThread(threadId) {
    if (!confirm('Delete this plot thread?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/plot-threads/${threadId}`, { method: 'DELETE' });
    toast('Plot thread deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// ============== ADVERSARIES ==============

export function showAddAdversaryModal() {
    showModal('Add Adversary', `
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="add-adv-name" placeholder="Adversary name">
        </div>
        <div class="grid grid-2 gap-sm">
            <div class="form-group">
                <label class="form-label">Adventure Type</label>
                <select class="form-select" id="add-adv-adventure-type">
                    <option value="thwarting">Thwarting</option>
                    <option value="collecting">Collecting</option>
                    <option value="delivering">Delivering</option>
                    <option value="discovery">Discovery</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Adversary Type</label>
                <select class="form-select" id="add-adv-type">
                    <option value="heavy_hitter">Heavy Hitter</option>
                    <option value="racer">Racer</option>
                    <option value="chaser">Chaser</option>
                    <option value="shadow">Shadow</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="add-adv-desc" placeholder="Physical description and personality..."></textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Steps (5 steps, one per line)</label>
            <textarea class="form-textarea" id="add-adv-steps" placeholder="Enter exactly 5 steps..." style="height:100px"></textarea>
        </div>
        <div class="form-group">
            <label class="form-label">GM Notes</label>
            <textarea class="form-textarea" id="add-adv-notes" placeholder="Motivations, secrets..."></textarea>
        </div>
    `, async (overlay) => {
        const name = overlay.querySelector('#add-adv-name').value.trim();
        if (!name) { toast('Name is required', 'error'); return; }
        
        const steps = overlay.querySelector('#add-adv-steps').value.split('\\n').filter(s => s.trim());
        
        await api(`/campaigns/${state.currentCampaign.id}/adversaries`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                adventure_type: overlay.querySelector('#add-adv-adventure-type').value,
                adversary_type: overlay.querySelector('#add-adv-type').value,
                description: overlay.querySelector('#add-adv-desc').value.trim(),
                steps: steps,
                notes: overlay.querySelector('#add-adv-notes').value.trim(),
            }),
        });
        toast('Adversary added!', 'success');
        await openCampaign(state.currentCampaign.id);
    });
}

export function editAdversary(advId) {
    const adv = state.currentCampaign.adversaries.find(a => a.id === advId);
    if (!adv) return;

    showModal('Edit Adversary', `
        <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="edit-adv-name" value="${esc(adv.name)}">
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-textarea" id="edit-adv-desc">${esc(adv.description)}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Steps (one per line)</label>
            <textarea class="form-textarea" id="edit-adv-steps" style="height:100px">${esc((adv.steps || []).join('\\n'))}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">GM Notes</label>
            <textarea class="form-textarea" id="edit-adv-notes">${esc(adv.notes)}</textarea>
        </div>
    `, async (overlay) => {
        const steps = overlay.querySelector('#edit-adv-steps').value.split('\\n').filter(s => s.trim());
        await api(`/campaigns/${state.currentCampaign.id}/adversaries/${advId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: overlay.querySelector('#edit-adv-name').value.trim(),
                description: overlay.querySelector('#edit-adv-desc').value.trim(),
                steps: steps,
                notes: overlay.querySelector('#edit-adv-notes').value.trim(),
            }),
        });
        toast('Adversary updated!', 'success');
        await openCampaign(state.currentCampaign.id);
        if (state.currentAdversaryId === advId) openAdversaryDetail(advId);
    });
}

export async function deleteAdversary(advId) {
    if (!confirm('Delete this adversary?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/adversaries/${advId}`, { method: 'DELETE' });
    toast('Adversary deleted', 'success');
    closeAdversaryDetail();
    await openCampaign(state.currentCampaign.id);
}

/**
 * AI GM Assistant — Frontend Application
 *
 * Vanilla JS SPA handling campaign management, content generation,
 * and PDF module workflow. Communicates with the FastAPI backend.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
    campaigns: [],
    currentCampaign: null,
    currentTab: 'overview',
    lastGeneratedResult: null,
    lastGeneratedType: null,
    settings: null,
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
const API = '/api';

async function api(path, options = {}) {
    const url = `${API}${path}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };

    // Don't set Content-Type for FormData
    if (config.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    try {
        const resp = await fetch(url, config);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({ detail: resp.statusText }));
            throw new Error(err.detail || 'Request failed');
        }
        return await resp.json();
    } catch (e) {
        toast(e.message, 'error');
        throw e;
    }
}

// ---------------------------------------------------------------------------
// Toast notifications
// ---------------------------------------------------------------------------
function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ---------------------------------------------------------------------------
// Loading overlay
// ---------------------------------------------------------------------------
function showLoading(text = 'Generating...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">${text}</div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

// ---------------------------------------------------------------------------
// Modal helper
// ---------------------------------------------------------------------------
function showModal(title, contentHtml, onConfirm, confirmText = 'Save') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-title">${title}</div>
            <div class="modal-body">${contentHtml}</div>
            <div class="modal-actions">
                <button class="btn" id="modal-cancel">Cancel</button>
                <button class="btn btn-primary" id="modal-confirm">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#modal-confirm').onclick = () => {
        onConfirm(overlay);
        overlay.remove();
    };
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    return overlay;
}

// ---------------------------------------------------------------------------
// View management
// ---------------------------------------------------------------------------
/**
 * Shows the requested view and hides all others.
 * @param {string} viewId - The ID of the view div to show (e.g. 'view-dashboard')
 */
function showView(viewId) {
    const views = ['view-dashboard', 'view-campaign', 'view-settings'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === viewId) ? '' : 'none';
    });

    // Also close overlays if switching main views
    if (typeof closeAdversaryDetail === 'function') {
        closeAdversaryDetail();
    }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
async function loadDashboard() {
    state.campaigns = await api('/campaigns');
    renderDashboard();
    renderSidebar();
}

function renderDashboard() {
    const campaigns = state.campaigns;
    const cardsEl = document.getElementById('campaign-cards');
    const emptyEl = document.getElementById('empty-dashboard');
    const statsEl = document.getElementById('dashboard-stats');

    // Stats
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
    cardsEl.innerHTML = campaigns.map(c => `
        <div class="card" onclick="openCampaign('${c.id}')" style="cursor:pointer;">
            <div class="card-title">${esc(c.name)}</div>
            <div class="card-meta">
                ${c.game_system ? `<span class="tag">${esc(c.game_system)}</span>` : ''}
                <span>${c.session_count} sessions</span>
                <span>${c.npc_count} NPCs</span>
            </div>
            <div class="card-description">${esc(c.setting || 'No setting described yet.')}</div>
        </div>
    `).join('');
}

function renderSidebar() {
    const list = document.getElementById('campaign-list');
    list.innerHTML = state.campaigns.map(c => `
        <li class="campaign-list-item ${state.currentCampaign?.id === c.id ? 'active' : ''}"
            onclick="openCampaign('${c.id}')">
            <span class="dot"></span>
            ${esc(c.name)}
        </li>
    `).join('');
}

// ---------------------------------------------------------------------------
// Campaign view
// ---------------------------------------------------------------------------
async function openCampaign(id) {
    showLoading('Loading campaign...');
    try {
        const campaign = await api(`/campaigns/${id}`);
        state.currentCampaign = campaign;

        showView('view-campaign');

        renderCampaignView();
        renderSidebar();

        // Update sidebar active states
        document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

function renderCampaignView() {
    const campaign = state.currentCampaign;
    if (!campaign) return;

    // Header
    document.getElementById('campaign-title').textContent = campaign.name;
    document.getElementById('campaign-breadcrumb-name').textContent = campaign.name;

    // Overview content
    const systemEl = document.getElementById('overview-system');
    if (systemEl) {
        systemEl.textContent = campaign.game_system || 'Unknown System';
        systemEl.style.display = campaign.game_system ? '' : 'none';
    }
    
    document.getElementById('overview-setting').innerHTML = formatContent(campaign.setting || 'No setting described yet.');
    document.getElementById('overview-notes').innerHTML = formatContent(campaign.notes || 'No campaign notes yet.');

    // Tab counts
    document.getElementById('tab-count-sessions').textContent = campaign.sessions.length;
    document.getElementById('tab-count-npcs').textContent = campaign.npcs.length;
    document.getElementById('tab-count-locations').textContent = campaign.locations.length;
    document.getElementById('tab-count-plots').textContent = campaign.plot_threads.length;
    document.getElementById('tab-count-adversaries').textContent = (campaign.adversaries || []).length;
    document.getElementById('tab-count-rulesets').textContent = campaign.rulesets.length;

    // Overview stats
    document.getElementById('overview-sessions').textContent = campaign.sessions.length;
    document.getElementById('overview-npcs').textContent = campaign.npcs.length;
    document.getElementById('overview-locations').textContent = campaign.locations.length;
    document.getElementById('overview-plots').textContent = campaign.plot_threads.length;
    document.getElementById('overview-adversaries').textContent = (campaign.adversaries || []).length;
    document.getElementById('overview-rulesets').textContent = campaign.rulesets.length;

    // Render all tab contents
    renderSessions();
    renderNPCs();
    renderLocations();
    renderPlotThreads();
    renderAdversaries();
    renderRulesets();
    renderModules();
}

function showDashboard() {
    state.currentCampaign = null;
    showView('view-dashboard');
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-dashboard').classList.add('active');
    renderSidebar();
    loadDashboard();
}

async function showSettings() {
    state.currentCampaign = null;
    showView('view-settings');
    
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-settings').classList.add('active');
    
    await loadSettings();
    renderSidebar();
}

async function loadSettings() {
    try {
        state.settings = await api('/settings');
        document.getElementById('settings-reasoning-model').value = state.settings.reasoning_model;
        document.getElementById('settings-image-model').value = state.settings.image_model;
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

async function saveSettings() {
    const reasoning_model = document.getElementById('settings-reasoning-model').value;
    const image_model = document.getElementById('settings-image-model').value;
    
    showLoading('Saving settings...');
    try {
        await api('/settings', {
            method: 'PUT',
            body: JSON.stringify({ reasoning_model, image_model })
        });
        state.settings = { reasoning_model, image_model };
        toast('Settings saved successfully!', 'success');
    } catch (e) {
        // toast handles error
    } finally {
        hideLoading();
    }
}

async function generateAdversaryImage(advId) {
    showLoading('Generating Image with Art Director...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/adversaries/${advId}/generate-image`, {method: 'POST'});
        toast('Image Generated!', 'success');
        await openCampaign(state.currentCampaign.id);
        if (state.currentAdversaryId === advId) openAdversaryDetail(advId);
    } catch(e) {} finally {
        hideLoading();
    }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function switchTab(tabName) {
    state.currentTab = tabName;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `panel-${tabName}`);
    });
}

// ---------------------------------------------------------------------------
// Sessions rendering
// ---------------------------------------------------------------------------
function renderSessions() {
    const c = state.currentCampaign;
    const list = document.getElementById('sessions-list');
    const empty = document.getElementById('empty-sessions');

    if (!c.sessions.length) {
        list.innerHTML = '';
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = c.sessions.map(s => `
        <div class="card mb-1">
            <div class="flex justify-between items-center">
                <div class="card-title">Session ${s.number}: ${esc(s.title || 'Untitled')}</div>
                <span class="badge badge-${s.status}">${s.status}</span>
            </div>
            ${s.summary ? `<div class="card-description mt-1">${esc(s.summary)}</div>` : ''}
            ${s.plan ? `
                <details class="mt-1">
                    <summary style="cursor:pointer;color:var(--gold);font-size:0.85rem;">View Plan</summary>
                    <div class="content-display mt-1" style="max-height:400px;overflow-y:auto;">${formatContent(s.plan)}</div>
                </details>
            ` : ''}
            ${s.key_events.length ? `
                <div class="mt-1 text-sm text-dim">Key Events: ${s.key_events.map(e => esc(e)).join(' • ')}</div>
            ` : ''}
            <div class="card-actions">
                <button class="btn btn-sm" onclick="editSession('${s.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSession('${s.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ---------------------------------------------------------------------------
// NPCs rendering
// ---------------------------------------------------------------------------
function renderNPCs() {
    const c = state.currentCampaign;
    const grid = document.getElementById('npcs-grid');
    const empty = document.getElementById('empty-npcs');

    if (!c.npcs.length) {
        grid.innerHTML = '';
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = c.npcs.map(npc => `
        <div class="card">
            ${npc.image_path ? `<img src="${npc.image_path}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; margin-bottom:0.5rem;">` : ''}
            <div class="card-title">${esc(npc.name)}</div>
            <div class="card-meta">
                <span class="badge badge-active">${npc.role}</span>
            </div>
            <details class="mt-1">
                <summary style="cursor:pointer;color:var(--gold);font-size:0.85rem;">Description</summary>
                <div class="card-description mt-1" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;">${esc(npc.description)}</div>
            </details>
            ${Object.keys(npc.stats).length ? `
                <details class="mt-1">
                    <summary style="cursor:pointer;color:var(--gold);font-size:0.85rem;">Stat Block</summary>
                    <div class="stat-block-display mt-1">
                        ${Object.entries(npc.stats).map(([k, v]) => `<div class="stat-line"><strong>${esc(k)}:</strong> ${esc(String(v))}</div>`).join('')}
                    </div>
                </details>
            ` : ''}
            ${npc.notes ? `
                <details class="mt-1">
                    <summary style="cursor:pointer;color:var(--gold);font-size:0.85rem;">Notes</summary>
                    <div class="mt-1 text-sm text-dim" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;">${esc(npc.notes)}</div>
                </details>
            ` : ''}
            <div class="card-actions">
                <button class="btn btn-sm" onclick="editNPC('${npc.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteNPC('${npc.id}')">🗑️</button>
                <button class="btn btn-sm" onclick="enhanceNPC('${npc.id}')" title="Enhance with AI">✨</button>
                <button class="btn btn-sm" onclick="generateNPCImage('${npc.id}')" title="Generate Image">🖼️</button>
            </div>
        </div>
    `).join('');
}

// ---------------------------------------------------------------------------
// Locations rendering
// ---------------------------------------------------------------------------
function renderLocations() {
    const c = state.currentCampaign;
    const grid = document.getElementById('locations-grid');
    const empty = document.getElementById('empty-locations');

    if (!c.locations.length) {
        grid.innerHTML = '';
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = c.locations.map(loc => `
        <div class="card">
            ${loc.image_path ? `<img src="${loc.image_path}" style="width:100%; max-height:200px; object-fit:cover; border-radius:4px; margin-bottom:0.5rem;">` : ''}
            <div class="card-title">${esc(loc.name)}</div>
            <details class="mt-1">
                <summary style="cursor:pointer;color:var(--gold);font-size:0.85rem;">Description</summary>
                <div class="card-description mt-1" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;">${esc(loc.description)}</div>
            </details>
            ${loc.points_of_interest.length ? `
                <div class="mt-1 text-sm">
                    <strong class="text-gold">Points of Interest:</strong>
                    ${loc.points_of_interest.map(p => esc(p)).join(' • ')}
                </div>
            ` : ''}
            ${loc.hooks && loc.hooks.length ? `
                <div class="mt-1 text-sm">
                    <strong class="text-gold">Adventure Hooks:</strong>
                    <ul style="margin: 0.2rem 0 0 1.2rem; padding: 0;">
                        ${loc.hooks.map(h => `<li>${esc(h)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            <div class="card-actions">
                <button class="btn btn-sm" onclick="editLocation('${loc.id}')">✏️ Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteLocation('${loc.id}')">🗑️</button>
                <button class="btn btn-sm" onclick="enhanceLocation('${loc.id}')" title="Enhance with AI">✨</button>
                <button class="btn btn-sm" onclick="generateLocationImage('${loc.id}')" title="Generate Image">🖼️</button>
            </div>
        </div>
    `).join('');
}

// ---------------------------------------------------------------------------
// Plot threads rendering
// ---------------------------------------------------------------------------
function renderPlotThreads() {
    const c = state.currentCampaign;
    const list = document.getElementById('plots-list');
    const empty = document.getElementById('empty-plots');

    if (!c.plot_threads.length) {
        list.innerHTML = '';
        empty.style.display = '';
        return;
    }

    const npcMap = Object.fromEntries((c.npcs || []).map(n => [n.id, n.name]));
    const locMap = Object.fromEntries((c.locations || []).map(l => [l.id, l.name]));

    empty.style.display = 'none';
    list.innerHTML = c.plot_threads.map(pt => {
        const relatedNPCs = (pt.related_npcs || []).map(id => npcMap[id] || 'Unknown').join(', ');
        const relatedLocs = (pt.related_locations || []).map(id => locMap[id] || 'Unknown').join(', ');
        
        return `
            <div class="card mb-1">
                <div class="flex justify-between items-center">
                    <div class="card-title">${esc(pt.title)}</div>
                    <span class="badge badge-${pt.status}">${pt.status}</span>
                </div>
                <details class="mt-1">
                    <summary style="cursor:pointer;color:var(--gold);font-size:0.85rem;">Description</summary>
                    <div class="card-description mt-1" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;">${esc(pt.description)}</div>
                </details>
                ${relatedNPCs ? `<div class="mt-1 text-sm text-dim"><strong>NPCs:</strong> ${esc(relatedNPCs)}</div>` : ''}
                ${relatedLocs ? `<div class="mt-1 text-sm text-dim"><strong>Locations:</strong> ${esc(relatedLocs)}</div>` : ''}
                ${pt.notes ? `
                    <details class="mt-1">
                        <summary style="cursor:pointer;color:var(--gold);font-size:0.85rem;">Notes</summary>
                        <div class="mt-1 text-sm text-dim" style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;">${esc(pt.notes)}</div>
                    </details>
                ` : ''}
                <div class="card-actions">
                    <button class="btn btn-sm" onclick="editPlotThread('${pt.id}')">✏️ Edit</button>
                    <select class="form-select" style="width:auto;padding:0.3rem 0.6rem;font-size:0.78rem;" onchange="updatePlotStatus('${pt.id}', this.value)">
                        <option value="active" ${pt.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="dormant" ${pt.status === 'dormant' ? 'selected' : ''}>Dormant</option>
                        <option value="resolved" ${pt.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                    </select>
                    <button class="btn btn-sm btn-danger" onclick="deletePlotThread('${pt.id}')">🗑️</button>
                    <button class="btn btn-sm" onclick="enhancePlotThread('${pt.id}')" title="Enhance with AI">✨</button>
                </div>
            </div>
        `;
    }).join('');
}

// ---------------------------------------------------------------------------
// Rulesets rendering
// ---------------------------------------------------------------------------
function renderRulesets() {
    const c = state.currentCampaign;
    const list = document.getElementById('rulesets-list');
    const empty = document.getElementById('empty-rulesets');

    if (!c.rulesets.length) {
        list.innerHTML = '';
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    list.innerHTML = c.rulesets.map(r => `
        <div class="ruleset-item">
            <div class="file-icon">📄</div>
            <div class="file-info">
                <div class="file-name">${esc(r.display_name)}</div>
                <div class="file-date">${esc(r.file_name)} • Uploaded ${new Date(r.uploaded_at).toLocaleDateString()}</div>
            </div>
        </div>
    `).join('');
}

// ---------------------------------------------------------------------------
// Modules rendering
// ---------------------------------------------------------------------------
async function renderModules() {
    const list = document.getElementById('modules-list');
    const empty = document.getElementById('empty-modules');

    try {
        const modules = await api('/modules');
        if (!modules.length) {
            list.innerHTML = '';
            empty.style.display = '';
            return;
        }
        empty.style.display = 'none';
        list.innerHTML = modules.map(m => `
            <div class="ruleset-item">
                <div class="file-icon">📕</div>
                <div class="file-info">
                    <div class="file-name">${esc(m.filename)}</div>
                    <div class="file-date">${(m.size / 1024).toFixed(1)} KB</div>
                </div>
                <a class="btn btn-sm" href="/api/modules/${encodeURIComponent(m.filename)}/download" target="_blank">⬇ Download</a>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '';
        empty.style.display = '';
    }
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

// -- Campaign --
function showNewCampaignModal() {
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
        await loadDashboard();
    }, 'Create Campaign');
}

function showEditCampaignModal() {
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
        await loadDashboard();
    });
}

async function deleteCampaign() {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    const c = state.currentCampaign;
    await api(`/campaigns/${c.id}`, { method: 'DELETE' });
    toast('Campaign deleted', 'success');
    showDashboard();
}

// -- Sessions --
function showAddSessionModal() {
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

function editSession(sessionId) {
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

async function deleteSession(sessionId) {
    if (!confirm('Delete this session?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/sessions/${sessionId}`, { method: 'DELETE' });
    toast('Session deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// -- NPCs --
function showAddNPCModal() {
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

function editNPC(npcId) {
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

async function deleteNPC(npcId) {
    if (!confirm('Delete this NPC?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/npcs/${npcId}`, { method: 'DELETE' });
    toast('NPC deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// -- Locations --
function showAddLocationModal() {
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

function editLocation(locationId) {
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

async function deleteLocation(locationId) {
    if (!confirm('Delete this location?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/locations/${locationId}`, { method: 'DELETE' });
    toast('Location deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// -- Plot Threads --
function showAddPlotModal() {
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

function editPlotThread(threadId) {
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

async function updatePlotStatus(threadId, status) {
    await api(`/campaigns/${state.currentCampaign.id}/plot-threads/${threadId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
    toast('Status updated', 'success');
    await openCampaign(state.currentCampaign.id);
}

async function deletePlotThread(threadId) {
    if (!confirm('Delete this plot thread?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/plot-threads/${threadId}`, { method: 'DELETE' });
    toast('Plot thread deleted', 'success');
    await openCampaign(state.currentCampaign.id);
}

// -- Adversaries --
function renderAdversaries() {
    const grid = document.getElementById('adversaries-grid');
    const empty = document.getElementById('empty-adversaries');
    const adversaries = state.currentCampaign.adversaries || [];

    grid.innerHTML = '';
    if (adversaries.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    adversaries.forEach(adv => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            ${adv.image_path ? `<div class="card-image"><img src="${adv.image_path}" alt="${esc(adv.name)}"></div>` : ''}
            <div class="card-title">${esc(adv.name)}</div>
            <div class="card-meta">
                <span class="tag">${esc(adv.adventure_type)}</span>
                <span class="tag">${esc(adv.adversary_type.replace('_', ' '))}</span>
            </div>
            <div class="card-description">${esc(adv.description.substring(0, 120))}${adv.description.length > 120 ? '...' : ''}</div>
            <div class="card-actions">
                <button class="btn btn-sm btn-primary" onclick="openAdversaryDetail('${adv.id}')">👁️ View Plan</button>
                <button class="btn btn-sm btn-icon-only" onclick="editAdversary('${adv.id}')">✏️</button>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="deleteAdversary('${adv.id}')">🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function openAdversaryDetail(advId) {
    const adv = state.currentCampaign.adversaries.find(a => a.id === advId);
    if (!adv) return;

    state.currentAdversaryId = advId;
    
    document.getElementById('adv-detail-name').textContent = adv.name;
    document.getElementById('adv-detail-tags').innerHTML = `
        <span class="badge badge-active">${esc(adv.adventure_type)}</span>
        <span class="badge badge-planned">${esc(adv.adversary_type.replace('_', ' '))}</span>
    `;
    
    const imgContainer = document.getElementById('adv-detail-image-container');
    imgContainer.innerHTML = adv.image_path ? `<img src="${adv.image_path}" alt="${esc(adv.name)}">` : '<span>No Illustration</span>';
    
    document.getElementById('adv-detail-description').textContent = adv.description;
    document.getElementById('adv-detail-notes').textContent = adv.notes || 'No GM notes yet.';
    
    const stepsContainer = document.getElementById('adv-detail-steps');
    stepsContainer.innerHTML = (adv.steps || []).map((step, index) => `
        <div class="step-item">
            <div class="step-num">${index + 1}</div>
            <div class="step-content">${esc(step)}</div>
        </div>
    `).join('');

    document.getElementById('adversary-detail-view').style.display = 'flex';
}

function closeAdversaryDetail() {
    document.getElementById('adversary-detail-view').style.display = 'none';
    state.currentAdversaryId = null;
}

function showAddAdversaryModal() {
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
        
        const steps = overlay.querySelector('#add-adv-steps').value.split('\n').filter(s => s.trim());
        
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

function editAdversary(advId) {
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
            <textarea class="form-textarea" id="edit-adv-steps" style="height:100px">${esc((adv.steps || []).join('\n'))}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">GM Notes</label>
            <textarea class="form-textarea" id="edit-adv-notes">${esc(adv.notes)}</textarea>
        </div>
    `, async (overlay) => {
        const steps = overlay.querySelector('#edit-adv-steps').value.split('\n').filter(s => s.trim());
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

async function deleteAdversary(advId) {
    if (!confirm('Delete this adversary?')) return;
    await api(`/campaigns/${state.currentCampaign.id}/adversaries/${advId}`, { method: 'DELETE' });
    toast('Adversary deleted', 'success');
    closeAdversaryDetail();
    await openCampaign(state.currentCampaign.id);
}

// ---------------------------------------------------------------------------
// Ruleset upload
// ---------------------------------------------------------------------------
function setupRulesetUpload() {
    const area = document.getElementById('ruleset-upload-area');
    const input = document.getElementById('ruleset-file-input');

    area.addEventListener('click', () => input.click());

    area.addEventListener('dragover', (e) => {
        e.preventDefault();
        area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
        area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
        e.preventDefault();
        area.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            uploadRuleset(e.dataTransfer.files[0]);
        }
    });

    input.addEventListener('change', () => {
        if (input.files.length) {
            uploadRuleset(input.files[0]);
            input.value = '';
        }
    });
}

async function uploadRuleset(file) {
    if (!file.name.endsWith('.pdf')) {
        toast('Please upload a PDF file', 'error');
        return;
    }

    showLoading('Uploading & indexing ruleset...\nThis may take a minute.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('display_name', file.name.replace('.pdf', ''));

    try {
        await api(`/campaigns/${state.currentCampaign.id}/rulesets`, {
            method: 'POST',
            body: formData,
        });
        toast('Ruleset uploaded and indexed!', 'success');
        await openCampaign(state.currentCampaign.id);
    } catch (e) {
        // Toast already shown by api()
    }

    hideLoading();
}

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------
async function generateContent() {
    const type = document.getElementById('gen-type').value;
    const prompt = document.getElementById('gen-prompt').value.trim();
    const context = document.getElementById('gen-context').value.trim();

    if (!prompt) {
        toast('Please enter a prompt', 'error');
        return;
    }

    showLoading('Generating content...');

    try {
        let body = { prompt, context };
        if (type === 'session') {
            const getSelected = (id) => {
                const el = document.getElementById(id);
                return el ? Array.from(el.selectedOptions).map(o => o.value) : [];
            };
            body.selected_npc_ids = getSelected('gen-session-npcs');
            body.selected_location_ids = getSelected('gen-session-locs');
            body.selected_plot_thread_ids = getSelected('gen-session-plots');
        }
        let result;

        switch (type) {
            case 'session':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/session`, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                break;
            case 'npc':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/npc`, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                break;
            case 'encounter':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/encounter`, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                break;
            case 'location':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/location`, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                break;
            case 'adversary':
                const getSelected = (id) => {
                    const el = document.getElementById(id);
                    return el ? Array.from(el.selectedOptions).map(o => o.value) : [];
                };
                body.adventure_type = document.getElementById('gen-adv-adventure-type').value;
                body.adversary_type = document.getElementById('gen-adv-type').value;
                body.selected_npc_ids = getSelected('gen-adv-npcs');
                body.selected_location_ids = getSelected('gen-adv-locs');
                body.selected_plot_thread_ids = getSelected('gen-adv-plots');
                
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/adversary`, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                break;
            case 'ask-rules':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/ask-rules`, {
                    method: 'POST',
                    body: JSON.stringify(body),
                });
                break;
        }

        state.lastGeneratedResult = result;
        state.lastGeneratedType = type;
        displayGeneratedResult(result, type);
        toast('Content generated!', 'success');
    } catch (e) {
        // Toast already shown
    }

    hideLoading();
}

function displayGeneratedResult(result, type) {
    const card = document.getElementById('gen-result-card');
    const display = document.getElementById('gen-result');
    card.style.display = '';

    let html = '';

    switch (type) {
        case 'session':
            html = `
                <h3>${esc(result.title)}</h3>
                <p><em>${esc(result.summary)}</em></p>
                <div class="mt-1">${formatContent(result.plan)}</div>
                ${result.key_events?.length ? `<p class="mt-1"><strong>Key Events:</strong> ${result.key_events.map(e => esc(e)).join(' • ')}</p>` : ''}
                ${result.npcs_involved?.length ? `<p><strong>NPCs:</strong> ${result.npcs_involved.map(n => esc(n)).join(', ')}</p>` : ''}
                ${result.locations_visited?.length ? `<p><strong>Locations:</strong> ${result.locations_visited.map(l => esc(l)).join(', ')}</p>` : ''}
            `;
            break;
        case 'npc':
            html = `
                <h3>${esc(result.name)}</h3>
                <span class="badge badge-active">${esc(result.role)}</span>
                <div class="mt-1">${formatContent(result.description)}</div>
                ${Object.keys(result.stats || {}).length ? `
                    <div class="stat-block-display mt-1">
                        <div class="stat-name">${esc(result.name)}</div>
                        ${Object.entries(result.stats).map(([k, v]) =>
                            `<div class="stat-line"><strong>${esc(k)}:</strong> ${esc(String(v))}</div>`
                        ).join('')}
                    </div>
                ` : ''}
                ${result.notes ? `<div class="mt-1"><strong>GM Notes:</strong> ${formatContent(result.notes)}</div>` : ''}
            `;
            break;
        case 'encounter':
            html = `
                <h3>${esc(result.title)}</h3>
                <span class="badge badge-planned">${esc(result.difficulty)}</span>
                <div class="mt-1">${formatContent(result.description)}</div>
                ${result.enemies?.length ? `
                    <h4 class="mt-1">Enemies</h4>
                    ${result.enemies.map(e => `
                        <div class="stat-block-display mt-1">
                            <div class="stat-name">${esc(e.name || 'Enemy')}</div>
                            ${Object.entries(e).filter(([k]) => k !== 'name').map(([k, v]) =>
                                `<div class="stat-line"><strong>${esc(k)}:</strong> ${esc(String(v))}</div>`
                            ).join('')}
                        </div>
                    `).join('')}
                ` : ''}
                <div class="mt-1"><strong>Tactics:</strong> ${formatContent(result.tactics)}</div>
                <div class="mt-1"><strong>Treasure:</strong> ${formatContent(result.treasure)}</div>
            `;
            break;
        case 'location':
            html = `
                <h3>${esc(result.name)}</h3>
                <div class="mt-1">${formatContent(result.description)}</div>
                ${result.points_of_interest?.length ? `
                    <h4 class="mt-1">Points of Interest</h4>
                    <ul>${result.points_of_interest.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
                ` : ''}
                ${result.hooks?.length ? `
                    <h4 class="mt-1">Adventure Hooks</h4>
                    <ul>${result.hooks.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
                ` : ''}
            `;
            break;
        case 'adversary':
            html = `
                <h3>${esc(result.name)}</h3>
                <div class="mt-1">${formatContent(result.description)}</div>
                <h4 class="mt-1">Master Plan</h4>
                <div class="plan-steps mt-1">
                    ${(result.steps || []).map((s, i) => `
                        <div class="step-item">
                            <div class="step-num">${i + 1}</div>
                            <div class="step-content">${esc(s)}</div>
                        </div>
                    `).join('')}
                </div>
                ${result.notes ? `<div class="mt-1"><strong>GM Notes:</strong> ${formatContent(result.notes)}</div>` : ''}
            `;
            break;
        case 'ask-rules':
            html = `
                <div class="rule-${result.confidence === 'verified' ? 'verified' : 'unverified'} mb-1">
                    ${result.confidence === 'verified' ? '✅ Verified from rulesets' : '⚠️ Not fully verified'}
                </div>
                <div>${formatContent(result.answer)}</div>
                ${result.sources?.length ? `
                    <div class="mt-1">
                        <strong>Sources:</strong>
                        ${result.sources.map(s => `<div class="rule-citation">${esc(s)}</div>`).join('')}
                    </div>
                ` : ''}
            `;
            break;
    }

    display.innerHTML = html;
}

async function saveGeneratedContent() {
    const result = state.lastGeneratedResult;
    const type = state.lastGeneratedType;
    if (!result || !type) return;

    const c = state.currentCampaign;

    try {
        switch (type) {
            case 'session':
                await api(`/campaigns/${c.id}/sessions`, {
                    method: 'POST',
                    body: JSON.stringify({
                        number: c.sessions.length + 1,
                        title: result.title,
                        summary: result.summary,
                        plan: result.plan,
                        npcs_involved: result.npcs_involved || [],
                        locations_visited: result.locations_visited || [],
                        plot_developments: result.plot_developments || [],
                        key_events: result.key_events || [],
                        status: 'planned',
                    }),
                });
                toast('Session saved to campaign!', 'success');
                break;
            case 'npc':
                await api(`/campaigns/${c.id}/npcs`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: result.name,
                        description: result.description,
                        role: result.role || 'neutral',
                        stats: result.stats || {},
                        notes: result.notes || '',
                    }),
                });
                toast('NPC saved to campaign!', 'success');
                break;
            case 'location':
                await api(`/campaigns/${c.id}/locations`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: result.name,
                        description: result.description,
                        points_of_interest: result.points_of_interest || [],
                        notes: result.notes || '',
                    }),
                });
                toast('Location saved to campaign!', 'success');
                break;
            case 'adversary':
                const advResult = await api(`/campaigns/${c.id}/adversaries`, {
                    method: 'POST',
                    body: JSON.stringify({
                        name: result.name,
                        description: result.description,
                        adventure_type: document.getElementById('gen-adv-adventure-type').value,
                        adversary_type: document.getElementById('gen-adv-type').value,
                        steps: result.steps || [],
                        notes: result.notes || '',
                    }),
                });
                toast('Adversary saved to campaign!', 'success');
                // Trigger image generation if it's a new adversary and was just generated
                if (confirm('Would you like to generate an illustration for this adversary now?')) {
                    await generateAdversaryImage(advResult.adversary_id);
                }
                break;
            default:
                toast('This content type cannot be auto-saved', 'info');
                return;
        }
        await openCampaign(c.id);
    } catch (e) {
        // toast already shown
    }
}

// ---------------------------------------------------------------------------
// Module generation
// ---------------------------------------------------------------------------
async function generateModule() {
    const title = document.getElementById('module-title').value.trim();
    const prompt = document.getElementById('module-prompt').value.trim();
    const illustrations = document.getElementById('module-illustrations').checked;

    if (!prompt) {
        toast('Please enter a description', 'error');
        return;
    }

    showLoading('Generating adventure module...\nThis may take several minutes.');

    try {
        await api(`/campaigns/${state.currentCampaign.id}/modules/generate`, {
            method: 'POST',
            body: JSON.stringify({
                title: title || null,
                prompt,
                include_illustrations: illustrations,
            }),
        });
        toast('Module generated!', 'success');
        await renderModules();
    } catch (e) {
        // handled
    }

    hideLoading();
}

// ---------------------------------------------------------------------------
// Generate from specific tabs (shortcut buttons)
// ---------------------------------------------------------------------------
function generateSessionFromTab() {
    switchTab('generate');
    document.getElementById('gen-type').value = 'session';
    document.getElementById('gen-prompt').focus();
}

function generateNPCFromTab() {
    switchTab('generate');
    document.getElementById('gen-type').value = 'npc';
    document.getElementById('gen-prompt').focus();
}

function generateLocationFromTab() {
    switchTab('generate');
    document.getElementById('gen-type').value = 'location';
    document.getElementById('gen-prompt').focus();
}

function generateAdversaryFromTab() {
    switchTab('generate');
    document.getElementById('gen-type').value = 'adversary';
    // Trigger the change event to show fields
    document.getElementById('gen-type').dispatchEvent(new Event('change'));
    document.getElementById('gen-prompt').focus();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatContent(text) {
    if (!text) return '';
    // Simple markdown-like formatting
    return esc(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        .replace(/\n{2,}/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------
function bindEvents() {
    // Navigation
    document.getElementById('nav-dashboard').addEventListener('click', showDashboard);
    document.getElementById('nav-settings').addEventListener('click', showSettings);
    document.getElementById('btn-new-campaign').addEventListener('click', showNewCampaignModal);
    document.getElementById('btn-new-campaign-main').addEventListener('click', showNewCampaignModal);
    document.getElementById('btn-new-campaign-empty').addEventListener('click', showNewCampaignModal);

    // Campaign view
    document.getElementById('btn-edit-campaign').addEventListener('click', showEditCampaignModal);
    document.getElementById('btn-delete-campaign').addEventListener('click', deleteCampaign);

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Session buttons
    document.getElementById('btn-generate-session').addEventListener('click', generateSessionFromTab);
    document.getElementById('btn-add-session').addEventListener('click', showAddSessionModal);

    // NPC buttons
    document.getElementById('btn-generate-npc').addEventListener('click', generateNPCFromTab);
    document.getElementById('btn-add-npc').addEventListener('click', showAddNPCModal);

    // Location buttons
    document.getElementById('btn-generate-location').addEventListener('click', generateLocationFromTab);
    document.getElementById('btn-add-location').addEventListener('click', showAddLocationModal);

    // Adversary buttons
    document.getElementById('btn-generate-adversary').addEventListener('click', generateAdversaryFromTab);
    document.getElementById('btn-add-adversary').addEventListener('click', showAddAdversaryModal);
    document.getElementById('btn-close-adversary-detail').addEventListener('click', closeAdversaryDetail);
    document.getElementById('btn-detail-edit').addEventListener('click', () => editAdversary(state.currentAdversaryId));
    document.getElementById('btn-detail-gen-image').addEventListener('click', () => generateAdversaryImage(state.currentAdversaryId));

    // Plot thread buttons
    document.getElementById('btn-add-plot').addEventListener('click', showAddPlotModal);

    // Generation
    document.getElementById('btn-generate').addEventListener('click', generateContent);
    document.getElementById('btn-save-generated').addEventListener('click', saveGeneratedContent);

    // Module generation
    document.getElementById('btn-generate-module').addEventListener('click', generateModule);

    // Settings
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

    // Ruleset upload
    setupRulesetUpload();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadDashboard();
});
// -- AI Enhancements and Generation --
async function enhanceNPC(npcId) {
    if(!confirm('This will use AI to expand this NPC. Continue?')) return;
    showLoading('Enhancing NPC...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/npcs/${npcId}/enhance`, {method: 'POST'});
        toast('NPC Enhanced!', 'success');
        await openCampaign(state.currentCampaign.id);
    } catch(e) {} finally {
        hideLoading();
    }
}

async function enhanceLocation(locationId) {
    if(!confirm('This will use AI to expand this Location. Continue?')) return;
    showLoading('Enhancing Location...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/locations/${locationId}/enhance`, {method: 'POST'});
        toast('Location Enhanced!', 'success');
        await openCampaign(state.currentCampaign.id);
    } catch(e) {} finally {
        hideLoading();
    }
}

async function enhancePlotThread(threadId) {
    if(!confirm('This will use AI to expand this Plot Thread. Continue?')) return;
    showLoading('Enhancing Plot Thread...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/plot-threads/${threadId}/enhance`, {method: 'POST'});
        toast('Plot Thread Enhanced!', 'success');
        await openCampaign(state.currentCampaign.id);
    } catch(e) {} finally {
        hideLoading();
    }
}

async function generateNPCImage(npcId) {
    showLoading('Generating Image with Art Director...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/npcs/${npcId}/generate-image`, {method: 'POST'});
        toast('Image Generated!', 'success');
        await openCampaign(state.currentCampaign.id);
    } catch(e) {} finally {
        hideLoading();
    }
}

async function generateLocationImage(locationId) {
    showLoading('Generating Image with Art Director...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/locations/${locationId}/generate-image`, {method: 'POST'});
        toast('Image Generated!', 'success');
        await openCampaign(state.currentCampaign.id);
    } catch(e) {} finally {
        hideLoading();
    }
}

document.getElementById('gen-type').addEventListener('change', (e) => {
    const type = e.target.value;
    const extra = document.getElementById('gen-extra-fields');
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
});

import { state } from '../state.js';
import { api } from '../api.js';
import { showLoading, hideLoading, toast, esc, formatContent, el, showModal, showEnhanceModal } from '../utils.js';
import { renderSidebar } from '../components/Sidebar.js';

export async function openCampaign(id) {
    showLoading('Loading campaign...');
    try {
        const campaign = await api(`/campaigns/${id}`);
        state.currentCampaign = campaign;

        ['view-dashboard', 'view-campaign', 'view-settings'].forEach(vid => {
            const el = document.getElementById(vid);
            if (el) el.style.display = (vid === 'view-campaign') ? '' : 'none';
        });

        renderCampaignView();
        renderSidebar();

        document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    } catch (e) {
        console.error(e);
    }
    hideLoading();
}

export function renderCampaignView() {
    const campaign = state.currentCampaign;
    if (!campaign) return;

    document.getElementById('campaign-title').textContent = campaign.name;
    document.getElementById('campaign-breadcrumb-name').textContent = campaign.name;

    const systemEl = document.getElementById('overview-system');
    if (systemEl) {
        systemEl.textContent = campaign.game_system || 'Unknown System';
        systemEl.style.display = campaign.game_system ? '' : 'none';
    }
    
    document.getElementById('overview-setting').innerHTML = formatContent(campaign.setting || 'No setting described yet.');
    document.getElementById('overview-notes').innerHTML = formatContent(campaign.notes || 'No campaign notes yet.');

    ['sessions', 'npcs', 'locations'].forEach(k => {
        document.getElementById(`tab-count-${k}`).textContent = campaign[k].length;
        document.getElementById(`overview-${k}`).textContent = campaign[k].length;
    });
    
    document.getElementById('tab-count-plots').textContent = campaign.plot_threads.length;
    document.getElementById('overview-plots').textContent = campaign.plot_threads.length;
    
    const adversariesLength = (campaign.adversaries || []).length;
    document.getElementById('tab-count-adversaries').textContent = adversariesLength;
    document.getElementById('overview-adversaries').textContent = adversariesLength;

    document.getElementById('tab-count-rulesets').textContent = campaign.rulesets.length;
    document.getElementById('overview-rulesets').textContent = campaign.rulesets.length;

    renderSessions();
    renderNPCs();
    renderLocations();
    renderPlotThreads();
    renderAdversaries();
    renderRulesets();
    renderModules();
}

export function switchTab(tabName) {
    state.currentTab = tabName;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `panel-${tabName}`);
    });
}

// ============== RENDERERS ==============

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
    list.innerHTML = '';

    c.sessions.forEach(s => {
        list.appendChild(el('div', { className: 'card mb-1' },
            el('div', { className: 'flex justify-between items-center' },
                el('div', { className: 'card-title', textContent: `Session ${s.number}: ${s.title || 'Untitled'}` }),
                el('span', { className: `badge badge-${s.status}`, textContent: s.status })
            ),
            s.summary ? el('div', { className: 'card-description mt-1', textContent: s.summary }) : null,
            s.plan ? el('details', { className: 'mt-1' },
                el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:0.85rem;', textContent: 'View Plan' }),
                el('div', { className: 'content-display mt-1', style: 'max-height:400px;overflow-y:auto;', innerHTML: formatContent(s.plan) })
            ) : null,
            s.key_events.length ? el('div', { className: 'mt-1 text-sm text-dim', textContent: `Key Events: ${s.key_events.join(' • ')}` }) : null,
            el('div', { className: 'card-actions' },
                el('button', { className: 'btn btn-sm', dataset: { action: 'edit-session', id: s.id }, textContent: '✏️ Edit' }),
                el('button', { className: 'btn btn-sm btn-danger', dataset: { action: 'delete-session', id: s.id }, textContent: '🗑️' }),
                el('button', { className: 'btn btn-sm', dataset: { action: 'enhance-session', id: s.id }, title: 'Enhance with AI', textContent: '✨' })
            )
        ));
    });
}

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
    grid.innerHTML = '';

    c.npcs.forEach(npc => {
        const statsArray = Object.entries(npc.stats);
        grid.appendChild(el('div', { className: 'card' },
            npc.image_path ? el('img', { src: npc.image_path, style: 'width:100%; max-height:200px; object-fit:cover; border-radius:4px; margin-bottom:0.5rem;' }) : null,
            el('div', { className: 'card-title', textContent: npc.name }),
            el('div', { className: 'card-meta' }, el('span', { className: 'badge badge-active', textContent: npc.role })),
            el('details', { className: 'mt-1' },
                el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:0.85rem;', textContent: 'Description' }),
                el('div', { className: 'card-description mt-1', style: 'max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;', textContent: npc.description })
            ),
            statsArray.length ? el('details', { className: 'mt-1' },
                el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:0.85rem;', textContent: 'Stat Block' }),
                el('div', { className: 'stat-block-display mt-1' },
                    statsArray.map(([k, v]) => el('div', { className: 'stat-line' }, el('strong', { textContent: k + ': ' }), v))
                )
            ) : null,
            npc.notes ? el('details', { className: 'mt-1' },
                el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:0.85rem;', textContent: 'Notes' }),
                el('div', { className: 'mt-1 text-sm text-dim', style: 'max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;', textContent: npc.notes })
            ) : null,
            el('div', { className: 'card-actions' },
                el('button', { className: 'btn btn-sm', dataset: { action: 'edit-npc', id: npc.id }, textContent: '✏️ Edit' }),
                el('button', { className: 'btn btn-sm btn-danger', dataset: { action: 'delete-npc', id: npc.id }, textContent: '🗑️' }),
                el('button', { className: 'btn btn-sm', dataset: { action: 'enhance-npc', id: npc.id }, title: 'Enhance with AI', textContent: '✨' }),
                el('button', { className: 'btn btn-sm', dataset: { action: 'regen-npc-image', id: npc.id }, title: 'Generate Image', textContent: '🖼️' })
            )
        ));
    });
}

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
    grid.innerHTML = '';

    c.locations.forEach(loc => {
        grid.appendChild(el('div', { className: 'card' },
            loc.image_path ? el('img', { src: loc.image_path, style: 'width:100%; max-height:200px; object-fit:cover; border-radius:4px; margin-bottom:0.5rem;' }) : null,
            el('div', { className: 'card-title', textContent: loc.name }),
            el('details', { className: 'mt-1' },
                el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:0.85rem;', textContent: 'Description' }),
                el('div', { className: 'card-description mt-1', style: 'max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;', textContent: loc.description })
            ),
            loc.points_of_interest.length ? el('div', { className: 'mt-1 text-sm' },
                el('strong', { className: 'text-gold', textContent: 'Points of Interest: ' }),
                loc.points_of_interest.join(' • ')
            ) : null,
            loc.hooks && loc.hooks.length ? el('div', { className: 'mt-1 text-sm' },
                el('strong', { className: 'text-gold', textContent: 'Adventure Hooks:' }),
                el('ul', { style: 'margin: 0.2rem 0 0 1.2rem; padding: 0;' },
                    loc.hooks.map(h => el('li', { textContent: h }))
                )
            ) : null,
            el('div', { className: 'card-actions' },
                el('button', { className: 'btn btn-sm', dataset: { action: 'edit-location', id: loc.id }, textContent: '✏️ Edit' }),
                el('button', { className: 'btn btn-sm btn-danger', dataset: { action: 'delete-location', id: loc.id }, textContent: '🗑️' }),
                el('button', { className: 'btn btn-sm', dataset: { action: 'enhance-location', id: loc.id }, title: 'Enhance with AI', textContent: '✨' }),
                el('button', { className: 'btn btn-sm', dataset: { action: 'regen-location-image', id: loc.id }, title: 'Generate Image', textContent: '🖼️' })
            )
        ));
    });
}

function renderPlotThreads() {
    const c = state.currentCampaign;
    const list = document.getElementById('plots-list');
    const empty = document.getElementById('empty-plots');

    if (!c.plot_threads.length) {
        list.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';
    list.innerHTML = '';

    const npcMap = Object.fromEntries((c.npcs || []).map(n => [n.id, n.name]));
    const locMap = Object.fromEntries((c.locations || []).map(l => [l.id, l.name]));

    c.plot_threads.forEach(pt => {
        const relatedNPCs = (pt.related_npcs || []).map(id => npcMap[id] || 'Unknown').join(', ');
        const relatedLocs = (pt.related_locations || []).map(id => locMap[id] || 'Unknown').join(', ');

        const statusSelect = el('select', { 
            className: 'form-select', 
            style: 'width:auto;padding:0.3rem 0.6rem;font-size:0.78rem;',
            dataset: { action: 'update-plot-status', id: pt.id }
        },
            el('option', { value: 'active', selected: pt.status === 'active', textContent: 'Active' }),
            el('option', { value: 'dormant', selected: pt.status === 'dormant', textContent: 'Dormant' }),
            el('option', { value: 'resolved', selected: pt.status === 'resolved', textContent: 'Resolved' })
        );

        list.appendChild(el('div', { className: 'card mb-1' },
            el('div', { className: 'flex justify-between items-center' },
                el('div', { className: 'card-title', textContent: pt.title }),
                el('span', { className: `badge badge-${pt.status}`, textContent: pt.status })
            ),
            el('details', { className: 'mt-1' },
                el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:0.85rem;', textContent: 'Description' }),
                el('div', { className: 'card-description mt-1', style: 'max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;', textContent: pt.description })
            ),
            relatedNPCs ? el('div', { className: 'mt-1 text-sm text-dim' }, el('strong', { textContent: 'NPCs: ' }), relatedNPCs) : null,
            relatedLocs ? el('div', { className: 'mt-1 text-sm text-dim' }, el('strong', { textContent: 'Locations: ' }), relatedLocs) : null,
            pt.notes ? el('details', { className: 'mt-1' },
                el('summary', { style: 'cursor:pointer;color:var(--gold);font-size:0.85rem;', textContent: 'Notes' }),
                el('div', { className: 'mt-1 text-sm text-dim', style: 'max-height: 200px; overflow-y: auto; white-space: pre-wrap; padding-right: 5px;', textContent: pt.notes })
            ) : null,
            el('div', { className: 'card-actions' },
                el('button', { className: 'btn btn-sm', dataset: { action: 'edit-plot', id: pt.id }, textContent: '✏️ Edit' }),
                statusSelect,
                el('button', { className: 'btn btn-sm btn-danger', dataset: { action: 'delete-plot', id: pt.id }, textContent: '🗑️' }),
                el('button', { className: 'btn btn-sm', dataset: { action: 'enhance-plot', id: pt.id }, title: 'Enhance with AI', textContent: '✨' })
            )
        ));
    });
}

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
        grid.appendChild(el('div', { className: 'card' },
            adv.image_path ? el('div', { className: 'card-image' }, el('img', { src: adv.image_path, alt: adv.name })) : null,
            el('div', { className: 'card-title', textContent: adv.name }),
            el('div', { className: 'card-meta' },
                el('span', { className: 'tag', textContent: adv.adventure_type }),
                el('span', { className: 'tag', textContent: adv.adversary_type.replace('_', ' ') })
            ),
            el('div', { className: 'card-description', textContent: adv.description.substring(0, 120) + (adv.description.length > 120 ? '...' : '') }),
            el('div', { className: 'card-actions' },
                el('button', { className: 'btn btn-sm btn-primary', dataset: { action: 'view-adversary', id: adv.id }, textContent: '👁️ View Plan' }),
                el('button', { className: 'btn btn-sm btn-icon-only', dataset: { action: 'edit-adversary', id: adv.id }, textContent: '✏️' }),
                el('button', { className: 'btn btn-sm btn-danger btn-icon-only', dataset: { action: 'delete-adversary', id: adv.id }, textContent: '🗑️' })
            )
        ));
    });
}

export function openAdversaryDetail(advId) {
    const adv = state.currentCampaign.adversaries.find(a => a.id === advId);
    if (!adv) return;

    state.currentAdversaryId = advId;
    
    document.getElementById('adv-detail-name').textContent = adv.name;
    const tagsContainer = document.getElementById('adv-detail-tags');
    tagsContainer.innerHTML = '';
    tagsContainer.appendChild(el('span', { className: 'badge badge-active', textContent: adv.adventure_type }));
    tagsContainer.appendChild(el('span', { className: 'badge badge-planned', textContent: adv.adversary_type.replace('_', ' ') }));
    
    const imgContainer = document.getElementById('adv-detail-image-container');
    imgContainer.innerHTML = '';
    if (adv.image_path) {
        imgContainer.appendChild(el('img', { src: adv.image_path, alt: adv.name }));
    } else {
        imgContainer.appendChild(el('span', { textContent: 'No Illustration' }));
    }
    
    document.getElementById('adv-detail-description').textContent = adv.description;
    document.getElementById('adv-detail-notes').textContent = adv.notes || 'No GM notes yet.';
    
    const stepsContainer = document.getElementById('adv-detail-steps');
    stepsContainer.innerHTML = '';
    (adv.steps || []).forEach((step, index) => {
        stepsContainer.appendChild(el('div', { className: 'step-item' },
            el('div', { className: 'step-num', textContent: String(index + 1) }),
            el('div', { className: 'step-content', textContent: step })
        ));
    });

    document.getElementById('adversary-detail-view').style.display = 'flex';
}

export function closeAdversaryDetail() {
    const v = document.getElementById('adversary-detail-view');
    if (v) v.style.display = 'none';
    state.currentAdversaryId = null;
}

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
    list.innerHTML = '';

    c.rulesets.forEach(r => {
        list.appendChild(el('div', { className: 'ruleset-item' },
            el('div', { className: 'file-icon', textContent: '📄' }),
            el('div', { className: 'file-info' },
                el('div', { className: 'file-name', textContent: r.display_name }),
                el('div', { className: 'file-date', textContent: `${r.file_name} • Uploaded ${new Date(r.uploaded_at).toLocaleDateString()}` })
            )
        ));
    });
}

export async function renderModules() {
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
        list.innerHTML = '';
        
        modules.forEach(m => {
            list.appendChild(el('div', { className: 'ruleset-item' },
                el('div', { className: 'file-icon', textContent: '📕' }),
                el('div', { className: 'file-info' },
                    el('div', { className: 'file-name', textContent: m.filename }),
                    el('div', { className: 'file-date', textContent: `${(m.size / 1024).toFixed(1)} KB` })
                ),
                el('a', { className: 'btn btn-sm', href: `/api/modules/${encodeURIComponent(m.filename)}/download`, target: '_blank', textContent: '⬇ Download' })
            ));
        });
    } catch (e) {
        list.innerHTML = '';
        empty.style.display = '';
    }
}

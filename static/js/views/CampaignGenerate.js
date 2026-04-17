import { state } from '../state.js';
import { api } from '../api.js';
import { showLoading, hideLoading, toast, esc, formatContent, showEnhanceModal } from '../utils.js';
import { openCampaign, renderModules } from './Campaign.js';
import { openAdversaryDetail } from './Campaign.js';

export async function uploadRuleset(file) {
    if (!file.name.endsWith('.pdf')) {
        toast('Please upload a PDF file', 'error');
        return;
    }

    showLoading('Uploading & indexing ruleset...\\nThis may take a minute.');

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
        // Handled by api() wrapper
    }

    hideLoading();
}

export async function generateContent() {
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
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/session`, { method: 'POST', body: JSON.stringify(body) });
                break;
            case 'npc':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/npc`, { method: 'POST', body: JSON.stringify(body) });
                break;
            case 'encounter':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/encounter`, { method: 'POST', body: JSON.stringify(body) });
                break;
            case 'location':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/location`, { method: 'POST', body: JSON.stringify(body) });
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
                
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/adversary`, { method: 'POST', body: JSON.stringify(body) });
                break;
            case 'ask-rules':
                result = await api(`/campaigns/${state.currentCampaign.id}/generate/ask-rules`, { method: 'POST', body: JSON.stringify(body) });
                break;
        }

        state.lastGeneratedResult = result;
        state.lastGeneratedType = type;
        displayGeneratedResult(result, type);
        toast('Content generated!', 'success');
    } catch (e) {
        // toast already shown
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
            `;
            break;
        case 'npc':
            html = `
                <h3>${esc(result.name)}</h3>
                <span class="badge badge-active">${esc(result.role)}</span>
                <div class="mt-1">${formatContent(result.description)}</div>
            `;
            break;
        case 'encounter':
            html = `
                <h3>${esc(result.title)}</h3>
                <span class="badge badge-planned">${esc(result.difficulty)}</span>
                <div class="mt-1">${formatContent(result.description)}</div>
            `;
            break;
        case 'location':
            html = `
                <h3>${esc(result.name)}</h3>
                <div class="mt-1">${formatContent(result.description)}</div>
            `;
            break;
        case 'adversary':
            html = `
                <h3>${esc(result.name)}</h3>
                <div class="mt-1">${formatContent(result.description)}</div>
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

export async function saveGeneratedContent() {
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
                if (confirm('Would you like to generate an illustration for this adversary now?')) {
                    await generateImage('adversaries', advResult.adversary_id);
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

export async function generateModule() {
    const title = document.getElementById('module-title').value.trim();
    const prompt = document.getElementById('module-prompt').value.trim();
    const illustrations = document.getElementById('module-illustrations').checked;

    if (!prompt) {
        toast('Please enter a description', 'error');
        return;
    }

    showLoading('Generating adventure module...\\nThis may take several minutes.');

    try {
        await api(`/campaigns/${state.currentCampaign.id}/modules/generate`, {
            method: 'POST',
            body: JSON.stringify({ title: title || null, prompt, include_illustrations: illustrations }),
        });
        toast('Module generated!', 'success');
        await renderModules();
    } catch (e) { }

    hideLoading();
}

export async function enhanceEntity(endpointPath, entityId) {
    showEnhanceModal(endpointPath, async (prompt) => {
        showLoading(`Enhancing...`);
        try {
            await api(`/campaigns/${state.currentCampaign.id}/${endpointPath}/${entityId}/enhance`, {
                method: 'POST',
                body: JSON.stringify({ prompt })
            });
            toast(`Enhanced!`, 'success');
            await openCampaign(state.currentCampaign.id);
        } catch(e) {} finally {
            hideLoading();
        }
    });
}

export async function generateImage(endpointPath, entityId) {
    showLoading('Generating Image with Art Director...');
    try {
        await api(`/campaigns/${state.currentCampaign.id}/${endpointPath}/${entityId}/generate-image`, {method: 'POST'});
        toast('Image Generated!', 'success');
        await openCampaign(state.currentCampaign.id);
        if (endpointPath === 'adversaries' && state.currentAdversaryId === entityId) openAdversaryDetail(entityId);
    } catch(e) {} finally {
        hideLoading();
    }
}

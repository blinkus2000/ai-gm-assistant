import { state } from '../state.js';
import { api } from '../api.js';
import { showLoading, hideLoading, toast } from '../utils.js';
import { renderSidebar } from '../components/Sidebar.js';

export async function showSettings() {
    state.currentCampaign = null;
    
    ['view-dashboard', 'view-campaign', 'view-settings'].forEach(id => {
        const viewEl = document.getElementById(id);
        if (viewEl) viewEl.style.display = (id === 'view-settings') ? '' : 'none';
    });
    
    const advDetailView = document.getElementById('adversary-detail-view');
    if (advDetailView) advDetailView.style.display = 'none';
    state.currentAdversaryId = null;

    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    const navSettings = document.getElementById('nav-settings');
    if (navSettings) navSettings.classList.add('active');
    
    await loadSettings();
    renderSidebar();
}

export async function loadSettings() {
    try {
        state.settings = await api('/settings');
        document.getElementById('settings-reasoning-model').value = state.settings.reasoning_model;
        document.getElementById('settings-image-model').value = state.settings.image_model;
    } catch (e) {
        console.error('Failed to load settings', e);
    }
}

export async function saveSettings() {
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

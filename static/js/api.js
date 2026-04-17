import { toast } from './utils.js';

export const API_BASE = '/api';

export async function api(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };

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

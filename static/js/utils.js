export function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

export function showLoading(text = 'Generating...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading-overlay';
    // Use raw HTML here since it's hardcoded and safe
    overlay.innerHTML = `
        <div class="spinner"></div>
        <div class="loading-text">${esc(text)}</div>
    `;
    document.body.appendChild(overlay);
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

export function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function formatContent(text) {
    if (!text) return '';
    if (window.marked && window.marked.parse) {
        return window.marked.parse(text);
    }
    return esc(text).replace(/\n/g, '<br>');
}

export function showModal(title, contentHtml, onConfirm, confirmText = 'Save') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-title">${esc(title)}</div>
            <div class="modal-body">${contentHtml}</div>
            <div class="modal-actions">
                <button class="btn" id="modal-cancel">Cancel</button>
                <button class="btn btn-primary" id="modal-confirm">${esc(confirmText)}</button>
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

export function showEnhanceModal(title, onConfirm) {
    const content = `
        <p class="mb-1 text-sm">You can provide optional guidance or focus for the AI to follow during this enhancement.</p>
        <div class="form-group">
            <label class="form-label">Guidance Prompt (Optional)</label>
            <textarea class="form-textarea" id="enhance-prompt" placeholder="e.g., 'Make it more mysterious', 'Add more details about the history', etc." style="min-height:100px;"></textarea>
        </div>
    `;
    return showModal(`✨ Enhance ${title}`, content, (overlay) => {
        const prompt = overlay.querySelector('#enhance-prompt').value.trim();
        onConfirm(prompt);
    }, 'Enhance');
}

/**
 * Helper strictly for building DOM elements programatically without innerHTML.
 */
export function el(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
        if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else if (key === 'className' || key === 'class') {
            if (value) element.className = value;
        } else if (key === 'dataset') {
            for (const [dKey, dVal] of Object.entries(value)) {
                element.dataset[dKey] = dVal;
            }
        } else if (key === 'innerHTML') {
            element.innerHTML = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else {
            if (value !== false && value != null) {
                element.setAttribute(key, value === true ? '' : value);
            }
        }
    }
    for (const child of children) {
        if (child == null || child === false) continue;
        if (typeof child === 'string' || typeof child === 'number') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        } else if (Array.isArray(child)) {
            child.forEach(c => {
                if (c == null || c === false) return;
                if (c instanceof Node) element.appendChild(c);
                else if (typeof c === 'string' || typeof c === 'number') element.appendChild(document.createTextNode(c));
            });
        }
    }
    return element;
}

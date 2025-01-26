let sidebarActive = false;

function isOdooPage() {
    return !!(
        document.querySelector('.o_main_navbar') ||
        document.querySelector('.o_web_client') ||
        document.querySelector('.o_form_view') ||
        document.querySelector('.oe_website_sale')
    );
}

// Watch for URL changes
let lastUrl = location.href;
setInterval(() => {
    if (location.href !== lastUrl) {
        console.log('URL CHANGED:', lastUrl, '->', location.href);
        lastUrl = location.href;
        
        // Refresh sidebar
        hideFieldHints();
        chrome.storage.sync.get(['fieldHintsEnabled'], function(result) {
            if (result.fieldHintsEnabled) {
                setTimeout(showFieldHints, 1000);
            }
        });
    }
}, 100);


// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (!isOdooPage()) return;

    // Check if extension has been initialized before
    chrome.storage.sync.get(['extensionInitialized'], function(result) {
        if (!result.extensionInitialized) {
            // First time initialization - set everything OFF
            chrome.storage.sync.set({ 
                fieldHintsEnabled: false,
                devModeEnabled: false,
                extensionInitialized: true  // Mark as initialized
            }, function() {
                console.log('Extension initialized for first time: all toggles set to OFF');
            });
        }
    });

    // Watch for URL changes
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            console.log('URL CHANGED:', lastUrl, '->', location.href);
            lastUrl = location.href;
            
            // Refresh sidebar
            hideFieldHints();
            chrome.storage.sync.get(['fieldHintsEnabled'], function(result) {
                if (result.fieldHintsEnabled) {
                    setTimeout(showFieldHints, 1000);
                }
            });
        }
    }, 100);

    // Initial load
    chrome.storage.sync.get(['fieldHintsEnabled'], function(result) {
        if (result.fieldHintsEnabled) {
            setTimeout(showFieldHints, 1000);
        }
    });
});

// Message Listener
// Message Listener
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (!isOdooPage()) return;

    if (request.action === 'toggleFieldHints') {
        if (request.enabled) {
            // When enabling fields, make sure dev mode is on first
            chrome.storage.sync.set({ fieldHintsEnabled: true }, function() {
                // Check if we're already in dev mode
                const debugParam = new URL(window.location.href).searchParams.get('debug');
                if (!debugParam) {
                    // If not in dev mode, turn it on first
                    activateDevMode('assets');
                } else {
                    // If already in dev mode, just show fields
                    showFieldHints();
                }
            });
        } else {
            // When disabling fields, just hide them (leave dev mode alone)
            chrome.storage.sync.set({ fieldHintsEnabled: false }, function() {
                hideFieldHints();
            });
        }
    }
    
    if (request.action === 'toggleDevMode') {
        if (request.enabled) {
            // When enabling dev mode, just enable it
            activateDevMode(request.mode);
        } else {
            // When disabling dev mode, make sure fields are off too
            chrome.storage.sync.set({ fieldHintsEnabled: false }, function() {
                hideFieldHints();
                deactivateDevMode();
            });
        }
    }
});

function showFieldHints() {
    if (!isOdooPage()) return;
    
    // Always remove existing sidebar first
    hideFieldHints();
    
    const currentUrl = new URL(window.location.href);
    const debugParam = currentUrl.searchParams.get('debug');
    
    if (!debugParam) {
        activateDevMode('assets');
        return;
    }
    
    const sidebar = document.createElement('div');
    sidebar.id = 'tooltip-sidebar';
    sidebar.style.cssText = `
        position: fixed;
        right: 0;
        top: 0;
        width: 400px;
        height: 100vh;
        background: white;
        padding: 15px;
        box-shadow: -2px 0 5px rgba(0,0,0,0.1);
        overflow-y: auto;
        z-index: 9999;
        border-left: 1px solid #ccc;
        font-family: Arial, sans-serif;
    `;

    sidebar.innerHTML = '<h3 style="margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">Field Information</h3>';
    document.body.appendChild(sidebar);
    sidebarActive = true;
    
    setTimeout(() => {
        populateSidebar(sidebar);
    }, 300);
}

// Rest of your code stays exactly the same...

function populateSidebar(sidebar) {
    const fields = document.querySelectorAll('.o_field_widget, [name^="field_"], [data-name]');
    const processedFields = new Set();
    
    fields.forEach((el) => {
        try {
            const fieldName = 
                el.getAttribute('name')?.replace('field_', '') ||
                el.dataset.name ||
                el.getAttribute('field_name') ||
                Array.from(el.classList)
                    .find(cls => cls.startsWith('o_field_'))
                    ?.replace('o_field_', '');

            if (!fieldName || processedFields.has(fieldName)) return;
            processedFields.add(fieldName);

            const fieldType = Array.from(el.classList)
                .find(cls => cls.startsWith('o_field_'))
                ?.replace('o_field_', '') || 'unknown';

            const widgetType = Array.from(el.classList)
                .find(cls => cls.startsWith('o_field_widget'))
                ?.replace('o_field_widget', '') || 'unknown';

            const label = document.querySelector(`label[for="${el.id}"]`)?.textContent || fieldName;

            const field = {
                name: fieldName,
                label: label,
                type: fieldType,
                widget: widgetType,
                required: el.hasAttribute('required'),
                readonly: el.hasAttribute('readonly'),
                id: el.id || '',
                classes: Array.from(el.classList).join(' ')
            };

            const accordionItem = document.createElement('div');
            accordionItem.style.marginBottom = '10px';
            
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 8px;
                background: #eee;
                cursor: pointer;
                border-radius: 4px;
                font-weight: bold;
            `;
            header.innerHTML = field.label || field.name;
            
            const content = document.createElement('div');
            content.style.cssText = `
                display: none;
                padding: 10px;
                border: 1px solid #eee;
                border-top: none;
                background: #f9f9f9;
                font-family: monospace;
                font-size: 12px;
            `;
            content.innerHTML = `<pre style="white-space: pre-wrap; word-break: break-all; margin: 0;">${JSON.stringify(field, null, 2)}</pre>`;
            
            header.onclick = () => {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
                header.style.borderRadius = content.style.display === 'none' ? '4px' : '4px 4px 0 0';
            };
            
            accordionItem.addEventListener('mouseenter', () => {
                el.style.outline = '2px solid #00ff00';
                el.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
            });
            
            accordionItem.addEventListener('mouseleave', () => {
                el.style.outline = '';
                el.style.backgroundColor = '';
            });
            
            accordionItem.appendChild(header);
            accordionItem.appendChild(content);
            sidebar.appendChild(accordionItem);
        } catch (error) {
            console.log('Error processing field:', el, error);
        }
    });
}

function hideFieldHints() {
    const sidebar = document.getElementById('tooltip-sidebar');
    if (sidebar) {
        sidebar.remove();
        sidebarActive = false;
    }
}

function activateDevMode(mode) {
    if (!isOdooPage()) return;
    const currentUrl = new URL(window.location.href);
    const hash = currentUrl.hash;
    currentUrl.searchParams.delete('debug');
    
    if (mode === 'assets') {
        currentUrl.searchParams.append('debug', 'assets');
    } else if (mode === 'assets,tests') {
        currentUrl.searchParams.append('debug', 'assets,tests');
    }
    
    currentUrl.hash = hash;
    window.location.replace(currentUrl.toString());
}

function deactivateDevMode() {
    if (!isOdooPage()) return;
    const currentUrl = new URL(window.location.href);
    const hash = currentUrl.hash;
    currentUrl.searchParams.delete('debug');
    currentUrl.hash = hash;
    window.location.replace(currentUrl.toString());
}
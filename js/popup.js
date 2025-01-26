document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const fieldHintsCheckbox = document.getElementById('fieldHints');
    const devModeCheckbox = document.getElementById('devMode');
    const debugRadios = document.getElementsByName('debugMode');
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');

    // Function to update status UI
    function updateStatusUI(active, mode) {
        if (active) {
            statusIndicator.classList.add('status-active');
            statusIndicator.classList.remove('status-inactive');
            statusText.textContent = `Active (${mode || 'basic'})`;
            devModeCheckbox.checked = true;
            if (mode) {
                const radio = document.querySelector(`input[name="debugMode"][value="${mode}"]`);
                if (radio) radio.checked = true;
            }
        } else {
            statusIndicator.classList.add('status-inactive');
            statusIndicator.classList.remove('status-active');
            statusText.textContent = 'Inactive';
            devModeCheckbox.checked = false;
        }
    }

    // Check current tab's status immediately when popup opens
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const url = new URL(tabs[0].url);
        const debugParam = url.searchParams.get('debug');
        updateStatusUI(!!debugParam, debugParam);
    });

    // Field Hints Toggle
    fieldHintsCheckbox.addEventListener('change', function() {
        chrome.storage.sync.set({
            fieldHintsEnabled: fieldHintsCheckbox.checked
        });

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const url = new URL(tabs[0].url);
            const debugParam = url.searchParams.get('debug');
            
            if (fieldHintsCheckbox.checked && !debugParam) {
                // If enabling hints and not in debug mode, also enable debug mode
                devModeCheckbox.checked = true;
                const selectedMode = document.querySelector('input[name="debugMode"]:checked');
                const mode = selectedMode ? selectedMode.value : 'assets';
                
                chrome.storage.sync.set({
                    devModeEnabled: true,
                    debugMode: mode
                });

                // Update the UI to show active status
                updateStatusUI(true, mode);

                // Send message to activate dev mode
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleDevMode',
                    enabled: true,
                    mode: mode
                });
            }

            // Send message for field hints
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleFieldHints',
                enabled: fieldHintsCheckbox.checked
            });
        });
    });

    // Dev Mode Toggle with immediate feedback
    devModeCheckbox.addEventListener('change', function() {
        const selectedMode = document.querySelector('input[name="debugMode"]:checked');
        const mode = selectedMode ? selectedMode.value : 'assets';

        chrome.storage.sync.set({
            devModeEnabled: devModeCheckbox.checked,
            debugMode: mode
        });

        updateStatusUI(devModeCheckbox.checked, devModeCheckbox.checked ? mode : null);

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleDevMode',
                enabled: devModeCheckbox.checked,
                mode: mode
            });
        });
    });

    // Debug Mode Radio Buttons with immediate feedback
    debugRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (devModeCheckbox.checked) {
                const mode = this.value;
                chrome.storage.sync.set({
                    debugMode: mode
                });

                updateStatusUI(true, mode);

                chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'toggleDevMode',
                        enabled: true,
                        mode: mode
                    });
                });
            }
        });
    });

    // Load saved states
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const url = new URL(tabs[0].url);
        const debugParam = url.searchParams.get('debug');
        
        chrome.storage.sync.get(['fieldHintsEnabled', 'devModeEnabled', 'debugMode'], function(result) {
            // Update checkbox states
            fieldHintsCheckbox.checked = result.fieldHintsEnabled || false;
            devModeCheckbox.checked = !!debugParam; // Use actual URL state
            
            // Update debug radio if needed
            if (debugParam) {
                const radio = document.querySelector(`input[name="debugMode"][value="${debugParam}"]`);
                if (radio) radio.checked = true;
            }
            
            // Update status UI
            updateStatusUI(!!debugParam, debugParam);
        });
    });

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'updateUI') {
            fieldHintsCheckbox.checked = request.fieldHintsEnabled;
            devModeCheckbox.checked = request.devModeEnabled;
            updateStatusUI(request.devModeEnabled, request.debugMode);
        }
    });
});
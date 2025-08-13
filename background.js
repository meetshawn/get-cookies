// Background service worker for Cookie Header Extractor
chrome.runtime.onInstalled.addListener(() => {
    console.log('Cookie Header Extractor extension installed');
    
    // Initialize storage with default values
    chrome.storage.sync.set({
        configuredHeaders: [],
        extractionHistory: [],
        settings: {
            autoRefresh: false,
            showNotifications: true
        }
    });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'cookieChanged':
            handleCookieChange(request.url, request.cookie);
            break;
            
        case 'getExtractionHistory':
            handleGetExtractionHistory(sendResponse);
            return true; // Keep message channel open for async response
            
        case 'clearHistory':
            handleClearHistory(sendResponse);
            return true;
            
        case 'addConfiguredHeader':
            handleAddConfiguredHeader(request.header, sendResponse);
            return true;
            
        case 'removeConfiguredHeader':
            handleRemoveConfiguredHeader(request.header, sendResponse);
            return true;
            
        case 'getConfiguredHeaders':
            handleGetConfiguredHeaders(sendResponse);
            return true;
    }
});

function handleCookieChange(url, cookie) {
    // Log cookie changes for debugging
    console.log('Cookie changed for', url, cookie);
    
    // Optionally notify popup if it's open
    chrome.runtime.sendMessage({
        action: 'cookieUpdated',
        url: url,
        cookie: cookie
    }).catch(() => {
        // Popup might not be open, ignore error
    });
}

async function handleGetExtractionHistory(sendResponse) {
    try {
        const result = await chrome.storage.sync.get(['extractionHistory']);
        sendResponse({ success: true, history: result.extractionHistory || [] });
    } catch (error) {
        console.error('Failed to get extraction history:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleClearHistory(sendResponse) {
    try {
        await chrome.storage.sync.set({ extractionHistory: [] });
        sendResponse({ success: true });
    } catch (error) {
        console.error('Failed to clear history:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleAddConfiguredHeader(header, sendResponse) {
    try {
        const result = await chrome.storage.sync.get(['configuredHeaders']);
        const headers = result.configuredHeaders || [];
        
        if (!headers.includes(header)) {
            headers.push(header);
            await chrome.storage.sync.set({ configuredHeaders: headers });
        }
        
        sendResponse({ success: true, headers });
    } catch (error) {
        console.error('Failed to add configured header:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleRemoveConfiguredHeader(header, sendResponse) {
    try {
        const result = await chrome.storage.sync.get(['configuredHeaders']);
        const headers = result.configuredHeaders || [];
        const filteredHeaders = headers.filter(h => h !== header);
        
        await chrome.storage.sync.set({ configuredHeaders: filteredHeaders });
        sendResponse({ success: true, headers: filteredHeaders });
    } catch (error) {
        console.error('Failed to remove configured header:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleGetConfiguredHeaders(sendResponse) {
    try {
        const result = await chrome.storage.sync.get(['configuredHeaders']);
        sendResponse({ success: true, headers: result.configuredHeaders || [] });
    } catch (error) {
        console.error('Failed to get configured headers:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Utility functions for managing extraction history
async function addExtractionHistory(entry) {
    try {
        const result = await chrome.storage.sync.get(['extractionHistory']);
        const history = result.extractionHistory || [];
        
        // Add new entry with timestamp
        const newEntry = {
            ...entry,
            timestamp: new Date().toISOString(),
            id: Date.now()
        };
        
        // Keep only last 100 entries
        history.unshift(newEntry);
        if (history.length > 100) {
            history.pop();
        }
        
        await chrome.storage.sync.set({ extractionHistory: history });
    } catch (error) {
        console.error('Failed to add extraction history:', error);
    }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This is handled by popup.html, but we can add additional logic here
    console.log('Extension icon clicked for tab:', tab.url);
});

// Handle tab updates to reset popup state when navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        // Reset popup state when page loads
        chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
});

// Handle storage changes to sync between popup instances
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.configuredHeaders) {
        console.log('Configured headers updated:', changes.configuredHeaders.newValue);
    }
});

// Export utility functions for use in popup
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'popup') {
        port.onMessage.addListener(async (msg) => {
            switch (msg.action) {
                case 'addExtractionHistory':
                    await addExtractionHistory(msg.entry);
                    port.postMessage({ success: true });
                    break;
            }
        });
    }
});
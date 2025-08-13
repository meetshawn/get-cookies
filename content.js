// Content script for cookie header extraction support
(function() {
    'use strict';

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getPageInfo') {
            const pageInfo = {
                url: window.location.href,
                hostname: window.location.hostname,
                title: document.title,
                cookies: document.cookie
            };
            sendResponse(pageInfo);
        }

        if (request.action === 'extractCookieHeaders') {
            const headers = request.headers || [];
            const extractedCookies = {};
            
            // Get all cookies from document.cookie
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
                const [name, ...valueParts] = cookie.trim().split('=');
                if (name && valueParts.length > 0) {
                    acc[name.trim()] = valueParts.join('=').trim();
                }
                return acc;
            }, {});

            // Extract configured headers
            headers.forEach(header => {
                if (cookies[header]) {
                    extractedCookies[header] = cookies[header];
                }
            });

            sendResponse({ extractedCookies, allCookies: cookies });
        }
    });

    // Monitor cookie changes
    const originalSetCookie = document.__lookupSetter__('cookie') || function(value) {
        // Fallback for environments where lookupSetter doesn't work
        Object.defineProperty(document, 'cookie', {
            set: function(value) {
                // Notify background script about cookie change
                chrome.runtime.sendMessage({
                    action: 'cookieChanged',
                    url: window.location.href,
                    cookie: value
                });
            },
            get: function() {
                return document.cookie;
            }
        });
    };

    // Override document.cookie setter to detect changes
    if (Object.defineProperty) {
        let cookieCache = document.cookie;
        
        Object.defineProperty(document, 'cookie', {
            get: function() {
                return cookieCache;
            },
            set: function(value) {
                cookieCache = value;
                // Notify background script
                chrome.runtime.sendMessage({
                    action: 'cookieChanged',
                    url: window.location.href,
                    cookie: value
                });
            }
        });
    }

    console.log('Cookie Header Extractor: Content script loaded for', window.location.hostname);
})();
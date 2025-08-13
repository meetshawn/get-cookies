class CookieExtractorPopup {
    constructor() {
        this.currentUrl = '';
        this.configuredHeaders = [];
        this.init();
    }

    async init() {
        await this.loadCurrentUrl();
        await this.loadConfiguredHeaders();
        this.bindEvents();
        this.renderHeaderList();
    }

    async loadCurrentUrl() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentUrl = new URL(tab.url).hostname;
            document.getElementById('currentUrl').textContent = this.currentUrl;
        } catch (error) {
            document.getElementById('currentUrl').textContent = '无法获取当前网址';
        }
    }

    async loadConfiguredHeaders() {
        try {
            const result = await chrome.storage.sync.get(['configuredHeaders']);
            this.configuredHeaders = result.configuredHeaders || [];
        } catch (error) {
            console.error('加载配置失败:', error);
            this.configuredHeaders = [];
        }
    }

    async saveConfiguredHeaders() {
        try {
            await chrome.storage.sync.set({ configuredHeaders: this.configuredHeaders });
        } catch (error) {
            console.error('保存配置失败:', error);
        }
    }

    bindEvents() {
        document.getElementById('addHeader').addEventListener('click', () => this.addHeader());
        document.getElementById('extractCookies').addEventListener('click', () => this.extractCookies());
        document.getElementById('clearAll').addEventListener('click', () => this.clearAll());
        
        document.getElementById('headerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addHeader();
        });
    }

    async addHeader() {
        const input = document.getElementById('headerName');
        const headerName = input.value.trim();

        if (!headerName) {
            alert('请输入Cookie头名称');
            return;
        }

        if (this.configuredHeaders.includes(headerName)) {
            alert('该Cookie头已存在');
            return;
        }

        this.configuredHeaders.push(headerName);
        await this.saveConfiguredHeaders();
        this.renderHeaderList();
        input.value = '';
    }

    async removeHeader(headerName) {
        this.configuredHeaders = this.configuredHeaders.filter(h => h !== headerName);
        await this.saveConfiguredHeaders();
        this.renderHeaderList();
    }

    async clearAll() {
        if (confirm('确定要清除所有配置吗？')) {
            this.configuredHeaders = [];
            await this.saveConfiguredHeaders();
            this.renderHeaderList();
            document.getElementById('cookieResults').innerHTML = '<div class="empty-state">点击提取按钮获取Cookie信息</div>';
        }
    }

    renderHeaderList() {
        const container = document.getElementById('headerList');
        
        if (this.configuredHeaders.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无配置</div>';
            return;
        }

        container.innerHTML = this.configuredHeaders.map(header => `
            <div class="header-item">
                <span class="header-name">${header}</span>
                <button class="remove-btn" data-header="${header}">删除</button>
            </div>
        `).join('');

        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const header = e.target.dataset.header;
                this.removeHeader(header);
            });
        });
    }

    async extractCookies() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!this.configuredHeaders.length) {
                alert('请先配置要提取的Cookie头');
                return;
            }

            const cookies = await chrome.cookies.getAll({ url: tab.url });
            const results = [];

            this.configuredHeaders.forEach(headerName => {
                const matchingCookies = cookies.filter(cookie => 
                    cookie.name.toLowerCase().includes(headerName.toLowerCase()) ||
                    cookie.name === headerName
                );

                if (matchingCookies.length > 0) {
                    matchingCookies.forEach(cookie => {
                        results.push({
                            name: cookie.name,
                            value: cookie.value,
                            domain: cookie.domain,
                            path: cookie.path,
                            secure: cookie.secure,
                            httpOnly: cookie.httpOnly,
                            expirationDate: cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleString() : '会话Cookie'
                        });
                    });
                } else {
                    results.push({
                        name: headerName,
                        value: '未找到',
                        notFound: true
                    });
                }
            });

            this.renderCookieResults(results);
        } catch (error) {
            console.error('提取Cookie失败:', error);
            alert('提取Cookie失败，请检查权限');
        }
    }

    renderCookieResults(results) {
        const container = document.getElementById('cookieResults');
        
        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state">未找到相关Cookie</div>';
            return;
        }

        container.innerHTML = results.map(result => `
            <div class="cookie-result ${result.notFound ? 'not-found' : ''}">
                <div class="cookie-name">
                    <strong>${result.name}</strong>
                    ${result.notFound ? '' : `<button class="copy-btn" data-value="${result.value}">复制</button>`}
                </div>
                ${result.notFound ? '' : `
                    <div class="cookie-value">值: ${result.value}</div>
                    ${result.domain ? `<div class="cookie-details">域: ${result.domain}</div>` : ''}
                    ${result.path ? `<div class="cookie-details">路径: ${result.path}</div>` : ''}
                    ${result.expirationDate ? `<div class="cookie-details">过期: ${result.expirationDate}</div>` : ''}
                    <div class="cookie-flags">
                        ${result.secure ? '<span class="flag">安全</span>' : ''}
                        ${result.httpOnly ? '<span class="flag">HttpOnly</span>' : ''}
                    </div>
                `}
            </div>
        `).join('');

        container.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const value = e.target.dataset.value;
                navigator.clipboard.writeText(value).then(() => {
                    e.target.textContent = '已复制';
                    setTimeout(() => {
                        e.target.textContent = '复制';
                    }, 1000);
                });
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CookieExtractorPopup();
});
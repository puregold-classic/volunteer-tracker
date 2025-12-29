// ============================================
// data-panel.js - 统一数据面板管理器
// ============================================

console.log('📊 data-panel.js 加载');

class DataPanel {
    constructor() {
        this.currentMode = 'global'; // 'global' 或 'country'
        this.currentCountry = null;
        console.log('✅ 数据面板初始化');
    }
    
    /**
     * 显示全球统计数据
     */
    async showGlobalStats() {
        console.log('显示全球统计');
        this.currentMode = 'global';
        this.currentCountry = null;
        
        // 更新面板标题
        document.getElementById('panel-title').textContent = '🌍 全球义工统计';
        
        try {
            // 加载并汇总所有国家数据
            const globalStats = await this.calculateGlobalStats();
            this.renderGlobalStats(globalStats);
        } catch (error) {
            console.error('加载全球统计失败:', error);
            this.renderError('无法加载全球数据');
        }
    }
    
    /**
     * 显示国家详情
     */
    async showCountryDetails(countryName, countryCode) {
        console.log(`显示国家详情: ${countryName} (${countryCode})`);
        this.currentMode = 'country';
        this.currentCountry = countryCode;
        
        // 更新面板标题
        document.getElementById('panel-title').textContent = `📍 ${countryName}`;
        
        try {
            // 加载国家数据
            const countryData = await this.loadCountryData(countryCode);
            this.renderCountryDetails(countryName, countryCode, countryData);
        } catch (error) {
            console.error('加载国家详情失败:', error);
            this.renderCountryError(countryName, countryCode, error);
        }
    }
    
    /**
     * 计算全球统计数据
     */
    async calculateGlobalStats() {
        console.log('计算全球统计...');
        
        // 这里可以遍历所有国家JSON文件，汇总数据
        // 暂时使用模拟数据
        return {
            totalVolunteers: 245,
            totalCountries: 15,
            totalProjects: 42,
            activeVolunteers: 201,
            topCountries: [
                { name: '中国', count: 156 },
                { name: '美国', count: 89 }
            ]
        };
    }
    
    /**
     * 加载国家数据
     */
    async loadCountryData(countryCode) {
        console.log(`加载 ${countryCode} 数据`);
        
        // 方法1: 使用volunteer-manager
        if (window.volunteerManager && window.volunteerManager.loadCountryData) {
            return await window.volunteerManager.loadCountryData(countryCode);
        }
        
        // 方法2: 直接加载JSON
        const response = await fetch(`data/volunteers/countries/${countryCode}.json`);
        if (!response.ok) throw new Error('数据文件不存在');
        return await response.json();
    }
    
    /**
     * 渲染全球统计
     */
    renderGlobalStats(stats) {
        const panel = document.getElementById('data-panel');
        
        panel.innerHTML = `
            <div class="global-stats-view">
                <div class="global-summary">
                    <div class="global-stat">
                        <div class="stat-number">${stats.totalVolunteers}</div>
                        <div class="stat-label">总义工数</div>
                    </div>
                    <div class="global-stat">
                        <div class="stat-number">${stats.totalCountries}</div>
                        <div class="stat-label">国家/地区</div>
                    </div>
                    <div class="global-stat">
                        <div class="stat-number">${stats.totalProjects}</div>
                        <div class="stat-label">翻译项目</div>
                    </div>
                    <div class="global-stat">
                        <div class="stat-number">${stats.activeVolunteers}</div>
                        <div class="stat-label">活跃义工</div>
                    </div>
                </div>
                
                <div class="global-details">
                    <h4>📈 分布概况</h4>
                    <div class="country-ranking">
                        ${stats.topCountries.map(country => `
                            <div class="country-rank-item">
                                <span class="rank-name">${country.name}</span>
                                <span class="rank-count">${country.count}人</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="global-actions">
                        <button onclick="dataPanel.refreshGlobalStats()" class="btn-refresh">
                            🔄 刷新数据
                        </button>
                        <button onclick="dataPanel.showAllCountries()" class="btn-view-all">
                            👁️ 查看所有国家
                        </button>
                    </div>
                    
                    <div class="global-hint">
                        <p>💡 点击地图上的国家查看详细义工信息</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 渲染国家详情
     */
    renderCountryDetails(countryName, countryCode, countryData) {
        const panel = document.getElementById('data-panel');
        const stats = countryData.stats || {};
        
        panel.innerHTML = `
            <div class="country-details-view">
                <div class="country-header">
                    <div class="country-title">
                        <h4>${countryData.country || countryName}</h4>
                        <span class="country-code">${countryData.code || countryCode}</span>
                    </div>
                    <div class="country-meta">
                        <span class="last-updated">更新: ${countryData.lastUpdated || '未知'}</span>
                        <button onclick="dataPanel.showGlobalStats()" class="btn-back">
                            ← 返回全球
                        </button>
                    </div>
                </div>
                
                <div class="country-stats-grid">
                    <div class="country-stat-card">
                        <div class="card-icon">👥</div>
                        <div class="card-content">
                            <div class="card-number">${stats.total || 0}</div>
                            <div class="card-label">总义工数</div>
                        </div>
                    </div>
                    
                    <div class="country-stat-card">
                        <div class="card-icon">✅</div>
                        <div class="card-content">
                            <div class="card-number">${stats.active || 0}</div>
                            <div class="card-label">活跃义工</div>
                        </div>
                    </div>
                    
                    <div class="country-stat-card">
                        <div class="card-icon">🌐</div>
                        <div class="card-content">
                            <div class="card-number">${stats.languages || 0}</div>
                            <div class="card-label">翻译语言</div>
                        </div>
                    </div>
                    
                    <div class="country-stat-card">
                        <div class="card-icon">📁</div>
                        <div class="card-content">
                            <div class="card-number">${countryData.volunteers ? countryData.volunteers.length : 0}</div>
                            <div class="card-label">当前记录</div>
                        </div>
                    </div>
                </div>
                
                <div class="country-role-distribution">
                    <div class="role-dist-item">
                        <span class="role-name">翻译员</span>
                        <span class="role-count">${stats.translators || 0}</span>
                    </div>
                    <div class="role-dist-item">
                        <span class="role-name">审校员</span>
                        <span class="role-count">${stats.reviewers || 0}</span>
                    </div>
                    <div class="role-dist-item">
                        <span class="role-name">协调员</span>
                        <span class="role-count">${stats.coordinators || 0}</span>
                    </div>
                </div>
                
                <div class="country-volunteers-preview">
                    <h5>👤 义工预览</h5>
                    ${this.renderVolunteersPreview(countryData.volunteers || [])}
                </div>
                
                <div class="country-actions">
                    <button onclick="viewFullVolunteerList('${countryCode}')" class="btn-view-full">
                        📋 查看完整列表
                    </button>
                    <button onclick="addVolunteerToCountry('${countryCode}')" class="btn-add">
                        ➕ 添加义工
                    </button>
                    <button onclick="dataPanel.refreshCountryData('${countryCode}')" class="btn-refresh">
                        🔄 刷新
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 渲染义工预览
     */
    renderVolunteersPreview(volunteers) {
        if (volunteers.length === 0) {
            return `
                <div class="empty-preview">
                    <p>暂无义工记录</p>
                    <button onclick="addVolunteerToCountry('${this.currentCountry}')" class="btn-add-first">
                        成为第一位义工
                    </button>
                </div>
            `;
        }
        
        // 显示前3位义工
        const previewVolunteers = volunteers.slice(0, 3);
        
        return `
            <div class="preview-list">
                ${previewVolunteers.map(vol => `
                    <div class="preview-item">
                        <div class="preview-name">${vol.name}</div>
                        <div class="preview-details">
                            <span class="preview-role">${this.getRoleName(vol.role)}</span>
                            <span class="preview-lang">${(vol.languages || []).slice(0, 2).join(', ')}</span>
                        </div>
                    </div>
                `).join('')}
                
                ${volunteers.length > 3 ? `
                    <div class="preview-more">
                        还有 ${volunteers.length - 3} 位义工...
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * 渲染错误状态
     */
    renderError(message) {
        const panel = document.getElementById('data-panel');
        panel.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h4>数据加载失败</h4>
                <p>${message}</p>
                <button onclick="dataPanel.showGlobalStats()" class="btn-retry">
                    🔄 重试
                </button>
            </div>
        `;
    }
    
    /**
     * 渲染国家错误状态
     */
    renderCountryError(countryName, countryCode, error) {
        const panel = document.getElementById('data-panel');
        
        panel.innerHTML = `
            <div class="country-error">
                <h4>${countryName}</h4>
                <p class="error-message">${error.message}</p>
                
                <div class="error-solution">
                    <p>可能的原因：</p>
                    <ul>
                        <li>数据文件不存在</li>
                        <li>文件格式错误</li>
                        <li>网络连接问题</li>
                    </ul>
                </div>
                
                <div class="error-actions">
                    <button onclick="dataPanel.showCountryDetails('${countryName}', '${countryCode}')" class="btn-retry">
                        🔄 重试加载
                    </button>
                    <button onclick="dataPanel.showGlobalStats()" class="btn-back">
                        ← 返回全球
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 获取角色名称
     */
    getRoleName(role) {
        const roleMap = {
            'translator': '翻译员',
            'reviewer': '审校员',
            'coordinator': '协调员'
        };
        return roleMap[role] || role;
    }
    
    /**
     * 刷新全球统计
     */
    refreshGlobalStats() {
        console.log('刷新全球统计');
        this.showGlobalStats();
    }
    
    /**
     * 刷新国家数据
     */
    refreshCountryData(countryCode) {
        if (this.currentCountry === countryCode) {
            console.log(`刷新 ${countryCode} 数据`);
            // 清除缓存
            if (window.volunteerManager && window.volunteerManager.countryCache) {
                delete window.volunteerManager.countryCache[countryCode];
            }
            // 重新加载
            const countryName = this.getCountryName(countryCode);
            this.showCountryDetails(countryName, countryCode);
        }
    }
    
    /**
     * 显示所有国家
     */
    showAllCountries() {
        alert('所有国家列表功能待实现');
    }
    
    /**
     * 获取国家名称
     */
    getCountryName(code) {
        const nameMap = {
            'CN': '中国', 'US': '美国', 'JP': '日本', 'DE': '德国',
            'FR': '法国', 'GB': '英国', 'IN': '印度', 'BR': '巴西'
        };
        return nameMap[code] || code;
    }
}

// 创建全局实例
const dataPanel = new DataPanel();

// 全局函数
window.dataPanel = dataPanel;
window.viewFullVolunteerList = function(countryCode) {
    console.log(`查看完整列表: ${countryCode}`);
    // 这里可以打开完整列表模态框
    alert(`查看 ${countryCode} 完整义工列表 - 功能待实现`);
};

window.addVolunteerToCountry = function(countryCode) {
    console.log(`添加义工到: ${countryCode}`);
    alert(`添加义工到 ${countryCode} - 功能待实现`);
};

// 页面加载完成后显示全球统计
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        dataPanel.showGlobalStats();
    }, 500);
});

console.log('✅ data-panel.js 加载完成');
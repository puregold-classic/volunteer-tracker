// 义工数据管理器
console.log('👥 volunteer-manager.js 加载');

class VolunteerManager {
    constructor() {
        this.basePath = 'data/volunteers/countries';
        this.countryCache = {};
        console.log('✅ 义工管理器初始化完成');
    }
    
    /**
     * 加载国家义工数据
     * @param {string} countryCode - 国家代码 (如: CN, US)
     */
    async loadCountryVolunteers(countryCode) {
        console.log(`📊 加载 ${countryCode} 义工数据...`);
        
        if (!countryCode || countryCode === '--') {
            console.warn('⚠️ 无效的国家代码');
            return this.getEmptyCountryData(countryCode);
        }
        
        const normalizedCode = countryCode.toUpperCase();
        
        // 检查缓存
        if (this.countryCache[normalizedCode]) {
            console.log(`✅ 从缓存加载 ${normalizedCode}`);
            return this.countryCache[normalizedCode];
        }
        
        try {
            // 尝试加载数据文件
            const filePath = `${this.basePath}/${normalizedCode}.json`;
            console.log(`尝试加载: ${filePath}`);
            
            const response = await fetch(filePath);
            
            if (response.ok) {
                const countryData = await response.json();
                console.log(`✅ 加载 ${countryData.country} 数据成功`);
                
                // 缓存数据
                this.countryCache[normalizedCode] = countryData;
                
                // 显示数据
                this.displayVolunteers(countryData);
                
                return countryData;
                
            } else {
                // 文件不存在，创建示例数据
                console.log(`📭 ${normalizedCode} 暂无数据文件`);
                const sampleData = this.createSampleData(normalizedCode);
                
                // 显示示例数据（引导用户创建真实数据）
                this.displaySampleData(sampleData);
                
                return sampleData;
            }
            
        } catch (error) {
            console.error(`❌ 加载 ${normalizedCode} 数据失败:`, error);
            this.displayErrorMessage(normalizedCode, error);
            return this.getEmptyCountryData(normalizedCode);
        }
    }
    
    /**
     * 显示义工数据
     */
    displayVolunteers(countryData) {
        const volunteerTable = document.getElementById('volunteer-table');
        if (!volunteerTable) {
            console.error('找不到义工表格容器');
            return;
        }
        
        const { country, code, stats, volunteers, lastUpdated } = countryData;
        
        if (volunteers.length === 0) {
            volunteerTable.innerHTML = this.createEmptyState(country, code);
            return;
        }
        
        volunteerTable.innerHTML = `
            <div class="volunteer-container">
                <div class="volunteer-header">
                    <h4>${country} 义工管理</h4>
                    <div class="header-info">
                        <span class="country-code">${code}</span>
                        <span class="update-time">更新: ${lastUpdated}</span>
                    </div>
                </div>
                
                <div class="volunteer-stats">
                    <div class="stat-card">
                        <div class="stat-number">${stats.total}</div>
                        <div class="stat-label">总义工数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.active}</div>
                        <div class="stat-label">活跃义工</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.translators}</div>
                        <div class="stat-label">翻译员</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.reviewers}</div>
                        <div class="stat-label">审校员</div>
                    </div>
                </div>
                
                <div class="volunteer-list-container">
                    <div class="list-header">
                        <h5>义工列表 (${volunteers.length}人)</h5>
                        <button onclick="showAddVolunteerForm('${code}')" class="btn-add-volunteer">
                            ➕ 添加义工
                        </button>
                    </div>
                    
                    <div class="volunteer-table">
                        <table>
                            <thead>
                                <tr>
                                    <th width="80">ID</th>
                                    <th>姓名</th>
                                    <th width="100">角色</th>
                                    <th width="150">语言</th>
                                    <th width="100">状态</th>
                                    <th width="80">任务数</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${volunteers.map(volunteer => `
                                    <tr>
                                        <td><span class="volunteer-id">${volunteer.id}</span></td>
                                        <td>
                                            <div class="volunteer-name">${volunteer.name}</div>
                                            <div class="volunteer-location">${volunteer.location || '未指定'}</div>
                                        </td>
                                        <td>
                                            <span class="role-badge role-${volunteer.role}">
                                                ${this.getRoleName(volunteer.role)}
                                            </span>
                                        </td>
                                        <td>
                                            <div class="languages">
                                                ${(volunteer.languages || []).map(lang => 
                                                    `<span class="language-tag">${lang}</span>`
                                                ).join('')}
                                            </div>
                                        </td>
                                        <td>
                                            <span class="status-indicator ${volunteer.status}">
                                                ${volunteer.status === 'active' ? '活跃' : '休息'}
                                            </span>
                                        </td>
                                        <td class="task-count">${volunteer.completedTasks || 0}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div class="volunteer-actions">
                    <button onclick="exportVolunteers('${code}')" class="btn-secondary">
                        📥 导出数据
                    </button>
                    <button onclick="refreshVolunteers('${code}')" class="btn-secondary">
                        🔄 刷新
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 创建空状态显示
     */
    createEmptyState(country, code) {
        return `
            <div class="empty-volunteers">
                <div class="empty-icon">📭</div>
                <h4>${country} (${code})</h4>
                <p>暂无义工记录</p>
                <p class="empty-hint">成为 ${country} 的第一位义工！</p>
                <div class="empty-actions">
                    <button onclick="showAddVolunteerForm('${code}', '${country}')" class="btn-primary">
                        ➕ 添加第一位义工
                    </button>
                    <button onclick="createSampleDataFile('${code}')" class="btn-secondary">
                        🚀 创建示例数据
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * 显示示例数据（引导用户创建真实数据）
     */
    displaySampleData(sampleData) {
        const volunteerTable = document.getElementById('volunteer-table');
        const { country, code } = sampleData;
        
        volunteerTable.innerHTML = `
            <div class="sample-data">
                <div class="sample-header">
                    <h4>${country} (${code})</h4>
                    <div class="sample-badge">示例数据</div>
                </div>
                
                <div class="sample-content">
                    <p>🔍 检测到 ${country} 还没有义工数据文件。</p>
                    <p>请创建文件: <code>data/volunteers/countries/${code}.json</code></p>
                    
                    <div class="sample-code">
                        <pre><code>{
  "country": "${country}",
  "code": "${code}",
  "lastUpdated": "${new Date().toISOString().split('T')[0]}",
  "stats": {
    "total": 0,
    "active": 0,
    "translators": 0,
    "reviewers": 0,
    "coordinators": 0,
    "languages": 0
  },
  "volunteers": []
}</code></pre>
                    </div>
                    
                    <div class="sample-actions">
                        <button onclick="createDataFile('${code}')" class="btn-primary">
                            📄 创建数据文件
                        </button>
                        <button onclick="loadDemoData('${code}')" class="btn-secondary">
                            🎮 加载演示数据
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 显示错误信息
     */
    displayErrorMessage(countryCode, error) {
        const volunteerTable = document.getElementById('volunteer-table');
        
        volunteerTable.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h4>数据加载失败</h4>
                <p>无法加载 ${countryCode} 的义工数据</p>
                <p class="error-detail">${error.message}</p>
                <button onclick="volunteerManager.loadCountryVolunteers('${countryCode}')" class="btn-retry">
                    🔄 重试加载
                </button>
            </div>
        `;
    }
    
    /**
     * 创建示例数据
     */
    createSampleData(countryCode) {
        const countryName = this.getCountryName(countryCode);
        
        return {
            country: countryName,
            code: countryCode,
            lastUpdated: new Date().toISOString().split('T')[0],
            stats: {
                total: 0,
                active: 0,
                translators: 0,
                reviewers: 0,
                coordinators: 0,
                languages: 0
            },
            volunteers: []
        };
    }
    
    /**
     * 获取空数据
     */
    getEmptyCountryData(countryCode) {
        return this.createSampleData(countryCode);
    }
    
    /**
     * 获取国家名称
     */
    getCountryName(code) {
        const nameMap = {
            'CN': '中国', 'US': '美国', 'JP': '日本', 'DE': '德国',
            'FR': '法国', 'GB': '英国', 'IN': '印度', 'BR': '巴西',
            'RU': '俄罗斯', 'CA': '加拿大', 'AU': '澳大利亚',
            'KR': '韩国', 'IT': '意大利', 'ES': '西班牙'
        };
        return nameMap[code] || code;
    }
    
    /**
     * 获取角色名称
     */
    getRoleName(role) {
        const roleNames = {
            'translator': '翻译员',
            'reviewer': '审校员',
            'coordinator': '协调员',
            'other': '其他'
        };
        return roleNames[role] || role;
    }
}

// 创建全局实例
const volunteerManager = new VolunteerManager();

// 全局函数（供map-loader.js调用）
window.loadCountryVolunteers = function(countryCode) {
    return volunteerManager.loadCountryVolunteers(countryCode);
};

// 辅助函数
window.createDataFile = function(countryCode) {
    alert(`请创建文件: data/volunteers/countries/${countryCode}.json\n\n可以使用上面的示例内容。`);
};

window.loadDemoData = function(countryCode) {
    console.log(`加载 ${countryCode} 的演示数据`);
    // 这里可以加载演示数据
    alert('演示数据功能待实现');
};

window.showAddVolunteerForm = function(countryCode) {
    console.log(`显示添加义工表单: ${countryCode}`);
    alert('添加义工表单待实现');
};

window.exportVolunteers = function(countryCode) {
    console.log(`导出 ${countryCode} 义工数据`);
    alert('导出功能待实现');
};

window.refreshVolunteers = function(countryCode) {
    console.log(`刷新 ${countryCode} 数据`);
    volunteerManager.loadCountryVolunteers(countryCode);
};

console.log('✅ volunteer-manager.js 加载完成');
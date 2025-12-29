// ============================================
// region-handler.js - 国家信息处理器（最终版）
// ============================================

console.log('📍 region-handler.js 加载 - 最终版');

// 清除所有旧的函数定义
delete window.showCountryInfo;
delete window.actualShowCountryInfo;

/**
 * 主函数：显示国家信息（使用真实数据）
 */
async function showCountryInfo(countryName, countryCode) {
    console.log(`🔍 showCountryInfo被调用: ${countryName} (${countryCode})`);
    
    const detailsPanel = document.getElementById('region-details');
    if (!detailsPanel) {
        console.error('找不到区域信息面板');
        return;
    }
    
    // 显示加载状态
    detailsPanel.innerHTML = `
        <div class="country-info-loading">
            <h4>${countryName}</h4>
            <div class="loading-spinner"></div>
            <p>加载真实数据中...</p>
        </div>
    `;
    
    try {
        // 1. 尝试多种方式加载真实数据
        const countryData = await loadRealCountryData(countryCode);
        console.log('✅ 加载真实数据成功:', countryData);
        
        // 2. 显示真实数据
        displayRealCountryData(countryName, countryCode, countryData, detailsPanel);
        
    } catch (error) {
        console.error('❌ 加载数据失败:', error);
        displayErrorState(countryName, countryCode, error, detailsPanel);
    }
}

/**
 * 加载真实国家数据
 */
async function loadRealCountryData(countryCode) {
    console.log(`📂 尝试加载真实数据: ${countryCode}`);
    
    // 方法1: 使用volunteer-manager
    if (window.volunteerManager && typeof window.volunteerManager.loadCountryData === 'function') {
        const data = await window.volunteerManager.loadCountryData(countryCode);
        if (data && data.country) {
            console.log('✅ 通过volunteer-manager加载成功');
            return data;
        }
    }
    
    // 方法2: 直接加载JSON文件
    console.log('直接加载JSON文件');
    const response = await fetch(`data/volunteers/countries/${countryCode.toUpperCase()}.json`);
    
    if (!response.ok) {
        throw new Error(`数据文件不存在 (HTTP ${response.status})`);
    }
    
    const data = await response.json();
    
    // 验证和补全数据
    return validateAndCompleteData(data, countryCode);
}

/**
 * 验证和补全数据
 */
function validateAndCompleteData(data, countryCode) {
    if (!data.stats) {
        data.stats = {};
    }
    
    // 确保必要字段存在
    const stats = data.stats;
    stats.total = stats.total || (data.volunteers ? data.volunteers.length : 0);
    stats.active = stats.active || stats.total;
    stats.translators = stats.translators || 0;
    stats.reviewers = stats.reviewers || 0;
    stats.coordinators = stats.coordinators || 0;
    
    // 计算语言种类
    stats.languages = calculateLanguageCount(data);
    
    return data;
}

/**
 * 计算语言种类数量
 */
function calculateLanguageCount(countryData) {
    // 如果数据中已有统计，直接使用
    if (countryData.stats.languages && countryData.stats.languages > 0) {
        return countryData.stats.languages;
    }
    
    // 从义工数据中计算
    if (countryData.volunteers && Array.isArray(countryData.volunteers)) {
        const languageSet = new Set();
        countryData.volunteers.forEach(volunteer => {
            if (volunteer.languages && Array.isArray(volunteer.languages)) {
                volunteer.languages.forEach(lang => languageSet.add(lang.trim()));
            }
        });
        return languageSet.size;
    }
    
    return 0;
}

/**
 * 显示真实数据
 */
function displayRealCountryData(countryName, countryCode, countryData, panel) {
    console.log('📊 显示真实数据:', countryData.stats);
    
    panel.innerHTML = `
        <div class="country-info">
            <div class="country-header">
                <h4>${countryData.country || countryName}</h4>
                <span class="country-code">${countryData.code || countryCode}</span>
            </div>
            
            <div class="country-stats">
                <div class="stat-item">
                    <span class="stat-label">📊 总义工数</span>
                    <span class="stat-value">${countryData.stats.total}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">✅ 活跃义工</span>
                    <span class="stat-value">${countryData.stats.active}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🌐 翻译语言</span>
                    <span class="stat-value">${countryData.stats.languages}</span>
                </div>
            </div>
            
            <div class="role-distribution">
                <div class="role-item">
                    <span class="role-label">翻译员</span>
                    <span class="role-count">${countryData.stats.translators}</span>
                </div>
                <div class="role-item">
                    <span class="role-label">审校员</span>
                    <span class="role-count">${countryData.stats.reviewers}</span>
                </div>
                <div class="role-item">
                    <span class="role-label">协调员</span>
                    <span class="role-count">${countryData.stats.coordinators}</span>
                </div>
            </div>
            
            <div class="data-source">
                <p><strong>📁 数据文件:</strong> ${countryCode}.json</p>
                <p><strong>🔄 最后更新:</strong> ${countryData.lastUpdated || '未知'}</p>
                <p><strong>👥 实际义工数:</strong> ${countryData.volunteers ? countryData.volunteers.length : 0} 人</p>
            </div>
            
            <div class="country-actions">
                <button class="btn-action" onclick="addVolunteer('${countryCode}')">
                    ➕ 添加义工
                </button>
                <button class="btn-action" onclick="viewVolunteers('${countryCode}')">
                    👥 查看列表
                </button>
                <button class="btn-action" onclick="refreshData('${countryCode}')">
                    🔄 刷新
                </button>
            </div>
        </div>
    `;
}

/**
 * 显示错误状态
 */
function displayErrorState(countryName, countryCode, error, panel) {
    console.error('显示错误状态:', error);
    
    if (error.message.includes('404') || error.message.includes('文件不存在')) {
        panel.innerHTML = `
            <div class="country-info-empty">
                <h4>${countryName}</h4>
                <p>📭 数据文件不存在</p>
                <p style="color: #666; font-size: 14px;">
                    文件路径: data/volunteers/countries/${countryCode}.json
                </p>
                <button onclick="createDataFile('${countryCode}', '${countryName}')" 
                        style="margin-top: 10px; padding: 8px 16px; background: #4a90e2; color: white; border: none; border-radius: 4px;">
                    创建数据文件
                </button>
            </div>
        `;
    } else {
        panel.innerHTML = `
            <div class="country-info-error">
                <h4>${countryName}</h4>
                <p style="color: #e74c3c;">❌ 加载失败: ${error.message}</p>
                <button onclick="showCountryInfo('${countryName}', '${countryCode}')" 
                        style="margin-top: 10px; padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px;">
                    🔄 重试
                </button>
            </div>
        `;
    }
}

/**
 * 辅助函数
 */
function addVolunteer(countryCode) {
    alert(`添加义工到 ${countryCode} - 功能待实现`);
}

function viewVolunteers(countryCode) {
    if (typeof loadCountryVolunteers === 'function') {
        loadCountryVolunteers(countryCode);
    } else {
        alert('义工列表功能加载中...');
    }
}

function refreshData(countryCode) {
    // 清除缓存
    if (window.volunteerManager && window.volunteerManager.countryCache) {
        delete window.volunteerManager.countryCache[countryCode.toUpperCase()];
    }
    location.reload();
}

function createDataFile(countryCode, countryName) {
    alert(`请创建文件: data/volunteers/countries/${countryCode}.json\n\n内容示例:\n{\n  "country": "${countryName}",\n  "code": "${countryCode}",\n  "lastUpdated": "${new Date().toISOString().split('T')[0]}",\n  "stats": {\n    "total": 0,\n    "active": 0,\n    "translators": 0,\n    "reviewers": 0,\n    "coordinators": 0,\n    "languages": 0\n  },\n  "volunteers": []\n}`);
}

// 全局导出
window.showCountryInfo = showCountryInfo;
window.loadRealCountryData = loadRealCountryData;

console.log('✅ region-handler.js 加载完成 - 单函数版本');
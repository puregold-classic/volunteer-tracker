// 地图加载器 - 防止重复初始化
console.log('🗺️ map-loader.js 加载');

// 全局地图实例引用
let mapInstance = null;

function getCountryCode(countryName) {
    const codeMap = {
        'China': 'CN', 'Turkey': 'TR', 'United States': 'US',
        'Japan': 'JP', 'Germany': 'DE', 'France': 'FR',
        'United Kingdom': 'GB', 'Italy': 'IT', 'Canada': 'CA',
        'Australia': 'AU', 'Russia': 'RU', 'India': 'IN',
        'Brazil': 'BR', 'South Korea': 'KR', 'Mexico': 'MX',
        'Indonesia': 'ID', 'Netherlands': 'NL', 'Saudi Arabia': 'SA',
        'Switzerland': 'CH', 'Argentina': 'AR', 'Sweden': 'SE',
        'Poland': 'PL', 'Belgium': 'BE', 'Thailand': 'TH',
        'Iran': 'IR', 'Austria': 'AT', 'Norway': 'NO',
        'United Arab Emirates': 'AE', 'Egypt': 'EG', 'Israel': 'IL',
        'Philippines': 'PH', 'Vietnam': 'VN', 'Denmark': 'DK',
        'Singapore': 'SG', 'Malaysia': 'MY', 'South Africa': 'ZA',
        'Colombia': 'CO', 'Finland': 'FI', 'Chile': 'CL',
        'Pakistan': 'PK', 'Ireland': 'IE', 'Portugal': 'PT',
        'Greece': 'GR', 'Iraq': 'IQ', 'Kazakhstan': 'KZ',
        'Algeria': 'DZ', 'Qatar': 'QA', 'Czech Republic': 'CZ',
        'Romania': 'RO', 'Peru': 'PE', 'New Zealand': 'NZ'
    };
    
    return codeMap[countryName] || countryName.substring(0, 2).toUpperCase();
}

// ========== 安全事件处理函数（方案4） ==========

/**
 * 安全地显示国家信息（多重回退机制）
 */
function safelyShowCountryInfo(countryName, countryCode) {
    console.log('🛡️ 安全显示国家信息:', countryName);
    
    const detailsPanel = document.getElementById('region-details');
    if (!detailsPanel) {
        console.error('找不到区域信息面板');
        return;
    }
    
    // 尝试方案1：直接调用showCountryInfo
    try {
        if (typeof showCountryInfo === 'function') {
            console.log('✅ 使用showCountryInfo函数');
            showCountryInfo(countryName, countryCode);
            return;
        }
    } catch (error) {
        console.warn('showCountryInfo调用失败:', error);
    }
    
    // 尝试方案2：检查全局命名空间
    try {
        if (window.VolunteerMap && typeof window.VolunteerMap.showCountryInfo === 'function') {
            console.log('✅ 使用VolunteerMap.showCountryInfo');
            window.VolunteerMap.showCountryInfo(countryName, countryCode);
            return;
        }
    } catch (error) {
        console.warn('VolunteerMap.showCountryInfo调用失败:', error);
    }
    
    // 尝试方案3：检查是否在window对象上
    try {
        if (window.showCountryInfo && typeof window.showCountryInfo === 'function') {
            console.log('✅ 使用window.showCountryInfo');
            window.showCountryInfo(countryName, countryCode);
            return;
        }
    } catch (error) {
        console.warn('window.showCountryInfo调用失败:', error);
    }
    
    // 方案4：显示基本回退信息
    console.log('⚠️ 使用回退信息显示');
    showFallbackCountryInfo(countryName, countryCode);
}

/**
 * 显示回退的国家信息（当主要函数不可用时）
 */
function showFallbackCountryInfo(countryName, countryCode) {
    const detailsPanel = document.getElementById('region-details');
    
    detailsPanel.innerHTML = `
        <div class="country-info-fallback">
            <div class="fallback-header">
                <h4>${countryName}</h4>
                <span class="country-code">${countryCode}</span>
            </div>
            
            <div class="fallback-stats">
                <p>📍 国家代码: <strong>${countryCode}</strong></p>
                <p>🕒 选择时间: ${new Date().toLocaleTimeString('zh-CN')}</p>
                <p>👆 这是基础信息显示</p>
            </div>
            
            <div class="fallback-notice">
                <p style="color: #e67e22; font-size: 12px;">
                    ℹ️ 详细功能加载中...<br>
                    <button onclick="checkAndLoadRegionHandler()" style="margin-top: 5px; padding: 5px 10px;">
                        检查功能状态
                    </button>
                </p>
            </div>
        </div>
    `;
}

/**
 * 安全加载义工数据
 */
function safelyLoadVolunteerData(countryCode) {
    console.log('🛡️ 安全加载义工数据:', countryCode);
    
    // 尝试多种可能的函数名
    const possibleFunctions = [
        'loadCountryVolunteers',
        'loadVolunteerData',
        'fetchVolunteers'
    ];
    
    for (const funcName of possibleFunctions) {
        try {
            if (typeof window[funcName] === 'function') {
                console.log(`✅ 调用 ${funcName}`);
                window[funcName](countryCode);
                return;
            }
        } catch (error) {
            console.warn(`${funcName}调用失败:`, error);
        }
    }
    
    console.log('ℹ️ 未找到义工数据加载函数');
}

/**
 * 检查并加载region-handler.js的功能
 */
function checkAndLoadRegionHandler() {
    console.log('🔍 检查region-handler.js状态');
    
    const checks = {
        'showCountryInfo': typeof showCountryInfo,
        'window.showCountryInfo': typeof window.showCountryInfo,
        'VolunteerMap对象': window.VolunteerMap ? '存在' : '不存在'
    };
    
    let report = '📊 当前状态:\n';
    for (const [name, status] of Object.entries(checks)) {
        report += `${name}: ${status}\n`;
    }
    
    alert(report);
    
    // 尝试重新加载
    const detailsPanel = document.getElementById('region-details');
    detailsPanel.innerHTML += `
        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <p style="font-size: 12px;">建议:</p>
            <ol style="font-size: 12px; margin: 5px 0 0 15px;">
                <li>检查region-handler.js是否加载</li>
                <li>检查控制台是否有错误</li>
                <li>按F5刷新页面</li>
            </ol>
        </div>
    `;
}
// ========== 安全事件处理函数结束 ==========

// 加载国家边界数据
async function loadCountryBorders(map) {
    console.log('🌍 加载国家边界数据...');
    
    try {
        // 尝试加载数据文件
        const response = await fetch('data/geo-json/world-countries-simple.json');
        if (!response.ok) {
            throw new Error(`数据加载失败: ${response.status}`);
        }
        
        const countries = await response.json();
        console.log(`✅ 加载了 ${countries.features.length} 个国家`);
        
        // 创建国家边界图层
        const countryLayer = L.geoJSON(countries, {
            style: {
                fillColor: '#e0f7fa',      // 填充色
                weight: 1,                  // 边界粗细
                color: '#006064',           // 边界颜色
                fillOpacity: 0.4,           // 填充透明度
                dashArray: '3'              // 虚线边框
            },
            onEachFeature: function(feature, layer) {
                // 获取国家信息
                const countryName = feature.properties.name || '未知国家';
                const countryCode = getCountryCode(countryName);
                
                // 鼠标悬停效果
                layer.on('mouseover', function(e) {
                    layer.setStyle({
                        weight: 3,
                        color: '#d32f2f',    // 悬停时变红色
                        fillOpacity: 0.7
                    });
                    
                    // 显示国家名提示
                    layer.bindTooltip(`<b>${countryName}</b><br>点击查看详情`, {
                        direction: 'top',
                        permanent: false,
                        className: 'country-tooltip'
                    }).openTooltip();
                });
                
                layer.on('mouseout', function(e) {
                    layer.setStyle({
                        weight: 1,
                        color: '#006064',
                        fillOpacity: 0.4
                    });
                    layer.closeTooltip();
                });
                
                // 点击国家（使用安全处理）
                layer.on('click', function(e) {
                    console.log('📍 国家点击:', countryName, '(', countryCode, ')');
                    
                    // 高亮选中国家
                    highlightSelectedCountry(layer);
                    
                    // 🔧 安全的显示国家信息（方案4）
                    safelyShowCountryInfo(countryName, countryCode);
                    
                    // 🔧 安全的加载义工数据
                    safelyLoadVolunteerData(countryCode);
                });
            }
        }).addTo(map);
        
        // 保存引用，方便后续操作
        window.countryLayer = countryLayer;
        console.log('✅ 国家边界图层加载完成');
        
    } catch (error) {
        console.error('❌ 加载国家边界失败:', error);
        
        // 显示错误信息
        document.getElementById('region-details').innerHTML = `
            <div class="error-message">
                <h4>⚠️ 地图数据加载失败</h4>
                <p>错误: ${error.message}</p>
                <button onclick="retryLoadCountries()">重试</button>
            </div>
        `;
    }
}

// 高亮选中国家
function highlightSelectedCountry(selectedLayer) {
    // 清除之前的高亮
    if (window.selectedCountry) {
        window.selectedCountry.setStyle({
            weight: 1,
            color: '#006064',
            fillOpacity: 0.4
        });
    }
    
    // 高亮当前选择
    selectedLayer.setStyle({
        weight: 3,
        color: '#388e3c',    // 选中时变绿色
        fillOpacity: 0.6
    });
    
    window.selectedCountry = selectedLayer;
}

function initializeMap() {
    console.log('🗺️ 初始化地图流程开始');
    
    // ... 原有的地图创建代码 ...
    const map = L.map('world-map').setView([30, 100], 3);
    
    // 添加地图图层
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 10,
        minZoom: 2
    }).addTo(map);
    
    // 保存地图实例
    window.volunteerMap = map;
    
    // 🔥 新增：加载国家边界
    loadCountryBorders(map);
    
    // 设置控制按钮
    setupMapControls(map);
    
    console.log('✅ 地图初始化完成');
    return map;
}

function setupMapControls(map) {
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const resetBtn = document.getElementById('reset-view');
    
    if (zoomInBtn) {
        zoomInBtn.onclick = () => map.zoomIn();
        console.log('✅ 放大按钮已绑定');
    }
    if (zoomOutBtn) {
        zoomOutBtn.onclick = () => map.zoomOut();
        console.log('✅ 缩小按钮已绑定');
    }
    if (resetBtn) {
        resetBtn.onclick = () => map.setView([30, 100], 3);
        console.log('✅ 复位按钮已绑定');
    }
}

// 安全初始化函数 - 确保只执行一次
function safeInitializeMap() {
    console.log('🔒 安全初始化地图');
    
    // 如果地图已存在，直接返回
    if (mapInstance || (window.volunteerMap && window.volunteerMap.getCenter)) {
        console.log('地图已存在，跳过初始化');
        return mapInstance || window.volunteerMap;
    }
    
    // 否则创建新地图
    return initializeMap();
}

// 启动逻辑 - 多种方式确保只执行一次
let initializationStarted = false;

function startMapInitialization() {
    if (initializationStarted) {
        console.log('初始化已开始，跳过重复启动');
        return;
    }
    
    initializationStarted = true;
    console.log('开始地图初始化流程');
    
    // 等待一小段时间确保一切就绪
    setTimeout(() => {
        safeInitializeMap();
    }, 100);
}

// 根据文档状态选择初始化时机
if (document.readyState === 'loading') {
    // 文档还在加载，等待DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded触发，初始化地图');
        startMapInitialization();
    });
} else {
    // 文档已加载完成，直接初始化
    console.log('文档已就绪，直接初始化地图');
    startMapInitialization();
}

// 导出函数供其他脚本使用
window.initializeVolunteerMap = safeInitializeMap;
console.log('✅ map-loader.js 加载完成');
// ========== 单地图加载器 - single-map-loader.js ==========

console.log('🗺️ 单地图加载器加载');

// ========== 地图配置 ==========

// 快速聚焦区域定义
const focusRegions = {
    china: {
        name: "中国",
        bounds: [[18, 73], [53, 135]]
    },
    taiwan: {
        name: "台湾",
        center: [23.5, 121],
        zoom: 7
    },
    hongkong: {
        name: "香港",
        center: [22.3, 114.2],
        zoom: 9
    },
    macau: {
        name: "澳门",
        center: [22.2, 113.5],
        zoom: 11
    },
    singapore: {
        name: "新加坡",
        center: [1.35, 103.8],
        zoom: 10
    },
    usa: {
        name: "美国",
        center: [40, -100],
        zoom: 4
    },
    europe: {
        name: "欧洲",
        bounds: [[35, -10], [60, 30]]
    },
    global: {
        name: "全球",
        center: [30, 0],
        zoom: 2
    }
};

// 全局地图实例
let mapInstance = null;

// ========== 核心功能 ==========

/**
 * 初始化地图
 */
function initializeSingleMap() {
    console.log('🗺️ 初始化单地图');
    
    // 检查地图容器
    if (!document.getElementById('world-map')) {
        console.error('❌ 找不到地图容器 #world-map');
        return null;
    }
    
    // 创建地图（默认显示全球）
    const map = L.map('world-map', {
        center: [30, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true, // 启用Leaflet自带的缩放控件
        zoomControlOptions: {
            position: 'topright' // 放在右上角
        }
    });
    
    // 添加底图
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 10,
        minZoom: 2
    }).addTo(map);
    
    // 保存实例
    mapInstance = map;
    window.volunteerMap = map;
    
    // 加载国家边界（使用原函数）
    loadCountryBorders(map);
    
    // 移除自定义的控制按钮设置
    // setupMapControls(map); // 注释掉这行
    
    // 添加重置视图功能到缩放控件
    addResetToGlobalView();
    
    console.log('✅ 单地图初始化完成');
    return map;
}

/**
 * 添加重置到全球视图的功能
 */
function addResetToGlobalView() {
    // 创建一个自定义的"重置"按钮
    const resetControl = L.Control.extend({
        options: {
            position: 'topright'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            container.style.marginTop = '80px'; // 放在缩放控件下方
            container.style.backgroundColor = 'white';
            container.style.borderRadius = '4px';
            container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
            
            const button = L.DomUtil.create('a', '', container);
            button.href = '#';
            button.title = '重置到全球视图';
            button.innerHTML = '🌍';
            button.style.width = '30px';
            button.style.height = '30px';
            button.style.lineHeight = '30px';
            button.style.textAlign = 'center';
            button.style.display = 'block';
            button.style.fontSize = '16px';
            button.style.color = '#333';
            
            L.DomEvent.on(button, 'click', function(e) {
                L.DomEvent.stopPropagation(e);
                L.DomEvent.preventDefault(e);
                
                if (mapInstance) {
                    mapInstance.setView([30, 0], 2);
                    console.log('🗺️ 重置到全球视图');
                    
                    // 重置面板标题
                    updatePanelTitle('global');
                    
                    // 显示全球义工数据
                    if (window.dataPanel && typeof window.dataPanel.showCountryDetails === 'function') {
                        window.dataPanel.showCountryDetails('Global', 'GL');
                    }
                }
            });
            
            return container;
        }
    });
    
    if (mapInstance) {
        new resetControl().addTo(mapInstance);
    }
}

/**
 * 更新面板标题
 */
function updatePanelTitle(region) {
    const panelTitle = document.getElementById('panel-title');
    if (panelTitle) {
        if (region === 'global') {
            panelTitle.textContent = '🌍 全球义工统计';
        } else {
            const config = focusRegions[region];
            if (config) {
                panelTitle.textContent = `📍 ${config.name} - 义工统计`;
            }
        }
    }
}

/**
 * 聚焦到指定区域
 */
function focusOnRegion(region) {
    if (!mapInstance || !focusRegions[region]) {
        console.error('无法聚焦: 地图未初始化或区域不存在');
        return;
    }
    
    const config = focusRegions[region];
    console.log(`📍 聚焦到${config.name}`);
    
    if (config.bounds) {
        mapInstance.fitBounds(config.bounds);
    } else if (config.center) {
        mapInstance.setView(config.center, config.zoom || 5);
    }
    
    // 更新面板标题
    updatePanelTitle(region);
    
    // 如果是全球视图，显示全球统计数据
    if (region === 'global' && window.dataPanel && typeof window.dataPanel.showCountryDetails === 'function') {
        window.dataPanel.showCountryDetails('Global', 'GL');
    }
}

// ========== 从原文件移植的必要函数 ==========

function getCountryCode(countryName) {
    const codeMap = {
        'China': 'CN', 'United States': 'US', 'Japan': 'JP',
        'Germany': 'DE', 'France': 'FR', 'United Kingdom': 'GB',
        'Italy': 'IT', 'Canada': 'CA', 'Australia': 'AU',
        'Russia': 'RU', 'India': 'IN', 'Brazil': 'BR',
        'South Korea': 'KR', 'Singapore': 'SG', 'Taiwan': 'TW'
    };
    
    return codeMap[countryName] || countryName.substring(0, 2).toUpperCase();
}

async function loadCountryBorders(map) {
    console.log('🌍 加载国家边界数据...');
    
    try {
        const response = await fetch('data/geo-json/world-countries-simple.json');
        if (!response.ok) throw new Error(`数据加载失败: ${response.status}`);
        
        const countries = await response.json();
        console.log(`✅ 加载了 ${countries.features.length} 个国家`);
        
        const countryLayer = L.geoJSON(countries, {
            style: {
                fillColor: '#e0f7fa',
                weight: 1,
                color: '#006064',
                fillOpacity: 0.4
            },
            onEachFeature: function(feature, layer) {
                const countryName = feature.properties.name || '未知国家';
                const countryCode = getCountryCode(countryName);
                
                // 鼠标悬停效果
                layer.on('mouseover', function(e) {
                    layer.setStyle({
                        weight: 3,
                        color: '#d32f2f',
                        fillOpacity: 0.7
                    });
                    
                    layer.bindTooltip(`<b>${countryName}</b><br>点击查看详情`, {
                        permanent: false
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
                
                // 点击国家
                layer.on('click', function(e) {
                    console.log('📍 国家点击:', countryName);
                    
                    // 高亮选中国家
                    highlightSelectedCountry(layer);
                    
                    // 显示国家详情（使用现有的dataPanel功能）
                    if (window.dataPanel && typeof window.dataPanel.showCountryDetails === 'function') {
                        window.dataPanel.showCountryDetails(countryName, countryCode);
                    }
                });
            }
        }).addTo(map);
        
        window.countryLayer = countryLayer;
        
    } catch (error) {
        console.error('❌ 加载国家边界失败:', error);
    }
}

function highlightSelectedCountry(selectedLayer) {
    if (window.selectedCountry) {
        window.selectedCountry.setStyle({
            weight: 1,
            color: '#006064',
            fillOpacity: 0.4
        });
    }
    
    selectedLayer.setStyle({
        weight: 3,
        color: '#388e3c',
        fillOpacity: 0.6
    });
    
    window.selectedCountry = selectedLayer;
}

// ========== 初始化逻辑 ==========

function startMapInitialization() {
    console.log('开始地图初始化流程');
    
    setTimeout(() => {
        initializeSingleMap();
        
        // 导出全局函数
        window.focusOnRegion = focusOnRegion;
        window.initializeVolunteerMap = initializeSingleMap;
        
        console.log('✅ 单地图系统准备就绪');
    }, 100);
}

// 启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMapInitialization);
} else {
    startMapInitialization();
}

console.log('✅ 单地图加载器加载完成');
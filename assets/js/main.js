// 主入口文件
console.log('main.js 加载成功 - 纯金经典翻译计划义工追踪系统');

// 页面加载完成后的初始化
window.onload = function() {
    console.log('页面完全加载完成');
    
    // 更新最后更新日期
    document.getElementById('last-updated').textContent = 
        new Date().toLocaleDateString('zh-CN');
    
    // 设置全局统计信息（示例数据）
    document.getElementById('global-stats').innerHTML = `
        <div class="stats-grid">
            <div class="stat-item">
                <span class="stat-number">0</span>
                <span class="stat-label">总义工数</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">0</span>
                <span class="stat-label">国家/地区</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">0</span>
                <span class="stat-label">翻译项目</span>
            </div>
        </div>
    `;
    
    console.log('✅ 系统初始化完成');
};

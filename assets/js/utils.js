// 工具函数
console.log('utils.js 加载成功');

// 格式化日期
function formatDate(date) {
    return new Date(date).toLocaleDateString('zh-CN');
}

// 显示消息
function showMessage(text, type = 'info') {
    console.log(`${type}: ${text}`);
}

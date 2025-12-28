// assets/js/data-manager.js
class DataManager {
    constructor() {
        this.baseUrl = 'data/volunteers';
    }
    
    // 加载国家数据
    async loadCountryData(countryCode) {
        try {
            const response = await fetch(`${this.baseUrl}/countries/${countryCode.toUpperCase()}.json`);
            
            if (!response.ok) {
                // 如果文件不存在，返回空模板
                return this.getEmptyCountryData(countryCode);
            }
            
            const data = await response.json();
            console.log(`✅ 加载 ${data.country} 数据成功`);
            return data;
            
        } catch (error) {
            console.error(`❌ 加载 ${countryCode} 数据失败:`, error);
            return this.getEmptyCountryData(countryCode);
        }
    }
    
    // 获取空数据模板
    getEmptyCountryData(countryCode) {
        const countryNames = {
            'CN': '中国', 'US': '美国', 'JP': '日本', 
            'DE': '德国', 'FR': '法国', 'GB': '英国',
            'IN': '印度', 'BR': '巴西', 'RU': '俄罗斯'
        };
        
        return {
            country: countryNames[countryCode] || countryCode,
            code: countryCode,
            lastUpdated: new Date().toISOString().split('T')[0],
            stats: { total: 0, active: 0, translators: 0, reviewers: 0, coordinators: 0, languages: 0 },
            volunteers: []
        };
    }
    
    // 添加新义工
    async addVolunteer(countryCode, volunteerData) {
        const countryData = await this.loadCountryData(countryCode);
        
        // 生成ID
        const newId = `${countryCode}${String(countryData.volunteers.length + 1).padStart(3, '0')}`;
        
        const newVolunteer = {
            id: newId,
            name: volunteerData.name,
            role: volunteerData.role || 'translator',
            languages: volunteerData.languages || [],
            location: volunteerData.location || '',
            joinedDate: new Date().toISOString().split('T')[0],
            status: 'active',
            completedTasks: 0,
            ...volunteerData
        };
        
        // 添加到列表
        countryData.volunteers.push(newVolunteer);
        
        // 更新统计
        countryData.stats.total++;
        countryData.stats.active++;
        countryData.lastUpdated = new Date().toISOString().split('T')[0];
        
        console.log(`✅ 添加义工 ${newId} 到 ${countryCode}`);
        return newVolunteer;
    }
    
    // 搜索义工
    searchVolunteers(query, countryCode = null) {
        // 实现搜索逻辑
        console.log(`搜索: ${query}`, countryCode ? `在 ${countryCode}` : '全球');
    }
}

// 创建全局实例
window.volunteerDataManager = new DataManager();
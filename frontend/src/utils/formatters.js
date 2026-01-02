// 数据格式化工具

export const formatVolunteerName = (volunteer) => {
  if (volunteer.englishName && volunteer.chineseName) {
    return `${volunteer.chineseName} (${volunteer.englishName})`
  }
  return volunteer.englishName || volunteer.chineseName || '未知'
}

export const formatServiceTypes = (services) => {
  const serviceMap = {
    'translation': '翻译',
    'proofreading': '校对',
    'management': '管理',
    'technical': '技术',
    'other': '其他'
  }
  
  return services
    .map(service => serviceMap[service] || service)
    .join('、')
}

export const formatStatus = (status) => {
  const statusMap = {
    'active': { text: '在职', color: 'success' },
    'inactive': { text: '非在职', color: 'warning' },
    'pending': { text: '待审核', color: 'info' }
  }
  
  return statusMap[status] || { text: '未知', color: 'secondary' }
}

export const formatRegionName = (regionId) => {
  const regionMap = {
    'mainland-china': '中国大陆',
    'taiwan': '中国台湾',
    'southeast-asia': '东南亚',
    'usa': '美国',
    'europe': '欧洲'
  }
  
  return regionMap[regionId] || regionId
}

export const formatHoursAndCount = (hours, count) => {
  return `${formatHours(hours)} / ${count}次`
}

export const formatCoordinates = (lat, lng) => {
  const format = (coord) => {
    const absCoord = Math.abs(coord)
    const degrees = Math.floor(absCoord)
    const minutes = Math.floor((absCoord - degrees) * 60)
    const seconds = ((absCoord - degrees) * 3600 % 60).toFixed(1)
    const direction = coord >= 0 ? 'N' : 'S'
    return `${degrees}°${minutes}'${seconds}"${direction}`
  }
  
  return `${format(lat)}, ${format(lng)}`
}

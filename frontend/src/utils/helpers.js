// 工具函数集合

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  return new Intl.NumberFormat().format(num)
}

export const formatHours = (hours) => {
  if (!hours) return '0小时'
  return `${hours.toFixed(1)}小时`
}

export const formatDate = (dateString, format = 'yyyy-MM-dd') => {
  if (!dateString) return ''
  const date = new Date(dateString)
  
  const formats = {
    'yyyy-MM-dd': () => date.toISOString().split('T')[0],
    'MM/dd/yyyy': () => date.toLocaleDateString('en-US'),
    'dd/MM/yyyy': () => date.toLocaleDateString('en-GB'),
    'relative': () => getRelativeTime(date)
  }
  
  return formats[format] ? formats[format]() : formats['yyyy-MM-dd']()
}

export const getRelativeTime = (date) => {
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 30) return `${diffDays}天前`
  return formatDate(date, 'yyyy-MM-dd')
}

export const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export const throttle = (func, limit) => {
  let inThrottle
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export const validatePhone = (phone) => {
  const re = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/
  return re.test(phone)
}

export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj))
}

export const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const groupKey = item[key]
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {})
}

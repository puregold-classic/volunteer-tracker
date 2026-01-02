// 项目常量定义

export const MAP_CONSTANTS = {
  DEFAULT_CENTER: [20, 0],
  DEFAULT_ZOOM: 2,
  REGION_ZOOM: {
    'china': 4,
    'europe': 4,
    'usa': 4,
    'southeast-asia': 5
  },
  REGION_CENTER: {
    'china': [35, 105],
    'europe': [50, 10],
    'usa': [40, -100],
    'southeast-asia': [10, 105]
  }
}

export const VOLUNTEER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending'
}

export const SERVICE_TYPES = {
  TRANSLATION: 'translation',
  PROOFREADING: 'proofreading',
  MANAGEMENT: 'management',
  TECHNICAL: 'technical',
  OTHER: 'other'
}

export const REGIONS = {
  MAINLAND_CHINA: 'mainland-china',
  TAIWAN: 'taiwan',
  SOUTHEAST_ASIA: 'southeast-asia',
  USA: 'usa',
  EUROPE: 'europe'
}

export const LOCAL_STORAGE_KEYS = {
  MAP_SETTINGS: 'volunteer-map-settings',
  FILTERS: 'volunteer-filters',
  THEME: 'volunteer-theme'
}

export const API_ENDPOINTS = {
  VOLUNTEERS: '/api/volunteers',
  REGIONS: '/api/regions',
  STATS: '/api/stats'
}

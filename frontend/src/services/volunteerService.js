// 志愿者数据服务
import { volunteerAPI } from './api'

const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

class VolunteerService {
  constructor() {
    this.cache = new Map()
    this.cacheTimestamps = new Map()
  }

  async getAllVolunteers(forceRefresh = false) {
    const cacheKey = 'all-volunteers'
    
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const data = await volunteerAPI.getAll()
      this.setCache(cacheKey, data)
      return data
    } catch (error) {
      console.error('Error fetching volunteers:', error)
      throw error
    }
  }

  async getVolunteersByRegion(regionId) {
    const cacheKey = `region-${regionId}`
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const allVolunteers = await this.getAllVolunteers()
      const regionVolunteers = allVolunteers.filter(
        volunteer => volunteer.region === regionId
      )
      this.setCache(cacheKey, regionVolunteers)
      return regionVolunteers
    } catch (error) {
      console.error(`Error fetching volunteers for region ${regionId}:`, error)
      throw error
    }
  }

  filterVolunteers(volunteers, filters) {
    return volunteers.filter(volunteer => {
      if (filters.status && volunteer.status !== filters.status) return false
      if (filters.services && !this.hasService(volunteer, filters.services)) return false
      if (filters.region && volunteer.region !== filters.region) return false
      if (filters.searchTerm && !this.matchesSearch(volunteer, filters.searchTerm)) return false
      return true
    })
  }

  hasService(volunteer, requiredServices) {
    return requiredServices.every(service => 
      volunteer.services.includes(service)
    )
  }

  matchesSearch(volunteer, searchTerm) {
    const term = searchTerm.toLowerCase()
    return (
      volunteer.name.toLowerCase().includes(term) ||
      volunteer.email.toLowerCase().includes(term) ||
      volunteer.id.toLowerCase().includes(term)
    )
  }

  isCacheValid(key) {
    const timestamp = this.cacheTimestamps.get(key)
    if (!timestamp) return false
    return Date.now() - timestamp < CACHE_DURATION
  }

  setCache(key, data) {
    this.cache.set(key, data)
    this.cacheTimestamps.set(key, Date.now())
  }

  clearCache() {
    this.cache.clear()
    this.cacheTimestamps.clear()
  }
}

export default new VolunteerService()

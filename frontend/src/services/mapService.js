// 地图相关服务
export const loadGeoJSON = async (type) => {
  try {
    const response = await fetch(`/geo-data/${type}.json`)
    if (!response.ok) throw new Error('Failed to load GeoJSON')
    return await response.json()
  } catch (error) {
    console.error('Error loading GeoJSON:', error)
    return null
  }
}

export const getRegionCenter = (geoJSON) => {
  if (!geoJSON || !geoJSON.bbox) return [0, 0]
  const [minLon, minLat, maxLon, maxLat] = geoJSON.bbox
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2]
}

export const calculateRegionStats = (volunteers) => {
  const stats = {
    total: volunteers.length,
    active: volunteers.filter(v => v.status === 'active').length,
    inactive: volunteers.filter(v => v.status === 'inactive').length,
    totalHours: volunteers.reduce((sum, v) => sum + (v.totalHours || 0), 0)
  }
  return stats
}

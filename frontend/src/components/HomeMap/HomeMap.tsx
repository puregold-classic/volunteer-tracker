import React, { useEffect } from 'react';
import { GeoJSON, MapContainer, Rectangle, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, PathOptions } from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import 'leaflet/dist/leaflet.css';
import './HomeMap.scss';

interface HomeMapProps {
  activeProvince: string;
  focusRegion: string;
  onProvinceSelect: (province: string) => void;
  onReset: () => void;
}

type ProvinceFeature = Feature<Geometry, { name?: string; adcode?: string | number }>;
type ProvinceCollection = FeatureCollection<Geometry, { name?: string; adcode?: string | number }>;
const PROVINCE_PALETTE = ['#dbeafe', '#bfdbfe', '#c7d2fe', '#ddd6fe', '#bae6fd', '#cffafe', '#e0e7ff'];

const CHINA_BOUNDS: LatLngBoundsExpression = [
  [17.5, 73.0],
  [54.0, 136.0]
];
const CHINA_CENTER: [number, number] = [35.5, 104.5];
const CHINA_GEOJSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const REGION_VIEW: Record<
  string,
  { center: [number, number]; zoom: number; bounds?: LatLngBoundsExpression; label?: string; borderColor?: string }
> = {
  中国大陆: { center: [35.5, 104.5], zoom: 4, bounds: CHINA_BOUNDS, label: '中国大陆', borderColor: '#2563eb' },
  中国台湾: {
    center: [23.8, 121.0],
    zoom: 7,
    bounds: [
      [21.7, 119.8],
      [25.6, 122.3]
    ],
    label: '中国台湾',
    borderColor: '#0f766e'
  },
  东南亚: {
    center: [10.5, 106.0],
    zoom: 5,
    bounds: [
      [-11.0, 94.0],
      [24.5, 141.0]
    ],
    label: '东南亚',
    borderColor: '#7c3aed'
  },
  美国: {
    center: [39.0, -98.0],
    zoom: 4,
    bounds: [
      [24.0, -125.0],
      [49.5, -66.5]
    ],
    label: '美国',
    borderColor: '#b45309'
  },
  欧洲: {
    center: [52.0, 14.0],
    zoom: 5,
    bounds: [
      [35.0, -10.0],
      [71.0, 40.0]
    ],
    label: '欧洲',
    borderColor: '#be123c'
  }
};

const FitChinaBounds: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(CHINA_BOUNDS, { padding: [6, 6] });
  }, [map]);
  return null;
};

const FocusRegion: React.FC<{ focusRegion: string }> = ({ focusRegion }) => {
  const map = useMap();

  useEffect(() => {
    if (!focusRegion || focusRegion === '重置世界视图') {
      map.fitBounds(CHINA_BOUNDS, { padding: [6, 6] });
      return;
    }
    const view = REGION_VIEW[focusRegion];
    if (view) {
      map.flyTo(view.center, view.zoom, { duration: 0.6 });
    }
  }, [map, focusRegion]);

  return null;
};

const FocusBorder: React.FC<{ focusRegion: string }> = ({ focusRegion }) => {
  if (!focusRegion || focusRegion === '重置世界视图' || focusRegion === '中国大陆') return null;
  const view = REGION_VIEW[focusRegion];
  if (!view?.bounds) return null;

  const pathOptions: PathOptions = {
    color: view.borderColor || '#2563eb',
    weight: 2.5,
    dashArray: '8 6',
    fillOpacity: 0.04
  };

  return (
    <Rectangle bounds={view.bounds} pathOptions={pathOptions}>
      {view.label && <Tooltip permanent direction="center" className="home-map__region-label">{view.label}</Tooltip>}
    </Rectangle>
  );
};

const HomeMap: React.FC<HomeMapProps> = ({ activeProvince, focusRegion, onProvinceSelect, onReset }) => {
  const [geoData, setGeoData] = React.useState<ProvinceCollection | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [hoveredProvince, setHoveredProvince] = React.useState('');

  React.useEffect(() => {
    let canceled = false;
    const loadGeo = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(CHINA_GEOJSON_URL);
        if (!res.ok) throw new Error(`GeoJSON加载失败(${res.status})`);
        const data = (await res.json()) as ProvinceCollection;
        if (!canceled) setGeoData(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : '地图数据加载失败';
        if (!canceled) setError(message);
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    void loadGeo();
    return () => {
      canceled = true;
    };
  }, []);

  const getProvinceColor = (name: string) => {
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return PROVINCE_PALETTE[hash % PROVINCE_PALETTE.length];
  };

  const style = (feature?: ProvinceFeature) => {
    const name = feature?.properties?.name || '';
    const isActive = name === activeProvince;
    const isHovered = name === hoveredProvince;

    if (isActive) {
      return {
        color: '#1e3a8a',
        weight: 3,
        fillColor: '#60a5fa',
        fillOpacity: 0.86
      };
    }

    if (isHovered) {
      return {
        color: '#2563eb',
        weight: 2.2,
        fillColor: '#93c5fd',
        fillOpacity: 0.82
      };
    }

    return {
      color: '#334155',
      weight: 1.35,
      fillColor: getProvinceColor(name),
      fillOpacity: 0.72
    };
  };

  return (
    <div className="home-map">
      {loading && <div className="home-map__state">地图加载中...</div>}
      {error && <div className="home-map__state home-map__state--error">{error}</div>}

      {!loading && !error && (
        <MapContainer
          className="home-map__leaflet"
          center={CHINA_CENTER}
          zoom={4}
          minZoom={2}
          maxZoom={8}
          zoomControl
          scrollWheelZoom
        >
          <FitChinaBounds />
          <FocusRegion focusRegion={focusRegion} />
          <FocusBorder focusRegion={focusRegion} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {geoData && (
            <GeoJSON
              data={geoData}
              style={style}
              onEachFeature={(feature, layer) => {
                const name = feature.properties?.name || '';
                layer.on({
                  mouseover: () => {
                    setHoveredProvince(name);
                  },
                  mouseout: () => {
                    setHoveredProvince((current) => (current === name ? '' : current));
                  },
                  click: () => {
                    if (name) onProvinceSelect(name);
                  }
                });
                layer.bindTooltip(name || '未知省份', {
                  permanent: true,
                  direction: 'center',
                  className: 'home-map__province-label'
                });
              }}
            />
          )}
        </MapContainer>
      )}

      <div className="home-map__toolbar">
        <span>当前省份: {activeProvince || '未选择'}</span>
        <button type="button" onClick={onReset}>清除省份</button>
      </div>
    </div>
  );
};

export default HomeMap;

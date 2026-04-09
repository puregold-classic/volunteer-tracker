// frontend/src/components/HomeMap/HomeMap.tsx — chunk 6 phase C.6
//
// Changes (user feedback):
// - Province tooltips: permanent → hover-only (was overlapping each other)
// - New top toolbar overlay: region tabs + hot province chips
//   ("地理筛选搬到地图侧"，节省右侧 rail 空间)
// - Focus panel popover removed (the crosshair button); the new top toolbar
//   covers the same use case more directly
// - Bottom toolbar shows current selection + a "重置" link
// - Map controls (zoom in/out + refresh) stay in the top-right corner

import React, { useEffect } from 'react';
import { RefreshCw, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { GeoJSON, MapContainer, Rectangle, TileLayer, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, PathOptions } from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';

export interface HotLocation {
  label: string;
  type: 'province' | 'region';
  value: string;
}

interface HomeMapProps {
  activeProvince: string[];
  activeRegions: string[];
  quickFocusOptions: string[];
  hotLocations: readonly HotLocation[];
  focusRegion: string;
  onProvinceSelect: (province: string) => void;
  onReset: () => void;
  onQuickFocusSelect: (region: string) => void;
  onRefresh: () => void;
  isLocationActive: (type: 'province' | 'region', value: string) => boolean;
}

type ProvinceProperties = {
  name?: string;
  fullname?: string;
  NAME?: string;
  NAME_CHN?: string;
  adcode?: string | number;
};
type ProvinceFeature = Feature<Geometry, ProvinceProperties>;
type ProvinceCollection = FeatureCollection<Geometry, ProvinceProperties>;
const PROVINCE_PALETTE = ['#dbeafe', '#bfdbfe', '#c7d2fe', '#ddd6fe', '#bae6fd', '#cffafe', '#e0e7ff'];

const CHINA_BOUNDS: LatLngBoundsExpression = [
  [17.5, 73.0],
  [54.0, 136.0]
];
const CHINA_CENTER: [number, number] = [35.5, 104.5];
const CHINA_GEOJSON_URL = '/china-100000.json';
const REGION_VIEW: Record<
  string,
  { center: [number, number]; zoom: number; bounds?: LatLngBoundsExpression; label?: string; borderColor?: string }
> = {
  中国大陆: { center: [35.5, 104.5], zoom: 4, bounds: CHINA_BOUNDS, label: '中国大陆', borderColor: '#a6610b' },
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
    if (view?.bounds) {
      map.fitBounds(view.bounds, { padding: [16, 16] });
      return;
    }
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
    color: view.borderColor || '#a6610b',
    weight: 2.5,
    dashArray: '8 6',
    fillOpacity: 0.04
  };

  return <Rectangle bounds={view.bounds} pathOptions={pathOptions} />;
};

// ─── Top toolbar overlay: region tabs + hot provinces ───────────────────────

const MapTopToolbar: React.FC<{
  quickFocusOptions: string[];
  hotLocations: readonly HotLocation[];
  isLocationActive: (type: 'province' | 'region', value: string) => boolean;
  onRegionSelect: (region: string) => void;
  onProvinceSelect: (province: string) => void;
  onReset: () => void;
}> = ({ quickFocusOptions, hotLocations, isLocationActive, onRegionSelect, onProvinceSelect, onReset }) => {
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

  return (
    <div
      className="absolute left-3 right-3 top-3 z-[400] rounded-xl border border-border bg-card/95 px-2.5 py-2 shadow-md backdrop-blur"
      onClick={stop}
      onMouseDown={stop}
      onMouseUp={stop}
      onWheel={stop}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
        {/* Region tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {quickFocusOptions.map((region) => {
            const active = isLocationActive('region', region);
            return (
              <button
                key={region}
                type="button"
                onClick={(e) => { stop(e); onRegionSelect(region); }}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {region.replace('中国', '')}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <span className="hidden h-4 w-px bg-border md:inline-block" />

        {/* Hot provinces */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
            热门
          </span>
          {hotLocations.map((h) => {
            const active = isLocationActive(h.type, h.value);
            return (
              <button
                key={h.label}
                type="button"
                onClick={(e) => {
                  stop(e);
                  if (h.type === 'province') onProvinceSelect(h.value);
                  else onRegionSelect(h.value);
                }}
                className={cn(
                  'rounded-md px-2 py-1 font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {h.label}
              </button>
            );
          })}
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={(e) => { stop(e); onReset(); }}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="重置选择"
          title="重置地理筛选"
        >
          <RotateCcw className="h-3 w-3" />
          重置
        </button>
      </div>
    </div>
  );
};

// ─── Right-side zoom/refresh stack ──────────────────────────────────────────

const MapZoomControls: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const map = useMap();
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
  return (
    <div className="home-map__controls" onClick={stop} onMouseDown={stop}>
      <button type="button" onClick={(e) => { stop(e); map.zoomIn(); }} aria-label="放大">
        <ZoomIn className="h-4 w-4" />
      </button>
      <button type="button" onClick={(e) => { stop(e); map.zoomOut(); }} aria-label="缩小">
        <ZoomOut className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={(e) => { stop(e); map.fitBounds(CHINA_BOUNDS, { padding: [6, 6] }); onRefresh(); }}
        aria-label="刷新"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
    </div>
  );
};

// ─── Main map ───────────────────────────────────────────────────────────────

const HomeMap: React.FC<HomeMapProps> = ({
  activeProvince,
  activeRegions: _activeRegions,
  quickFocusOptions,
  hotLocations,
  focusRegion,
  onProvinceSelect,
  onReset,
  onQuickFocusSelect,
  onRefresh,
  isLocationActive,
}) => {
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
    return () => { canceled = true; };
  }, []);

  const getProvinceColor = (name: string) => {
    const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return PROVINCE_PALETTE[hash % PROVINCE_PALETTE.length];
  };

  const getFeatureName = (feature?: ProvinceFeature): string => {
    const props = feature?.properties;
    if (!props) return '';
    return String(
      props.name ||
      props.fullname ||
      props.NAME_CHN ||
      props.NAME ||
      ''
    ).trim();
  };

  const style = (feature?: ProvinceFeature) => {
    const name = getFeatureName(feature);
    const isActive = activeProvince.includes(name);
    const isHovered = name === hoveredProvince;

    if (isActive) {
      return { color: '#7a4a06', weight: 3, fillColor: '#e8a153', fillOpacity: 0.86 };
    }
    if (isHovered) {
      return { color: '#a6610b', weight: 2.2, fillColor: '#f0c389', fillOpacity: 0.82 };
    }
    return {
      color: '#334155',
      weight: 1.0,
      fillColor: getProvinceColor(name),
      fillOpacity: 0.55,
    };
  };

  const geoJsonRenderKey = `${activeProvince.join('|')}__${hoveredProvince}`;

  const selectionLabel = activeProvince.length > 0
    ? `当前省份: ${activeProvince.join(' / ')}`
    : focusRegion
      ? `当前区域: ${focusRegion}`
      : '';

  return (
    <div className="home-map">
      {loading && <div className="home-map__state">地图加载中…</div>}
      {error && <div className="home-map__state home-map__state--error">{error}</div>}

      {!loading && !error && (
        <MapContainer
          className="home-map__leaflet"
          center={CHINA_CENTER}
          zoom={4}
          minZoom={2}
          maxZoom={8}
          zoomControl={false}
          scrollWheelZoom
        >
          <FitChinaBounds />
          <FocusRegion focusRegion={focusRegion} />
          <FocusBorder focusRegion={focusRegion} />
          <MapZoomControls onRefresh={onRefresh} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {geoData && (
            <GeoJSON
              key={geoJsonRenderKey}
              data={geoData}
              style={style}
              onEachFeature={(feature, layer) => {
                const name = getFeatureName(feature as ProvinceFeature);
                if (!name) return;
                layer.on({
                  mouseover: () => setHoveredProvince(name),
                  mouseout: () => setHoveredProvince((current) => (current === name ? '' : current)),
                  click: () => {
                    if (REGION_VIEW[name]) return;
                    onProvinceSelect(name);
                  },
                });
                // Tooltip is hover-only (permanent: false) — fixes the
                // overlapping label issue from previous design
                layer.bindTooltip(name, {
                  permanent: false,
                  direction: 'top',
                  className: 'home-map__province-label',
                  sticky: true,
                });
              }}
            />
          )}
        </MapContainer>
      )}

      {/* Top toolbar overlay (region + hot provinces + reset) */}
      {!loading && !error && (
        <MapTopToolbar
          quickFocusOptions={quickFocusOptions}
          hotLocations={hotLocations}
          isLocationActive={isLocationActive}
          onRegionSelect={onQuickFocusSelect}
          onProvinceSelect={onProvinceSelect}
          onReset={onReset}
        />
      )}

      {/* Bottom selection display */}
      {selectionLabel && (
        <div className="home-map__toolbar">{selectionLabel}</div>
      )}
    </div>
  );
};

export default HomeMap;

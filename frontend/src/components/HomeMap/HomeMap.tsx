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

import React, { useEffect, useState } from 'react';
import { Crosshair, MapPin, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { GeoJSON, MapContainer, Rectangle, TileLayer, useMap } from 'react-leaflet';
import type L from 'leaflet';
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

// Sync zoom level to data-zoom on .home-map for CSS-driven label visibility
const ZoomTracker: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer().closest('.home-map');
    if (!container) return;
    const update = () => container.setAttribute('data-zoom', String(Math.round(map.getZoom())));
    update();
    map.on('zoomend', update);
    return () => { map.off('zoomend', update); };
  }, [map]);
  return null;
};

// Bounding-box area tiers — controls when labels hide on zoom-out
//   lg (>80): 新疆、内蒙古、西藏  — visible from zoom 2+
//   md (>25): 四川、青海、黑龙江、云南、甘肃…  — visible from zoom 3+
//   sm (>5):  浙江、福建、江苏、山西…  — visible from zoom 4+ (default)
//   ≤5:       京津沪港澳  — hover only
const TIER_LG = 80;
const TIER_MD = 25;
const TIER_SM = 5;

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

// ─── Left-side collapsible popovers — phase C.8 ─────────────────────────────
// Two icon buttons stacked top-left of the map. Click to expand a small
// popover with chips. Default state: collapsed (just icons), so the map
// gets the full visible area.

const stopAll = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };

const PopoverPanel: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, onClose, children }) => (
  <div
    className="absolute left-14 top-0 z-[401] w-[19rem] rounded-lg border border-border bg-card/95 p-2 shadow-lg backdrop-blur-sm"
    onClick={stopAll}
    onMouseDown={stopAll}
    onMouseUp={stopAll}
    onWheel={stopAll}
  >
    <div className="mb-1.5 flex items-center justify-between px-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
      <button
        type="button"
        onClick={(e) => { stopAll(e); onClose(); }}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="收起"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
    <div className="flex flex-wrap gap-1">{children}</div>
  </div>
);

const MapLeftControls: React.FC<{
  quickFocusOptions: string[];
  hotLocations: readonly HotLocation[];
  isLocationActive: (type: 'province' | 'region', value: string) => boolean;
  onRegionSelect: (region: string) => void;
  onProvinceSelect: (province: string) => void;
  onReset: () => void;
  onRefresh: () => void;
}> = ({ quickFocusOptions, hotLocations, isLocationActive, onRegionSelect, onProvinceSelect, onReset, onRefresh }) => {
  const [open, setOpen] = useState<null | 'region' | 'province'>(null);

  const togglePanel = (panel: 'region' | 'province') => (e: React.MouseEvent) => {
    stopAll(e);
    setOpen((prev) => (prev === panel ? null : panel));
  };

  const closeAll = () => setOpen(null);

  // active counts for badge
  const activeRegionCount = quickFocusOptions.filter((r) => isLocationActive('region', r)).length;
  const activeProvinceCount = hotLocations.filter((h) => isLocationActive(h.type, h.value)).length;

  return (
    <div
      className="absolute left-3 top-3 z-[400]"
      onClick={stopAll}
      onMouseDown={stopAll}
      onWheel={stopAll}
    >
      <div className="relative flex flex-col gap-1.5 rounded-xl border border-border bg-card/95 p-1.5 shadow-md backdrop-blur">
        {/* 快速聚焦 (region) trigger */}
        <button
          type="button"
          onClick={togglePanel('region')}
          className={cn(
            'relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            open === 'region' || activeRegionCount > 0
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label="快速聚焦区域"
          title="快速聚焦"
        >
          <Crosshair className="h-4 w-4" />
          {activeRegionCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>

        {/* 热门省份 trigger */}
        <button
          type="button"
          onClick={togglePanel('province')}
          className={cn(
            'relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            open === 'province' || activeProvinceCount > 0
              ? 'bg-accent/10 text-accent'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          aria-label="热门省份"
          title="热门省份"
        >
          <MapPin className="h-4 w-4" />
          {activeProvinceCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent" />
          )}
        </button>

        {/* 重置 trigger — clears selections + resets map view */}
        <button
          type="button"
          onClick={(e) => { stopAll(e); onReset(); onRefresh(); closeAll(); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="重置地理筛选"
          title="重置"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        {/* Region popover */}
        {open === 'region' && (
          <PopoverPanel title="快速聚焦" onClose={closeAll}>
            {quickFocusOptions.map((region) => {
              const active = isLocationActive('region', region);
              return (
                <button
                  key={region}
                  type="button"
                  onClick={(e) => { stopAll(e); onRegionSelect(region); }}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {region}
                </button>
              );
            })}
          </PopoverPanel>
        )}

        {/* Province popover */}
        {open === 'province' && (
          <PopoverPanel title="热门省份" onClose={closeAll}>
            {hotLocations.map((h) => {
              const active = isLocationActive(h.type, h.value);
              return (
                <button
                  key={h.label}
                  type="button"
                  onClick={(e) => {
                    stopAll(e);
                    if (h.type === 'province') onProvinceSelect(h.value);
                    else onRegionSelect(h.value);
                  }}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {h.label}
                </button>
              );
            })}
          </PopoverPanel>
        )}
      </div>
    </div>
  );
};

// ─── Right-side zoom/refresh stack ──────────────────────────────────────────

const MapZoomControls: React.FC = () => {
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
          <ZoomTracker />
          <FocusRegion focusRegion={focusRegion} />
          <FocusBorder focusRegion={focusRegion} />
          <MapZoomControls />
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
                // Label tier based on bounding-box area: large provinces
                // stay visible at all zoom levels, smaller ones hide via
                // CSS when zoomed out, tiny ones are hover-only.
                const bounds = 'getBounds' in layer ? (layer as L.Polyline).getBounds() : null;
                const area = bounds
                  ? (bounds.getNorth() - bounds.getSouth()) * (bounds.getEast() - bounds.getWest())
                  : 0;
                const isPermanent = area > TIER_SM;
                const tier = area > TIER_LG ? 'lg' : area > TIER_MD ? 'md' : 'sm';
                layer.bindTooltip(name, {
                  permanent: isPermanent,
                  direction: isPermanent ? 'center' : 'top',
                  className: isPermanent
                    ? `home-map__province-label home-map__province-label--${tier}`
                    : 'home-map__province-label--hover',
                  sticky: !isPermanent,
                });
              }}
            />
          )}
        </MapContainer>
      )}

      {/* Left-side collapsible controls: region popover + province popover + reset */}
      {!loading && !error && (
        <MapLeftControls
          quickFocusOptions={quickFocusOptions}
          hotLocations={hotLocations}
          isLocationActive={isLocationActive}
          onRegionSelect={onQuickFocusSelect}
          onProvinceSelect={onProvinceSelect}
          onReset={onReset}
          onRefresh={onRefresh}
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

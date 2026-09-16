"use client";

import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary, MapMouseEvent, MapControl, ControlPosition, Polyline } from '@vis.gl/react-google-maps';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import ContributionModal from './ContributionModal';

export interface SearchResult {
  lat: number;
  lng: number;
  name: string;
}

// Tooltip that follows cursor over indexed streets
function StreetTooltip({ name, position }: { name: string; position: { x: number; y: number } | null }) {
  if (!position || !name) return null;
  return (
    <div
      className="pointer-events-none fixed z-9999 bg-zinc-900/90 text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-xl translate-y-[-120%] -translate-x-1/2 whitespace-nowrap"
      style={{ left: position.x, top: position.y }}
    >
      {name}
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-zinc-900/90" />
    </div>
  );
}

// Downsample waypoints to avoid Google Maps MAX_WAYPOINTS_EXCEEDED error
function sampleWaypoints(intermediatePoints: { lat: number; lng: number }[], maxCount = 12): { lat: number; lng: number }[] {
  if (intermediatePoints.length <= maxCount) return intermediatePoints;
  const step = intermediatePoints.length / (maxCount + 1);
  const sampled: { lat: number; lng: number }[] = [];
  for (let i = 1; i <= maxCount; i++) {
    sampled.push(intermediatePoints[Math.floor(i * step)]);
  }
  return sampled;
}

export default function MainMap({
  children,
  indexedStreets = [],
}: {
  children?: React.ReactNode;
  indexedStreets?: any[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const routesLib = useMapsLibrary('routes');
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);

  const [searchMarker, setSearchMarker] = useState<SearchResult | null>(null);
  const [tooltip, setTooltip] = useState<{ name: string; position: { x: number; y: number } } | null>(null);
  
  // Contribution state
  const [mapTypeId, setMapTypeId] = useState<string>('roadmap');
  const [isContributing, setIsContributing] = useState(false);
  const [contributionMode, setContributionMode] = useState<'auto' | 'manual'>('auto');
  const [autoTravelMode, setAutoTravelMode] = useState<'walking' | 'driving'>('walking');
  const [activePinTool, setActivePinTool] = useState<'none' | 'start' | 'middle' | 'end'>('none');

  const [drawnPoints, setDrawnPoints] = useState<{lat: number, lng: number}[]>([]);
  const [snappedPath, setSnappedPath] = useState<{lat: number, lng: number}[]>([]);
  const [roadStatus, setRoadStatus] = useState<'idle' | 'detecting' | 'found' | 'not_found'>('idle');
  const [detectedRoadName, setDetectedRoadName] = useState<string>('');
  const [showContributionModal, setShowContributionModal] = useState(false);

  // Prevents the Map onClick geocoder from firing when data layer already handled it
  const dataLayerClickedRef = useRef(false);

  // Build geocoder and directions service once
  useEffect(() => {
    if (geocodingLib && !geocoderRef.current) {
      geocoderRef.current = new geocodingLib.Geocoder();
    }
  }, [geocodingLib]);

  useEffect(() => {
    if (routesLib && !directionsServiceRef.current) {
      directionsServiceRef.current = new routesLib.DirectionsService();
    }
  }, [routesLib]);

  // Snap road when drawnPoints changes (at least 2 points) and mode is 'auto'
  useEffect(() => {
    if (contributionMode !== 'auto') {
      setSnappedPath([]);
      setRoadStatus('idle');
      return;
    }

    if (drawnPoints.length < 2) {
      setSnappedPath([]);
      setRoadStatus('idle');
      setDetectedRoadName('');
      return;
    }

    if (!directionsServiceRef.current) return;

    let isMounted = true;
    setRoadStatus('detecting');

    const origin = drawnPoints[0];
    const destination = drawnPoints[drawnPoints.length - 1];
    
    // Intermediate middle waypoints
    const rawMiddle = drawnPoints.slice(1, -1);
    const sampledMiddle = sampleWaypoints(rawMiddle, 12);
    const waypoints = sampledMiddle.map(pt => ({
      location: pt,
      stopover: false,
    }));

    const fetchRoute = (travelMode: google.maps.TravelMode): Promise<google.maps.DirectionsResult> => {
      return new Promise((resolve, reject) => {
        directionsServiceRef.current!.route(
          {
            origin,
            destination,
            waypoints,
            travelMode,
          },
          (res, status) => {
            if (status === google.maps.DirectionsStatus.OK && res) {
              resolve(res);
            } else {
              reject(status);
            }
          }
        );
      });
    };

    const primaryMode = autoTravelMode === 'walking' ? google.maps.TravelMode.WALKING : google.maps.TravelMode.DRIVING;
    const fallbackMode = autoTravelMode === 'walking' ? google.maps.TravelMode.DRIVING : google.maps.TravelMode.WALKING;

    fetchRoute(primaryMode)
      .catch(() => fetchRoute(fallbackMode))
      .then(async (result) => {
        if (!isMounted) return;
        const route = result.routes[0];
        if (!route || !route.overview_path || route.overview_path.length === 0) {
          throw new Error('No route found');
        }

        const path = route.overview_path.map(p => ({
          lat: p.lat(),
          lng: p.lng(),
        }));

        let roadName = route.summary || '';
        if (!roadName && geocoderRef.current && path.length > 0) {
          try {
            const geoRes = await geocoderRef.current.geocode({ location: path[0] });
            const routeComp = geoRes.results
              .flatMap(r => r.address_components)
              .find(c => c.types.includes('route'));
            if (routeComp) roadName = routeComp.long_name;
          } catch {
            // ignore geocode error
          }
        }

        setSnappedPath(path);
        setDetectedRoadName(roadName);
        setRoadStatus('found');
      })
      .catch(() => {
        if (!isMounted) return;
        setSnappedPath([]);
        setDetectedRoadName('');
        setRoadStatus('not_found');
      });

    return () => {
      isMounted = false;
    };
  }, [drawnPoints, contributionMode, autoTravelMode]);

  // Listen for search events from StreetSearch
  useEffect(() => {
    const handler = (e: CustomEvent<SearchResult>) => setSearchMarker(e.detail);
    window.addEventListener('map:search', handler as EventListener);
    return () => window.removeEventListener('map:search', handler as EventListener);
  }, []);

  // Draw streets on the data layer + hover/click handlers
  useEffect(() => {
    if (!map) return;

    map.data.forEach(feature => map.data.remove(feature));

    // Build a slug→name lookup
    const slugToName: Record<string, string> = {};
    indexedStreets.forEach(s => { slugToName[s.slug] = s.name; });

    map.data.setStyle((feature) => {
      const isSelected = pathname === `/street/${feature.getProperty('slug')}`;
      const status = feature.getProperty('status');
      const isPending = status === 'PENDING';

      return {
        strokeColor: isSelected
          ? '#2563eb'
          : isPending
            ? '#facc15' // Light yellow for pending streets
            : '#16a34a', // Lean green for approved streets
        strokeWeight: isSelected ? 4 : 2.5, // Lean, sleek lines
        strokeOpacity: isPending ? 0.95 : 0.9,
        zIndex: isSelected ? 3 : isPending ? 1 : 2,
        cursor: 'pointer',
      };
    });

    indexedStreets.forEach(street => {
      if (street.geom) {
        map.data.addGeoJson({
          type: 'Feature',
          geometry: street.geom,
          properties: {
            slug: street.slug,
            name: street.name,
            status: street.status,
          },
        });
      }
    });

    // Click: navigate to street page (set flag so Map onClick geocoder skips)
    const clickListener = map.data.addListener('click', (e: any) => {
      const slug = e.feature.getProperty('slug');
      if (slug) {
        dataLayerClickedRef.current = true;
        setSearchMarker(null);
        setTooltip(null);
        router.push(`/street/${slug}`);
        // Reset flag after event bubbling completes
        setTimeout(() => { dataLayerClickedRef.current = false; }, 100);
      }
    });

    // Mouseover: show tooltip
    const overListener = map.data.addListener('mouseover', (e: any) => {
      const name = e.feature.getProperty('name');
      const status = e.feature.getProperty('status');
      const label = status === 'PENDING' ? `${name} (Pending Review)` : name;
      if (name && e.domEvent) {
        map.getDiv().style.cursor = 'pointer';
        setTooltip({ name: label, position: { x: e.domEvent.clientX, y: e.domEvent.clientY } });
      }
    });

    // Mousemove: update tooltip position
    const moveListener = map.data.addListener('mousemove', (e: any) => {
      if (e.domEvent) {
        setTooltip(prev => prev ? { ...prev, position: { x: e.domEvent.clientX, y: e.domEvent.clientY } } : null);
      }
    });

    // Mouseout: hide tooltip
    const outListener = map.data.addListener('mouseout', () => {
      map.getDiv().style.cursor = '';
      setTooltip(null);
    });

    return () => {
      google.maps.event.removeListener(clickListener);
      google.maps.event.removeListener(overListener);
      google.maps.event.removeListener(moveListener);
      google.maps.event.removeListener(outListener);
    };
  }, [map, indexedStreets, pathname]);

  // Pan/zoom when a street page is active
  useEffect(() => {
    if (!map || !pathname || !indexedStreets.length) return;

    const match = pathname.match(/^\/street\/([^/]+)$/);
    if (match) {
      const slug = match[1];
      const street = indexedStreets.find(s => s.slug === slug);
      if (street?.centroid?.coordinates) {
        map.panTo({ lng: street.centroid.coordinates[0], lat: street.centroid.coordinates[1] });
        if (window.innerWidth >= 768) map.panBy(-225, 0);
        map.setZoom(16);
      }
    } else if (pathname === '/') {
      setSearchMarker(null);
    }
  }, [map, pathname, indexedStreets]);

  // Selected pin state & click tracker for reliable pin deletion
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const lastPinClickRef = useRef<{ id: number; time: number }>({ id: -1, time: 0 });
  const markerInteractedRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  // General map click: reverse geocode and open panel for any street, OR add/modify pin if contributing
  const handleMapClick = async (e: MapMouseEvent) => {
    if (!e.detail.latLng) return;
    
    if (isContributing) {
      // If a marker was recently clicked, tapped, or dragged, suppress map click
      if (Date.now() - markerInteractedRef.current < 450) {
        return;
      }
      setSelectedPinIndex(null);

      const pos = e.detail.latLng;

      if (activePinTool === 'start') {
        setDrawnPoints(prev => {
          if (prev.length === 0) return [pos];
          const updated = [...prev];
          updated[0] = pos;
          return updated;
        });
        setActivePinTool('none');
      } else if (activePinTool === 'end') {
        setDrawnPoints(prev => {
          if (prev.length === 0) return [pos];
          if (prev.length === 1) return [prev[0], pos];
          const updated = [...prev];
          updated[updated.length - 1] = pos;
          return updated;
        });
        setActivePinTool('none');
      } else if (activePinTool === 'middle') {
        setDrawnPoints(prev => {
          if (prev.length === 0) return [pos];
          if (prev.length === 1) return [prev[0], pos];
          const start = prev.slice(0, -1);
          const end = prev[prev.length - 1];
          return [...start, pos, end];
        });
      } else {
        // Smart sequential placement when tool is 'none'
        if (drawnPoints.length === 0) {
          setDrawnPoints([pos]);
        } else if (drawnPoints.length === 1) {
          setDrawnPoints(prev => [...prev, pos]);
        } else {
          // If 2+ pins exist, clicking on map inserts a middle waypoint between Start and End
          if (contributionMode === 'auto') {
            setDrawnPoints(prev => {
              const start = prev.slice(0, -1);
              const end = prev[prev.length - 1];
              return [...start, pos, end];
            });
          } else {
            // Manual mode appends
            setDrawnPoints(prev => [...prev, pos]);
          }
        }
      }
      return;
    }

    // Skip if data layer already handled this click (indexed street)
    if (dataLayerClickedRef.current) return;
    if (!geocoderRef.current || !e.detail.latLng) return;
    try {
      const result = await geocoderRef.current.geocode({ location: e.detail.latLng });
      const route = result.results.find(r => r.types.includes('route'));
      if (route) {
        const routeComp = route.address_components.find(c => c.types.includes('route'));
        if (routeComp) {
          const slug = routeComp.long_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          if (slug) router.push(`/street/${slug}`);
        }
      }
    } catch {
      // ignore ZERO_RESULTS (click on water, park, etc.)
    }
  };

  // Drag point handler for user contribution mode
  const handleDragPoint = (index: number, newPos: { lat: number; lng: number }) => {
    setDrawnPoints(prev => {
      const updated = [...prev];
      updated[index] = newPos;
      return updated;
    });
  };

  // Delete individual pin
  const handleDeletePoint = (index: number) => {
    setDrawnPoints(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length < 2) {
        setSnappedPath([]);
        setRoadStatus('idle');
      }
      return updated;
    });
    setSelectedPinIndex(null);
  };

  // Double tap / double click detection on map markers to delete pin
  const handlePinInteraction = (index: number, e?: any) => {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (e.nativeEvent?.stopPropagation) e.nativeEvent.stopPropagation();
      if (e.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
      if (typeof e.stop === 'function') e.stop();
    }

    if (isDraggingRef.current) return;

    const now = Date.now();
    markerInteractedRef.current = now;

    const last = lastPinClickRef.current;
    const timeDiff = now - last.time;
    const samePin = last.id === index;

    if (samePin && timeDiff > 40 && timeDiff < 650) {
      // Real double tap / double click detected!
      handleDeletePoint(index);
      lastPinClickRef.current = { id: -1, time: 0 };
      setSelectedPinIndex(null);
    } else {
      // Discard duplicate synthetic events within 40ms, otherwise toggle pin selection
      if (timeDiff > 40) {
        lastPinClickRef.current = { id: index, time: now };
        setSelectedPinIndex(prev => (prev === index ? null : index));
      }
    }
  };

  // Clear middle waypoints
  const handleClearMiddlePins = () => {
    if (drawnPoints.length <= 2) return;
    setDrawnPoints([drawnPoints[0], drawnPoints[drawnPoints.length - 1]]);
    setActivePinTool('none');
  };

  // Switch between Auto and Manual mode without collapsing road to a straight line
  const handleSwitchContributionMode = (newMode: 'auto' | 'manual') => {
    if (newMode === 'manual' && contributionMode === 'auto') {
      // When switching from Auto to Manual:
      // Preserve the curved road path by sampling waypoints from snappedPath as draggable middle pins
      if (snappedPath.length > 2 && drawnPoints.length <= 2) {
        const start = drawnPoints[0] || snappedPath[0];
        const end = drawnPoints[drawnPoints.length - 1] || snappedPath[snappedPath.length - 1];
        const sampledMiddle = sampleWaypoints(snappedPath.slice(1, -1), 6);
        setDrawnPoints([start, ...sampledMiddle, end]);
      }
    }
    setContributionMode(newMode);
  };

  const handlePopulateMiddlePins = () => {
    if (snappedPath.length <= 2) return;
    const start = drawnPoints[0] || snappedPath[0];
    const end = drawnPoints[drawnPoints.length - 1] || snappedPath[snappedPath.length - 1];
    const sampledMiddle = sampleWaypoints(snappedPath.slice(1, -1), 6);
    setDrawnPoints([start, ...sampledMiddle, end]);
  };

  const middlePins = drawnPoints.slice(1, -1);

  return (
    <>
      <StreetTooltip name={tooltip?.name ?? ''} position={tooltip?.position ?? null} />
      <div className="absolute inset-0 w-full h-full">
        <Map
          mapTypeId={mapTypeId}
          defaultCenter={{ lat: 22.5726, lng: 88.3639 }}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          disableDoubleClickZoom={isContributing}
          mapTypeControl={false}
          clickableIcons={false}
          mapId="d877c081e190637f21b415db"
          onClick={handleMapClick}
        >
          {/* Map Controls */}
          <MapControl position={ControlPosition.TOP_LEFT}>
            <div className="flex flex-col gap-2 m-4 pointer-events-auto">
              {/* Map / Satellite / Contribute Button Bar */}
              <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-zinc-200">
                <div className="flex bg-zinc-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setMapTypeId('roadmap')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      mapTypeId === 'roadmap' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    Map
                  </button>
                  <button
                    onClick={() => setMapTypeId('satellite')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      mapTypeId === 'satellite' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    Satellite
                  </button>
                </div>
                
                <div className="w-px h-5 bg-zinc-200" />
                
                {!isContributing ? (
                  <button
                    onClick={() => {
                      setIsContributing(true);
                      setDrawnPoints([]);
                      setSnappedPath([]);
                      setRoadStatus('idle');
                      setContributionMode('auto');
                      setActivePinTool('none');
                    }}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <span>＋</span> Contribute Street
                  </button>
                ) : (
                  <span className="text-xs font-bold text-blue-700 px-2">
                    Drawing Mode Active
                  </span>
                )}
              </div>

              {/* Contribution Floating Drawer */}
              {isContributing && (
                <div className="flex flex-col gap-2.5 p-3.5 bg-white/98 backdrop-blur-md rounded-2xl shadow-xl border border-zinc-200 w-84 md:w-96 text-xs transition-all">
                  {/* Mode Selector: Auto vs Manual */}
                  <div className="flex items-center justify-between gap-1 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
                    <button
                      type="button"
                      onClick={() => handleSwitchContributionMode('auto')}
                      className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-all cursor-pointer ${
                        contributionMode === 'auto'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      🚗 Auto (Road Snapped)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchContributionMode('manual')}
                      className={`flex-1 py-1.5 text-center font-bold rounded-lg transition-all cursor-pointer ${
                        contributionMode === 'manual'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      ✍️ Manual (Custom Pins)
                    </button>
                  </div>

                  {contributionMode === 'auto' && (
                    <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
                      <button
                        type="button"
                        onClick={() => setAutoTravelMode('walking')}
                        className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                          autoTravelMode === 'walking'
                            ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                        title="Bi-directional street path: ignores one-way car traffic to prevent detour loops"
                      >
                        🚶 Bi-directional (No Loops)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoTravelMode('driving')}
                        className={`flex-1 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                          autoTravelMode === 'driving'
                            ? 'bg-white text-blue-800 shadow-2xs font-bold'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }`}
                        title="Vehicular traffic rules: respects one-way car laws"
                      >
                        🚗 Car Traffic
                      </button>
                    </div>
                  )}

                  {/* Pin Tool Quick Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActivePinTool(prev => prev === 'start' ? 'none' : 'start')}
                      className={`px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                        activePinTool === 'start'
                          ? 'bg-green-600 text-white border-green-700 ring-2 ring-green-300'
                          : 'bg-zinc-50 hover:bg-green-50 text-green-800 border-zinc-200'
                      }`}
                    >
                      🟢 {drawnPoints.length > 0 ? 'Move Start' : 'Set Start'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePinTool(prev => prev === 'middle' ? 'none' : 'middle')}
                      className={`px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                        activePinTool === 'middle'
                          ? 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-300'
                          : 'bg-zinc-50 hover:bg-blue-50 text-blue-800 border-zinc-200'
                      }`}
                    >
                      🔵 ＋ Middle Pin
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePinTool(prev => prev === 'end' ? 'none' : 'end')}
                      className={`px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                        activePinTool === 'end'
                          ? 'bg-red-600 text-white border-red-700 ring-2 ring-red-300'
                          : 'bg-zinc-50 hover:bg-red-50 text-red-800 border-zinc-200'
                      }`}
                    >
                      🔴 {drawnPoints.length > 1 ? 'Move End' : 'Set End'}
                    </button>

                    {drawnPoints.length > 2 && (
                      <button
                        type="button"
                        onClick={handleClearMiddlePins}
                        className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-medium cursor-pointer"
                        title="Remove intermediate middle pins"
                      >
                        🧹 Clear Middle
                      </button>
                    )}

                    {snappedPath.length > 2 && middlePins.length === 0 && (
                      <button
                        type="button"
                        onClick={handlePopulateMiddlePins}
                        className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200 transition-colors cursor-pointer"
                        title="Extract draggable waypoints from the road path"
                      >
                        📍 Distribute Middle Pins
                      </button>
                    )}
                  </div>

                  {/* Status Banner */}
                  <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                    {contributionMode === 'auto' ? (
                      <>
                        {roadStatus === 'idle' && (
                          <p className="text-xs text-zinc-500">
                            Drop 🟢 <strong>Start</strong> and 🔴 <strong>End</strong> pins. Add 🔵 <strong>Middle</strong> pins if road curves or detours.
                          </p>
                        )}
                        {roadStatus === 'detecting' && (
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0" />
                            <span>Snapping through Start, Middle, and End pins...</span>
                          </div>
                        )}
                        {roadStatus === 'found' && (
                          <div className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 space-y-0.5">
                            <p className="font-semibold flex items-center gap-1">
                              <span>✓ Road snapped:</span>
                              <span className="underline">{detectedRoadName || 'Road Network'}</span>
                            </p>
                            <p className="text-[11px] text-emerald-700">
                              {middlePins.length > 0 ? `Routed via ${middlePins.length} middle waypoint(s).` : 'Add middle pins if route detours.'}
                            </p>
                          </div>
                        )}
                        {drawnPoints.length >= 2 && roadStatus === 'not_found' && (
                          <div className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200 space-y-0.5">
                            <p className="font-semibold">⚠️ Road route not found</p>
                            <p className="text-[11px] text-red-600">
                              Try adding middle pins along the street or switch to <strong>Manual Mode</strong>.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                        <p className="font-semibold text-blue-700">✍️ Manual Drawing Mode</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Click map to add custom line segments. Drag pins to adjust.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Pin breakdown list with quick delete (×) */}
                  {drawnPoints.length > 0 && (
                    <div className="pt-2 border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                      {drawnPoints.map((_, idx) => {
                        const isStart = idx === 0;
                        const isEnd = idx === drawnPoints.length - 1 && drawnPoints.length > 1;
                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border shrink-0 ${
                              isStart ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              isEnd ? 'bg-red-50 text-red-800 border-red-200' :
                              'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {isStart ? '🟢 Start' : isEnd ? '🔴 End' : `🔵 #${idx}`}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePoint(idx);
                              }}
                              className="text-zinc-400 hover:text-red-700 font-bold ml-0.5 cursor-pointer"
                              title="Delete this pin"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100">
                    <div className="flex gap-1.5">
                      {drawnPoints.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDrawnPoints(prev => prev.slice(0, -1))}
                          className="px-2.5 py-1 font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer"
                        >
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setIsContributing(false);
                          setDrawnPoints([]);
                          setSnappedPath([]);
                          setRoadStatus('idle');
                          setDetectedRoadName('');
                          setActivePinTool('none');
                        }}
                        className="px-2.5 py-1 font-medium text-zinc-500 hover:text-zinc-800 rounded-md transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={
                        drawnPoints.length < 2 ||
                        (contributionMode === 'auto' && (roadStatus !== 'found' || snappedPath.length === 0))
                      }
                      onClick={() => setShowContributionModal(true)}
                      className="px-3.5 py-1.5 font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                    >
                      Finish Drawing →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </MapControl>

          {/* Contribution Drawing Layer */}
          {isContributing && drawnPoints.length > 0 && (
            <>
              {/* Accurately Snapped Road Polyline in Auto Mode */}
              {contributionMode === 'auto' && snappedPath.length > 0 && (
                <Polyline
                  path={snappedPath}
                  strokeColor="#2563eb"
                  strokeWeight={3.5}
                  strokeOpacity={0.9}
                />
              )}

              {/* Direct Polyline in Manual Mode */}
              {contributionMode === 'manual' && drawnPoints.length >= 2 && (
                <Polyline
                  path={drawnPoints}
                  strokeColor="#2563eb"
                  strokeWeight={3.5}
                  strokeOpacity={0.9}
                />
              )}

              {/* Invalid Warning Line in Auto Mode */}
              {contributionMode === 'auto' && roadStatus === 'not_found' && drawnPoints.length >= 2 && (
                <Polyline
                  path={drawnPoints}
                  strokeColor="#ef4444"
                  strokeWeight={3}
                  strokeOpacity={0.6}
                />
              )}

              {/* Pins with Start / Middle Waypoint / End Styling, Draggable */}
              {drawnPoints.map((pt, i) => {
                const isStart = i === 0;
                const isEnd = i === drawnPoints.length - 1 && drawnPoints.length > 1;
                const isSelected = selectedPinIndex === i;

                return (
                  <AdvancedMarker
                    key={`user-pin-${i}`}
                    position={pt}
                    draggable={true}
                    clickable={true}
                    title={`${isStart ? 'Start Point (🟢)' : isEnd ? 'End Point (🔴)' : `Middle Waypoint #${i} (🔵)`} - Double-click / Double-tap to delete, or drag to move`}
                    onClick={(e: any) => handlePinInteraction(i, e)}
                    onDragStart={() => {
                      isDraggingRef.current = true;
                      markerInteractedRef.current = Date.now();
                    }}
                    onDragEnd={(e: any) => {
                      markerInteractedRef.current = Date.now();
                      setTimeout(() => {
                        isDraggingRef.current = false;
                      }, 120);
                      if (e.latLng) {
                        handleDragPoint(i, {
                          lat: e.latLng.lat(),
                          lng: e.latLng.lng(),
                        });
                      }
                    }}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        e.nativeEvent?.stopPropagation?.();
                        e.nativeEvent?.stopImmediatePropagation?.();
                        handlePinInteraction(i, e);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.nativeEvent?.stopPropagation?.();
                        e.nativeEvent?.stopImmediatePropagation?.();
                        markerInteractedRef.current = Date.now();
                        handleDeletePoint(i);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.nativeEvent?.stopPropagation?.();
                        e.nativeEvent?.stopImmediatePropagation?.();
                        markerInteractedRef.current = Date.now();
                        handleDeletePoint(i);
                      }}
                      className="relative cursor-pointer select-none group"
                    >
                      {isSelected && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent?.stopPropagation?.();
                            e.nativeEvent?.stopImmediatePropagation?.();
                            markerInteractedRef.current = Date.now();
                            handleDeletePoint(i);
                          }}
                          className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 text-white px-2.5 py-1 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap border border-zinc-700 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
                        >
                          <span>{isStart ? '🟢 Start' : isEnd ? '🔴 End' : `🔵 Pin #${i}`}</span>
                          <span className="text-red-400 hover:text-red-300 font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800/60 cursor-pointer">
                            🗑️ Delete
                          </span>
                        </div>
                      )}

                      {isStart ? (
                        <Pin background="#16a34a" borderColor="#15803d" glyphColor="#ffffff" scale={0.95} />
                      ) : isEnd ? (
                        <Pin background="#dc2626" borderColor="#b91c1c" glyphColor="#ffffff" scale={0.95} />
                      ) : (
                        <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#ffffff" scale={0.75} />
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}
            </>
          )}

          {children}

          {/* Search result drop pin */}
          {searchMarker && !isContributing && (
            <AdvancedMarker
              position={{ lat: searchMarker.lat, lng: searchMarker.lng }}
              onClick={() => setSearchMarker(null)}
            >
              <Pin background="#EA4335" borderColor="#C5221F" glyphColor="#FFFFFF" />
            </AdvancedMarker>
          )}
        </Map>
      </div>

      {showContributionModal && (
        <ContributionModal
          points={contributionMode === 'auto' && snappedPath.length > 0 ? snappedPath : drawnPoints}
          initialName={detectedRoadName}
          onClose={() => {
            setShowContributionModal(false);
            setIsContributing(false);
            setDrawnPoints([]);
            setSnappedPath([]);
            setRoadStatus('idle');
            setDetectedRoadName('');
            setActivePinTool('none');
          }}
        />
      )}
    </>
  );
}

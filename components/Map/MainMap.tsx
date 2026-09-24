"use client";

import {
  Map,
  AdvancedMarker,
  Pin,
  Circle,
  useMap,
  useMapsLibrary,
  MapMouseEvent,
  MapControl,
  ControlPosition,
  Polyline,
} from '@vis.gl/react-google-maps';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import ContributionModal from './ContributionModal';
import ContributeSelectModal from './ContributeSelectModal';
import AddPlaceModal from '@/components/Recommendations/AddPlaceModal';
import EditPlaceModal from '@/components/Admin/EditPlaceModal';
import SpotInfoPanel from '@/components/SpotInfoPanel';
import LeftDrawer from '@/components/Navigation/LeftDrawer';
import { useAuth } from '@/context/AuthContext';
import {
  Menu,
  User as UserIcon,
  Layers,
  Route,
  Edit3,
  Plus,
  Compass,
  Crosshair,
  MapPin,
  X,
  ArrowUpRight,
  Navigation,
  Star,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';

export interface SearchResult {
  lat: number;
  lng: number;
  name: string;
  placeId?: string;
  address?: string;
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

// Calculate road distance with Kolkata urban grid tortuosity factor (~1.25x)
function calculateRoadDistance(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): { meters: number; label: string } {
  const R = 6371e3;
  const p1 = (from.lat * Math.PI) / 180;
  const p2 = (to.lat * Math.PI) / 180;
  const dp = ((to.lat - from.lat) * Math.PI) / 180;
  const dl = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const haversineMeters = R * c;

  const roadMeters = Math.round(haversineMeters * 1.25);
  const km = (roadMeters / 1000).toFixed(1);

  return {
    meters: roadMeters,
    label: roadMeters < 1000 ? `${roadMeters}m road distance` : `${km} km road distance`,
  };
}

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'Food & Adda':
      return { icon: '☕', bg: 'bg-amber-600', border: 'border-amber-400', ring: 'ring-amber-500/30', text: 'text-amber-700 dark:text-amber-300', badgeBg: 'bg-amber-50 dark:bg-amber-950/60' };
    case 'Heritage Sites':
      return { icon: '🏛️', bg: 'bg-emerald-600', border: 'border-emerald-400', ring: 'ring-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-300', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60' };
    case 'Culture & Books':
      return { icon: '📚', bg: 'bg-blue-600', border: 'border-blue-400', ring: 'ring-blue-500/30', text: 'text-blue-700 dark:text-blue-300', badgeBg: 'bg-blue-50 dark:bg-blue-950/60' };
    case 'Markets & Gems':
      return { icon: '🛍️', bg: 'bg-purple-600', border: 'border-purple-400', ring: 'ring-purple-500/30', text: 'text-purple-700 dark:text-purple-300', badgeBg: 'bg-purple-50 dark:bg-purple-950/60' };
    case 'Art & Architecture':
      return { icon: '🎨', bg: 'bg-rose-600', border: 'border-rose-400', ring: 'ring-rose-500/30', text: 'text-rose-700 dark:text-rose-300', badgeBg: 'bg-rose-50 dark:bg-rose-950/60' };
    default:
      return { icon: '📍', bg: 'bg-indigo-600', border: 'border-indigo-400', ring: 'ring-indigo-500/30', text: 'text-indigo-700 dark:text-indigo-300', badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60' };
  }
};

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

  const { user, canContribute, openAuthModal } = useAuth();
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);

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

  // Live user location & POI preview state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [activePoiPreview, setActivePoiPreview] = useState<{
    id?: string;
    lat: number;
    lng: number;
    title: string;
    address?: string | null;
    category?: string;
    distanceMeters?: number | null;
    roadDistanceLabel?: string | null;
  } | null>(null);

  const [isGooglePoiLoading, setIsGooglePoiLoading] = useState(false);

  // Spatial Radius Exploration system (Around Me / Around Pin / Around Street)
  const [spatialRadius, setSpatialRadius] = useState<{
    active: boolean;
    center: { lat: number; lng: number };
    radiusMeters: number; // 3000, 5000, 10000, 20000
    label?: string;
    places: any[];
    loading: boolean;
  } | null>(null);

  // Add Place Modal state for contributors
  const [showAddPlaceModal, setShowAddPlaceModal] = useState(false);
  const [addPlaceInitialPos, setAddPlaceInitialPos] = useState<{
    lat?: number;
    lng?: number;
    title?: string;
    address?: string;
    streetId?: string | null;
    streetName?: string | null;
    placeId?: string | null;
  } | null>(null);

  // Approved Heritage Spots / Places State (Displayed on live map)
  const [heritageSpots, setHeritageSpots] = useState<{
    id: string;
    streetId?: string | null;
    zone: string;
    title: string;
    category: string;
    description: string;
    address?: string | null;
    lat: number;
    lng: number;
    status: string;
    contributorName?: string | null;
  }[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<any | null>(null);
  const [editingSpot, setEditingSpot] = useState<any | null>(null);
  const [isContributeSelectOpen, setIsContributeSelectOpen] = useState(false);
  const [showHeritageSpots, setShowHeritageSpots] = useState(true);

  // Fetch all approved heritage spots to show as pins on map
  const fetchHeritageSpots = useCallback(async () => {
    try {
      const res = await fetch('/api/recommendations?all=true', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const valid = (data || []).filter(
          (d: any) =>
            d.lat &&
            d.lng &&
            Number.isFinite(Number(d.lat)) &&
            Number.isFinite(Number(d.lng))
        );
        setHeritageSpots(valid);
      }
    } catch (e) {
      console.error('Failed to load map heritage spots:', e);
    }
  }, []);

  useEffect(() => {
    fetchHeritageSpots();
  }, [fetchHeritageSpots]);

  // Real-time synchronization when places are created or edited
  useEffect(() => {
    const handlePlacesChanged = () => {
      fetchHeritageSpots();
    };
    window.addEventListener('places:created', handlePlacesChanged);
    window.addEventListener('places:updated', handlePlacesChanged);
    return () => {
      window.removeEventListener('places:created', handlePlacesChanged);
      window.removeEventListener('places:updated', handlePlacesChanged);
    };
  }, [fetchHeritageSpots]);

  // Route synchronization: When navigating to a street corridor, dismiss any open spot panel so they never stack
  useEffect(() => {
    if (pathname.startsWith('/street/')) {
      setSelectedSpot(null);
    }
  }, [pathname]);

  // Trigger spatial radius exploration around a center point
  const triggerRadiusExplore = useCallback(
    async (center: { lat: number; lng: number }, radiusMeters = 5000, label?: string) => {
      setSpatialRadius({
        active: true,
        center,
        radiusMeters,
        label: label || 'Area Recommendations',
        places: [],
        loading: true,
      });

      if (map) {
        map.panTo(center);
        const zoomLevel = radiusMeters <= 3000 ? 15 : radiusMeters <= 5000 ? 14 : radiusMeters <= 10000 ? 13 : 12;
        map.setZoom(zoomLevel);
      }

      try {
        const res = await fetch(`/api/recommendations?lat=${center.lat}&lng=${center.lng}&radius=${radiusMeters}`);
        if (res.ok) {
          const data = await res.json();
          setSpatialRadius((prev) => (prev ? { ...prev, places: data, loading: false } : null));
        }
      } catch (err) {
        console.error('Failed to load radius recommendations:', err);
        setSpatialRadius((prev) => (prev ? { ...prev, loading: false } : null));
      }
    },
    [map]
  );

  // Move radius center when dragging the center pin
  const handleMoveRadiusCenter = (newCenter: { lat: number; lng: number }) => {
    if (!spatialRadius) return;
    triggerRadiusExplore(newCenter, spatialRadius.radiusMeters, 'Selected Location');
  };

  // Change radius selector
  const handleChangeRadius = (newRadiusMeters: number) => {
    if (!spatialRadius) return;
    triggerRadiusExplore(spatialRadius.center, newRadiusMeters, spatialRadius.label);
  };

  // Fetch Google Place Details when clicking a native Google POI icon on the map
  const fetchGooglePoiDetails = useCallback(
    async (placeId: string, fallbackLatLng?: google.maps.LatLngLiteral | null) => {
      if (pathname !== '/') {
        router.push('/');
      }
      setIsGooglePoiLoading(true);
      try {
        const res = await fetch(`/api/place-details?placeId=${encodeURIComponent(placeId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            const rawLat = data.lat ?? fallbackLatLng?.lat ?? 22.5726;
            const rawLng = data.lng ?? fallbackLatLng?.lng ?? 88.3639;
            const lat = typeof rawLat === 'function' ? rawLat() : Number(rawLat);
            const lng = typeof rawLng === 'function' ? rawLng() : Number(rawLng);

            // Check if this matches an existing heritage spot in DB
            const existingSpot = heritageSpots.find(
              (s) =>
                s.title?.toLowerCase() === data.name?.toLowerCase() ||
                (Math.abs(s.lat - lat) < 0.0005 && Math.abs(s.lng - lng) < 0.0005)
            );

            setSelectedSpot({
              id: existingSpot?.id || placeId,
              title: data.name,
              category: existingSpot?.category || (data.types?.[0] ? data.types[0].replace(/_/g, ' ') : 'Heritage Spot'),
              zone: existingSpot?.zone || 'Central Kolkata',
              description: existingSpot?.description || (data.reviews?.[0]?.text
                ? `"${data.reviews[0].text}" — Documented landmark in Kolkata.`
                : `Historic landmark and cultural point of interest in Kolkata located at ${data.formattedAddress || data.name}.`),
              address: data.formattedAddress,
              lat,
              lng,
              status: existingSpot?.status || 'APPROVED',
              contributorName: existingSpot?.contributorName || 'Google Places & Community Archive',
              placeData: data,
              isGooglePoi: !existingSpot,
            });

            if (map && Number.isFinite(lat) && Number.isFinite(lng)) {
              map.panTo({ lat, lng });
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch Google POI details:', err);
      } finally {
        setIsGooglePoiLoading(false);
      }
    },
    [pathname, router, heritageSpots, map]
  );

  // Open Add Place Modal for contributors
  const handleOpenAddPlace = useCallback((preset?: {
    lat?: number;
    lng?: number;
    title?: string;
    address?: string;
    streetId?: string | null;
    streetName?: string | null;
    placeId?: string | null;
  }) => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    if (!canContribute) {
      openAuthModal('contributor');
      return;
    }
    let lat = 22.5726;
    let lng = 88.3639;
    if (preset?.lat !== undefined && preset?.lng !== undefined) {
      lat = typeof preset.lat === 'function' ? (preset.lat as any)() : Number(preset.lat);
      lng = typeof preset.lng === 'function' ? (preset.lng as any)() : Number(preset.lng);
    } else if (map) {
      const c = map.getCenter();
      if (c) {
        lat = typeof c.lat === 'function' ? c.lat() : Number(c.lat);
        lng = typeof c.lng === 'function' ? c.lng() : Number(c.lng);
      }
    } else if (userLocation) {
      lat = userLocation.lat;
      lng = userLocation.lng;
    }

    setAddPlaceInitialPos({
      lat,
      lng,
      title: preset?.title,
      address: preset?.address,
      streetId: preset?.streetId,
      streetName: preset?.streetName,
      placeId: preset?.placeId,
    });
    setShowAddPlaceModal(true);
  }, [user, canContribute, openAuthModal, map, userLocation]);

  // Listen for radius changed, radius cleared, and open add place events
  useEffect(() => {
    const handleRadiusChanged = (e: any) => {
      if (e.detail?.center && e.detail?.radiusMeters) {
        setSpatialRadius({
          active: true,
          center: e.detail.center,
          radiusMeters: e.detail.radiusMeters,
          label: e.detail.label || 'Spatial Radius',
          places: e.detail.places || [],
          loading: false,
        });
      }
    };

    const handleRadiusCleared = () => {
      setSpatialRadius(null);
    };

    const handleOpenAddPlaceEvent = () => {
      handleOpenAddPlace();
    };

    window.addEventListener('recommendations:radius_changed', handleRadiusChanged);
    window.addEventListener('recommendations:radius_cleared', handleRadiusCleared);
    window.addEventListener('modal:open-add-place', handleOpenAddPlaceEvent);
    return () => {
      window.removeEventListener('recommendations:radius_changed', handleRadiusChanged);
      window.removeEventListener('recommendations:radius_cleared', handleRadiusCleared);
      window.removeEventListener('modal:open-add-place', handleOpenAddPlaceEvent);
    };
  }, [handleOpenAddPlace]);

  // Listen for POI selection from recommendations panel
  useEffect(() => {
    const handleFocusPoi = (e: any) => {
      const poi = e.detail;
      if (poi?.lat && poi?.lng) {
        setActivePoiPreview(poi);
        if (map) {
          map.panTo({ lat: poi.lat, lng: poi.lng });
          map.setZoom(17);
        }
      }
    };
    window.addEventListener('focus-poi', handleFocusPoi);
    return () => window.removeEventListener('focus-poi', handleFocusPoi);
  }, [map]);

  const handleGetLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(loc);
        if (map) {
          map.panTo(loc);
          map.setZoom(16);
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation lookup notice:', err.message);
        // Fallback to Central Kolkata landmark (Park Street / Victoria Memorial)
        const fallbackLoc = { lat: 22.5515, lng: 88.3524 };
        setUserLocation(fallbackLoc);
        if (map) {
          map.panTo(fallbackLoc);
          map.setZoom(16);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

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
    const handler = (e: CustomEvent<SearchResult>) => {
      const searchRes = e.detail;
      setSearchMarker(searchRes);
      if (searchRes.placeId) {
        fetchGooglePoiDetails(searchRes.placeId, { lat: searchRes.lat, lng: searchRes.lng });
      }
    };
    window.addEventListener('map:search', handler as EventListener);
    return () => window.removeEventListener('map:search', handler as EventListener);
  }, [fetchGooglePoiDetails]);

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
        setSelectedSpot(null);
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

  // General map click: reverse geocode and open panel for any street, OR add/modify pin if contributing, OR show Google POI
  const handleMapClick = async (e: MapMouseEvent) => {
    // Intercept Google Maps native POI click (e.g. Victoria Memorial, Indian Museum, Metro stations)
    const clickedPlaceId = (e.detail as any)?.placeId || (e as any)?.placeId;
    if (clickedPlaceId) {
      if (typeof (e as any).stop === 'function') (e as any).stop();
      if (typeof (e.detail as any)?.domEvent?.stopPropagation === 'function') {
        (e.detail as any).domEvent.stopPropagation();
      }
      fetchGooglePoiDetails(clickedPlaceId, e.detail.latLng);
      return;
    }

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
    if (selectedSpot) setSelectedSpot(null);
    if (activePoiPreview) setActivePoiPreview(null);
    if (pathname !== '/') router.push('/');
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
      <LeftDrawer
        indexedStreets={indexedStreets}
        isOpen={isLeftDrawerOpen}
        onClose={() => setIsLeftDrawerOpen(false)}
        mapTypeId={mapTypeId}
        onMapTypeChange={(newType) => setMapTypeId(newType)}
      />
      <div className="absolute inset-0 w-full h-full">
        <Map
          mapTypeId={mapTypeId}
          defaultCenter={{ lat: 22.5726, lng: 88.3639 }}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          disableDoubleClickZoom={isContributing}
          mapTypeControl={false}
          fullscreenControl={false}
          clickableIcons={true}
          mapId="d877c081e190637f21b415db"
          onClick={handleMapClick}
        >
          {/* Map Controls */}
          <MapControl position={ControlPosition.TOP_LEFT}>
            <div className="flex flex-col gap-2 m-2 sm:m-4 pointer-events-auto max-w-[calc(100vw-1rem)]">
              {/* Explore / Contribute / Sign In Button Bar */}
              <div className="flex items-center gap-1 sm:gap-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1 sm:p-1.5 rounded-xl shadow-md border border-zinc-200/80 dark:border-zinc-800 shrink-0">
                {/* Left Drawer Explore Trigger */}
                <button
                  type="button"
                  onClick={() => setIsLeftDrawerOpen(true)}
                  className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer font-sans shrink-0"
                  title="Explore Tilottoma Archive & Zones"
                >
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="hidden md:inline">Archive</span>
                </button>

                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

                {/* Single Contribute Trigger */}
                {!isContributing ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        openAuthModal('login');
                        return;
                      }
                      if (!canContribute) {
                        openAuthModal('contributor');
                        return;
                      }
                      setIsContributeSelectOpen(true);
                    }}
                    className="px-2.5 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 font-sans shrink-0"
                    title="Contribute a historical corridor or heritage landmark"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Contribute</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-mono font-medium text-blue-700 dark:text-blue-400 px-2 shrink-0">
                      DRAWING ACTIVE
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsContributing(false);
                        setDrawnPoints([]);
                        setSnappedPath([]);
                        setRoadStatus('idle');
                        setActivePinTool('none');
                      }}
                      className="px-2 py-1 text-[11px] font-sans font-medium rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

                {/* My Location Button */}
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer border border-zinc-200/60 dark:border-zinc-700/60 font-sans shrink-0 flex items-center gap-1"
                  title="Center map on your current location"
                >
                  <Crosshair className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${isLocating ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">{isLocating ? 'Locating...' : 'My Location'}</span>
                </button>

                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 shrink-0" />

                {/* Sign In / User Status Button Beside Contribute */}
                {!user ? (
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer flex items-center gap-1 font-sans shrink-0"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span className="hidden sm:inline">Sign In</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsLeftDrawerOpen(true)}
                    className="flex items-center gap-1 p-1 sm:px-2 sm:py-1 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer border border-zinc-200/60 dark:border-zinc-700/60 font-sans shrink-0"
                    title={`Logged in as ${user.name} (${user.role})`}
                  >
                    <span className="w-4.5 h-4.5 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center text-[10px] font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden lg:inline max-w-16 truncate">{user.name.split(' ')[0]}</span>
                  </button>
                )}
              </div>

              {/* Contribution Floating Drawer */}
              {isContributing && (
                <div className="flex flex-col gap-2.5 p-3.5 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-md rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-84 md:w-96 text-xs transition-all font-sans">
                  {/* Mode Selector: Auto vs Manual */}
                  <div className="flex items-center justify-between gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => handleSwitchContributionMode('auto')}
                      className={`flex-1 py-1.5 text-center font-medium rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        contributionMode === 'auto'
                          ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Route className="w-3.5 h-3.5" />
                      <span>Auto Snapped</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSwitchContributionMode('manual')}
                      className={`flex-1 py-1.5 text-center font-medium rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        contributionMode === 'manual'
                          ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Manual Pins</span>
                    </button>
                  </div>

                  {contributionMode === 'auto' && (
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setAutoTravelMode('walking')}
                        className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          autoTravelMode === 'walking'
                            ? 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 shadow-2xs font-semibold'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                        title="Bi-directional street path: ignores one-way car traffic to prevent detour loops"
                      >
                        Bi-directional (No Loops)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutoTravelMode('driving')}
                        className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                          autoTravelMode === 'driving'
                            ? 'bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-400 shadow-2xs font-semibold'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                        }`}
                        title="Vehicular traffic rules: respects one-way car laws"
                      >
                        Vehicular Traffic
                      </button>
                    </div>
                  )}

                  {/* Pin Tool Quick Bar */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActivePinTool(prev => prev === 'start' ? 'none' : 'start')}
                      className={`px-2.5 py-1 rounded-lg border font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        activePinTool === 'start'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs font-semibold'
                          : 'bg-white hover:bg-emerald-50 text-emerald-800 border-zinc-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span>{drawnPoints.length > 0 ? 'Move Start' : 'Set Start'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePinTool(prev => prev === 'middle' ? 'none' : 'middle')}
                      className={`px-2.5 py-1 rounded-lg border font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        activePinTool === 'middle'
                          ? 'bg-blue-600 text-white border-blue-700 shadow-2xs font-semibold'
                          : 'bg-white hover:bg-blue-50 text-blue-800 border-zinc-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      <span>+ Waypoint</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivePinTool(prev => prev === 'end' ? 'none' : 'end')}
                      className={`px-2.5 py-1 rounded-lg border font-medium text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        activePinTool === 'end'
                          ? 'bg-red-600 text-white border-red-700 shadow-2xs font-semibold'
                          : 'bg-white hover:bg-red-50 text-red-800 border-zinc-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      <span>{drawnPoints.length > 1 ? 'Move End' : 'Set End'}</span>
                    </button>

                    {drawnPoints.length > 2 && (
                      <button
                        type="button"
                        onClick={handleClearMiddlePins}
                        className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-xs font-medium cursor-pointer"
                        title="Remove intermediate middle waypoints"
                      >
                        Clear Waypoints
                      </button>
                    )}

                    {snappedPath.length > 2 && middlePins.length === 0 && (
                      <button
                        type="button"
                        onClick={handlePopulateMiddlePins}
                        className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200 transition-colors cursor-pointer"
                        title="Extract draggable waypoints from the road path"
                      >
                        Distribute Nodes
                      </button>
                    )}
                  </div>

                  {/* Status Banner */}
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                    {contributionMode === 'auto' ? (
                      <>
                        {roadStatus === 'idle' && (
                          <p className="text-xs text-zinc-500">
                            Place <strong>Start</strong> and <strong>End</strong> terminals. Add <strong>Waypoints</strong> if corridor detours.
                          </p>
                        )}
                        {roadStatus === 'detecting' && (
                          <div className="flex items-center gap-2 text-xs font-medium text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-200">
                            <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                            <span>Computing route geometry through waypoints...</span>
                          </div>
                        )}
                        {roadStatus === 'found' && (
                          <div className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 space-y-0.5">
                            <p className="font-semibold flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              <span>Corridor snapped:</span>
                              <span className="font-mono text-emerald-900">{detectedRoadName || 'Road Network'}</span>
                            </p>
                            <p className="text-[11px] text-emerald-700 font-mono">
                              {middlePins.length > 0 ? `Routed through ${middlePins.length} intermediate waypoint(s).` : 'Add waypoints if route curves.'}
                            </p>
                          </div>
                        )}
                        {drawnPoints.length >= 2 && roadStatus === 'not_found' && (
                          <div className="text-xs text-red-700 bg-red-50 p-2 rounded-lg border border-red-200 space-y-0.5">
                            <p className="font-semibold">Route geometry not resolved</p>
                            <p className="text-[11px] text-red-600">
                              Place intermediate waypoints along corridor or switch to Manual Mode.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-xs text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-200">
                        <p className="font-semibold text-blue-700">Manual Drawing Active</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Click map to place geometry nodes. Drag existing pins to reposition.
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

          {/* User Live Location Marker */}
          {userLocation && (
            <AdvancedMarker
              position={userLocation}
              onClick={() => {
                if (map) {
                  map.panTo(userLocation);
                  map.setZoom(17);
                }
              }}
            >
              <div className="relative flex items-center justify-center cursor-pointer group select-none">
                <span className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping pointer-events-none" />
                <span className="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-lg shadow-blue-500/50" />
                <div className="absolute bottom-full mb-1.5 hidden group-hover:flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 text-white text-[10px] font-mono whitespace-nowrap shadow-md">
                  <span>Your Location</span>
                </div>
              </div>
            </AdvancedMarker>
          )}

          {/* Active Spatial Point of Interest Live Map Preview Marker */}
          {activePoiPreview && (
            <AdvancedMarker
              position={{ lat: activePoiPreview.lat, lng: activePoiPreview.lng }}
              onClick={() => setActivePoiPreview(null)}
            >
              <div className="relative select-none animate-in fade-in zoom-in-95 duration-200">
                {/* Live Preview Info Bubble */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-white/98 dark:bg-zinc-900/98 backdrop-blur-md rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-56 text-xs font-sans pointer-events-auto">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1">
                      {activePoiPreview.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePoiPreview(null);
                      }}
                      className="p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {activePoiPreview.category && (
                    <span className="inline-block mt-0.5 text-[9px] font-mono uppercase px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {activePoiPreview.category}
                    </span>
                  )}
                  {activePoiPreview.address && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {activePoiPreview.address}
                    </p>
                  )}
                  <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    {activePoiPreview.roadDistanceLabel ? (
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Route className="w-3 h-3 text-emerald-500" />
                        <span>{activePoiPreview.roadDistanceLabel}</span>
                      </span>
                    ) : activePoiPreview.distanceMeters !== undefined && activePoiPreview.distanceMeters !== null ? (
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-medium">
                        {activePoiPreview.distanceMeters === 0 ? 'On street' : `${activePoiPreview.distanceMeters}m away`}
                      </span>
                    ) : null}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activePoiPreview.title + ' ' + (activePoiPreview.address || 'Kolkata'))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      Directions <ArrowUpRight className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                {/* Marker Beacon */}
                <div className="flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </AdvancedMarker>
          )}

          {/* Archived Heritage Spots on Map */}
          {showHeritageSpots && !isContributing && heritageSpots.map((spot) => {
            const badge = getCategoryBadge(spot.category);
            const isSelected = selectedSpot?.id === spot.id;
            return (
              <AdvancedMarker
                key={`heritage-spot-${spot.id}`}
                position={{ lat: spot.lat, lng: spot.lng }}
                onClick={() => {
                  if (pathname !== '/') router.push('/');
                  setSelectedSpot(spot);
                  setActivePoiPreview(null);
                }}
                title={`${spot.title} (${spot.category})`}
              >
                <div
                  className={`cursor-pointer group select-none transition-all duration-200 flex flex-col items-center ${
                    isSelected ? 'scale-125 z-40' : 'hover:scale-110 z-20'
                  }`}
                >
                  <div
                    className={`px-2 py-0.5 rounded-full backdrop-blur-md border shadow-md text-[10px] font-semibold whitespace-nowrap mb-0.5 max-w-40 truncate flex items-center gap-1 transition-colors ${
                      isSelected
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white ring-2 ring-blue-500'
                        : 'bg-white/95 dark:bg-zinc-900/95 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <span>{badge.icon}</span>
                    <span className="truncate">{spot.title}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <div
                      className={`w-6 h-6 rounded-full ${badge.bg} border-2 border-white dark:border-zinc-900 shadow-lg flex items-center justify-center text-white text-[10px] ring-2 ${badge.ring}`}
                    >
                      {badge.icon}
                    </div>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

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

      {/* Spot / Landmark Sliding Right Panel (Matching StreetInfoPanel structure) */}
      {selectedSpot && !isContributing && (
        <SpotInfoPanel
          spot={selectedSpot}
          onClose={() => {
            setSelectedSpot(null);
            if (pathname !== '/') router.push('/');
          }}
          onEditSpot={(spot) => {
            setEditingSpot(spot);
          }}
        />
      )}

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

      {/* Choice Modal: Street vs Landmark Contribution */}
      {isContributeSelectOpen && (
        <ContributeSelectModal
          isOpen={isContributeSelectOpen}
          onClose={() => setIsContributeSelectOpen(false)}
          onSelectStreet={() => {
            setIsContributing(true);
            setDrawnPoints([]);
            setSnappedPath([]);
            setRoadStatus('idle');
            setContributionMode('auto');
            setActivePinTool('none');
          }}
          onSelectPlace={() => {
            handleOpenAddPlace();
          }}
        />
      )}

      {showAddPlaceModal && (
        <AddPlaceModal
          isOpen={showAddPlaceModal}
          onClose={() => {
            setShowAddPlaceModal(false);
            setAddPlaceInitialPos(null);
          }}
          initialLat={addPlaceInitialPos?.lat}
          initialLng={addPlaceInitialPos?.lng}
          initialTitle={addPlaceInitialPos?.title}
          initialAddress={addPlaceInitialPos?.address}
          initialPlaceId={addPlaceInitialPos?.placeId}
          initialStreetName={addPlaceInitialPos?.streetName}
          initialStreetId={addPlaceInitialPos?.streetId}
          onSuccess={(newPlace) => {
            setShowAddPlaceModal(false);
            setAddPlaceInitialPos(null);
            if (spatialRadius?.active) {
              triggerRadiusExplore(spatialRadius.center, spatialRadius.radiusMeters, spatialRadius.label);
            }
          }}
        />
      )}

      {/* Admin Quick Edit Spot Modal */}
      {editingSpot && (
        <EditPlaceModal
          isOpen={!!editingSpot}
          onClose={() => setEditingSpot(null)}
          place={editingSpot}
          onSuccess={() => {
            setEditingSpot(null);
            fetchHeritageSpots();
          }}
        />
      )}
    </>
  );
}

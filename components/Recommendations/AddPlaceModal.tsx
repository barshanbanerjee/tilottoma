"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  X,
  MapPin,
  Crosshair,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Navigation,
  Compass,
  Search,
  Star,
  RotateCcw,
  Sliders,
  Check,
  Building,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  initialTitle?: string | null;
  initialAddress?: string | null;
  initialPlaceId?: string | null;
  initialStreetId?: string | null;
  initialStreetName?: string | null;
  onSuccess?: (newPlace: any) => void;
}

const CATEGORIES = [
  { id: 'Food & Adda', label: '☕ Food & Adda' },
  { id: 'Heritage Sites', label: '🏛️ Heritage Sites' },
  { id: 'Culture & Books', label: '📚 Culture & Books' },
  { id: 'Markets & Gems', label: '🛍️ Markets & Gems' },
  { id: 'Art & Architecture', label: '🎨 Art & Architecture' },
];

const ZONES = [
  'Central Kolkata',
  'North Kolkata',
  'South Kolkata',
  'Howrah & Hooghly',
  'East Kolkata',
];

// Helper to deduce zone from address string
function detectZoneFromAddress(address: string): string {
  const lower = address.toLowerCase();
  if (lower.includes('shyambazar') || lower.includes('sovabazar') || lower.includes('bagbazar') || lower.includes('chitpur') || lower.includes('kumartuli') || lower.includes('north kolkata')) {
    return 'North Kolkata';
  }
  if (lower.includes('bhowanipore') || lower.includes('alipore') || lower.includes('ballygunge') || lower.includes('gariahat') || lower.includes('tollygunge') || lower.includes('kalighat') || lower.includes('south kolkata')) {
    return 'South Kolkata';
  }
  if (lower.includes('howrah') || lower.includes('hooghly') || lower.includes('shibpur') || lower.includes('salkia') || lower.includes('ghat')) {
    return 'Howrah & Hooghly';
  }
  if (lower.includes('salt lake') || lower.includes('bidhannagar') || lower.includes('new town') || lower.includes('tangra') || lower.includes('east kolkata')) {
    return 'East Kolkata';
  }
  return 'Central Kolkata'; // Default
}

// Helper to deduce category from Google Place types
function deduceCategoryFromTypes(types: string[]): string {
  if (!types || types.length === 0) return 'Heritage Sites';
  const joined = types.join(' ').toLowerCase();
  if (joined.includes('restaurant') || joined.includes('cafe') || joined.includes('food') || joined.includes('bakery') || joined.includes('bar')) {
    return 'Food & Adda';
  }
  if (joined.includes('library') || joined.includes('book_store') || joined.includes('university') || joined.includes('school')) {
    return 'Culture & Books';
  }
  if (joined.includes('shopping_mall') || joined.includes('store') || joined.includes('clothing_store') || joined.includes('market')) {
    return 'Markets & Gems';
  }
  if (joined.includes('art_gallery') || joined.includes('museum')) {
    return 'Art & Architecture';
  }
  return 'Heritage Sites';
}

// Inner map controller to sync pan when coordinates change
function MiniMapSync({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (map && Number.isFinite(lat) && Number.isFinite(lng)) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng]);
  return null;
}

function parseCoord(val: any, fallback: number): number {
  if (typeof val === 'function') {
    try {
      const res = val();
      return typeof res === 'number' && Number.isFinite(res) ? res : fallback;
    } catch {
      return fallback;
    }
  }
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

interface SelectedPlaceInstance {
  placeId?: string;
  name: string;
  formattedAddress?: string;
  lat: number;
  lng: number;
  rating?: number | null;
  userRatingsTotal?: number | null;
  photoUrl?: string | null;
  types?: string[];
}

export default function AddPlaceModal({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  initialTitle,
  initialAddress,
  initialPlaceId,
  initialStreetId,
  initialStreetName,
  onSuccess,
}: AddPlaceModalProps) {
  const { user, openAuthModal } = useAuth();
  const geocodingLib = useMapsLibrary('geocoding');
  const placesLib = useMapsLibrary('places');
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);

  // Two modes: 'auto' (default) and 'manual'
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');

  // Position state (default: Kolkata central if not specified)
  const defaultPos = { lat: 22.5726, lng: 88.3639 };
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number }>({
    lat: parseCoord(initialLat, defaultPos.lat),
    lng: parseCoord(initialLng, defaultPos.lng),
  });

  // Selected Google Place instance in Auto mode
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlaceInstance | null>(() => {
    if (initialTitle && initialLat && initialLng) {
      return {
        placeId: initialPlaceId || undefined,
        name: initialTitle,
        formattedAddress: initialAddress || undefined,
        lat: parseCoord(initialLat, defaultPos.lat),
        lng: parseCoord(initialLng, defaultPos.lng),
      };
    }
    return null;
  });

  // Search input for Google Places in Auto mode
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPredictions, setSearchPredictions] = useState<any[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Form Fields
  const [customTitle, setCustomTitle] = useState(initialTitle || '');
  const [category, setCategory] = useState('Food & Adda');
  const [zone, setZone] = useState('Central Kolkata');
  const [address, setAddress] = useState(initialAddress || '');
  const [description, setDescription] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initialize geocoder & places services
  useEffect(() => {
    if (geocodingLib && !geocoderRef.current) {
      geocoderRef.current = new geocodingLib.Geocoder();
    }
    if (placesLib && !autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new placesLib.AutocompleteService();
    }
  }, [geocodingLib, placesLib]);

  // Synchronize initial preset props when modal opens
  useEffect(() => {
    if (initialTitle || (initialLat !== undefined && initialLng !== undefined)) {
      const lat = parseCoord(initialLat, defaultPos.lat);
      const lng = parseCoord(initialLng, defaultPos.lng);
      setPinPosition({ lat, lng });

      if (initialTitle) {
        setCustomTitle(initialTitle);
        setSelectedPlace({
          placeId: initialPlaceId || undefined,
          name: initialTitle,
          formattedAddress: initialAddress || undefined,
          lat,
          lng,
        });
      }

      if (initialAddress) {
        setAddress(initialAddress);
        setZone(detectZoneFromAddress(initialAddress));
      } else if (!initialTitle) {
        reverseGeocode(lat, lng);
      }
    }
  }, [initialLat, initialLng, initialTitle, initialAddress, initialPlaceId]);

  // Reverse geocoding helper (used for manual mode)
  const reverseGeocode = useCallback(async (rawLat: number, rawLng: number) => {
    if (!geocoderRef.current) return;
    const lat = parseCoord(rawLat, 22.5726);
    const lng = parseCoord(rawLng, 88.3639);
    setIsGeocoding(true);
    try {
      const response = await geocoderRef.current.geocode({ location: { lat, lng } });
      if (response.results && response.results.length > 0) {
        const topResult = response.results[0];
        const formatted = topResult.formatted_address;
        setAddress(formatted);
        const deducedZone = detectZoneFromAddress(formatted);
        setZone(deducedZone);
      }
    } catch {
      // Ignore geocode error
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Update pin position and auto-geocode (Manual mode)
  const handleSetPosition = (newLat: any, newLng: any) => {
    const lat = parseCoord(newLat, defaultPos.lat);
    const lng = parseCoord(newLng, defaultPos.lng);
    setPinPosition({ lat, lng });
    reverseGeocode(lat, lng);
  };

  // Google Places Autocomplete search for Auto Mode
  useEffect(() => {
    if (mode !== 'auto' || !searchQuery.trim() || !autocompleteServiceRef.current) {
      setSearchPredictions([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearchingPlaces(true);
      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(22.3, 88.1),
        new google.maps.LatLng(22.8, 88.6)
      );

      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: searchQuery,
          bounds,
          componentRestrictions: { country: 'in' },
        },
        (predictions, status) => {
          setIsSearchingPlaces(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSearchPredictions(predictions.slice(0, 5));
          } else {
            setSearchPredictions([]);
          }
        }
      );
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery, mode]);

  // Select place from Google Places prediction in Auto Mode
  const handleSelectGooglePlace = async (pred: any) => {
    setIsLoadingDetails(true);
    setSearchPredictions([]);
    setSearchQuery('');

    try {
      const res = await fetch(`/api/place-details?placeId=${encodeURIComponent(pred.place_id)}`);
      if (res.ok) {
        const data = await res.json();
        const lat = parseCoord(data.lat, defaultPos.lat);
        const lng = parseCoord(data.lng, defaultPos.lng);

        const placeInstance: SelectedPlaceInstance = {
          placeId: pred.place_id,
          name: data.name || pred.structured_formatting.main_text,
          formattedAddress: data.formattedAddress || pred.description,
          lat,
          lng,
          rating: data.rating,
          userRatingsTotal: data.userRatingsTotal,
          photoUrl: data.photos && data.photos.length > 0 ? data.photos[0].url : null,
          types: data.types || pred.types || [],
        };

        setSelectedPlace(placeInstance);
        setPinPosition({ lat, lng });
        setAddress(placeInstance.formattedAddress || '');
        setZone(detectZoneFromAddress(placeInstance.formattedAddress || ''));
        setCategory(deduceCategoryFromTypes(placeInstance.types || []));

        // Pre-fill custom title if empty or matching old place name
        if (!customTitle || customTitle === selectedPlace?.name) {
          setCustomTitle(placeInstance.name);
        }
      }
    } catch (err) {
      console.error('Failed to load place details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Locate user with GPS (Manual mode)
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        handleSetPosition(lat, lng);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        alert('Could not retrieve your current location. Please drag the pin on the map instead.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Submit place
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const titleToSave = customTitle.trim() || selectedPlace?.name || '';
    if (!titleToSave) {
      setError('Please provide a title or select a place.');
      return;
    }

    if (!description.trim()) {
      setError('Please provide historical folklore or cultural notes for this spot.');
      return;
    }

    if (!user) {
      openAuthModal('login');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const effectiveLat = mode === 'auto' && selectedPlace ? selectedPlace.lat : pinPosition.lat;
    const effectiveLng = mode === 'auto' && selectedPlace ? selectedPlace.lng : pinPosition.lng;
    const effectiveAddress = mode === 'auto' && selectedPlace?.formattedAddress ? selectedPlace.formattedAddress : address;

    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleToSave,
          category,
          zone,
          streetId: initialStreetId || null,
          address: effectiveAddress?.trim() || null,
          lat: effectiveLat,
          lng: effectiveLng,
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit place.');
        return;
      }

      setSuccessMsg(data.message || 'Spot successfully saved!');
      if (onSuccess && data.recommendation) {
        onSuccess(data.recommendation);
      }

      // Dispatch global event so maps and lists refresh
      window.dispatchEvent(
        new CustomEvent('places:created', { detail: data.recommendation })
      );

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                Recommend Heritage Spot
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Auto-sync verified Google Place instances or manually place pins with custom historical titles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 font-sans text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TWO OPTIONS MODE SELECTOR: AUTO (DEFAULT) VS MANUAL */}
          <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'auto'
                  ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Auto (Google Places)</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 font-bold">
                Default
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'manual'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-blue-500" />
              <span>Manual Pinpoint</span>
            </button>
          </div>

          {/* MODE A: AUTO (TAKES PLACE FROM PLACES API INSTANCE) */}
          {mode === 'auto' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Google Places Auto-Instance</span>
                </span>
                {selectedPlace && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlace(null);
                      setSearchQuery('');
                    }}
                    className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Change Place</span>
                  </button>
                )}
              </div>

              {/* If no place selected, show autocomplete search bar */}
              {!selectedPlace ? (
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search place on Google (e.g. The Park Hotel, Flurys, Presidency College)..."
                      className="w-full pl-9 pr-8 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    {isSearchingPlaces && (
                      <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin absolute right-3" />
                    )}
                  </div>

                  {/* Autocomplete Predictions Dropdown */}
                  {searchPredictions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-20 divide-y divide-zinc-100 dark:divide-zinc-800">
                      {searchPredictions.map((pred) => (
                        <button
                          key={pred.place_id}
                          type="button"
                          onClick={() => handleSelectGooglePlace(pred)}
                          className="w-full text-left p-2.5 hover:bg-amber-50 dark:hover:bg-zinc-800/80 transition-colors flex items-start gap-2 cursor-pointer"
                        >
                          <Building className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                              {pred.structured_formatting.main_text}
                            </p>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                              {pred.structured_formatting.secondary_text}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Place Verified Instance Card */
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-start gap-3 shadow-2xs">
                  {selectedPlace.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedPlace.photoUrl}
                      alt={selectedPlace.name}
                      className="w-16 h-16 rounded-lg object-cover shrink-0 border border-zinc-200 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Building className="w-7 h-7 opacity-80" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        ✓ GOOGLE INSTANCE ATTACHED
                      </span>
                      {selectedPlace.rating && (
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-current" />
                          <span>{selectedPlace.rating}</span>
                          {selectedPlace.userRatingsTotal && (
                            <span className="text-zinc-400 font-normal">
                              ({selectedPlace.userRatingsTotal})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 mt-1 truncate">
                      {selectedPlace.name}
                    </h4>
                    {selectedPlace.formattedAddress && (
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                        {selectedPlace.formattedAddress}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                      <span>LAT: {selectedPlace.lat.toFixed(5)}</span>
                      <span>•</span>
                      <span>LNG: {selectedPlace.lng.toFixed(5)}</span>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingDetails && (
                <div className="flex items-center gap-2 text-[11px] text-amber-600 py-1 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading full Google Place telemetry...</span>
                </div>
              )}
            </div>
          )}

          {/* MODE B: MANUAL (FREEFORM DRAGGABLE PIN MAP) */}
          {mode === 'manual' && (
            <div className="space-y-1.5 p-3 rounded-xl bg-blue-50/30 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>Interactive Draggable Pin (Fully Manual)</span>
                  {isGeocoding && <span className="text-[10px] text-blue-600 font-normal animate-pulse">(resolving...)</span>}
                </label>

                <button
                  type="button"
                  onClick={handleUseMyLocation}
                  disabled={isLocating}
                  className="px-2 py-0.5 rounded-lg bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700 text-[10px] shadow-2xs"
                >
                  <Crosshair className={`w-3 h-3 text-blue-600 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Locating...' : '🎯 My GPS'}</span>
                </button>
              </div>

              {/* Embedded Google Map with Draggable Pin */}
              <div className="relative w-full h-44 sm:h-48 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 shadow-inner">
                <Map
                  defaultCenter={pinPosition}
                  defaultZoom={16}
                  mapId="tilottoma-picker-map"
                  gestureHandling="greedy"
                  disableDefaultUI={true}
                  className="w-full h-full"
                  onClick={(e) => {
                    if (e.detail.latLng) {
                      handleSetPosition(e.detail.latLng.lat, e.detail.latLng.lng);
                    }
                  }}
                >
                  <MiniMapSync lat={pinPosition.lat} lng={pinPosition.lng} />

                  <AdvancedMarker
                    position={pinPosition}
                    draggable={true}
                    onDragEnd={(e) => {
                      if (e.latLng) {
                        const lat = typeof e.latLng.lat === 'function' ? e.latLng.lat() : Number(e.latLng.lat);
                        const lng = typeof e.latLng.lng === 'function' ? e.latLng.lng() : Number(e.latLng.lng);
                        handleSetPosition(lat, lng);
                      }
                    }}
                  >
                    <div className="cursor-grab active:cursor-grabbing select-none group flex flex-col items-center">
                      <div className="px-2 py-0.5 rounded-md bg-zinc-900/90 text-white text-[9px] font-mono whitespace-nowrap shadow-md -translate-y-1">
                        Drag me
                      </div>
                      <Pin background="#2563eb" borderColor="#1d4ed8" glyphColor="#ffffff" scale={1.05} />
                    </div>
                  </AdvancedMarker>
                </Map>

                {/* Coordinates Pill Overlay */}
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-zinc-950/85 backdrop-blur-xs text-white text-[10px] font-mono border border-white/10 shadow-md">
                  LAT: {parseCoord(pinPosition.lat, 22.5726).toFixed(5)} · LNG: {parseCoord(pinPosition.lng, 88.3639).toFixed(5)}
                </div>
              </div>
              <p className="text-[10px] text-zinc-400">
                💡 Tip: Click anywhere or drag the blue pin to pinpoint custom coordinates without needing a Google Place.
              </p>
            </div>
          )}

          {/* SCOPE TO ADD CUSTOM TITLE */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                {mode === 'auto' ? 'Custom Title / Heritage Moniker *' : 'Place / Spot Title *'}
              </label>
              <span className="text-[10px] text-zinc-400 font-mono">
                {mode === 'auto' ? 'Customizable' : 'Required'}
              </span>
            </div>
            <input
              type="text"
              required
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={
                mode === 'auto'
                  ? 'e.g. Historic Indian Coffee House - Adda of the Intellectuals'
                  : 'e.g. Bow Barracks Bakery, Nakur Chandra Nandy, Basanta Cabin'
              }
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            {mode === 'auto' && (
              <p className="text-[10px] text-zinc-400 mt-1">
                💡 You can provide a custom title, Bengali alias, or historical moniker while retaining the verified Google Place location and telemetry.
              </p>
            )}
          </div>

          {/* Category & Zone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Zone / Locality
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Postal Address */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
              Postal Address / Landmark Reference
            </label>
            <input
              type="text"
              value={mode === 'auto' && selectedPlace?.formattedAddress ? selectedPlace.formattedAddress : address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 15 Bankim Chatterjee St, College Street, Kolkata"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Cultural & Historical Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
              Historical Folklore & Cultural Memory *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this spot special? Historical patrons, colonial recipes, architectural lore, famous addas, or literary gatherings..."
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-y"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{submitting ? 'Publishing...' : 'Add Heritage Spot'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

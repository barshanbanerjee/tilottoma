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
  Compass,
  Save,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface EditPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: {
    id: string;
    title: string;
    category: string;
    zone: string;
    description: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    streetId?: string | null;
    streetName?: string | null;
  } | null;
  onSuccess?: (updated: any) => void;
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

export default function EditPlaceModal({
  isOpen,
  onClose,
  place,
  onSuccess,
}: EditPlaceModalProps) {
  const { user, canModerate } = useAuth();
  const defaultPos = { lat: 22.5726, lng: 88.3639 };
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Food & Adda');
  const [zone, setZone] = useState('Central Kolkata');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('APPROVED');
  const [pinPosition, setPinPosition] = useState<{ lat: number; lng: number }>(defaultPos);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (geocodingLib && !geocoderRef.current) {
      geocoderRef.current = new geocodingLib.Geocoder();
    }
  }, [geocodingLib]);

  useEffect(() => {
    if (place) {
      setTitle(place.title || '');
      setCategory(place.category || 'Food & Adda');
      setZone(place.zone || 'Central Kolkata');
      setAddress(place.address || '');
      setDescription(place.description || '');
      setStatus(place.status || 'APPROVED');
      setPinPosition({
        lat: parseCoord(place.lat, defaultPos.lat),
        lng: parseCoord(place.lng, defaultPos.lng),
      });
      setError(null);
    }
  }, [place]);

  const reverseGeocode = useCallback(async (rawLat: number, rawLng: number) => {
    if (!geocoderRef.current) return;
    const lat = parseCoord(rawLat, defaultPos.lat);
    const lng = parseCoord(rawLng, defaultPos.lng);
    setIsGeocoding(true);
    try {
      const response = await geocoderRef.current.geocode({ location: { lat, lng } });
      if (response.results && response.results.length > 0) {
        setAddress(response.results[0].formatted_address);
      }
    } catch {
      // Ignore geocode error
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const handleSetPosition = (newLat: any, newLng: any) => {
    const lat = parseCoord(newLat, defaultPos.lat);
    const lng = parseCoord(newLng, defaultPos.lng);
    setPinPosition({ lat, lng });
    reverseGeocode(lat, lng);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        handleSetPosition(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setIsLocating(false);
        alert('Could not retrieve current location.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!place) return;

    if (!title.trim() || !description.trim()) {
      setError('Please provide a title and historical notes.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/recommendations/${place.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          zone,
          address: address.trim() || null,
          lat: pinPosition.lat,
          lng: pinPosition.lng,
          description: description.trim(),
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update place.');
        return;
      }

      window.dispatchEvent(new CustomEvent('places:updated', { detail: data }));
      if (onSuccess) onSuccess(data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error updating place.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !place) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                Edit Heritage Place / Spot
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Update coordinates, title, status, and historical archival folklore
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
          {!canModerate && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">Contributor Submission Workflow</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                  As a Contributor, your proposed edits will be queued for Admin review. The spot will enter <strong>PENDING</strong> status until reviewed and approved by an administrator.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Interactive Draggable Pin Map */}
          <div className="space-y-1.5 p-3 rounded-xl bg-blue-50/30 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/40">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                <span>Adjust Pin Location</span>
                {isGeocoding && <span className="text-[10px] text-blue-600 font-normal animate-pulse">(resolving address...)</span>}
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

            <div className="relative w-full h-44 sm:h-48 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 shadow-inner">
              <Map
                defaultCenter={pinPosition}
                defaultZoom={16}
                mapId="tilottoma-edit-map"
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
              💡 Drag the pin or click anywhere on the map to update the exact geographic coordinates.
            </p>
          </div>

          {/* Place Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
              Spot / Place Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Indian Coffee House"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category, Zone & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                {canModerate ? 'Publication Status' : 'Review Status'}
              </label>
              {canModerate ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="APPROVED">🟢 APPROVED (Live on Map)</option>
                  <option value="PENDING">🟡 PENDING (Review Draft)</option>
                  <option value="REJECTED">🔴 REJECTED</option>
                </select>
              ) : (
                <div className="w-full px-3 py-2 border border-amber-200 dark:border-amber-800/80 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-medium text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>Queued for Admin Approval (PENDING)</span>
                </div>
              )}
            </div>
          </div>

          {/* Postal Address */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
              Postal Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 15 Bankim Chatterjee St, College Street, Kolkata"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : canModerate ? 'Save Place Changes' : 'Submit Edits for Approval'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

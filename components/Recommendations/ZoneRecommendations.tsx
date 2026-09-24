"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils,
  Landmark,
  BookOpen,
  ShoppingBag,
  MapPin,
  Plus,
  Compass,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ArrowUpRight,
  Navigation,
  Crosshair,
  Route,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AddPlaceModal from './AddPlaceModal';

export interface RecommendationItem {
  id: string;
  streetId?: string | null;
  zone: string;
  title: string;
  category: string;
  description: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  contributorName?: string | null;
  createdAt: string;
  distanceMeters?: number | null;
}

const CATEGORIES = [
  { id: 'ALL', label: 'All Heritage', icon: Compass },
  { id: 'Food & Adda', label: 'Culinary & Adda', icon: Utensils },
  { id: 'Heritage Sites', label: 'Historic Relics', icon: Landmark },
  { id: 'Culture & Books', label: 'Literature & Books', icon: BookOpen },
  { id: 'Markets & Gems', label: 'Bazaars & Gems', icon: ShoppingBag },
];

const RADIUS_OPTIONS = [
  { label: '3 km', value: 3000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '20 km', value: 20000 },
];

interface ZoneRecommendationsProps {
  streetId?: string;
  streetName: string;
  zone?: string;
  centerCoords?: { lat: number; lng: number } | null;
}

export default function ZoneRecommendations({
  streetId,
  streetName,
  zone = 'Central Kolkata',
  centerCoords,
}: ZoneRecommendationsProps) {
  const { user, openAuthModal } = useAuth();

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [activePoiId, setActivePoiId] = useState<string | null>(null);

  // Radius Exploration State (Default: 5km)
  const [radiusMeters, setRadiusMeters] = useState<number>(5000);
  const [originMode, setOriginMode] = useState<'street' | 'around_me'>('street');
  const [userGps, setUserGps] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Map Circle Toggle (Only active in recommendations system when explicitly enabled)
  const [showMapCircle, setShowMapCircle] = useState(false);

  // Add Place Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Fetch recommendations based on origin and radius
  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/recommendations?radius=${radiusMeters}`;

      if (originMode === 'around_me' && userGps) {
        url += `&lat=${userGps.lat}&lng=${userGps.lng}`;
      } else if (centerCoords) {
        url += `&lat=${centerCoords.lat}&lng=${centerCoords.lng}`;
      } else if (streetId) {
        url += `&streetId=${streetId}`;
      } else {
        url += `&zone=${encodeURIComponent(zone)}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch (e) {
      console.error('Failed to load recommendations:', e);
    } finally {
      setLoading(false);
    }
  }, [radiusMeters, originMode, userGps, centerCoords, streetId, zone]);

  // Synchronize circle with map ONLY when showMapCircle is explicitly enabled
  useEffect(() => {
    if (!showMapCircle) {
      window.dispatchEvent(new CustomEvent('recommendations:radius_cleared'));
      return;
    }

    const effectiveCenter =
      originMode === 'around_me' && userGps
        ? userGps
        : centerCoords || { lat: 22.5726, lng: 88.3639 };

    window.dispatchEvent(
      new CustomEvent('recommendations:radius_changed', {
        detail: {
          active: true,
          center: effectiveCenter,
          radiusMeters,
          places: recommendations,
          label: originMode === 'around_me' ? 'Around Me' : streetName ? `Near ${streetName}` : 'Zone Coverage',
        },
      })
    );
  }, [showMapCircle, recommendations, radiusMeters, originMode, userGps, centerCoords, streetName]);

  // Clean up radius circle when unmounting (e.g. leaving recommendations)
  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('recommendations:radius_cleared'));
    };
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Listen for externally dispatched explore radius event (e.g. from Search bar or POI click)
  useEffect(() => {
    const handleExploreRadius = (e: any) => {
      if (e.detail?.radiusMeters) {
        setRadiusMeters(e.detail.radiusMeters);
      }
    };
    window.addEventListener('recommendations:explore_radius', handleExploreRadius);
    return () => window.removeEventListener('recommendations:explore_radius', handleExploreRadius);
  }, []);

  // Listen for newly created places to refresh list
  useEffect(() => {
    const handlePlaceCreated = () => {
      fetchRecommendations();
    };
    window.addEventListener('places:created', handlePlaceCreated);
    return () => window.removeEventListener('places:created', handlePlaceCreated);
  }, [fetchRecommendations]);

  // Locate user GPS for "Around Me"
  const handleToggleAroundMe = () => {
    if (originMode === 'around_me') {
      setOriginMode('street');
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setUserGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setOriginMode('around_me');
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        alert('Could not determine current location. Defaulting to street extent.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleOpenAddModal = () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    setIsAddModalOpen(true);
  };

  // Focus map on selected point of interest
  const handleSelectPoi = (item: RecommendationItem) => {
    setActivePoiId(item.id);
    if (item.lat && item.lng) {
      window.dispatchEvent(
        new CustomEvent('focus-poi', {
          detail: {
            id: item.id,
            lat: item.lat,
            lng: item.lng,
            title: item.title,
            address: item.address,
            category: item.category,
            distanceMeters: item.distanceMeters,
          },
        })
      );
    }
  };

  const filteredItems = recommendations.filter((item) =>
    selectedCategory === 'ALL' ? true : item.category === selectedCategory
  );

  return (
    <div className="space-y-3 font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-400/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Spatial Recommendations
            </h4>
            <p className="text-[10px] text-zinc-400 font-mono">
              {originMode === 'around_me' ? 'AROUND YOUR GPS LOCATION' : `NEAR ${streetName.toUpperCase()}`}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          <span>Add Spot</span>
        </button>
      </div>

      {/* Radius Selector & Origin Bar */}
      <div className="p-2.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 space-y-2">
        <div className="flex items-center justify-between text-xs gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Search Radius:
          </span>

          <div className="flex items-center gap-1.5">
            {/* Show Radius on Map Toggle */}
            <button
              type="button"
              onClick={() => setShowMapCircle((prev) => !prev)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                showMapCircle
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
              title="Toggle interactive coverage circle on the map"
            >
              <Compass className="w-2.5 h-2.5" />
              <span>{showMapCircle ? 'Map Circle: ON' : 'Map Circle: OFF'}</span>
            </button>

            {/* Around Me Toggle */}
            <button
              type="button"
              onClick={handleToggleAroundMe}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                originMode === 'around_me'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Crosshair className={`w-2.5 h-2.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{originMode === 'around_me' ? 'Around Me' : 'Around Me'}</span>
            </button>
          </div>
        </div>

        {/* Radius Pill Selector: 3km, 5km, 10km, 20km */}
        <div className="grid grid-cols-4 gap-1.5">
          {RADIUS_OPTIONS.map((opt) => {
            const isSelected = radiusMeters === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRadiusMeters(opt.value)}
                className={`py-1 text-center rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-600 text-white font-bold shadow-2xs'
                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-amber-50 dark:hover:bg-zinc-700'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Categories Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all cursor-pointer ${
                isSelected
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800 font-medium'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Spot Cards List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {filteredItems.map((item) => {
            const isFocused = activePoiId === item.id;
            const distanceFormatted =
              item.distanceMeters !== undefined && item.distanceMeters !== null
                ? item.distanceMeters === 0
                  ? 'On Corridor'
                  : item.distanceMeters < 1000
                  ? `${item.distanceMeters} m road distance`
                  : `${(item.distanceMeters / 1000).toFixed(1)} km road distance`
                : null;

            return (
              <div
                key={item.id}
                onClick={() => handleSelectPoi(item)}
                className={`p-3.5 rounded-xl border space-y-1.5 transition-all cursor-pointer group ${
                  isFocused
                    ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-500 shadow-xs ring-1 ring-amber-500/30'
                    : 'bg-white dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h5 className="font-sans font-semibold text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h5>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {distanceFormatted && (
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/40 inline-flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {distanceFormatted}
                      </span>
                    )}
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
                      {item.category}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans line-clamp-2">
                  {item.description}
                </p>

                {item.address && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 pt-0.5 truncate">
                    <span className="truncate">{item.address}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                  <div className="text-[10px] font-mono text-zinc-400 truncate">
                    {item.contributorName ? `CURATED BY ${item.contributorName.toUpperCase()}` : 'HERITAGE SPOT'}
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat && item.lng ? `${item.lat},${item.lng}` : encodeURIComponent(item.title + ' ' + (item.address || 'Kolkata'))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 inline-flex items-center gap-0.5"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>Directions</span>
                    </a>
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                      Focus Map <ArrowUpRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-sans space-y-1.5">
          <p className="font-mono text-[11px]">
            NO SPOTS FOUND WITHIN {radiusMeters / 1000} KM IN THIS CATEGORY
          </p>
          <button
            onClick={handleOpenAddModal}
            className="text-amber-600 dark:text-amber-400 font-semibold hover:underline text-xs"
          >
            + Be the first to recommend a spot here
          </button>
        </div>
      )}

      {/* Add Place Modal with Draggable Pin */}
      <AddPlaceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialLat={centerCoords?.lat || userGps?.lat || 22.5726}
        initialLng={centerCoords?.lng || userGps?.lng || 88.3639}
        initialStreetId={streetId}
        initialStreetName={streetName}
        onSuccess={() => {
          fetchRecommendations();
        }}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, MapPin, Route, Landmark, X, ArrowUpRight, Compass, Sparkles, Navigation } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMapsLibrary, useMap } from "@vis.gl/react-google-maps";

interface IndexedStreetOption {
  id: string;
  name: string;
  slug: string;
  status: string;
  tags?: string[] | null;
  historicalNames?: { name: string }[];
  centroid?: { coordinates: [number, number] } | null;
}

interface PlacePredictionOption {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullDescription: string;
  types: string[];
}

export default function StreetSearch() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();

  const map = useMap();
  const placesLib = useMapsLibrary("places");
  const geocodingLib = useMapsLibrary("geocoding");

  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  const [indexedStreets, setIndexedStreets] = useState<IndexedStreetOption[]>([]);
  const [placePredictions, setPlacePredictions] = useState<PlacePredictionOption[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize Places & Geocoding services
  useEffect(() => {
    if (placesLib) {
      autocompleteServiceRef.current = new placesLib.AutocompleteService();
      if (map) {
        placesServiceRef.current = new placesLib.PlacesService(map);
      }
    }
    if (geocodingLib) {
      geocoderRef.current = new geocodingLib.Geocoder();
    }
  }, [placesLib, geocodingLib, map]);

  // Load available indexed corridors
  useEffect(() => {
    fetch("/api/admin/contributions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.contributions) {
          setIndexedStreets(data.contributions);
        }
      })
      .catch(() => {});
  }, []);

  // Filter local indexed corridors matching query
  const matchingStreets = query.trim().length > 0
    ? indexedStreets.filter((st) => {
        const q = query.toLowerCase().trim();
        const nameMatch = st.name.toLowerCase().includes(q);
        const tagMatch = st.tags?.some((t) => t.toLowerCase().includes(q));
        const oldNameMatch = st.historicalNames?.some((h) => h.name.toLowerCase().includes(q));
        return nameMatch || tagMatch || oldNameMatch;
      }).slice(0, 4)
    : [];

  // Query Google Places Autocomplete with debounce
  useEffect(() => {
    if (!query.trim() || !autocompleteServiceRef.current) {
      setPlacePredictions([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoadingPredictions(true);
      const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(22.3, 88.1), // Greater Kolkata SW
        new google.maps.LatLng(22.8, 88.6)  // Greater Kolkata NE
      );

      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: query,
          bounds,
          componentRestrictions: { country: "in" },
        },
        (predictions, status) => {
          setIsLoadingPredictions(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setPlacePredictions(
              predictions.slice(0, 5).map((p) => ({
                placeId: p.place_id,
                mainText: p.structured_formatting.main_text,
                secondaryText: p.structured_formatting.secondary_text || "",
                fullDescription: p.description,
                types: p.types || [],
              }))
            );
          } else {
            setPlacePredictions([]);
          }
        }
      );
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  // Total selectable items count
  const totalOptions = matchingStreets.length + placePredictions.length;

  // Handle Street Corridor selection
  const handleSelectStreet = (street: IndexedStreetOption) => {
    setIsFocused(false);
    setQuery(street.name);

    if (street.centroid?.coordinates && map) {
      map.panTo({
        lng: street.centroid.coordinates[0],
        lat: street.centroid.coordinates[1],
      });
      map.setZoom(16);
    }

    router.push(`/street/${street.slug}`);
  };

  // Handle Google Place / Locality selection (e.g. Salt Lake, Victoria Memorial)
  const handleSelectPlace = (place: PlacePredictionOption) => {
    setIsFocused(false);
    setQuery(place.mainText);

    const resolveCoordsAndNavigate = (lat: number, lng: number, placeName: string, placeId?: string) => {
      if (map) {
        map.panTo({ lat, lng });
        const isBroadArea = place.types.includes("sublocality") || place.types.includes("locality") || place.types.includes("administrative_area_level_3");
        map.setZoom(isBroadArea ? 14 : 17);
      }

      // Dispatch search marker event with placeId to open place details modal by default
      window.dispatchEvent(
        new CustomEvent("map:search", {
          detail: {
            lat,
            lng,
            name: placeName,
            address: place.secondaryText,
            isArea: true,
            placeId: placeId || place.placeId,
          },
        })
      );
    };

    if (placesServiceRef.current) {
      placesServiceRef.current.getDetails(
        { placeId: place.placeId, fields: ["geometry", "name", "formatted_address"] },
        (result, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
            const lat = result.geometry.location.lat();
            const lng = result.geometry.location.lng();
            resolveCoordsAndNavigate(lat, lng, result.name || place.mainText, place.placeId);
          } else if (geocoderRef.current) {
            // Fallback to Geocoding
            geocoderRef.current.geocode({ placeId: place.placeId }, (geoResults, geoStatus) => {
              if (geoStatus === "OK" && geoResults?.[0]?.geometry?.location) {
                const lat = geoResults[0].geometry.location.lat();
                const lng = geoResults[0].geometry.location.lng();
                resolveCoordsAndNavigate(lat, lng, place.mainText, place.placeId);
              }
            });
          }
        }
      );
    }
  };

  // Handle Keyboard Navigation (ArrowUp, ArrowDown, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : totalOptions - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < matchingStreets.length) {
        handleSelectStreet(matchingStreets[selectedIndex]);
      } else if (selectedIndex >= matchingStreets.length && selectedIndex < totalOptions) {
        handleSelectPlace(placePredictions[selectedIndex - matchingStreets.length]);
      } else if (matchingStreets.length > 0) {
        handleSelectStreet(matchingStreets[0]);
      } else if (placePredictions.length > 0) {
        handleSelectPlace(placePredictions[0]);
      } else if (query.trim() && geocoderRef.current) {
        // Direct Geocode fallback for freeform queries (e.g. "Salt Lake", "Chowringhee")
        geocoderRef.current.geocode(
          { address: `${query}, Kolkata, West Bengal` },
          (results, status) => {
            if (status === "OK" && results?.[0]?.geometry?.location) {
              const lat = results[0].geometry.location.lat();
              const lng = results[0].geometry.location.lng();
              if (map) {
                map.panTo({ lat, lng });
                map.setZoom(15);
              }
              window.dispatchEvent(
                new CustomEvent("map:search", {
                  detail: {
                    lat,
                    lng,
                    name: query,
                    address: results[0].formatted_address,
                    placeId: results[0].place_id,
                  },
                })
              );
            }
          }
        );
      }
    } else if (e.key === "Escape") {
      setIsFocused(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const showDropdown = isFocused && query.trim().length > 0 && totalOptions > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-lg mx-auto z-40 pointer-events-auto font-sans">
      {/* Search Bar Input Container */}
      <div
        className={`flex items-center bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md rounded-2xl px-4 py-2.5 shadow-lg border transition-all duration-200 ${
          isFocused
            ? "border-blue-500 shadow-xl ring-2 ring-blue-500/20"
            : "border-zinc-200/80 dark:border-zinc-800 shadow-md hover:border-zinc-300 dark:hover:border-zinc-700"
        }`}
      >
        <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-3" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search corridors, rajbaris, or areas (e.g. Salt Lake, Park St, Victoria)..."
          className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 placeholder:text-xs font-medium"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedIndex(-1);
            }}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Modern High-Finish Result Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95 duration-150 divide-y divide-zinc-100 dark:divide-zinc-900">
          {/* SECTION 1: Heritage Corridors from PostgreSQL */}
          {matchingStreets.length > 0 && (
            <div className="p-2">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Route className="w-3 h-3" />
                <span>Catalogued Heritage Corridors ({matchingStreets.length})</span>
              </div>
              <div className="space-y-1 mt-1">
                {matchingStreets.map((street, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <button
                      key={street.id}
                      onClick={() => handleSelectStreet(street)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs flex items-center gap-2">
                          <span className="truncate">{street.name}</span>
                          <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                            CORRIDOR
                          </span>
                        </div>
                        {street.tags && street.tags.length > 0 && (
                          <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5 truncate">
                            {street.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}
                          </div>
                        )}
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: Kolkata Localities, Areas & Landmarks from Google Places */}
          {placePredictions.length > 0 && (
            <div className="p-2">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                <span>Kolkata Localities & Landmarks</span>
                {isLoadingPredictions && (
                  <span className="text-[9px] text-zinc-400 font-normal animate-pulse">(updating...)</span>
                )}
              </div>
              <div className="space-y-1 mt-1">
                {placePredictions.map((place, idx) => {
                  const globalIdx = matchingStreets.length + idx;
                  const isSelected = selectedIndex === globalIdx;
                  return (
                    <button
                      key={place.placeId}
                      onClick={() => handleSelectPlace(place)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span className="truncate">{place.mainText}</span>
                          {place.types.includes("point_of_interest") ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                              LANDMARK
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              AREA
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono">
                          {place.secondaryText || place.fullDescription}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                        <span>Fly to Area</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

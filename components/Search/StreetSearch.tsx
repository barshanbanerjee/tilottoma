"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMapsLibrary, useMap } from "@vis.gl/react-google-maps";

export default function StreetSearch() {
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  
  const map = useMap();
  const places = useMapsLibrary('places');
  const inputRef = useRef<HTMLInputElement>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;

    // Restrict autocomplete to Kolkata region approximately
    const options = {
      bounds: new google.maps.LatLngBounds(
        new google.maps.LatLng(22.4, 88.2), // SW
        new google.maps.LatLng(22.7, 88.5)  // NE
      ),
      fields: ['address_components', 'geometry', 'name'],
      strictBounds: false,
    };

    setAutocomplete(new places.Autocomplete(inputRef.current, options));
  }, [places]);

  useEffect(() => {
    if (!autocomplete) return;

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place || !place.geometry || !place.geometry.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Pan the map to the selected place
      if (map) {
        map.panTo({ lat, lng });
        map.setZoom(17);
      }

      // Dispatch event to show a drop pin marker on the map
      window.dispatchEvent(
        new CustomEvent('map:search', {
          detail: { lat, lng, name: place.name || '' }
        })
      );

      // If they searched for a route/street, navigate to the street page
      const routeComponent = place.address_components?.find(c => c.types.includes('route'));
      if (routeComponent) {
        const streetName = routeComponent.long_name;
        const slug = streetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (slug) {
          router.push(`/street/${slug}`);
        }
      } else if (place.name) {
        const slug = place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (slug) {
          router.push(`/street/${slug}`);
        }
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    }
  }, [autocomplete, map, router]);

  return (
    <div className="relative w-full max-w-md mx-auto z-10 pointer-events-auto">
      <div 
        className={`flex items-center bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-lg transition-shadow duration-300 ${
          isFocused ? "shadow-xl ring-2 ring-blue-500/50" : "shadow-md"
        }`}
      >
        <Search className="w-5 h-5 text-zinc-400 mr-3" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 text-lg"
          placeholder="Search Kolkata's streets..."
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
      </div>
    </div>
  );
}

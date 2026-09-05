"use client";

import { Map, MapMouseEvent, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

export default function MainMap({
  children,
}: {
  children?: React.ReactNode;
  highlightedStreetGeoJson?: GeoJSON.FeatureCollection;
}) {
  const router = useRouter();
  const geocodingLib = useMapsLibrary('geocoding');
  const geocoder = useMemo(() => {
    return geocodingLib ? new geocodingLib.Geocoder() : null;
  }, [geocodingLib]);

  const handleMapClick = async (e: MapMouseEvent) => {
    if (!geocoder || !e.detail.latLng) return;

    try {
      const response = await geocoder.geocode({ location: e.detail.latLng });
      const results = response.results;
      
      // Look for a result that is a route (street)
      const route = results.find((r) => r.types.includes('route'));
      
      if (route) {
        const routeComponent = route.address_components.find(c => c.types.includes('route'));
        if (routeComponent) {
          const streetName = routeComponent.long_name;
          const slug = streetName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          
          if (slug) {
            router.push(`/street/${slug}`);
          }
        }
      }
    } catch {
      // Ignore geocoding errors (e.g. ZERO_RESULTS if clicked on empty water)
      console.log("No street found at this location.");
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      <Map
        defaultCenter={{ lat: 22.5726, lng: 88.3639 }}
        defaultZoom={13}
        gestureHandling={'greedy'}
        disableDefaultUI={false}
        onClick={handleMapClick}
        mapId="DEMO_MAP_ID"
      >
        {children}
      </Map>
    </div>
  );
}

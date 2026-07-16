import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  useMap,
} from '@/components/ui/map';
import { DEFAULT_MAP_CENTER, type GeoCoordinates } from '@/lib/utils/geocoding';
import type { MapMouseEvent } from 'maplibre-gl';
import { MapPin } from 'lucide-react';
import { useEffect } from 'react';

const DEFAULT_ZOOM = 14;

// Web-only (imported solo da DeliveryAddressField.web.tsx via React.lazy):
// tiene maplibre-gl fuori dal bundle iniziale del checkout — il chunk WebGL
// viene scaricato solo quando il campo indirizzo di consegna è visibile.

function MapLocationSync({
  coordinates,
  onMapClick,
}: {
  coordinates: GeoCoordinates;
  onMapClick: (coordinates: GeoCoordinates) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.flyTo({ center: [coordinates.lng, coordinates.lat], zoom: Math.max(map.getZoom(), 15) });
  }, [coordinates.lat, coordinates.lng, isLoaded, map]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleClick = (event: MapMouseEvent) => {
      onMapClick({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [isLoaded, map, onMapClick]);

  return null;
}

export default function DeliveryMapSection({
  coordinates,
  onApplyCoordinates,
}: {
  coordinates: GeoCoordinates;
  onApplyCoordinates: (coordinates: GeoCoordinates) => void;
}) {
  return (
    <Map center={[DEFAULT_MAP_CENTER.lng, DEFAULT_MAP_CENTER.lat]} zoom={DEFAULT_ZOOM} className="h-full w-full">
      <MapControls
        showZoom
        showLocate
        onLocate={(coords) => {
          onApplyCoordinates({ lng: coords.longitude, lat: coords.latitude });
        }}
      />
      <MapLocationSync coordinates={coordinates} onMapClick={onApplyCoordinates} />
      <MapMarker
        draggable
        longitude={coordinates.lng}
        latitude={coordinates.lat}
        onDragEnd={(lngLat) => {
          onApplyCoordinates({ lng: lngLat.lng, lat: lngLat.lat });
        }}
      >
        <MarkerContent className="cursor-move">
          <MapPin className="fill-[#8d171e] stroke-white" size={30} />
        </MarkerContent>
      </MapMarker>
    </Map>
  );
}

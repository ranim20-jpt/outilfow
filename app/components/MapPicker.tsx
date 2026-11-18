"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

// Centre de Nabeul : point de départ de la carte (le client peut déplacer le repère)
const NABEUL: [number, number] = [36.4513, 10.7356];

type Coords = { lat: number; lng: number };

/**
 * Carte OpenStreetMap permettant au client de placer le repère exact de
 * livraison. Les coordonnées sont envoyées avec le formulaire dans les champs
 * cachés `latitude` / `longitude`.
 */
export default function MapPicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const placerRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let marker: Marker | null = null;

    (async () => {
      const module = await import("leaflet");
      const L = module.default ?? module;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(NABEUL, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const icon = L.divIcon({
        className: "map-pin",
        html: "<span></span>",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const placer = (lat: number, lng: number) => {
        if (!map) return;
        if (marker) {
          marker.setLatLng([lat, lng]);
        } else {
          marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
          marker.on("dragend", () => {
            const p = marker!.getLatLng();
            setCoords({ lat: p.lat, lng: p.lng });
            setMessage("");
          });
          markerRef.current = marker;
        }
        setCoords({ lat, lng });
        setMessage("");
      };

      map.on("click", (e) => placer(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
      placerRef.current = placer;
      setTimeout(() => map?.invalidateSize(), 100);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      placerRef.current = null;
    };
  }, []);

  function utiliserMaPosition() {
    if (!("geolocation" in navigator)) {
      setMessage("La géolocalisation n’est pas disponible dans ce navigateur.");
      return;
    }
    setMessage("Recherche de votre position…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        mapRef.current?.setView([lat, lng], 16);
        placerRef.current?.(lat, lng);
        setMessage("Position GPS utilisée.");
      },
      () => setMessage("Position refusée ou indisponible. Cliquez sur la carte pour placer le repère."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="map-field">
      <div ref={containerRef} className="map-picker" role="application" aria-label="Carte de localisation" />
      <div className="map-tools">
        <button type="button" className="btn secondary small shrink" onClick={utiliserMaPosition}>
          📍 Utiliser ma position
        </button>
        <span className="muted small">
          {coords
            ? `Repère : ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
            : "Cliquez sur la carte pour placer le repère exact de livraison."}
          {message ? ` · ${message}` : ""}
        </span>
      </div>
      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
    </div>
  );
}

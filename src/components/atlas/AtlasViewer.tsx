"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { imagePoint, normalizedPoint } from "@/lib/atlas-coordinates";
import { markerIcons } from "@/lib/atlas-schema";
import type { AtlasMapView, AtlasMarkerView } from "@/lib/atlas-library";
export default function AtlasViewer({ campaignId, map, markers, editing, pending, select, place, move }: { campaignId: string; map: AtlasMapView; markers: AtlasMarkerView[]; editing: boolean; pending: boolean; select: (marker: AtlasMarkerView) => void; place: (x: number, y: number) => void; move: (id: string, x: number, y: number) => void }) {
  const host = useRef<HTMLDivElement>(null), frame = useRef<HTMLDivElement>(null), instance = useRef<Leaflet.Map | null>(null), layer = useRef<Leaflet.LayerGroup | null>(null), callbacks = useRef({ select, place, move, editing, pending });
  const [ready, setReady] = useState(0), [error, setError] = useState(""), [loadedImage, setLoadedImage] = useState("");
  useEffect(() => { callbacks.current = { select, place, move, editing, pending }; }, [select, place, move, editing, pending]);
  useEffect(() => {
    if (!map.imageWidth || !map.imageHeight || !host.current) return;
    let cancelled = false, observer: ResizeObserver | undefined;
    void import("leaflet").then(L => {
      if (cancelled || !host.current) return;
      const width = map.imageWidth!, height = map.imageHeight!, bounds = L.latLngBounds([[0, 0], [height, width]]);
      const viewer = L.map(host.current, { crs: L.CRS.Simple, minZoom: -5, maxZoom: 4, zoomSnap: 0, zoomDelta: 0.5, attributionControl: false, zoomControl: true, keyboard: true });
      instance.current = viewer;
      L.imageOverlay(`/api/campaign/${campaignId}/atlas/${map.id}/image?v=${map.imageStamp}`, bounds, { alt: map.name }).on("load", () => { setLoadedImage(map.imageStamp || ""); setError(""); }).on("error", () => setError("Kartenbild konnte nicht geladen werden. Zugang und Speicherung prüfen.")).addTo(viewer);
      viewer.setMinZoom(Math.min(-5, viewer.getBoundsZoom(bounds) - 1)); viewer.fitBounds(bounds, { padding: [16, 16] }); layer.current = L.layerGroup().addTo(viewer);
      viewer.on("click", (event: Leaflet.LeafletMouseEvent) => { const cb = callbacks.current; if (!cb.editing || cb.pending) return; const point = normalizedPoint(event.latlng.lat, event.latlng.lng, width, height); if (point) cb.place(point.x, point.y); });
      observer = new ResizeObserver(() => viewer.invalidateSize()); observer.observe(host.current); setReady(value => value + 1);
      const buttons = host.current.querySelectorAll<HTMLAnchorElement>(".leaflet-control-zoom a"); buttons[0]?.setAttribute("aria-label", "Vergrössern"); buttons[1]?.setAttribute("aria-label", "Verkleinern");
    }).catch(() => setError("Kartenansicht konnte nicht geladen werden."));
    return () => { cancelled = true; observer?.disconnect(); instance.current?.remove(); instance.current = null; layer.current = null; };
    // Image dimensions/key change rebuilds the image, marker-only writes retain zoom.
  }, [campaignId, map.id, map.imageWidth, map.imageHeight, map.imageStamp, map.name]);
  useEffect(() => {
    if (!ready || !instance.current || !layer.current || !map.imageWidth || !map.imageHeight) return;
    let cancelled = false;
    void import("leaflet").then(L => {
      if (cancelled || !layer.current) return; layer.current.clearLayers();
      for (const m of markers) {
        const node = document.createElement("span"); node.className = "atlas-pin"; node.style.backgroundColor = m.color; node.textContent = markerIcons[m.icon as keyof typeof markerIcons] || "●"; node.setAttribute("aria-hidden", "true");
        const icon = L.divIcon({ html: node, className: "atlas-marker-icon", iconSize: [32, 32], iconAnchor: [16, 16] });
        const pin = L.marker(imagePoint(m.x, m.y, map.imageWidth!, map.imageHeight!), { icon, draggable: editing && !pending, title: m.title, keyboard: true, alt: m.title });
        const label = document.createElement("span"); label.textContent = m.title; pin.bindTooltip(label);
        pin.on("click", () => callbacks.current.select(m)); pin.on("dragend", () => { const point = pin.getLatLng(); const x = Math.max(0, Math.min(1, point.lng / map.imageWidth!)), y = Math.max(0, Math.min(1, 1 - point.lat / map.imageHeight!)); callbacks.current.move(m.id, x, y); }); pin.addTo(layer.current);
      }
    });
    return () => { cancelled = true; };
  }, [markers, ready, editing, pending, map.imageWidth, map.imageHeight]);
  return <section ref={frame} className="atlas-viewer-frame" aria-label={`Karte: ${map.name}`}><div className="atlas-map-tools"><button type="button" onClick={() => { if (map.imageWidth && map.imageHeight) instance.current?.fitBounds([[0, 0], [map.imageHeight, map.imageWidth]], { padding: [16, 16] }); }}>Ansicht zurücksetzen</button><button type="button" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else if (frame.current?.requestFullscreen) void frame.current.requestFullscreen().catch(() => setError("Vollbild ist hier nicht verfügbar.")); else setError("Vollbild wird von diesem Browser nicht unterstützt."); }}>Vollbild umschalten</button></div>{map.imageStamp && loadedImage !== map.imageStamp && !error && <p role="status">Kartenbild wird geladen ...</p>}{error && <p role="alert">{error}</p>}{map.imageWidth && map.imageHeight ? <div ref={host} className="atlas-canvas" role="region" aria-label="Interaktive Karte. Mit Pfeiltasten verschieben, mit Plus und Minus zoomen." /> : <div className="atlas-canvas atlas-empty">Noch kein Kartenbild. Der DM kann im Editor ein Bild hochladen.</div>}</section>;
}

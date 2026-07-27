"use client";

import type { Cafe } from "../data/cafes";
import { MapCanvas, type SavedCafeMarker } from "./MapCanvas";

export function MapSurface(props: {
  cafes: Cafe[];
  activeId: string | null;
  savedMarkers: Record<string, SavedCafeMarker>;
  onSelect: (id: string) => void;
  onInteract: () => void;
}) {
  return <MapCanvas cafes={props.cafes} activeId={props.activeId} savedMarkers={props.savedMarkers} onSelect={props.onSelect} onInteract={props.onInteract} />;
}
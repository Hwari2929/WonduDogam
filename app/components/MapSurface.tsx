"use client";

import type { Cafe } from "../data/cafes";
import { MapCanvas } from "./MapCanvas";

/**
 * The product map is an editorial atlas, not a navigation surface.
 * Precise directions stay in the external map link on each cafe receipt.
 */
export function MapSurface(props: {
  cafes: Cafe[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onInteract: () => void;
}) {
  return (
    <MapCanvas
      cafes={props.cafes}
      activeId={props.activeId}
      onSelect={props.onSelect}
      onInteract={props.onInteract}
    />
  );
}

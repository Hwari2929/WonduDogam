import type { CSSProperties } from "react";
import type { Cafe } from "../data/cafes";
import { project } from "../data/geo";
import { districts, minorRoads, river, sea, tributaries, trunkRoads } from "../data/terrain";
import type { CodexIconId } from "../marks";
import { CodexIcon } from "./CodexIcon";

const PLACES: { label: string; lng: number; lat: number; sea?: boolean }[] = [
  { label: "고양", lng: 126.832, lat: 37.658 }, { label: "서울", lng: 126.978, lat: 37.566 },
  { label: "인천", lng: 126.705, lat: 37.456 }, { label: "성남", lng: 127.127, lat: 37.42 },
  { label: "수원", lng: 127.029, lat: 37.263 }, { label: "서해", lng: 126.5, lat: 37.34, sea: true },
];

export type SavedCafeMarker = { color: string; icon: CodexIconId; count: number; collectionName: string };

export function MapCanvas({ cafes, activeId, savedMarkers, onSelect, onInteract }: {
  cafes: Cafe[];
  activeId: string | null;
  savedMarkers: Record<string, SavedCafeMarker>;
  onSelect: (id: string) => void;
  onInteract: () => void;
}) {
  return (
    <section className="map" aria-label="수도권 카페 지도" tabIndex={0} onPointerDown={onInteract}>
      <svg className="map__terrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {minorRoads.map((d, index) => <path key={`minor-${index}`} className="terrain__road terrain__road--minor" d={d} />)}
        {trunkRoads.map((d, index) => <path key={`trunk-${index}`} className="terrain__road" d={d} />)}
        {districts.map((d, index) => <path key={`district-${index}`} className={`terrain__district terrain__district--${index % 3}`} d={d} />)}
        {tributaries.map((d, index) => <path key={`stream-${index}`} className="terrain__stream" d={d} />)}
        <path className="terrain__river" d={river} /><path className="terrain__sea" d={sea} fillRule="evenodd" />
      </svg>
      <div className="map__grain" aria-hidden="true" />
      <div className="map__places" aria-hidden="true">{PLACES.map((place) => { const { x, y } = project(place.lng, place.lat); return <span key={place.label} className={place.sea ? "map__sea-label" : undefined} style={{ left: `${x}%`, top: `${y}%` }}>{place.label}</span>; })}</div>

      {cafes.map((cafe) => {
        const active = activeId === cafe.id;
        const saved = savedMarkers[cafe.id];
        const { x, y } = project(cafe.pos[0], cafe.pos[1]);
        return <button
          key={cafe.id}
          className={["map-marker", "map-marker--plain", saved ? "is-saved" : "", active ? "is-active" : ""].filter(Boolean).join(" ")}
          style={{ left: `${x}%`, top: `${y}%`, "--codex-color": saved?.color } as CSSProperties}
          type="button"
          onClick={() => onSelect(cafe.id)}
          aria-label={`${cafe.name}, ${cafe.area}${saved ? `, ${saved.collectionName}에 저장됨` : ""}`}
          aria-pressed={active}
        >
          <span className="map-marker__dot">{saved ? <CodexIcon name={saved.icon} size={14} /> : null}</span>
          {saved ? <span className="map-marker__name">{cafe.name}{saved.count > 1 ? <i>+{saved.count - 1}</i> : null}</span> : null}
        </button>;
      })}
      <div className="map__scale" aria-hidden="true"><i /><span>10 km</span></div>
    </section>
  );
}
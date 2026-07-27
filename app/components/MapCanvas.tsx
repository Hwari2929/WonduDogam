import type { Cafe } from "../data/cafes";
import { project } from "../data/geo";
import { districts, minorRoads, river, sea, tributaries, trunkRoads } from "../data/terrain";
import { BeanStamp } from "./BeanArt";

/** 지명도 카페와 같은 경위도에서 옵니다. build/terrain.py 의 투영과 한 식입니다. */
const PLACES: { label: string; lng: number; lat: number; sea?: boolean }[] = [
  { label: "고양", lng: 126.832, lat: 37.658 },
  { label: "서울", lng: 126.978, lat: 37.566 },
  { label: "인천", lng: 126.705, lat: 37.456 },
  { label: "성남", lng: 127.127, lat: 37.42 },
  { label: "수원", lng: 127.029, lat: 37.263 },
  { label: "서해", lng: 126.5, lat: 37.34, sea: true },
];

/**
 * 지도 자리를 대신하는 인쇄물 목업.
 *
 * 카카오맵 SDK는 04_착수_검증의 데이터 사용 승낙 문제가 풀린 뒤에 붙습니다.
 * 그때까지 이 자리가 비어 있으면 "지도 위 UI"인지 판단할 수 없으므로,
 * 수도권의 골격(서해안·한강·지천)만 인쇄된 지도처럼 그려 둡니다.
 *
 * 지형은 preserveAspectRatio="none" 으로 늘어납니다. 그래야 SVG 좌표와
 * 마커의 % 좌표가 어떤 화면 비율에서도 정확히 겹칩니다. 대신 글자는 전부
 * HTML로 얹어서 늘어나지 않게 합니다.
 */
export function MapCanvas({
  cafes,
  activeId,
  onSelect,
  onInteract,
}: {
  cafes: Cafe[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onInteract: () => void;
}) {
  return (
    <section
      className="map"
      aria-label="수도권 카페 지도 (목업)"
      tabIndex={0}
      onPointerDown={onInteract}
    >
      {/* 지형은 build/terrain.py 가 만듭니다. preserveAspectRatio="none" 이라 화면비가
          바뀌어도 SVG 좌표와 마커의 % 좌표가 정확히 겹칩니다. */}
      <svg className="map__terrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {minorRoads.map((d, index) => (
          <path key={`minor-${index}`} className="terrain__road terrain__road--minor" d={d} />
        ))}
        {trunkRoads.map((d, index) => (
          <path key={`trunk-${index}`} className="terrain__road" d={d} />
        ))}
        {districts.map((d, index) => (
          <path key={`district-${index}`} className={`terrain__district terrain__district--${index % 3}`} d={d} />
        ))}
        {tributaries.map((d, index) => (
          <path key={`stream-${index}`} className="terrain__stream" d={d} />
        ))}
        <path className="terrain__river" d={river} />
        <path className="terrain__sea" d={sea} fillRule="evenodd" />
      </svg>

      <div className="map__grain" aria-hidden="true" />

      <div className="map__places" aria-hidden="true">
        {PLACES.map((place) => {
          const { x, y } = project(place.lng, place.lat);
          return (
            <span
              key={place.label}
              className={place.sea ? "map__sea-label" : undefined}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {place.label}
            </span>
          );
        })}
      </div>

      {cafes.map((cafe) => {
        const active = activeId === cafe.id;
        const { x, y } = project(cafe.pos[0], cafe.pos[1]);
        return (
          <button
            key={cafe.id}
            className={[
              "map-marker",
              cafe.partner ? "map-marker--partner" : "map-marker--plain",
              active ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ left: `${x}%`, top: `${y}%` }}
            type="button"
            onClick={() => onSelect(cafe.id)}
            aria-label={`${cafe.name}, ${cafe.area}${cafe.partner ? ", 협력업체" : ""}`}
            aria-pressed={active}
          >
            {cafe.partner ? <BeanStamp size={34} /> : null}
            {cafe.partner ? <span className="map-marker__name">{cafe.name}</span> : null}
          </button>
        );
      })}

      <div className="map__scale" aria-hidden="true">
        <i />
        <span>10 km</span>
      </div>
    </section>
  );
}

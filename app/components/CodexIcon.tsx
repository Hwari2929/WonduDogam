import { Bean, BookOpen, Bookmark, Coffee, Compass, Heart, MapPin, Star, type LucideIcon } from "lucide-react";
import type { CodexIconId } from "../marks";

const ICONS: Record<CodexIconId, LucideIcon> = {
  bean: Bean,
  coffee: Coffee,
  "book-open": BookOpen,
  "map-pin": MapPin,
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  compass: Compass,
};

/** 굵기는 적지 않습니다 — app/icons.ts 의 한 값을 layout 이 내려 줍니다. */
export function CodexIcon({ name, size }: { name: CodexIconId; size?: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} aria-hidden="true" />;
}
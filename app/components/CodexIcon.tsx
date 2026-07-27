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

export function CodexIcon({ name, size = 18 }: { name: CodexIconId; size?: number }) {
  const Icon = ICONS[name];
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" />;
}
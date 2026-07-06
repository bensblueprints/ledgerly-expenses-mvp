import {
  Utensils,
  Plane,
  Monitor,
  Briefcase,
  Megaphone,
  CircleDot,
  Car,
  Home,
  ShoppingBag,
  Coffee,
  Wrench,
  Heart,
  Gift,
  Phone
} from 'lucide-react';

export const ICONS = {
  utensils: Utensils,
  plane: Plane,
  monitor: Monitor,
  briefcase: Briefcase,
  megaphone: Megaphone,
  'circle-dot': CircleDot,
  car: Car,
  home: Home,
  'shopping-bag': ShoppingBag,
  coffee: Coffee,
  wrench: Wrench,
  heart: Heart,
  gift: Gift,
  phone: Phone
};

export function CategoryIcon({ icon, size = 16, ...props }) {
  const Cmp = ICONS[icon] || CircleDot;
  return <Cmp size={size} {...props} />;
}

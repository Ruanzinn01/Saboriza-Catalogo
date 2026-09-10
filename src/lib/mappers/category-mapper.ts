import type { Category } from "@/types/category";
import type { Database } from "@/types/supabase";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline,
    order: row.sort_order,
    active: row.is_active,
  };
}

export function categoryToRow(category: Category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    tagline: category.tagline,
    sort_order: category.order,
    is_active: category.active,
  };
}

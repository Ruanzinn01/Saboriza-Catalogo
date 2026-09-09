import type { Category } from "@/types/category";

export const mockCategories: Category[] = [
  {
    id: "sal-churrasco",
    name: "Sal & Churrasco",
    slug: "sal-churrasco",
    tagline: "Sabor que faz seu produto girar.",
    order: 0,
    active: true,
  },
  {
    id: "frascos",
    name: "Frascos",
    slug: "frascos",
    tagline: "Sabor concentrado, direto no frasco.",
    order: 1,
    active: true,
  },
  {
    id: "potes",
    name: "Potes",
    slug: "potes",
    tagline: "Temperos completos e sabores que vendem.",
    order: 2,
    active: true,
  },
  {
    id: "molhos",
    name: "Molhos",
    slug: "molhos",
    tagline: "Mais sabor. Mais vendas.",
    order: 3,
    active: true,
  },
  {
    id: "saches",
    name: "Sachês",
    slug: "saches",
    tagline: "Pequeno no preço, grande no giro.",
    order: 4,
    active: true,
  },
  {
    id: "linha-maior",
    name: "Linha Maior",
    slug: "linha-maior",
    tagline: "Mais rendimento. Mais economia.",
    order: 5,
    active: true,
  },
];

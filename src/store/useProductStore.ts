import { create } from 'zustand';
import { api } from '../utils/api';
import type { Product } from '../utils/types';

/**
 * Каталог с коротким кэшем.
 *
 * Раньше каждая страница дёргала /products при монтировании — переход
 * «каталог → товар → назад» стоил трёх запросов и мигал скелетонами на уже
 * загруженных данных. Теперь свежесть держим 60 секунд и на возврате
 * показываем то, что уже есть.
 */
const TTL_MS = 60_000;

interface ProductState {
  products: Product[];
  featured: Product[];
  categories: string[];
  currentProduct: Product | null;
  isLoading: boolean;
  error: string | null;

  /** Ключ последней загруженной выборки + отметка времени. */
  loadedCategory: string | null;
  loadedAt: number;
  featuredAt: number;

  fetchProducts: (category?: string, force?: boolean) => Promise<void>;
  fetchFeatured: (force?: boolean) => Promise<void>;
  fetchProduct: (id: number) => Promise<void>;
  fetchCategories: () => Promise<void>;
}

const fresh = (at: number) => at > 0 && Date.now() - at < TTL_MS;

export const useProductStore = create<ProductState>()((set, get) => ({
  products: [],
  featured: [],
  categories: ['Все'],
  currentProduct: null,
  isLoading: false,
  error: null,
  loadedCategory: null,
  loadedAt: 0,
  featuredAt: 0,

  fetchProducts: async (category = 'Все', force = false) => {
    const state = get();
    if (!force && state.loadedCategory === category && fresh(state.loadedAt) && state.products.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const query = category && category !== 'Все' ? `?category=${encodeURIComponent(category)}` : '';
      const products = await api.get<Product[]>(`/products${query}`);
      set({ products, isLoading: false, loadedCategory: category, loadedAt: Date.now() });
    } catch (error) {
      set({ error: (error as Error).message || 'Не удалось загрузить каталог', isLoading: false });
    }
  },

  fetchFeatured: async (force = false) => {
    if (!force && fresh(get().featuredAt) && get().featured.length > 0) return;
    try {
      const featured = await api.get<Product[]>('/products?featured=true');
      set({ featured, featuredAt: Date.now() });
    } catch (error) {
      // Хиты — украшение главной. Ошибку не показываем, но фиксируем.
      console.error('Failed to fetch featured:', error);
    }
  },

  fetchProduct: async (id: number) => {
    // Если товар уже есть в загруженном списке — показываем сразу, а свежие
    // данные подтягиваем в фоне: страница открывается без скелетона.
    const cached = get().products.find((p) => p.id === id) || null;
    set({ isLoading: !cached, error: null, currentProduct: cached });

    try {
      const product = await api.get<Product>(`/products/${id}`);
      set({ currentProduct: product, isLoading: false });
    } catch (error) {
      set({
        error: (error as Error).message || 'Не удалось загрузить товар',
        isLoading: false,
        currentProduct: cached,
      });
    }
  },

  fetchCategories: async () => {
    if (get().categories.length > 1) return;
    try {
      set({ categories: await api.get<string[]>('/products/categories') });
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  },
}));

import { create } from 'zustand';
import { api } from '../utils/api';
import type { Product } from '../utils/types';

interface ProductState {
  products: Product[];
  featured: Product[];
  categories: string[];
  currentProduct: Product | null;
  isLoading: boolean;
  error: string | null;
  fetchProducts: (category?: string) => Promise<void>;
  fetchFeatured: () => Promise<void>;
  fetchProduct: (id: number) => Promise<void>;
  fetchCategories: () => Promise<void>;
}

export const useProductStore = create<ProductState>()((set) => ({
  products: [],
  featured: [],
  categories: ['Все'],
  currentProduct: null,
  isLoading: false,
  error: null,

  fetchProducts: async (category?: string) => {
    set({ isLoading: true, error: null });
    try {
      const query = category && category !== 'Все' ? `?category=${encodeURIComponent(category)}` : '';
      const products = await api.get<Product[]>(`/products${query}`);
      set({ products, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchFeatured: async () => {
    try {
      const featured = await api.get<Product[]>('/products?featured=true');
      set({ featured });
    } catch (error) {
      console.error('Failed to fetch featured:', error);
    }
  },

  fetchProduct: async (id: number) => {
    set({ isLoading: true, error: null, currentProduct: null });
    try {
      const product = await api.get<Product>(`/products/${id}`);
      set({ currentProduct: product, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchCategories: async () => {
    try {
      const categories = await api.get<string[]>('/products/categories');
      set({ categories });
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  },
}));

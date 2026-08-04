import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../utils/types';

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (productId: number) => void;
  updateQty: (productId: number, qty: number) => void;
  clear: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const { items } = get();
        const existing = items.find((i) => i.productId === item.productId);

        if (existing) {
          set({
            items: items.map((i) =>
              i.productId === item.productId ? { ...i, qty: i.qty + 1 } : i
            ),
          });
        } else {
          set({ items: [...items, { ...item, qty: 1 }] });
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      updateQty: (productId, qty) => {
        if (qty <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.productId === productId ? { ...i, qty } : i
          ),
        });
      },

      clear: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce((acc, item) => acc + item.price * item.qty, 0);
      },

      getItemCount: () => {
        return get().items.reduce((acc, item) => acc + item.qty, 0);
      },
    }),
    {
      name: 'mishkin-cart',
    }
  )
);

import { create } from 'zustand';
import { api } from '../utils/api';
import type { DeliveryConfig, PaymentConfig } from '../utils/types';

/**
 * Настройки магазина, которые приходят с сервера: способы доставки с ценами и
 * режим оплаты. Держим в одном месте, чтобы корзина и чекаут не расходились в
 * цифрах и запрашивали это один раз за сессию.
 */
interface ShopConfigState {
  delivery: DeliveryConfig | null;
  payment: PaymentConfig | null;
  isLoading: boolean;
  error: string | null;
  load: (force?: boolean) => Promise<void>;
}

export const useShopConfig = create<ShopConfigState>()((set, get) => ({
  delivery: null,
  payment: null,
  isLoading: false,
  error: null,

  load: async (force = false) => {
    const { delivery, payment, isLoading } = get();
    if (isLoading) return;
    if (!force && delivery && payment) return;

    set({ isLoading: true, error: null });
    // Оплата и доставка независимы: если один запрос упал, второй всё равно
    // применяем — иначе из-за платёжки перестаёт работать выбор доставки.
    const [deliveryResult, paymentResult] = await Promise.allSettled([
      api.get<DeliveryConfig>('/orders/delivery-options'),
      api.get<PaymentConfig>('/payments/config'),
    ]);

    set({
      delivery: deliveryResult.status === 'fulfilled' ? deliveryResult.value : get().delivery,
      payment: paymentResult.status === 'fulfilled' ? paymentResult.value : get().payment,
      isLoading: false,
      error:
        deliveryResult.status === 'rejected'
          ? (deliveryResult.reason as Error)?.message || 'Не удалось загрузить настройки доставки'
          : null,
    });
  },
}));

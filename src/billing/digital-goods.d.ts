/**
 * Minimal Digital Goods API typings (Chrome / Trusted Web Activity).
 * The API is only available inside the Google Play TWA build; on the
 * open web `window.getDigitalGoodsService` is undefined.
 */
export interface DigitalGoodsItemDetails {
  itemId: string;
  title?: string;
  description?: string;
  price?: { currency: string; value: string };
  subscriptionPeriod?: string;
  freeTrialPeriod?: string;
  introductoryPrice?: {
    currency: string;
    value: string;
    cycles?: number;
  };
}

export interface DigitalGoodsPurchase {
  itemId: string;
  purchaseToken: string;
  acknowledged?: boolean;
  purchaseState?: number;
}

export interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<DigitalGoodsItemDetails[]>;
  listPurchases(): Promise<DigitalGoodsPurchase[]>;
  acknowledge?(purchaseToken: string, type: 'onetime' | 'subscription'): Promise<void>;
  consume?(purchaseToken: string): Promise<void>;
}

declare global {
  interface Window {
    getDigitalGoodsService?: (
      serviceProvider: string,
    ) => Promise<DigitalGoodsService>;
  }
}

export {};

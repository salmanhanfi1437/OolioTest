import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/services/api';
import type { Category, Product, SyncEvent, SyncResponse, Tag } from '@/types';

const PRODUCTS_CACHE_KEY = "products_cache";

interface ProductState {
  products: Product[];
  categories: Category[];
  tags: Tag[];
  isLoading: boolean;
  nextCursor: string | null;
  lastSyncVersion: number;
  error: string | null;
  loadProducts: () => Promise<void>;
  loadNextPage: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadTags: () => Promise<void>;
  bumpProduct: (id: number, expectedVersion: number) => Promise<void>;
  applyRealtimeEvent: (event: SyncEvent) => void;
  applySync: (response: SyncResponse) => void;
  backgroundSync: () => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  tags: [],
  isLoading: false,
  nextCursor: null,
  lastSyncVersion: 0,
  error: null,

  loadProducts: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.getProducts();

      const cacheData = {
        products: response.data,
        nextCursor: response.next_cursor,
      };

      // Save latest data for offline use
      await AsyncStorage.setItem(
        PRODUCTS_CACHE_KEY,
        JSON.stringify(cacheData)
      );

      set({
        products: response.data,
        nextCursor: response.next_cursor,
        isLoading: false,
      });
    } catch (e) {
      try {
        const cache = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);

        if (cache) {
          const data = JSON.parse(cache);

          set({
            products: data.products,
            nextCursor: data.nextCursor,
            isLoading: false,
            error: null,
          });

          return;
        }
      } catch (err) {
        console.log("Failed to load cached products", err);
      }

      set({
        isLoading: false,
        error: "Failed to load products",
      });
    }
  },

  loadNextPage: async () => {
    const { nextCursor, products, isLoading } = get();

    if (!nextCursor || isLoading) return;

    set({ isLoading: true });

    try {
      const response = await api.getProducts(nextCursor);

      const updatedProducts = [
        ...products,
        ...response.data,
      ];

      const cacheData = {
        products: updatedProducts,
        nextCursor: response.next_cursor,
      };

      // Update offline cache
      await AsyncStorage.setItem(
        PRODUCTS_CACHE_KEY,
        JSON.stringify(cacheData)
      );

      set({
        products: updatedProducts,
        nextCursor: response.next_cursor,
        isLoading: false,
      });
    } catch (e) {
      set({
        isLoading: false,
      });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await api.getCategories();
      set({ categories });
    } catch (e) {
      set({ error: 'Failed to load categories' });
    }
  },

  loadTags: async () => {
    try {
      const tags = await api.getTags();
      set({ tags });
    } catch (e) {
      set({ error: 'Failed to load tags' });
    }
  },

  bumpProduct: async (id: number, expectedVersion: number) => {
    try {
      const result = await api.bumpProduct(id, expectedVersion);
      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? { ...p, version: result.version } : p
        ),
      }));
    }
   catch (e: any) {
  if (e.error === "version_conflict") {
    console.log("Version conflict detected");

    const syncResponse = await api.getSync(
      get().lastSyncVersion
    );

    get().applySync(syncResponse);

    return;
  }

  console.log(e);
}
  },

  applyRealtimeEvent: (event: SyncEvent) => {
    set((state) => {
      if (event.type === "product_bump") {
        return {
          ...state,
          products: state.products.map((product) =>
            product.id === event.entity_id
              ? {
                ...product,
                version: event.version,
                updated_at: event.updated_at,
              }
              : product
          ),
          lastSyncVersion: Math.max(state.lastSyncVersion, event.version),
        };
      }

      if (event.type === "category_bump") {
        return {
          ...state,
          categories: state.categories.map((category) =>
            category.id === event.entity_id
              ? {
                ...category,
                version: event.version,
                updated_at: event.updated_at,
              }
              : category
          ),
        };
      }

      if (event.type === "tag_bump") {
        return {
          ...state,
          tags: state.tags.map((tag) =>
            tag.id === event.entity_id
              ? {
                ...tag,
                version: event.version,
                updated_at: event.updated_at,
              }
              : tag
          ),
        };
      }

      return state;
    });
  },

  applySync: (response: SyncResponse) => {
    set((state) => {
      let products = [...state.products];

      response.products.forEach((event) => {
        products = products.map((product) =>
          product.id === event.entity_id
            ? {
              ...product,
              version: event.version,
              updated_at: event.updated_at,
            }
            : product
        );
      });

      const allEvents = [
        ...response.products,
        ...response.categories,
        ...response.tags,
      ];

      const maxVersion = allEvents.reduce(
        (max, event) => Math.max(max, event.version),
        state.lastSyncVersion
      );

      return {
        products,
        lastSyncVersion: maxVersion,
      };
    });
  },

  backgroundSync: async () => {
    try {
      const { lastSyncVersion } = get();

      const response = await api.getSync(lastSyncVersion);

      get().applySync(response);
    } catch (e) {
      console.log("Background sync failed", e);
    }
  },

}));

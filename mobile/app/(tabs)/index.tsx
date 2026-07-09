import React, { useCallback, useState, useEffect } from 'react';
import { FlatList, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ProductCard } from '@/components/ProductCard';
import { SearchBar } from '@/components/SearchBar';
import { useProducts } from '@/hooks/useProducts';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAppState } from '@/hooks/useAppState';
import { useCartStore } from '@/store/cartStore';
import { useProductStore } from '@/store/productStore';
import type { Product, SyncEvent } from '@/types';
import NetInfo from "@react-native-community/netinfo";
import { api } from '@/services/api';

export default function ProductsScreen() {
  console.log("ProductsScreen Rendered");
  const router = useRouter();
  const { products, isLoading, nextCursor, loadNextPage, loadProducts } = useProducts();
  const addItem = useCartStore((s) => s.addItem);
  const applyRealtimeEvent = useProductStore((s) => s.applyRealtimeEvent);
  const applySync = useProductStore((s) => s.applySync);
  const lastSyncVersion = useProductStore((s) => s.lastSyncVersion);
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const displayProducts = searchResults ?? products;

  //------load product from async if no internet-----

 useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      console.log("Internet connected. Refreshing products...");

      await loadProducts();

      try {
        const response = await api.getSync(
          useProductStore.getState().lastSyncVersion
        );

        applySync(response);
      } catch (e) {
        console.log("Background sync failed", e);
      }
    }
  });

  return unsubscribe;
}, []);



  //--------------------------------------------

  useWebSocket((event: SyncEvent) => {
    console.log('sync event', event);
    applyRealtimeEvent(event);
  });


  useAppState(async () => {
    console.log("App resumed");

    try {
      const response = await api.getSync(lastSyncVersion);

      console.log("SYNC RESPONSE", response);

      applySync(response);
    } catch (e) {
      console.log("Sync failed", e);
    }
  });

  const handleEndReached = useCallback(() => {
    console.log("End Reached");
    console.log("Next Cursor:", nextCursor);

    if (!searchResults) {
      loadNextPage();
    }
  }, [searchResults, nextCursor, loadNextPage]);



  const handleAddToCart = useCallback(
    (product: Product) => {
      addItem(product.id, 1);
    },
    [addItem]
  );

  return (
    <View style={styles.container}>
      <SearchBar onResults={(r) => {
        console.log("Search Results:", r);
        setSearchResults(r.length > 0 ? r : null)
      }
      } />
      {isLoading && products.length === 0 ? (
        <ActivityIndicator size="large" color="#1976d2" style={styles.loader} />
      ) : (
        <FlatList
          data={displayProducts}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={(p) => router.push(`/product/${p.id}`)}
              onAddToCart={handleAddToCart}
            />
          )}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isLoading ? <View><ActivityIndicator color="#1976d2" /></View> : null}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  list: { paddingBottom: 20 },
  loader: { flex: 1 },
});

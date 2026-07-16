import React, { useCallback, useState, useEffect,useMemo } from 'react';
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
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (!state.isConnected) return;

    const syncProducts = async () => {
      try {
        await loadProducts();

        const response = await api.getSync(
          useProductStore.getState().lastSyncVersion
        );

        applySync(response);
      } catch (e) {
        console.log(e);
      }
    };

    syncProducts();
  });

  return unsubscribe;
}, [loadProducts, applySync]);



  //--------------------------------------------

  useWebSocket((event: SyncEvent) => {
    applyRealtimeEvent(event);
  });


  useAppState(async () => {
    

    try {
      const response = await api.getSync(lastSyncVersion);

      console.log("SYNC RESPONSE", response);

      applySync(response);
    } catch (e) {
      console.log("Sync failed", e);
    }
  });

  const handleEndReached = useCallback(() => {
    
    if (!searchResults && nextCursor) //Suppose if nextCursor will be null then also loadNexPage will worked
      {
      loadNextPage();
    }
  }, [searchResults, nextCursor, loadNextPage]);



  const handleAddToCart = useCallback(
    (product: Product) => {
      addItem(product.id, 1);
    },
    [addItem]
  );

const memoizedProducts = useMemo(() => {
    return products;
  }, [products]);

const handlePress = useCallback(
  (item: Product) => {
    router.push(`/product/${item.id}`);
  },
  [router]
);

  const renderItem = useCallback(
    ({ item }) => (
      <ProductCard
        product={item}
        onPress={handlePress}
        onAddToCart={handleAddToCart}
      />
    ),
    [handlePress]
  );

  const keyExtractor = useCallback(
    (item) => item.id.toString(),
    []
  );

  useEffect(() => {
  console.log("ProductScreen Mounted");

  return () => {
    console.log("ProductScreen Unmounted");
  };
}, []);


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
          keyExtractor={keyExtractor}
         renderItem={renderItem}
          showsVerticalScrollIndicator={false}
             initialNumToRender={10} //Render only first few items\
             maxToRenderPerBatch={10} // controls how many items are rendered each batch
             removeClippedSubviews={true} // it will unmount item which are not visible 
          windowSize={5}
             onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={isLoading ? <ActivityIndicator color="#1976d2" /> : null}
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

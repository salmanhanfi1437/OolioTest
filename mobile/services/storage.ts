import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '@/types';

const PRODUCTS_KEY = "products";

export async function saveProducts(products: Product[]) {
    try {
        await AsyncStorage.setItem(
            PRODUCTS_KEY,
            JSON.stringify(products)
        );
    } catch (e) {
        console.log("cache failed", e);
    }
}

export async function loadProducts() {
    try {
        const data = await AsyncStorage.getItem(PRODUCTS_KEY);

        if (!data) return [];

        return JSON.parse(data);
    } catch {
        return [];
    }
}
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { api } from '@/services/api';
import { useCartStore } from '@/store/cartStore';
import type { Order } from '@/types';
import { useFocusEffect } from '@react-navigation/native';


export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const clearCart = useCartStore((s) => s.clearCart);
  const deviceId = useCartStore((s) => s.deviceId);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) {
        loadOrders();
      }
    }, [deviceId])
  );

  const loadOrders = async () => {
    setRefreshing(true);

    try {
      const data = await api.getOrders(deviceId);
      setOrders(data);
    } catch {
      Alert.alert("Error", "Failed to load orders");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    console.log("Device ID:", deviceId);

    if (deviceId) loadOrders();
  }, [deviceId]);


  useEffect(() => {
    console.log("OrderScreen Mounted");

    return () => {
      console.log("Orders Unmounted");
    };
  }, []);

  const handlePay = async (orderId: number) => {
    try {
      const result = await api.payOrder(orderId);

      if (
        result.payment_status === 'success' ||
        result.payment_status === 'failed'
      ) {
        clearCart();
      }

      Alert.alert(
        result.payment_status === 'success'
          ? 'Payment successful'
          : 'Payment failed',
        `Order status: ${result.order_status}`
      );

      loadOrders();
    } catch {
      Alert.alert('Error', 'Payment request failed');
    }
  };
  const statusColor = (status: Order['status']) =>
    ({ draft: '#ff9800', paid: '#4caf50', failed: '#f44336' }[status]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Orders</Text>
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.order}>
            <View>
              <Text style={styles.orderId}>Order #{item.id}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.status, { color: statusColor(item.status) }]}>
                {item.status.toUpperCase()}
              </Text>
              {item.status === 'draft' && (
                <TouchableOpacity style={styles.payBtn} onPress={() => handlePay(item.id)}>
                  <Text style={styles.payBtnText}>Pay</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No orders yet</Text>}
        onRefresh={loadOrders}
        refreshing={refreshing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  order: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  orderId: { fontSize: 16, fontWeight: '600' },
  date: { fontSize: 12, color: '#9e9e9e', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  status: { fontWeight: '700', fontSize: 14 },
  payBtn: { backgroundColor: '#1976d2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, marginTop: 4 },
  payBtnText: { color: '#fff', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9e9e9e', marginTop: 40, fontSize: 16 },
});

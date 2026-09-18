import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { api } from '../../src/api/api';
import { Stack, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProductsScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/getAllProduct?limit=1000&isAdmin=true&_t=${Date.now()}`);
      if (res.data.success) {
        // Sort descending by id
        const sorted = (res.data.data || []).sort((a: any, b: any) => b.id - a.id);
        setProducts(sorted);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (product: any, field: 'isActive' | 'isDailyUpdate') => {
    try {
      setTogglingId(product.id);
      
      const newValue = !product[field];
      
      // Optimistic update
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, [field]: newValue } : p));
      
      const formData = new FormData();
      formData.append(field, String(newValue));
      
      await api.put(`/${product.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
    } catch (err) {
      console.error(err);
      Alert.alert('Error', `Failed to update ${field}`);
      // Revert on failure
      fetchProducts();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to completely delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setTogglingId(id);
              const res = await api.delete(`/deleteProduct/${id}`);
              if (res.data.success) {
                setProducts(prev => prev.filter(p => p.id !== id));
                Alert.alert('Success', 'Product deleted');
              }
            } catch (err: any) {
              console.error(err);
              Alert.alert('Error', err.response?.data?.message || 'Failed to delete product');
            } finally {
              setTogglingId(null);
            }
          }
        }
      ]
    );
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    return products.filter(p => 
      p.productName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const renderItem = ({ item }: { item: any }) => (
    <Card style={styles.productCard}>
      <View style={styles.cardTop}>
        <View style={styles.imageContainer}>
          {item.productImages && item.productImages.length > 0 ? (
             <Image source={{ uri: item.productImages[0] }} style={styles.productImage} />
          ) : (
            <View style={styles.noImage}>
              <MaterialCommunityIcons name="image-off-outline" size={24} color="#94a3b8" />
            </View>
          )}
          {!item.isActive && (
            <View style={styles.inactiveOverlay}>
              <Typography variant="label" weight="bold" color="#fff">INACTIVE</Typography>
            </View>
          )}
        </View>
        
        <View style={styles.cardInfo}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Typography variant="body" weight="extrabold" color="#0f172a" numberOfLines={2}>{item.productName}</Typography>
              <Typography variant="caption" weight="bold" color="#64748b" style={{ marginTop: 2 }}>SKU: {item.sku}</Typography>
            </View>
            <Typography variant="body" weight="extrabold" color="#047857">₹{item.finalPrice}</Typography>
          </View>
          
          <View style={styles.stockRow}>
            <View style={styles.stockBadge}>
              <MaterialCommunityIcons name="package-variant-closed" size={12} color="#475569" />
              <Typography variant="caption" weight="bold" color="#475569" style={{ marginLeft: 4 }}>
                {item.stockQuantity} in stock
              </Typography>
            </View>
            <Typography variant="caption" color="#94a3b8">ID: #{item.id}</Typography>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <View style={styles.toggles}>
          <TouchableOpacity 
            onPress={() => handleToggle(item, 'isActive')}
            disabled={togglingId === item.id}
            style={[styles.toggleBtn, item.isActive ? styles.toggleActive : styles.toggleInactive]}
          >
            <MaterialCommunityIcons name={item.isActive ? "eye" : "eye-off"} size={14} color={item.isActive ? "#fff" : "#64748b"} />
            <Typography variant="label" weight="bold" color={item.isActive ? "#fff" : "#64748b"} style={{ marginLeft: 4 }}>
              {item.isActive ? 'Active' : 'Hidden'}
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => handleToggle(item, 'isDailyUpdate')}
            disabled={togglingId === item.id}
            style={[styles.toggleBtn, item.isDailyUpdate ? styles.toggleActiveBlue : styles.toggleInactive]}
          >
            <MaterialCommunityIcons name={item.isDailyUpdate ? "star" : "star-outline"} size={14} color={item.isDailyUpdate ? "#fff" : "#64748b"} />
            <Typography variant="label" weight="bold" color={item.isDailyUpdate ? "#fff" : "#64748b"} style={{ marginLeft: 4 }}>
              {item.isDailyUpdate ? 'Daily Update' : 'Standard'}
            </Typography>
          </TouchableOpacity>
        </View>

        <View style={styles.rightActions}>
          <TouchableOpacity 
            onPress={() => router.push({ pathname: '/product-editor', params: { id: item.id } })}
            style={styles.actionBtn}
          >
            <MaterialCommunityIcons name="pencil" size={20} color="#0f172a" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleDelete(item.id)}
            style={[styles.actionBtn, { backgroundColor: '#fef2f2' }]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      
      {togglingId === item.id && (
        <View style={styles.cardLoaderOverlay}>
          <ActivityIndicator color="#0f172a" />
        </View>
      )}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerGradient}>
        <View style={styles.headerTop}>
          <View>
            <Typography variant="h2" weight="extrabold" color="#fff">Product Inventory</Typography>
            <Typography variant="body" color="#94a3b8" style={{ marginTop: 4 }}>
              {products.length} Items Listed
            </Typography>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/product-editor')}>
            <MaterialCommunityIcons name="plus" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <MaterialCommunityIcons name="magnify" size={24} color="#94a3b8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by name or SKU..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f172a" />
          <Typography variant="body" weight="medium" color="#64748b" style={{ marginTop: 12 }}>Loading Inventory...</Typography>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="package-variant" size={64} color="#cbd5e1" />
          <Typography variant="h3" weight="bold" color="#475569" style={{ marginTop: 16 }}>No Products Found</Typography>
          <Typography variant="body" color="#94a3b8" style={{ marginTop: 8, textAlign: 'center' }}>
            {searchQuery ? "Try adjusting your search criteria." : "Start by adding a new product to your inventory."}
          </Typography>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  headerGradient: {
    padding: 20,
    paddingTop: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    padding: 0,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  toggles: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  toggleActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  toggleActiveBlue: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  toggleInactive: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLoaderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  }
});

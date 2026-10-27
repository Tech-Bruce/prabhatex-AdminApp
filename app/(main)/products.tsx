import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Alert, 
  TextInput, 
  Modal, 
  ScrollView, 
  RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { api } from '../../src/api/api';
import { Stack, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppAlert } from '../../src/context/AlertContext';

type StatusFilter = 'all' | 'active' | 'disabled' | 'daily_update';
type DailyUpdateFilter = 'all' | 'in' | 'not_in';
type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type SortOption = 'default' | 'relevance' | 'name_asc' | 'name_desc' | 'price_asc' | 'price_desc' | 'stock_desc' | 'stock_asc';

/**
 * Calculates relevance score for search matching (matches web admin algorithm)
 */
const getRelevanceScore = (product: any, query: string) => {
  if (!query) return 0;
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = (product?.productName || '').toLowerCase();
  const sku = (product?.sku || '').toLowerCase();
  const cat = (product?.category?.category || '').toLowerCase();

  let score = 0;

  if (name === q) score += 10000;
  if (sku === q) score += 9000;

  if (name.startsWith(q)) {
    score += 5000;
  }

  if (sku.startsWith(q)) {
    score += 4000;
  }

  const words = name.split(/[\s\-_,./]+/).filter(Boolean);
  const wIdx = words.findIndex((w: string) => w.startsWith(q));
  if (wIdx !== -1) {
    score += Math.max(500, 3500 - wIdx * 500);
  } else {
    const subIdx = name.indexOf(q);
    if (subIdx !== -1) {
      score += Math.max(100, 1000 - subIdx * 20);
    }
  }

  if (sku.includes(q)) score += 800;
  if (cat.includes(q)) score += 200;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    let matched = 0;
    for (const t of tokens) {
      if (name.includes(t) || sku.includes(t)) matched++;
    }
    if (matched === tokens.length) score += 2000;
  }

  return score;
};

export default function ProductsScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Filter States (matching web panel)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dailyUpdateFilter, setDailyUpdateFilter] = useState<DailyUpdateFilter>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');

  // Modal State
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get(`/getCategory?t=${Date.now()}`);
      if (res.data?.success) {
        setCategories(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchProducts = async (isPullToRefresh = false) => {
    try {
      if (isPullToRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await api.get(`/getAllProduct?limit=1000&isAdmin=true&_t=${Date.now()}`);
      if (res.data.success) {
        const sorted = (res.data.data || []).sort((a: any, b: any) => b.id - a.id);
        setProducts(sorted);
      }
    } catch (err) {
      console.error(err);
      AppAlert.alert('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      AppAlert.alert('Error', `Failed to update ${field}`);
      fetchProducts();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (id: number) => {
    AppAlert.alert(
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
                AppAlert.alert('Success', 'Product deleted');
              }
            } catch (err: any) {
              console.error(err);
              AppAlert.alert('Error', err.response?.data?.message || 'Failed to delete product');
            } finally {
              setTogglingId(null);
            }
          }
        }
      ]
    );
  };

  // Live Stats for filter tabs
  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter(p => p.isActive !== false).length;
    const disabled = products.filter(p => p.isActive === false).length;
    const dailyUpdate = products.filter(p => Boolean(p.isDailyUpdate)).length;
    return { total, active, disabled, dailyUpdate };
  }, [products]);

  // Count active modal filters
  const activeModalFilterCount = useMemo(() => {
    let count = 0;
    if (categoryFilter !== 'all') count++;
    if (dailyUpdateFilter !== 'all') count++;
    if (stockFilter !== 'all') count++;
    if (sortOption !== 'default') count++;
    return count;
  }, [categoryFilter, dailyUpdateFilter, stockFilter, sortOption]);

  const hasAnyFilterActive = 
    statusFilter !== 'all' || 
    categoryFilter !== 'all' || 
    dailyUpdateFilter !== 'all' || 
    stockFilter !== 'all' || 
    sortOption !== 'default' || 
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setDailyUpdateFilter('all');
    setStockFilter('all');
    setSortOption('default');
  };

  // Filter & Sort Pipeline
  const filteredProducts = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];

    let list = products.filter(p => {
      // 1. Search matching (multi-token support)
      if (tokens.length > 0) {
        const name = (p.productName || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const cat = (p.category?.category || '').toLowerCase();
        const matchesAll = tokens.every(t => name.includes(t) || sku.includes(t) || cat.includes(t));
        if (!matchesAll) return false;
      }

      // 2. Status tab filter
      if (statusFilter === 'active' && p.isActive === false) return false;
      if (statusFilter === 'disabled' && p.isActive !== false) return false;
      if (statusFilter === 'daily_update' && !p.isDailyUpdate) return false;

      // 3. Category filter
      if (categoryFilter !== 'all') {
        const pCatId = String(p.categoryId || p.category?.id || '');
        if (pCatId !== String(categoryFilter)) return false;
      }

      // 4. Daily update filter from modal
      if (dailyUpdateFilter === 'in' && !p.isDailyUpdate) return false;
      if (dailyUpdateFilter === 'not_in' && p.isDailyUpdate) return false;

      // 5. Stock availability filter
      const avail = Number(p.available ?? Math.max(0, (Number(p.stockQuantity) || 0) - (Number(p.committed) || 0)));
      if (stockFilter === 'in_stock' && avail <= 0) return false;
      if (stockFilter === 'low_stock' && (avail <= 0 || avail > 5)) return false;
      if (stockFilter === 'out_of_stock' && avail > 0) return false;

      return true;
    });

    // 6. Sorting with relevance support
    if (sortOption === 'relevance' || (sortOption === 'default' && trimmed)) {
      list = [...list].sort((a, b) => {
        const scoreA = getRelevanceScore(a, trimmed);
        const scoreB = getRelevanceScore(b, trimmed);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.id || 0) - (a.id || 0);
      });
    } else if (sortOption === 'name_asc') {
      list = [...list].sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));
    } else if (sortOption === 'name_desc') {
      list = [...list].sort((a, b) => (b.productName || '').localeCompare(a.productName || ''));
    } else if (sortOption === 'price_asc') {
      list = [...list].sort((a, b) => (Number(a.finalPrice ?? a.price) || 0) - (Number(b.finalPrice ?? b.price) || 0));
    } else if (sortOption === 'price_desc') {
      list = [...list].sort((a, b) => (Number(b.finalPrice ?? b.price) || 0) - (Number(a.finalPrice ?? a.price) || 0));
    } else if (sortOption === 'stock_desc') {
      list = [...list].sort((a, b) => {
        const aStock = Number(a.available ?? a.stockQuantity ?? 0);
        const bStock = Number(b.available ?? b.stockQuantity ?? 0);
        return bStock - aStock;
      });
    } else if (sortOption === 'stock_asc') {
      list = [...list].sort((a, b) => {
        const aStock = Number(a.available ?? a.stockQuantity ?? 0);
        const bStock = Number(b.available ?? b.stockQuantity ?? 0);
        return aStock - bStock;
      });
    } else {
      // Default: ID descending (newest first)
      list = [...list].sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    return list;
  }, [products, searchQuery, statusFilter, categoryFilter, dailyUpdateFilter, stockFilter, sortOption]);

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
              <Typography variant="body" weight="extrabold" color="#0f172a" numberOfLines={2}>
                {item.productName}
              </Typography>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Typography variant="caption" weight="bold" color="#64748b">SKU: {item.sku}</Typography>
                {item.category?.category && (
                  <View style={styles.categoryPill}>
                    <Typography variant="label" weight="bold" color="#475569" style={{ fontSize: 9 }}>
                      {item.category.category}
                    </Typography>
                  </View>
                )}
              </View>
            </View>
            <Typography variant="body" weight="extrabold" color="#047857">₹{item.finalPrice || item.price}</Typography>
          </View>
          
          <View style={styles.inventoryContainer}>
            <View style={styles.inventoryCol}>
              <Typography variant="label" weight="bold" color="#64748b" style={styles.invLabel}>Available</Typography>
              <View style={[
                styles.invBadge,
                { backgroundColor: (item.available ?? Math.max(0, (Number(item.stockQuantity) || 0) - (Number(item.committed) || 0))) > 0 ? '#ecfdf5' : '#fef2f2' }
              ]}>
                <Typography variant="caption" weight="extrabold" color={(item.available ?? Math.max(0, (Number(item.stockQuantity) || 0) - (Number(item.committed) || 0))) > 0 ? '#065f46' : '#991b1b'}>
                  {item.available ?? Math.max(0, (Number(item.stockQuantity) || 0) - (Number(item.committed) || 0))}
                </Typography>
              </View>
            </View>

            <View style={styles.invDivider} />

            <View style={styles.inventoryCol}>
              <Typography variant="label" weight="bold" color="#64748b" style={styles.invLabel}>Committed</Typography>
              <Typography variant="caption" weight="extrabold" color={(Number(item.committed) || 0) > 0 ? '#b45309' : '#0f172a'}>
                {item.committed ?? 0}
              </Typography>
            </View>

            <View style={styles.invDivider} />

            <View style={styles.inventoryCol}>
              <Typography variant="label" weight="bold" color="#64748b" style={styles.invLabel}>On hand</Typography>
              <Typography variant="caption" weight="extrabold" color="#0f172a">
                {item.onHand ?? item.stockQuantity ?? 0}
              </Typography>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cardActions}>
        <View style={styles.toggles}>
          <TouchableOpacity 
            onPress={() => handleToggle(item, 'isActive')}
            disabled={togglingId === item.id}
            style={[styles.toggleBtn, item.isActive !== false ? styles.toggleActive : styles.toggleInactive]}
          >
            <MaterialCommunityIcons name={item.isActive !== false ? "eye" : "eye-off"} size={14} color={item.isActive !== false ? "#fff" : "#64748b"} />
            <Typography variant="label" weight="bold" color={item.isActive !== false ? "#fff" : "#64748b"} style={{ marginLeft: 4 }}>
              {item.isActive !== false ? 'Active' : 'Hidden'}
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => handleToggle(item, 'isDailyUpdate')}
            disabled={togglingId === item.id}
            style={[styles.toggleBtn, item.isDailyUpdate ? styles.toggleActiveBlue : styles.toggleInactive]}
          >
            <MaterialCommunityIcons name={item.isDailyUpdate ? "star" : "star-outline"} size={14} color={item.isDailyUpdate ? "#fff" : "#64748b"} />
            <Typography variant="label" weight="bold" color={item.isDailyUpdate ? "#fff" : "#64748b"} style={{ marginLeft: 4 }}>
              {item.isDailyUpdate ? 'In Daily Update' : 'Daily Update'}
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
      
      {/* ── Top Header with Search and Filter Button ── */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerGradient}>
        <View style={styles.headerTop}>
          <View>
            <Typography variant="h2" weight="extrabold" color="#fff">Product Inventory</Typography>
            <Typography variant="body" color="#94a3b8" style={{ marginTop: 2 }}>
              {products.length} Products Listed
            </Typography>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/product-editor')}>
            <MaterialCommunityIcons name="plus" size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={22} color="#94a3b8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or SKU..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Modal Trigger Button */}
          <TouchableOpacity 
            style={[styles.filterTriggerBtn, activeModalFilterCount > 0 && styles.filterTriggerBtnActive]}
            onPress={() => setIsFilterModalVisible(true)}
          >
            <MaterialCommunityIcons 
              name="tune-variant" 
              size={20} 
              color={activeModalFilterCount > 0 ? '#0f172a' : '#fff'} 
            />
            {activeModalFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Typography variant="caption" weight="extrabold" color="#fff" style={{ fontSize: 9 }}>
                  {activeModalFilterCount}
                </Typography>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Quick Status Filter Tabs (matching web panel) ── */}
      <View style={styles.quickTabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTabsContent}>
          <TouchableOpacity 
            style={[styles.tabChip, statusFilter === 'all' && styles.tabChipActive]}
            onPress={() => setStatusFilter('all')}
          >
            <Typography 
              variant="caption" 
              weight="bold" 
              color={statusFilter === 'all' ? '#0f172a' : '#64748b'}
            >
              All Products
            </Typography>
            <View style={[styles.tabCountBadge, statusFilter === 'all' && styles.tabCountBadgeActive]}>
              <Typography 
                variant="caption" 
                weight="bold" 
                color={statusFilter === 'all' ? '#0f172a' : '#64748b'} 
                style={{ fontSize: 10 }}
              >
                {stats.total}
              </Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabChip, statusFilter === 'active' && styles.tabChipActiveGreen]}
            onPress={() => setStatusFilter('active')}
          >
            <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
            <Typography 
              variant="caption" 
              weight="bold" 
              color={statusFilter === 'active' ? '#065f46' : '#64748b'}
            >
              Active
            </Typography>
            <View style={[styles.tabCountBadge, statusFilter === 'active' && { backgroundColor: '#a7f3d0' }]}>
              <Typography 
                variant="caption" 
                weight="bold" 
                color={statusFilter === 'active' ? '#065f46' : '#64748b'} 
                style={{ fontSize: 10 }}
              >
                {stats.active}
              </Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabChip, statusFilter === 'disabled' && styles.tabChipActiveAmber]}
            onPress={() => setStatusFilter('disabled')}
          >
            <View style={[styles.statusDot, { backgroundColor: '#f59e0b' }]} />
            <Typography 
              variant="caption" 
              weight="bold" 
              color={statusFilter === 'disabled' ? '#92400e' : '#64748b'}
            >
              Disabled
            </Typography>
            <View style={[styles.tabCountBadge, statusFilter === 'disabled' && { backgroundColor: '#fde68a' }]}>
              <Typography 
                variant="caption" 
                weight="bold" 
                color={statusFilter === 'disabled' ? '#92400e' : '#64748b'} 
                style={{ fontSize: 10 }}
              >
                {stats.disabled}
              </Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabChip, statusFilter === 'daily_update' && styles.tabChipActiveBlue]}
            onPress={() => setStatusFilter('daily_update')}
          >
            <View style={[styles.statusDot, { backgroundColor: '#3b82f6' }]} />
            <Typography 
              variant="caption" 
              weight="bold" 
              color={statusFilter === 'daily_update' ? '#1e40af' : '#64748b'}
            >
              In Daily Update
            </Typography>
            <View style={[styles.tabCountBadge, statusFilter === 'daily_update' && { backgroundColor: '#bfdbfe' }]}>
              <Typography 
                variant="caption" 
                weight="bold" 
                color={statusFilter === 'daily_update' ? '#1e40af' : '#64748b'} 
                style={{ fontSize: 10 }}
              >
                {stats.dailyUpdate}
              </Typography>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Active Filters & Results Summary Banner ── */}
      <View style={styles.filterSummaryBar}>
        <Typography variant="caption" weight="bold" color="#64748b">
          Showing <Typography variant="caption" weight="extrabold" color="#0f172a">{filteredProducts.length}</Typography> product{filteredProducts.length !== 1 ? 's' : ''}
        </Typography>

        {hasAnyFilterActive && (
          <TouchableOpacity style={styles.clearAllBtn} onPress={handleResetFilters}>
            <MaterialCommunityIcons name="close" size={12} color="#dc2626" />
            <Typography variant="caption" weight="extrabold" color="#dc2626" style={{ fontSize: 11, marginLeft: 2 }}>
              Clear filters
            </Typography>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Products List ── */}
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
            {hasAnyFilterActive ? "Try adjusting or clearing your filters." : "Start by adding a new product to your inventory."}
          </Typography>
          {hasAnyFilterActive && (
            <TouchableOpacity style={styles.emptyResetBtn} onPress={handleResetFilters}>
              <Typography variant="caption" weight="bold" color="#fff">Reset Filters</Typography>
            </TouchableOpacity>
          )}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchProducts(true)}
              tintColor="#0f172a"
              colors={['#0f172a']}
            />
          }
        />
      )}

      {/* ── Filter & Sort Modal (Bottom Sheet Style) ── */}
      <Modal
        visible={isFilterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="filter-variant" size={22} color="#0f172a" />
                <Typography variant="h3" weight="extrabold" color="#0f172a">Filters & Sort</Typography>
              </View>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* 1. Sort Options */}
              <View style={styles.filterSection}>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={styles.sectionTitle}>
                  Sort By
                </Typography>
                <View style={styles.chipGrid}>
                  {[
                    { id: 'default', label: 'Default (Newest)' },
                    { id: 'relevance', label: 'Relevance (Best match)' },
                    { id: 'price_asc', label: 'Price: Low to High' },
                    { id: 'price_desc', label: 'Price: High to Low' },
                    { id: 'name_asc', label: 'Name: A to Z' },
                    { id: 'name_desc', label: 'Name: Z to A' },
                    { id: 'stock_desc', label: 'Stock: High to Low' },
                    { id: 'stock_asc', label: 'Stock: Low to High' },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.filterChip, sortOption === item.id && styles.filterChipActive]}
                      onPress={() => setSortOption(item.id as SortOption)}
                    >
                      <Typography 
                        variant="caption" 
                        weight="bold" 
                        color={sortOption === item.id ? '#fff' : '#334155'}
                      >
                        {item.label}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 2. Category Filter */}
              <View style={styles.filterSection}>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={styles.sectionTitle}>
                  Category
                </Typography>
                <View style={styles.chipGrid}>
                  <TouchableOpacity
                    style={[styles.filterChip, categoryFilter === 'all' && styles.filterChipActive]}
                    onPress={() => setCategoryFilter('all')}
                  >
                    <Typography 
                      variant="caption" 
                      weight="bold" 
                      color={categoryFilter === 'all' ? '#fff' : '#334155'}
                    >
                      All Categories
                    </Typography>
                  </TouchableOpacity>
                  {categories.map((cat: any) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.filterChip, String(categoryFilter) === String(cat.id) && styles.filterChipActive]}
                      onPress={() => setCategoryFilter(String(cat.id))}
                    >
                      <Typography 
                        variant="caption" 
                        weight="bold" 
                        color={String(categoryFilter) === String(cat.id) ? '#fff' : '#334155'}
                      >
                        {cat.category}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 3. Daily Update Filter */}
              <View style={styles.filterSection}>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={styles.sectionTitle}>
                  Daily Update
                </Typography>
                <View style={styles.chipGrid}>
                  {[
                    { id: 'all', label: 'All Products' },
                    { id: 'in', label: 'In Daily Update' },
                    { id: 'not_in', label: 'Not in Daily Update' },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.filterChip, dailyUpdateFilter === item.id && styles.filterChipActive]}
                      onPress={() => setDailyUpdateFilter(item.id as DailyUpdateFilter)}
                    >
                      <Typography 
                        variant="caption" 
                        weight="bold" 
                        color={dailyUpdateFilter === item.id ? '#fff' : '#334155'}
                      >
                        {item.label}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 4. Stock Availability Filter */}
              <View style={styles.filterSection}>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={styles.sectionTitle}>
                  Stock Availability
                </Typography>
                <View style={styles.chipGrid}>
                  {[
                    { id: 'all', label: 'All Stock Levels' },
                    { id: 'in_stock', label: 'In Stock (> 0)' },
                    { id: 'low_stock', label: 'Low Stock (1-5)' },
                    { id: 'out_of_stock', label: 'Out of Stock (0)' },
                  ].map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.filterChip, stockFilter === item.id && styles.filterChipActive]}
                      onPress={() => setStockFilter(item.id as StockFilter)}
                    >
                      <Typography 
                        variant="caption" 
                        weight="bold" 
                        color={stockFilter === item.id ? '#fff' : '#334155'}
                      >
                        {item.label}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalResetBtn} 
                onPress={() => {
                  setCategoryFilter('all');
                  setDailyUpdateFilter('all');
                  setStockFilter('all');
                  setSortOption('default');
                }}
              >
                <Typography variant="body" weight="bold" color="#dc2626">Reset Filters</Typography>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalApplyBtn} 
                onPress={() => setIsFilterModalVisible(false)}
              >
                <Typography variant="body" weight="extrabold" color="#fff">Apply</Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 8,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTriggerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterTriggerBtnActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  quickTabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 10,
  },
  quickTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  tabChipActive: {
    backgroundColor: '#e2e8f0',
    borderColor: '#0f172a',
  },
  tabChipActiveGreen: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  tabChipActiveAmber: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
  },
  tabChipActiveBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tabCountBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabCountBadgeActive: {
    backgroundColor: '#cbd5e1',
  },
  filterSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  categoryPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
  emptyResetBtn: {
    marginTop: 16,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  productCard: {
    padding: 0,
    marginBottom: 14,
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    backgroundColor: 'rgba(15,23,42,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  inventoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  inventoryCol: {
    alignItems: 'center',
    flex: 1,
  },
  invLabel: {
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  invBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  invDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#cbd5e1',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
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
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLoaderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filterSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 14,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

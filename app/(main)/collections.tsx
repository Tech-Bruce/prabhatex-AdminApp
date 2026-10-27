import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  ScrollView,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { api } from '../../src/api/api';
import { Stack, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppAlert } from '../../src/context/AlertContext';

interface Collection {
  id: string | number;
  name: string;
  orderIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Product {
  id: string | number;
  productName: string;
  sku?: string;
  price?: number | string;
  finalPrice?: number | string;
  productImages?: string[];
}

/**
 * Relevance scoring for product search matching web panel
 */
const getProductRelevance = (product: Product, query: string) => {
  if (!query) return 0;
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const name = (product?.productName || '').toLowerCase();
  const sku = (product?.sku || '').toLowerCase();

  let score = 0;
  if (name === q) score += 10000;
  if (sku === q) score += 9000;
  if (name.startsWith(q)) score += 5000;
  if (sku.startsWith(q)) score += 4000;

  const words = name.split(/[\s\-_,./]+/).filter(Boolean);
  const wIdx = words.findIndex((w: string) => w.startsWith(q));
  if (wIdx !== -1) {
    score += Math.max(500, 3500 - wIdx * 500);
  } else {
    const subIdx = name.indexOf(q);
    if (subIdx !== -1) score += Math.max(100, 1000 - subIdx * 20);
  }

  if (sku.includes(q)) score += 800;

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

export default function CollectionsScreen() {
  const [activeTab, setActiveTab] = useState<'collections' | 'assign'>('collections');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCollectionProducts, setLoadingCollectionProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Selected collection & assigned product IDs
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<(string | number)[]>([]);

  // Create & Edit Collection Form State
  const [collectionInputName, setCollectionInputName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<string | number | null>(null);
  const [savingCollection, setSavingCollection] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [reordering, setReordering] = useState(false);

  // Product Search inside Assign View
  const [productSearch, setProductSearch] = useState('');

  // Handle hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      if (activeTab === 'assign') {
        setActiveTab('collections');
        return true;
      }
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeTab]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/more');
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchProducts();
  }, []);

  // Fetch all collections
  const fetchCollections = async (isPull = false): Promise<Collection[]> => {
    try {
      if (isPull) setRefreshing(true);
      else setLoadingCollections(true);

      const res = await api.get(`/collections?isAdmin=true&_t=${Date.now()}`);
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.collections || []);
      setCollections(data);
      return data;
    } catch (err) {
      console.error('Error fetching collections:', err);
      AppAlert.alert('Error', 'Failed to fetch collections');
      return [];
    } finally {
      setLoadingCollections(false);
      setRefreshing(false);
    }
  };

  // Fetch all products for assigning
  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await api.get(`/getAllProduct?limit=1000&isAdmin=true&_t=${Date.now()}`);
      if (res.data?.success) {
        setProducts(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Fetch products inside the selected collection
  const fetchCollectionProducts = async (collectionId: string | number) => {
    try {
      setLoadingCollectionProducts(true);
      const res = await api.get(`/collections/${collectionId}/products?_t=${Date.now()}`);
      const assigned = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setSelectedProductIds(assigned.map((p: any) => p.id));
    } catch (err) {
      console.error('Error fetching collection products:', err);
      setSelectedProductIds([]);
    } finally {
      setLoadingCollectionProducts(false);
    }
  };

  // Create or Update collection
  const handleSaveCollection = async () => {
    const trimmed = collectionInputName.trim();
    if (!trimmed) {
      AppAlert.alert('Validation Error', 'Please enter a collection name');
      return;
    }

    try {
      setSavingCollection(true);
      if (editingCollectionId) {
        // Update existing collection
        await api.put(`/collections/${editingCollectionId}`, { name: trimmed });
        setEditingCollectionId(null);
        setCollectionInputName('');
        await fetchCollections();
        AppAlert.alert('Success', 'Collection updated successfully');
      } else {
        // Create new collection
        const res = await api.post('/collections', { name: trimmed });
        const created = res.data?.collection;
        setCollectionInputName('');

        // Automatically fetch and update the collections list immediately from server
        const freshCollections = await fetchCollections();

        // If newly created collection is returned, select it
        if (created) {
          const match = freshCollections.find((c: Collection) => String(c.id) === String(created.id)) || created;
          setSelectedCollection(match);
        }

        AppAlert.alert('Success', 'Collection created successfully');
      }
    } catch (err: any) {
      console.error('Error saving collection:', err);
      AppAlert.alert('Error', err.response?.data?.message || 'Failed to save collection');
    } finally {
      setSavingCollection(false);
    }
  };

  // Delete collection
  const handleDeleteCollection = (collection: Collection) => {
    AppAlert.alert(
      'Delete Collection',
      `Are you sure you want to permanently delete "${collection.name}"? Products will be unassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/collections/${collection.id}`);
              if (selectedCollection?.id === collection.id) {
                setSelectedCollection(null);
                setActiveTab('collections');
              }
              if (editingCollectionId === collection.id) {
                setEditingCollectionId(null);
                setCollectionInputName('');
              }
              await fetchCollections();
              AppAlert.alert('Success', 'Collection deleted');
            } catch (err: any) {
              console.error('Error deleting collection:', err);
              AppAlert.alert('Error', err.response?.data?.message || 'Failed to delete collection');
            }
          },
        },
      ]
    );
  };

  // Move Collection Up / Down
  const handleMoveCollection = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= collections.length) return;

    const updated = [...collections];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    setCollections(updated);
    setReordering(true);

    try {
      const orders = updated.map((col, idx) => ({ id: col.id, orderIndex: idx }));
      await api.put('/collections/order', { orders });
      await fetchCollections();
    } catch (err) {
      console.error('Error updating collection order:', err);
      AppAlert.alert('Error', 'Failed to save new collection order');
      await fetchCollections();
    } finally {
      setReordering(false);
    }
  };

  // Select collection to assign products
  const handleOpenAssign = (collection: Collection) => {
    setSelectedCollection(collection);
    fetchCollectionProducts(collection.id);
    setProductSearch('');
    setActiveTab('assign');
  };

  // Toggle single product selection
  const handleToggleProduct = (productId: string | number) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // Filtered products inside Assign View
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;

    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = products.filter(p => {
      const name = (p.productName || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      return tokens.every(token => name.includes(token) || sku.includes(token));
    });

    return matches.sort((a, b) => getProductRelevance(b, q) - getProductRelevance(a, q));
  }, [products, productSearch]);

  const isAllFilteredSelected = useMemo(() => {
    if (!filteredProducts.length) return false;
    return filteredProducts.every(p => selectedProductIds.includes(p.id));
  }, [filteredProducts, selectedProductIds]);

  const handleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredProducts.map(p => p.id));
      setSelectedProductIds(prev => prev.filter(id => !filteredIdSet.has(id)));
    } else {
      const filteredIds = filteredProducts.map(p => p.id);
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Save product assignment
  const handleSaveAssignment = async () => {
    if (!selectedCollection) return;
    try {
      setSavingAssignment(true);
      await api.post(`/collections/${selectedCollection.id}/assign`, {
        productIds: selectedProductIds,
      });
      AppAlert.alert('Success', `Updated products for "${selectedCollection.name}"`);
    } catch (err: any) {
      console.error('Error assigning products:', err);
      AppAlert.alert('Error', err.response?.data?.message || 'Failed to assign products');
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top Header ── */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerGradient}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Typography variant="h2" weight="extrabold" color="#fff">Collections</Typography>
            <Typography variant="caption" color="#94a3b8" style={{ marginTop: 2 }}>
              {collections.length} Collections · Curate storefront showcases
            </Typography>
          </View>

          {activeTab === 'assign' && (
            <TouchableOpacity 
              style={[styles.saveHeaderBtn, savingAssignment && { opacity: 0.7 }]}
              onPress={handleSaveAssignment}
              disabled={savingAssignment}
            >
              {savingAssignment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  <Typography variant="caption" weight="extrabold" color="#fff" style={{ marginLeft: 4 }}>
                    Save
                  </Typography>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Segmented Control / Navigation Tabs ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'collections' && styles.tabBtnActive]}
            onPress={() => setActiveTab('collections')}
          >
            <MaterialCommunityIcons 
              name="folder-multiple-outline" 
              size={18} 
              color={activeTab === 'collections' ? '#0f172a' : '#94a3b8'} 
            />
            <Typography 
              variant="caption" 
              weight="bold" 
              color={activeTab === 'collections' ? '#0f172a' : '#94a3b8'}
              style={{ marginLeft: 6 }}
            >
              Collections ({collections.length})
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'assign' && styles.tabBtnActive]}
            onPress={() => {
              if (selectedCollection) {
                setActiveTab('assign');
              } else if (collections.length > 0) {
                handleOpenAssign(collections[0]);
              } else {
                AppAlert.alert('Notice', 'Please create a collection first');
              }
            }}
          >
            <MaterialCommunityIcons 
              name="tag-plus-outline" 
              size={18} 
              color={activeTab === 'assign' ? '#0f172a' : '#94a3b8'} 
            />
            <Typography 
              variant="caption" 
              weight="bold" 
              color={activeTab === 'assign' ? '#0f172a' : '#94a3b8'}
              style={{ marginLeft: 6 }}
              numberOfLines={1}
            >
              {selectedCollection ? selectedCollection.name : 'Assign Products'}
            </Typography>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── Tab 1: Collections Management ── */}
      {activeTab === 'collections' ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCollections(true)}
              tintColor="#0f172a"
              colors={['#0f172a']}
            />
          }
        >
          {/* Create or Edit Collection Form */}
          <Card style={styles.formCard}>
            <View style={styles.formHeader}>
              <View style={styles.formIconCircle}>
                <MaterialCommunityIcons 
                  name={editingCollectionId ? "pencil" : "plus"} 
                  size={20} 
                  color="#4f46e5" 
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Typography variant="body" weight="extrabold" color="#0f172a">
                  {editingCollectionId ? 'Update Collection Name' : 'Create New Collection'}
                </Typography>
                <Typography variant="caption" color="#64748b">
                  {editingCollectionId ? 'Rename your collection' : 'Add a showcase for your storefront'}
                </Typography>
              </View>
            </View>

            <View style={styles.formInputRow}>
              <TextInput
                value={collectionInputName}
                onChangeText={setCollectionInputName}
                placeholder="e.g. Festival Silk Specials..."
                placeholderTextColor="#94a3b8"
                style={styles.textInput}
              />
              {editingCollectionId && (
                <TouchableOpacity
                  style={styles.cancelEditBtn}
                  onPress={() => {
                    setEditingCollectionId(null);
                    setCollectionInputName('');
                  }}
                >
                  <Typography variant="caption" weight="bold" color="#64748b">Cancel</Typography>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.submitBtn, savingCollection && { opacity: 0.7 }]}
                onPress={handleSaveCollection}
                disabled={savingCollection}
              >
                {savingCollection ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Typography variant="caption" weight="extrabold" color="#fff">
                    {editingCollectionId ? 'Update' : 'Create'}
                  </Typography>
                )}
              </TouchableOpacity>
            </View>
          </Card>

          {/* Collections List Header */}
          <View style={styles.listHeaderRow}>
            <Typography variant="body" weight="extrabold" color="#0f172a">
              Your Collections ({collections.length})
            </Typography>
            {reordering && (
              <Typography variant="caption" weight="bold" color="#d97706" style={{ fontSize: 11 }}>
                Updating order...
              </Typography>
            )}
          </View>

          {/* Collections List */}
          {loadingCollections ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0f172a" />
              <Typography variant="caption" color="#64748b" style={{ marginTop: 8 }}>
                Loading collections...
              </Typography>
            </View>
          ) : collections.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="folder-outline" size={48} color="#cbd5e1" />
              <Typography variant="body" weight="bold" color="#475569" style={{ marginTop: 12 }}>
                No Collections Yet
              </Typography>
              <Typography variant="caption" color="#94a3b8" style={{ marginTop: 4, textAlign: 'center' }}>
                Use the box above to create your first product collection.
              </Typography>
            </View>
          ) : (
            collections.map((col, index) => {
              const isSelected = selectedCollection?.id === col.id;
              return (
                <Card 
                  key={col.id} 
                  style={[
                    styles.collectionCard,
                    isSelected && styles.collectionCardSelected
                  ]}
                >
                  <View style={styles.collectionMainRow}>
                    {/* Reorder Buttons */}
                    <View style={styles.orderActions}>
                      <TouchableOpacity
                        onPress={() => handleMoveCollection(index, 'up')}
                        disabled={index === 0}
                        style={[styles.orderBtn, index === 0 && { opacity: 0.25 }]}
                      >
                        <MaterialCommunityIcons name="chevron-up" size={18} color="#475569" />
                      </TouchableOpacity>
                      <Typography variant="caption" weight="bold" color="#94a3b8" style={{ fontSize: 10 }}>
                        {index + 1}
                      </Typography>
                      <TouchableOpacity
                        onPress={() => handleMoveCollection(index, 'down')}
                        disabled={index === collections.length - 1}
                        style={[styles.orderBtn, index === collections.length - 1 && { opacity: 0.25 }]}
                      >
                        <MaterialCommunityIcons name="chevron-down" size={18} color="#475569" />
                      </TouchableOpacity>
                    </View>

                    {/* Collection Info */}
                    <TouchableOpacity 
                      style={styles.colInfoArea}
                      onPress={() => handleOpenAssign(col)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Typography variant="body" weight="extrabold" color="#0f172a" numberOfLines={1}>
                          {col.name}
                        </Typography>
                        {isSelected && (
                          <View style={styles.activePill}>
                            <Typography variant="label" weight="extrabold" color="#6366f1" style={{ fontSize: 9 }}>
                              ACTIVE
                            </Typography>
                          </View>
                        )}
                      </View>
                      <Typography variant="caption" color="#94a3b8" style={{ marginTop: 3 }}>
                        {col.createdAt ? new Date(col.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Storefront Collection'}
                      </Typography>
                    </TouchableOpacity>

                    {/* Actions */}
                    <View style={styles.actionButtonsCol}>
                      <TouchableOpacity
                        style={styles.iconActionBtn}
                        onPress={() => {
                          setEditingCollectionId(col.id);
                          setCollectionInputName(col.name);
                        }}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={18} color="#4f46e5" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: '#fef2f2' }]}
                        onPress={() => handleDeleteCollection(col)}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Assign Products Action Bar */}
                  <TouchableOpacity
                    style={styles.assignProductsBtn}
                    onPress={() => handleOpenAssign(col)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialCommunityIcons name="package-variant" size={16} color="#4f46e5" />
                      <Typography variant="caption" weight="bold" color="#4f46e5">
                        Manage Products in Collection
                      </Typography>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color="#4f46e5" />
                  </TouchableOpacity>
                </Card>
              );
            })
          )}
        </ScrollView>
      ) : (
        /* ── Tab 2: Product Assignment to Collection ── */
        <View style={styles.assignContainer}>
          {/* Collection Title & Selection Summary Header */}
          <View style={styles.assignHeaderCard}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Typography variant="body" weight="extrabold" color="#0f172a">
                  Assigning to:
                </Typography>
                <Typography variant="body" weight="extrabold" color="#6366f1">
                  "{selectedCollection?.name}"
                </Typography>
              </View>
              <Typography variant="caption" color="#64748b" style={{ marginTop: 2 }}>
                <Typography variant="caption" weight="extrabold" color="#0f172a">{selectedProductIds.length}</Typography> product{selectedProductIds.length !== 1 ? 's' : ''} currently selected
              </Typography>
            </View>

            <TouchableOpacity 
              style={styles.switchColBtn}
              onPress={() => setActiveTab('collections')}
            >
              <Typography variant="caption" weight="bold" color="#64748b">Switch</Typography>
            </TouchableOpacity>
          </View>

          {/* Search & Select All Bar */}
          <View style={styles.searchAndActionsRow}>
            <View style={styles.assignSearchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
              <TextInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Search products by name or SKU..."
                placeholderTextColor="#94a3b8"
                style={styles.assignSearchInput}
              />
              {productSearch ? (
                <TouchableOpacity onPress={() => setProductSearch('')} style={{ padding: 4 }}>
                  <MaterialCommunityIcons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {filteredProducts.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.selectAllBtn,
                  isAllFilteredSelected && styles.selectAllBtnActive
                ]}
                onPress={handleSelectAllFiltered}
              >
                <MaterialCommunityIcons 
                  name={isAllFilteredSelected ? "checkbox-marked" : "checkbox-blank-outline"} 
                  size={18} 
                  color={isAllFilteredSelected ? "#fff" : "#4f46e5"} 
                />
                <Typography 
                  variant="caption" 
                  weight="extrabold" 
                  color={isAllFilteredSelected ? "#fff" : "#4f46e5"}
                  style={{ marginLeft: 4, fontSize: 11 }}
                >
                  {isAllFilteredSelected ? 'Deselect All' : 'Select All'}
                </Typography>
              </TouchableOpacity>
            )}
          </View>

          {/* Products List */}
          {loadingProducts || loadingCollectionProducts ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color="#0f172a" />
              <Typography variant="caption" color="#64748b" style={{ marginTop: 8 }}>
                Loading catalog products...
              </Typography>
            </View>
          ) : filteredProducts.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="magnify" size={48} color="#cbd5e1" />
              <Typography variant="body" weight="bold" color="#475569" style={{ marginTop: 12 }}>
                No Products Found
              </Typography>
              <Typography variant="caption" color="#94a3b8" style={{ marginTop: 4 }}>
                Try adjusting your search query.
              </Typography>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.productsListContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              renderItem={({ item }) => {
                const isSelected = selectedProductIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.productSelectCard,
                      isSelected && styles.productSelectCardSelected
                    ]}
                    onPress={() => handleToggleProduct(item.id)}
                    activeOpacity={0.7}
                  >
                    {/* Thumbnail */}
                    <View style={styles.productThumbnail}>
                      {item.productImages?.[0] ? (
                        <Image source={{ uri: item.productImages[0] }} style={styles.thumbImage} />
                      ) : (
                        <View style={styles.noThumb}>
                          <MaterialCommunityIcons name="image-off-outline" size={20} color="#cbd5e1" />
                        </View>
                      )}
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <MaterialCommunityIcons name="check" size={16} color="#fff" />
                        </View>
                      )}
                    </View>

                    {/* Details */}
                    <View style={styles.productDetails}>
                      <Typography variant="body" weight="bold" color="#0f172a" numberOfLines={2}>
                        {item.productName}
                      </Typography>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={styles.skuBadge}>
                          <Typography variant="label" weight="bold" color="#64748b" style={{ fontSize: 9 }}>
                            {item.sku || 'NO SKU'}
                          </Typography>
                        </View>
                        <Typography variant="caption" weight="extrabold" color="#059669">
                          ₹{Number(item.finalPrice || item.price || 0).toLocaleString()}
                        </Typography>
                      </View>
                    </View>

                    {/* Checkbox Icon */}
                    <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
                      {isSelected && (
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Bottom Floating Save Button Bar */}
          <View style={styles.bottomSaveBar}>
            <View>
              <Typography variant="body" weight="extrabold" color="#0f172a">
                {selectedProductIds.length} Selected
              </Typography>
              <Typography variant="caption" color="#64748b">
                in "{selectedCollection?.name}"
              </Typography>
            </View>

            <TouchableOpacity
              style={[styles.primarySaveBtn, savingAssignment && { opacity: 0.7 }]}
              onPress={handleSaveAssignment}
              disabled={savingAssignment}
            >
              {savingAssignment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#fff" />
                  <Typography variant="body" weight="extrabold" color="#fff" style={{ marginLeft: 6 }}>
                    Save Selection
                  </Typography>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f1f5f9' },
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Form Card
  formCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  formIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  cancelEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // List
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  collectionCard: {
    padding: 14,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  collectionCardSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#faf5ff',
  },
  collectionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderActions: {
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  orderBtn: {
    padding: 2,
  },
  colInfoArea: {
    flex: 1,
    paddingRight: 8,
  },
  activePill: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  actionButtonsCol: {
    flexDirection: 'row',
    gap: 6,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assignProductsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  // Assign View
  assignContainer: {
    flex: 1,
    padding: 16,
    paddingBottom: 0,
  },
  assignHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  switchColBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  searchAndActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  assignSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    height: 42,
  },
  assignSearchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 13,
    color: '#0f172a',
    height: '100%',
  },
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  selectAllBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  productsListContent: {
    paddingBottom: 110,
    gap: 10,
  },
  productSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  productSelectCardSelected: {
    backgroundColor: '#f5f3ff',
    borderColor: '#7c3aed',
  },
  productThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noThumb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(124, 58, 237, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  skuBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  checkCircleSelected: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },

  // Floating Save Bar
  bottomSaveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  primarySaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },

  // Center / Empty
  centerBox: {
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

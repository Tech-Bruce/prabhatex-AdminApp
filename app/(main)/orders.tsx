import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../src/api/api';
import { colors } from '../../src/theme/colors';
import { router } from 'expo-router';
import { orderGalleryStore } from '../../src/utils/orderGalleryStore';

const formatOrderId = (id: any) => {
  if (!id) return 'PT0100';
  const s = id.toString();
  if (s.includes('-')) return 'PT' + s.slice(-4).toUpperCase();
  const num = parseInt(s, 10);
  if (isNaN(num)) return 'PT' + s;
  return 'PT' + (num + 100).toString().padStart(4, '0');
};

const formatStatusName = (status: string) => {
  if (!status) return '';
  if (status.toLowerCase() === 'ofd') return 'Out for Delivery';
  return status.split(/[\s_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
};

const capitalizeName = (name: string) => {
  if (!name) return 'Guest';
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const getCourierTrackingUrl = (awbNo: string, courierPartner: string) => {
  return '';
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATUS_CONFIG = {
  pending: { color: '#f59e0b', icon: 'clock-outline', label: 'Pending' },
  paid: { color: '#f59e0b', icon: 'credit-card-check-outline', label: 'Pending' },
  processing: { color: '#3b82f6', icon: 'cog-outline', label: 'Processing' },
  shipped: { color: '#8b5cf6', icon: 'truck-delivery-outline', label: 'Shipped' },
  delivered: { color: '#10b981', icon: 'check-circle-outline', label: 'Delivered' },
  cancelled: { color: '#ef4444', icon: 'close-circle-outline', label: 'Cancelled' },
};

const STATUS_TAB_MAP: any = {
  Unlabeled: (o: any) => {
    if (o.awbNo || o.courierMeta?.externalLabelGenerated) return false;
    const state = o.shippingAddress?.state?.toLowerCase() || '';
    return state === 'tamil nadu' || state === 'tamilnadu' || state === 'tn';
  },
  'Out of TN': (o: any) => {
    if (o.awbNo || o.courierMeta?.externalLabelGenerated) return false;
    const state = o.shippingAddress?.state?.toLowerCase() || '';
    if (!state) return true;
    return state !== 'tamil nadu' && state !== 'tamilnadu' && state !== 'tn';
  },
  'All Orders': () => true,
  Pending: (o: any) => o.status === 'pending' || o.status === 'paid' || o.status === 'processing',
  Booked: (o: any) => !!o.awbNo || !!o.courierMeta?.externalLabelGenerated,
  Delivered: (o: any) => o.status === 'delivered',
  Hold: (o: any) => o.status === 'cancelled',
};

const TABS = Object.keys(STATUS_TAB_MAP);
const FULFILLMENT_TABS = ['All', 'Fulfilled', 'Unfulfilled'];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('Unlabeled');
  const [fulfillmentFilter, setFulfillmentFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isSavingAwbs, setIsSavingAwbs] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/all-orders');
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err) {
      console.log('Fetch orders error', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const normalizeId = (val: any) => String(val ?? '').toLowerCase().replace(/[\s-]/g, '');
      const q = normalizeId(searchQuery.trim());
      const displayedOrderId = o.orderNumber || o.id;
      
      if (q) {
        const matchSearch = [o.id, o.orderNumber, formatOrderId(displayedOrderId)]
          .some(value => normalizeId(value).includes(q));
        if (!matchSearch) return false;
      } else {
        const matchTab = (STATUS_TAB_MAP[activeTab] || (() => true))(o);
        if (!matchTab) return false;
        
        const matchFulfillment =
          fulfillmentFilter === 'All' ? true :
          fulfillmentFilter === 'Fulfilled' ? (o.status === 'shipped' || o.status === 'delivered') :
          (o.status !== 'shipped' && o.status !== 'delivered');
        if (!matchFulfillment) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [orders, activeTab, fulfillmentFilter, searchQuery]);

  const toggleSelection = (id: string) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const assignAndBookTNOrders = async (tnOrdersToBook: any[]) => {
    if (tnOrdersToBook.length === 0) return { success: true, updatedOrdersMap: {} as any };
    setIsSavingAwbs(true);
    let updatedOrdersMap: any = {};
    try {
      const res = await api.get('/available-labels');
      const availableIds = res.data.ids || [];
      if (availableIds.length < tnOrdersToBook.length) {
        Alert.alert('Error', `Not enough tracking IDs! Needed: ${tnOrdersToBook.length}, Available: ${availableIds.length}.`);
        return { success: false, updatedOrdersMap: {} };
      }
      
      let idIndex = 0;
      const getNextId = () => (idIndex < availableIds.length ? availableIds[idIndex++] : null);

      const bookingPromises = tnOrdersToBook.map(async (order) => {
        while (true) {
          const trackingId = getNextId();
          if (!trackingId) return { success: false };
          try {
            await api.post('/book', { orderId: order.id, awbNo: trackingId });
            await api.patch(`/label-used/${trackingId}`);
            return { orderId: order.id, trackingId, success: true };
          } catch (error: any) {
            const errorMsg = error.response?.data?.message || "";
            if (errorMsg.toLowerCase().includes("already booked")) {
              await api.patch(`/label-used/${trackingId}`).catch(() => {});
              continue;
            } else {
              return { success: false };
            }
          }
        }
      });
      const results = await Promise.all(bookingPromises);
      let allSuccess = true;
      results.forEach((r: any) => {
        if (r.success) updatedOrdersMap[r.orderId] = r.trackingId;
        else allSuccess = false;
      });
      if (!allSuccess) Alert.alert('Warning', 'Some orders failed to book.');
      return { success: allSuccess, updatedOrdersMap };
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to assign labels');
      return { success: false, updatedOrdersMap: {} };
    } finally {
      setIsSavingAwbs(false);
    }
  };

  const handleCreateLabels = async () => {
    if (selectedOrders.length === 0) return;
    const selectedOrderObjs = orders.filter(o => selectedOrders.includes(o.id));
    const unbookedTn = selectedOrderObjs.filter(o => {
      if (o.awbNo) return false;
      const stateStr = o.shippingAddress?.state?.toLowerCase() || '';
      return stateStr === 'tamil nadu' || stateStr === 'tamilnadu' || stateStr === 'tn';
    });

    if (unbookedTn.length > 0) {
      const { success, updatedOrdersMap } = await assignAndBookTNOrders(unbookedTn);
      if (!success) return;
      
      setOrders(prev => prev.map(o => {
        if (updatedOrdersMap[o.id]) {
          return { ...o, awbNo: updatedOrdersMap[o.id], status: 'processing', shippingStatus: 'Booked' };
        }
        return o;
      }));
      Alert.alert('Success', 'Labels created and assigned successfully!');
    } else {
      Alert.alert('Notice', 'No unbooked Tamil Nadu orders selected.');
    }
    setSelectedOrders([]);
  };

  const navigateToDetail = (order: any) => {
    orderGalleryStore.orders = filteredOrders;
    router.push({
      pathname: '/order-detail',
      params: { order: JSON.stringify(order) }
    });
  };

  const renderOrder = ({ item }: { item: any }) => {
    const isCOD = item.paymentMethod?.toLowerCase() === 'cod';
    const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const addr = item.shippingAddress || {};
    const isSelected = selectedOrders.includes(item.id);

    return (
      <TouchableOpacity 
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => navigateToDetail(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity style={styles.checkboxContainer} onPress={() => toggleSelection(item.id)}>
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Typography variant="h3" color={colors.primary} weight="bold" style={{ fontSize: 18 }}>{formatOrderId(item.orderNumber || item.id)}</Typography>
              <Typography variant="caption" color={colors.text} style={{ marginTop: 2, fontSize: 13 }}>{capitalizeName(item.user?.username || addr.fullName)}</Typography>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cfg.color + '15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.color, marginRight: 6 }} />
                <Typography variant="caption" weight="bold" style={{ color: cfg.color, fontSize: 12 }}>{cfg.label}</Typography>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
          <View style={styles.infoCol}>
            <Typography variant="caption" color={colors.text} style={styles.label} weight="bold">AMOUNT</Typography>
            <Typography variant="body" color={colors.text} weight="bold" style={{ fontSize: 16 }}>₹{Number(item.totalAmount).toLocaleString('en-IN')}</Typography>
            <View style={[styles.badge, isCOD ? styles.badgeOrange : styles.badgeGreen]}>
              <Typography variant="caption" color={isCOD ? '#b45309' : '#047857'} style={{ fontSize: 10, fontWeight: 'bold' }}>{isCOD ? 'COD' : 'PREPAID'}</Typography>
            </View>
          </View>
          
          <View style={styles.infoCol}>
            <Typography variant="caption" color={colors.text} style={styles.label} weight="bold">SHIP TO</Typography>
            <Typography variant="body" color={colors.text} weight="bold" style={{ flexShrink: 1, fontSize: 14 }} numberOfLines={1}>
              {addr.city ? `${addr.city}${addr.zipCode ? ` ${addr.zipCode}` : ''}` : addr.fullName || '—'}
            </Typography>
          </View>

          <View style={styles.infoCol}>
            <Typography variant="caption" color={colors.text} style={styles.label} weight="bold">DATE</Typography>
            <Typography variant="body" color={colors.text} weight="bold" style={{ fontSize: 14 }}>{formatDate(item.createdAt)}</Typography>
          </View>
        </View>

        {item.awbNo && (
          <View style={styles.awbBanner}>
            <MaterialCommunityIcons name="truck-delivery-outline" size={16} color="#3b82f6" style={{ marginRight: 8 }} />
            <Typography variant="caption" color="#3b82f6" weight="bold">AWB: {item.awbNo}</Typography>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      
      <View style={styles.header}>
        <Typography variant="h1" color={colors.primary}>Orders</Typography>
        <Typography variant="body" color={colors.textSecondary} weight="bold">{orders.length} Total</Typography>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search order ID..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.segmentedControl}>
        {FULFILLMENT_TABS.map(tab => (
          <TouchableOpacity 
            key={tab} 
            style={[styles.segmentBtn, fulfillmentFilter === tab && styles.segmentBtnActive]}
            onPress={() => setFulfillmentFilter(tab)}
          >
            <Typography variant="caption" weight="bold" color={fulfillmentFilter === tab ? colors.text : colors.textSecondary}>
              {tab}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={item => item}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={[styles.tab, activeTab === item && styles.activeTab]}
              onPress={() => setActiveTab(item)}
            >
              <Typography variant="caption" weight="bold" color={activeTab === item ? '#ffffff' : colors.textSecondary}>
                {item}
              </Typography>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Select All & Create Label Bar */}
      {filteredOrders.length > 0 && !loading && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={selectAll}>
            <View style={[styles.checkbox, selectedOrders.length === filteredOrders.length && styles.checkboxActive]}>
              {selectedOrders.length === filteredOrders.length && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
            </View>
            <Typography variant="caption" color={colors.textSecondary} style={{ marginLeft: 8 }}>
              Select All ({filteredOrders.length})
            </Typography>
          </TouchableOpacity>

          {selectedOrders.length > 0 && (
            <TouchableOpacity 
              style={[styles.createLabelBtn, isSavingAwbs && { opacity: 0.7 }]} 
              onPress={handleCreateLabels}
              disabled={isSavingAwbs}
            >
              {isSavingAwbs ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="tag-outline" size={16} color="#fff" />}
              <Typography variant="caption" weight="bold" color="#ffffff" style={{ marginLeft: 6 }}>
                Create Label ({selectedOrders.length})
              </Typography>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={renderOrder}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchOrders(); }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="package-variant" size={48} color={colors.border} />
              <Typography variant="body" color={colors.textSecondary} style={{ marginTop: 16 }}>No orders found.</Typography>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.text,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabsContainer: {
    marginBottom: 12,
    height: 36,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  checkboxContainer: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  createLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  cardHeader: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 16,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 6,
    color: colors.text,
  },
  badge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeGreen: { backgroundColor: '#d1fae5' },
  badgeOrange: { backgroundColor: '#ffedd5' },
  awbBanner: {
    marginTop: 12,
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
});

import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../src/api/api';
import { colors } from '../../src/theme/colors';
import { router } from 'expo-router';
import { orderGalleryStore } from '../../src/utils/orderGalleryStore';
import { CameraView, useCameraPermissions } from 'expo-camera';

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

const getItemImage = (orderItem: any) => {
  if (!orderItem) return null;
  if (orderItem.image) return orderItem.image;
  const product = orderItem.product;
  if (product) {
    if (orderItem.color && Array.isArray(product.colors)) {
      const target = String(orderItem.color).trim().toLowerCase();
      const matched = product.colors.find((c: any) => {
        const name = typeof c === 'string' ? c : (c?.name || c?.color);
        return name && String(name).trim().toLowerCase() === target;
      });
      if (matched && Array.isArray(matched.images) && matched.images.length > 0 && matched.images[0]) {
        return matched.images[0];
      }
    }
    if (Array.isArray(product.productImages) && product.productImages.length > 0 && product.productImages[0]) {
      return product.productImages[0];
    }
    if (typeof product.productImages === 'string' && product.productImages) {
      return product.productImages;
    }
  }
  return null;
};

const formatOrderDateTime = (dateString: string) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;
  return `${date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${timeStr}`;
};

const getCourierTrackingUrl = (awbNo: string, courierPartner: string) => {
  return '';
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateVal = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isOrderInDateRange = (dateString: any, startStr: string, endStr: string) => {
  if (!startStr && !endStr) return true;
  if (!dateString) return false;
  const dateObj = new Date(dateString);
  const orderTime = dateObj.getTime();
  if (isNaN(orderTime)) return false;

  if (startStr) {
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0).getTime();
    if (orderTime < start) return false;
  }

  if (endStr) {
    const [ey, em, ed] = endStr.split('-').map(Number);
    const end = new Date(ey, em - 1, ed, 23, 59, 59, 999).getTime();
    if (orderTime > end) return false;
  }

  return true;
};

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Past 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

const STATUS_CONFIG = {
  pending: { color: '#f59e0b', icon: 'clock-outline', label: 'Pending' },
  paid: { color: '#f59e0b', icon: 'credit-card-check-outline', label: 'Pending' },
  processing: { color: '#3b82f6', icon: 'cog-outline', label: 'Processing' },
  shipped: { color: '#8b5cf6', icon: 'truck-delivery-outline', label: 'Shipped' },
  delivered: { color: '#10b981', icon: 'check-circle-outline', label: 'Delivered' },
  cancelled: { color: '#ef4444', icon: 'close-circle-outline', label: 'Cancelled' },
};

const isInsideTamilNadu = (state: any) => {
  const s = String(state || '').trim().toLowerCase();
  return (
    s === 'tamil nadu' ||
    s === 'tamilnadu' ||
    s === 'tn' ||
    s === 'puducherry' ||
    s === 'pondicherry' ||
    s === 'pondy' ||
    s === 'py'
  );
};

const STATUS_TAB_MAP: any = {
  Unlabeled: (o: any) => {
    const s = String(o.status || '').toLowerCase().trim();
    if (s === 'delivered' || s === 'cancelled') return false;
    if (o.awbNo || o.courierMeta?.externalLabelGenerated) return false;
    return isInsideTamilNadu(o.shippingAddress?.state);
  },
  'Out of TN': (o: any) => {
    const s = String(o.status || '').toLowerCase().trim();
    if (s === 'delivered' || s === 'cancelled') return false;
    if (o.awbNo || o.courierMeta?.externalLabelGenerated) return false;
    const state = o.shippingAddress?.state;
    if (!state || !String(state).trim()) return true;
    return !isInsideTamilNadu(state);
  },
  'All Orders': () => true,
  Pending: (o: any) => {
    const s = String(o.status || '').toLowerCase().trim();
    if (s === 'delivered' || s === 'cancelled') return false;
    if (o.awbNo || o.courierMeta?.externalLabelGenerated) return false;
    return s === 'pending' || s === 'paid' || s === 'processing';
  },
  Booked: (o: any) => {
    const s = String(o.status || '').toLowerCase().trim();
    if (s === 'delivered' || s === 'cancelled') return false;
    return !!o.awbNo || !!o.courierMeta?.externalLabelGenerated;
  },
  Delivered: (o: any) => {
    const s = String(o.status || '').toLowerCase().trim();
    return s === 'delivered';
  },
  Hold: (o: any) => {
    const s = String(o.status || '').toLowerCase().trim();
    return s === 'cancelled';
  },
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
  
  // Date filter state
  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isSavingAwbs, setIsSavingAwbs] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);

  const handleScanPress = async () => {
    if (!permission?.granted) {
      const req = await requestPermission();
      if (!req.granted) {
        Alert.alert('Permission required', 'Camera permission is required to scan barcodes.');
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setSearchQuery(data);
    setIsScanning(false);
  };

  const applyDatePreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = formatDateVal(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatDateVal(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'week') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      setStartDate(formatDateVal(past));
      setEndDate(formatDateVal(now));
    } else if (preset === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDateVal(startOfMonth));
      setEndDate(formatDateVal(now));
    } else if (preset === 'custom') {
      setTempStartDate(startDate || formatDateVal(now));
      setTempEndDate(endDate || formatDateVal(now));
      setCustomModalVisible(true);
    }
  };

  const handleApplyCustomDate = () => {
    if (!tempStartDate && !tempEndDate) {
      applyDatePreset('all');
      setCustomModalVisible(false);
      return;
    }
    setStartDate(tempStartDate);
    setEndDate(tempEndDate || tempStartDate);
    setDatePreset('custom');
    setCustomModalVisible(false);
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get('/all-orders');
      if (res.data.success) {
        setOrders(res.data.orders || []);
      }
    } catch (err: any) {
      console.log('Fetch orders error', err);
      if (err?.response?.status !== 401) {
        Alert.alert('Error', err?.response?.data?.message || 'Failed to load orders. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Calculate live tab counts matching date filter (same as web admin)
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TABS.forEach(tab => {
      const predicate = STATUS_TAB_MAP[tab] || (() => true);
      counts[tab] = orders.filter(o => isOrderInDateRange(o.createdAt, startDate, endDate) && predicate(o)).length;
    });
    return counts;
  }, [orders, startDate, endDate]);

  const filteredOrders = useMemo(() => {
    const rawQuery = searchQuery.trim();
    const matchesDate = (o: any) => isOrderInDateRange(o.createdAt, startDate, endDate);
    const matchTab = (o: any) => (STATUS_TAB_MAP[activeTab] || (() => true))(o);
    const matchFulfillment = (o: any) => {
      if (fulfillmentFilter === 'All') return true;
      const s = String(o.status || '').toLowerCase().trim();
      const isFulfilled = s === 'shipped' || s === 'delivered';
      return fulfillmentFilter === 'Fulfilled' ? isFulfilled : !isFulfilled;
    };

    if (!rawQuery) {
      return orders
        .filter(o => matchTab(o) && matchFulfillment(o) && matchesDate(o))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }

    const q = rawQuery.toLowerCase();
    const normalize = (val: any) => String(val ?? '').toLowerCase().replace(/[\s-]/g, '');
    const qNormalized = normalize(rawQuery);
    const queryDigits = rawQuery.replace(/\D/g, '');
    const hasLetters = /[a-zA-Z]/.test(rawQuery);

    const scored: { order: any; score: number }[] = [];

    for (const o of orders) {
      if (!matchTab(o)) continue;
      if (!matchFulfillment(o)) continue;
      if (!matchesDate(o)) continue;

      let score = 0;
      const displayedOrderId = o.orderNumber || o.id;
      const formattedId = formatOrderId(displayedOrderId);
      const formattedIdNorm = normalize(formattedId);
      const rawOrderNum = o.orderNumber !== undefined && o.orderNumber !== null ? normalize(o.orderNumber) : '';
      const rawId = o.id ? normalize(o.id) : '';
      const displayOrderId = o.displayOrderId ? normalize(o.displayOrderId) : '';
      const awbNo = o.awbNo ? normalize(o.awbNo) : '';

      const addr = o.shippingAddress || {};
      const user = o.user || {};

      // ── 1. Order ID Matching ──
      if (
        formattedIdNorm === qNormalized ||
        displayOrderId === qNormalized ||
        rawOrderNum === qNormalized ||
        rawId === qNormalized
      ) {
        score = Math.max(score, 10000000);
      } else if (!hasLetters && queryDigits && queryDigits.length >= 2) {
        const orderNumDigits = formattedIdNorm.replace(/\D/g, '');
        const stripZero = (s: string) => s.replace(/^0+/, '');
        if (orderNumDigits === queryDigits || (stripZero(orderNumDigits) && stripZero(orderNumDigits) === stripZero(queryDigits))) {
          score = Math.max(score, 9000000);
        } else if (rawOrderNum && (rawOrderNum === queryDigits || stripZero(rawOrderNum) === stripZero(queryDigits))) {
          score = Math.max(score, 9000000);
        } else if (orderNumDigits.endsWith(queryDigits) || orderNumDigits.startsWith(queryDigits)) {
          score = Math.max(score, 4000000);
        }
      }

      if (
        formattedIdNorm.startsWith(qNormalized) ||
        displayOrderId.startsWith(qNormalized) ||
        (rawOrderNum && rawOrderNum.startsWith(qNormalized)) ||
        (rawId && rawId.startsWith(qNormalized))
      ) {
        score = Math.max(score, 5000000);
      } else if (
        formattedIdNorm.includes(qNormalized) ||
        displayOrderId.includes(qNormalized) ||
        (rawId && rawId.includes(qNormalized))
      ) {
        score = Math.max(score, 2000000);
      }

      // ── 2. AWB / Tracking Matching ──
      if (awbNo) {
        if (awbNo === qNormalized) {
          score = Math.max(score, 8000000);
        } else if (awbNo.startsWith(qNormalized)) {
          score = Math.max(score, 3000000);
        } else if (awbNo.includes(qNormalized)) {
          score = Math.max(score, 1000000);
        }
      }

      // ── 3. Customer / User Name Matching (Exact, Prefix, Substring) ──
      const nameCandidates = [
        addr.fullName,
        addr.firstName && addr.lastName ? `${addr.firstName} ${addr.lastName}` : null,
        addr.firstName,
        addr.lastName,
        user.username,
        user.name,
        o.customerName,
      ].filter(Boolean);

      for (const name of nameCandidates) {
        const nLower = String(name).toLowerCase().trim();
        if (nLower === q) {
          score = Math.max(score, 3500000);
          break;
        } else if (nLower.startsWith(q)) {
          score = Math.max(score, 2500000);
        } else if (nLower.includes(q)) {
          score = Math.max(score, 1500000);
        }
      }

      // ── 4. Customer Phone Number Matching ──
      const phoneCandidates = [
        addr.phoneNumber,
        addr.phone,
        user.phoneNumber,
        user.phone,
        o.contactNumber,
        o.phoneNumber,
      ].filter(Boolean);

      for (const ph of phoneCandidates) {
        const pStr = String(ph).trim();
        const pDigits = pStr.replace(/\D/g, '');

        if (!hasLetters && queryDigits) {
          if (pDigits === queryDigits || (queryDigits.length >= 10 && pDigits.endsWith(queryDigits.slice(-10)))) {
            score = Math.max(score, 4000000);
            break;
          } else if (queryDigits.length >= 3 && (pDigits.startsWith(queryDigits) || (queryDigits.startsWith('91') && pDigits.startsWith(queryDigits.slice(2))))) {
            score = Math.max(score, 2000000);
          } else if (queryDigits.length >= 4 && pDigits.includes(queryDigits)) {
            score = Math.max(score, 1200000);
          }
        } else if (pStr.toLowerCase().includes(q)) {
          score = Math.max(score, 500000);
        }
      }

      // ── 5. Product Name / Color Matching ──
      if (Array.isArray(o.items)) {
        for (const it of o.items) {
          const prodName = String(it.product?.productName || it.name || '').toLowerCase();
          const colorName = String(it.color || '').toLowerCase();
          if (prodName === q || colorName === q) {
            score = Math.max(score, 900000);
          } else if (prodName.includes(q) || colorName.includes(q)) {
            score = Math.max(score, 600000);
          }
        }
      }

      // ── 6. Destination City / State Matching ──
      const cityState = [addr.city, addr.state, addr.zipCode].filter(Boolean).join(' ').toLowerCase();
      if (cityState.includes(q)) {
        score = Math.max(score, 400000);
      }

      if (score > 0) {
        scored.push({ order: o, score });
      }
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.order.createdAt || 0).getTime() - new Date(a.order.createdAt || 0).getTime();
    });

    return scored.map(item => item.order);
  }, [orders, activeTab, fulfillmentFilter, searchQuery, startDate, endDate]);

  // ── Sales Summary for the currently visible / filtered orders ───────────
  const ordersSummary = useMemo(() => {
    let totalSales = 0;
    let deliveredCount = 0;
    let pendingCount = 0;
    let codCount = 0;
    let prepaidCount = 0;

    filteredOrders.forEach((o: any) => {
      const amt = Number(o.totalAmount) || 0;
      const s = String(o.status || '').toLowerCase().trim();
      const isCod = String(o.paymentMethod || '').toLowerCase().trim() === 'cod';

      if (s !== 'cancelled') {
        totalSales += amt;
      }
      if (s === 'delivered') deliveredCount++;
      else if (s !== 'cancelled') pendingCount++;

      if (isCod) codCount++;
      else prepaidCount++;
    });

    const aov = filteredOrders.length > 0 ? Math.round(totalSales / filteredOrders.length) : 0;

    return {
      totalSales,
      ordersCount: filteredOrders.length,
      aov,
      deliveredCount,
      pendingCount,
      codCount,
      prepaidCount,
    };
  }, [filteredOrders]);

  const [showSalesOverview, setShowSalesOverview] = useState(true);

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
      return isInsideTamilNadu(o.shippingAddress?.state);
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
      Alert.alert('Notice', 'No unbooked Tamil Nadu / Puducherry orders selected.');
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
    const isCOD = String(item.paymentMethod || '').toLowerCase().trim() === 'cod';
    const statusLower = String(item.status || '').toLowerCase().trim();
    const isFulfilled = statusLower === 'shipped' || statusLower === 'delivered';
    const cfg = STATUS_CONFIG[statusLower as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const addr = item.shippingAddress || {};
    const isSelected = selectedOrders.includes(item.id);

    const orderItems = Array.isArray(item.items) ? item.items : [];
    const totalItemsCount = orderItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0);
    const firstItem = orderItems[0];
    const firstImg = getItemImage(firstItem);

    const customerName = capitalizeName(addr.fullName || item.user?.username || 'Guest Customer');
    const customerPhone = addr.phoneNumber || item.user?.phoneNumber || '';
    const destinationCity = [addr.city, addr.state].filter(Boolean).join(', ') || addr.addressLine1 || '';
    const zipCode = addr.zipCode ? ` - ${addr.zipCode}` : '';

    return (
      <TouchableOpacity 
        style={[styles.card, isSelected && styles.cardSelected]}
        onPress={() => navigateToDetail(item)}
        activeOpacity={0.8}
      >
        {/* ── Top Header: Checkbox, Order ID, Date & Status Badge ── */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.checkboxContainer} 
              onPress={() => toggleSelection(item.id)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                {isSelected && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
              </View>
            </TouchableOpacity>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Typography variant="h3" color={colors.primary} weight="bold" style={styles.orderNumberText}>
                  {formatOrderId(item.orderNumber || item.id)}
                </Typography>
                {orderItems.length > 1 && (
                  <View style={styles.itemCountBadge}>
                    <Typography variant="caption" weight="bold" color="#475569" style={{ fontSize: 11 }}>
                      {totalItemsCount} items
                    </Typography>
                  </View>
                )}
              </View>
              <Typography variant="caption" color={colors.textSecondary} style={styles.orderDateText}>
                {formatOrderDateTime(item.createdAt)}
              </Typography>
            </View>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '35' }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
            <Typography variant="caption" weight="bold" style={{ color: cfg.color, fontSize: 12 }}>
              {cfg.label}
            </Typography>
          </View>
        </View>

        {/* ── Product Showcase Section ── */}
        <View style={styles.productShowcase}>
          <View style={styles.productMainRow}>
            <View style={styles.productThumbContainer}>
              {firstImg ? (
                <Image source={{ uri: firstImg }} style={styles.productThumb} resizeMode="cover" />
              ) : (
                <View style={styles.productThumbPlaceholder}>
                  <MaterialCommunityIcons name="package-variant" size={26} color="#94a3b8" />
                </View>
              )}
            </View>

            <View style={styles.productDetailsCol}>
              <Typography variant="body" weight="bold" color="#0f172a" numberOfLines={2} style={styles.productTitle}>
                {firstItem?.product?.productName || firstItem?.name || (orderItems.length > 0 ? 'Ordered Item' : 'No items listed')}
              </Typography>

              <View style={styles.variantChipsRow}>
                {firstItem?.color ? (
                  <View style={styles.variantChip}>
                    <View style={styles.variantDot} />
                    <Typography variant="caption" weight="bold" color="#334155" style={{ fontSize: 11 }}>
                      {firstItem.color}
                    </Typography>
                  </View>
                ) : null}

                {firstItem?.size ? (
                  <View style={styles.variantChip}>
                    <Typography variant="caption" weight="semibold" color="#475569" style={{ fontSize: 11 }}>
                      Size: {firstItem.size}
                    </Typography>
                  </View>
                ) : null}

                <View style={[styles.variantChip, styles.qtyChip]}>
                  <Typography variant="caption" weight="extrabold" color="#0f172a" style={{ fontSize: 11 }}>
                    Qty: {firstItem?.quantity || 1}
                  </Typography>
                </View>
              </View>

              {firstItem?.price ? (
                <Typography variant="caption" color="#64748b" style={{ marginTop: 4, fontSize: 12 }}>
                  ₹{Number(firstItem.price).toLocaleString('en-IN')} {Number(firstItem?.quantity) > 1 ? 'each' : ''}
                </Typography>
              ) : null}
            </View>
          </View>

          {/* Multiple items avatar row */}
          {orderItems.length > 1 && (
            <View style={styles.extraItemsRow}>
              <View style={styles.thumbStack}>
                {orderItems.slice(1, 4).map((extraIt: any, idx: number) => {
                  const extraImg = getItemImage(extraIt);
                  return (
                    <View key={idx} style={[styles.stackedThumbWrapper, { marginLeft: idx > 0 ? -10 : 0 }]}>
                      {extraImg ? (
                        <Image source={{ uri: extraImg }} style={styles.stackedThumb} resizeMode="cover" />
                      ) : (
                        <View style={styles.stackedThumbPlaceholder}>
                          <MaterialCommunityIcons name="package-variant" size={13} color="#94a3b8" />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
              <Typography variant="caption" weight="bold" color="#475569" style={{ fontSize: 12, marginLeft: 8 }}>
                +{orderItems.length - 1} other item{orderItems.length - 1 > 1 ? 's' : ''} ({totalItemsCount} total pcs)
              </Typography>
            </View>
          )}
        </View>

        {/* ── Customer & Shipping Address Info ── */}
        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="account-outline" size={15} color="#64748b" style={styles.metaIcon} />
            <Typography variant="body" weight="bold" color="#1e293b" numberOfLines={1} style={styles.customerName}>
              {customerName}
            </Typography>
            {customerPhone ? (
              <View style={styles.phoneBadge}>
                <MaterialCommunityIcons name="phone-outline" size={12} color="#64748b" style={{ marginRight: 3 }} />
                <Typography variant="caption" color="#64748b" style={{ fontSize: 11 }}>
                  {customerPhone}
                </Typography>
              </View>
            ) : null}
          </View>

          {destinationCity ? (
            <View style={[styles.metaRow, { marginTop: 4 }]}>
              <MaterialCommunityIcons name="map-marker-outline" size={15} color="#64748b" style={styles.metaIcon} />
              <Typography variant="caption" color="#475569" numberOfLines={1} style={styles.destinationText}>
                {destinationCity}{zipCode}
              </Typography>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* ── Footer: Total Amount, Badges & Chevron ── */}
        <View style={styles.cardFooter}>
          <View>
            <Typography variant="caption" color="#64748b" weight="bold" style={styles.totalLabel}>
              TOTAL AMOUNT
            </Typography>
            <Typography variant="body" color="#0f172a" weight="extrabold" style={styles.totalAmount}>
              ₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}
            </Typography>
          </View>

          <View style={styles.badgesGroup}>
            <View style={[styles.pillBadge, isCOD ? styles.badgeCOD : styles.badgePrepaid]}>
              <Typography variant="caption" weight="extrabold" color={isCOD ? '#b45309' : '#047857'} style={styles.pillText}>
                {isCOD ? 'COD' : 'PREPAID'}
              </Typography>
            </View>

            <View style={[styles.pillBadge, isFulfilled ? styles.badgeFulfilled : styles.badgeUnfulfilled]}>
              <Typography variant="caption" weight="extrabold" color={isFulfilled ? '#047857' : '#854d0e'} style={styles.pillText}>
                {isFulfilled ? 'FULFILLED' : 'UNFULFILLED'}
              </Typography>
            </View>

            <View style={styles.viewDetailBtn}>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#64748b" />
            </View>
          </View>
        </View>

        {/* ── AWB Tracking Banner (if available) ── */}
        {item.awbNo ? (
          <View style={styles.awbBanner}>
            <View style={styles.awbBannerLeft}>
              <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
              <Typography variant="caption" color="#1e40af" weight="extrabold" style={{ fontSize: 12 }}>
                {(item.courierPartner || 'COURIER').toUpperCase()} • AWB: {item.awbNo}
              </Typography>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={16} color="#3b82f6" />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      
      <View style={styles.header}>
        <View>
          <Typography variant="h1" color={colors.primary}>Orders</Typography>
          <Typography variant="caption" color={colors.textSecondary} weight="bold">
            {filteredOrders.length} {filteredOrders.length === orders.length ? 'Total' : `of ${orders.length}`}
          </Typography>
        </View>

        <TouchableOpacity
          style={styles.groupOrdersBtn}
          onPress={() => router.push('/order-groups')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="layers-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Typography variant="caption" weight="extrabold" color="#ffffff" style={{ fontSize: 12 }}>
            Group Orders
          </Typography>
        </TouchableOpacity>
      </View>

      {/* ── Search Bar (Order ID, Customer Name, Phone, Product, AWB) ── */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search ID, name, phone, AWB, product..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleScanPress} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="camera-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Fulfillment Segmented Control ── */}
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

      {/* ── Date Presets Filter Bar ── */}
      <View style={styles.dateFilterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={DATE_PRESETS}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.dateChip, datePreset === item.id && styles.dateChipActive]}
              onPress={() => applyDatePreset(item.id)}
            >
              <MaterialCommunityIcons 
                name={item.id === 'custom' ? 'calendar-range' : 'calendar-outline'} 
                size={13} 
                color={datePreset === item.id ? '#ffffff' : '#64748b'} 
                style={{ marginRight: 4 }}
              />
              <Typography
                variant="caption"
                weight="bold"
                color={datePreset === item.id ? '#ffffff' : '#64748b'}
                style={{ fontSize: 12 }}
              >
                {item.label}
              </Typography>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Active Date Filter Banner (when filter applied) ── */}
      {datePreset !== 'all' && (
        <View style={styles.activeDateBanner}>
          <View style={styles.activeDateLeft}>
            <MaterialCommunityIcons name="calendar-check" size={15} color="#1e40af" style={{ marginRight: 6 }} />
            <Typography variant="caption" weight="bold" color="#1e40af" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
              {datePreset === 'today' ? 'Filter: Today' :
               datePreset === 'yesterday' ? 'Filter: Yesterday' :
               datePreset === 'week' ? 'Filter: Past 7 Days' :
               datePreset === 'thisMonth' ? 'Filter: This Month' :
               `Filter: ${startDate} to ${endDate}`}
            </Typography>
          </View>
          <TouchableOpacity onPress={() => applyDatePreset('all')} style={styles.clearDateBtn}>
            <Typography variant="caption" weight="extrabold" color="#dc2626" style={{ fontSize: 11 }}>
              Clear ✕
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Sales Overview & Analytics Shortcut Card ── */}
      <View style={styles.salesOverviewCard}>
        <View style={styles.salesOverviewHeader}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            onPress={() => setShowSalesOverview(!showSalesOverview)}
            activeOpacity={0.7}
          >
            <View style={styles.salesOverviewIconCircle}>
              <MaterialCommunityIcons name="finance" size={16} color="#4f46e5" />
            </View>
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Typography variant="caption" weight="extrabold" color="#1e293b" style={{ fontSize: 12 }}>
                {datePreset === 'all' ? 'All-Time Overall Sales' : 'Filtered Period Sales'}
              </Typography>
              <Typography variant="caption" color="#64748b" style={{ fontSize: 11 }}>
                {ordersSummary.ordersCount} orders • ₹{ordersSummary.totalSales.toLocaleString('en-IN')} total
              </Typography>
            </View>
            <MaterialCommunityIcons 
              name={showSalesOverview ? "chevron-up" : "chevron-down"} 
              size={18} 
              color="#64748b" 
              style={{ marginLeft: 6, marginRight: 8 }} 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.openGraphShortcutBtn}
            onPress={() => router.push('/live-view')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="chart-bell-curve" size={13} color="#ffffff" style={{ marginRight: 4 }} />
            <Typography variant="caption" weight="extrabold" color="#ffffff" style={{ fontSize: 11 }}>
              Live Graph ↗
            </Typography>
          </TouchableOpacity>
        </View>

        {showSalesOverview && (
          <View style={styles.salesOverviewStatsRow}>
            <View style={styles.salesMiniStatCol}>
              <Typography variant="caption" color="#64748b" style={{ fontSize: 10 }}>TOTAL SALES</Typography>
              <Typography variant="body" weight="extrabold" color="#0f172a" style={{ fontSize: 14, marginTop: 2 }}>
                ₹{ordersSummary.totalSales.toLocaleString('en-IN')}
              </Typography>
            </View>
            <View style={styles.salesMiniStatDivider} />
            <View style={styles.salesMiniStatCol}>
              <Typography variant="caption" color="#64748b" style={{ fontSize: 10 }}>AVG ORDER (AOV)</Typography>
              <Typography variant="body" weight="extrabold" color="#2563eb" style={{ fontSize: 14, marginTop: 2 }}>
                ₹{ordersSummary.aov.toLocaleString('en-IN')}
              </Typography>
            </View>
            <View style={styles.salesMiniStatDivider} />
            <View style={styles.salesMiniStatCol}>
              <Typography variant="caption" color="#64748b" style={{ fontSize: 10 }}>COD / PREPAID</Typography>
              <Typography variant="body" weight="extrabold" color="#059669" style={{ fontSize: 14, marginTop: 2 }}>
                {ordersSummary.codCount} / {ordersSummary.prepaidCount}
              </Typography>
            </View>
          </View>
        )}
      </View>

      {/* ── Status Tabs with Live Counts (matching web admin) ── */}
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
                {item} ({tabCounts[item] ?? 0})
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

      {/* Camera Scanner Modal */}
      <Modal visible={isScanning} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h2" color="#fff">Scan Barcode</Typography>
              <TouchableOpacity onPress={() => setIsScanning(false)} style={{ padding: 8 }}>
                <MaterialCommunityIcons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, overflow: 'hidden', borderRadius: 24, margin: 16 }}>
              {isScanning && (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e'],
                  }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
              )}
            </View>
            <Typography variant="body" color="#ccc" style={{ textAlign: 'center', marginBottom: 32 }}>
              Position the barcode within the frame
            </Typography>
          </SafeAreaView>
        </View>
      </Modal>

      {/* ── Custom Date Range Modal ── */}
      <Modal visible={customModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-range" size={22} color={colors.primary} style={{ marginRight: 8 }} />
                <Typography variant="h3" color={colors.text} weight="bold">Select Date Range</Typography>
              </View>
              <TouchableOpacity onPress={() => setCustomModalVisible(false)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 16 }}>
              Enter start and end date (YYYY-MM-DD) to filter orders
            </Typography>

            <View style={styles.dateInputGroup}>
              <Typography variant="caption" weight="bold" color={colors.text} style={styles.dateInputLabel}>
                START DATE
              </Typography>
              <View style={styles.dateInputRow}>
                <TextInput
                  style={styles.dateInputField}
                  value={tempStartDate}
                  onChangeText={setTempStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => setTempStartDate(formatDateVal(new Date()))}
                >
                  <Typography variant="caption" weight="bold" color={colors.primary}>Today</Typography>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.dateInputGroup, { marginTop: 12 }]}>
              <Typography variant="caption" weight="bold" color={colors.text} style={styles.dateInputLabel}>
                END DATE
              </Typography>
              <View style={styles.dateInputRow}>
                <TextInput
                  style={styles.dateInputField}
                  value={tempEndDate}
                  onChangeText={setTempEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                />
                <TouchableOpacity
                  style={styles.quickDateBtn}
                  onPress={() => setTempEndDate(formatDateVal(new Date()))}
                >
                  <Typography variant="caption" weight="bold" color={colors.primary}>Today</Typography>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  applyDatePreset('all');
                  setCustomModalVisible(false);
                }}
              >
                <Typography variant="caption" weight="bold" color="#64748b">Clear Filter</Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={handleApplyCustomDate}
              >
                <Typography variant="caption" weight="bold" color="#ffffff">Apply Range</Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    alignItems: 'center',
  },
  groupOrdersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
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
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fff5f5',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderNumberText: {
    fontSize: 17,
    letterSpacing: 0.2,
  },
  itemCountBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  orderDateText: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  productShowcase: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#edf2f7',
    marginBottom: 12,
  },
  productMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productThumbContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productThumb: {
    width: '100%',
    height: '100%',
  },
  productThumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  productDetailsCol: {
    flex: 1,
    marginLeft: 12,
  },
  productTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  variantChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 5,
    alignItems: 'center',
  },
  variantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  variantDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#475569',
    marginRight: 5,
  },
  qtyChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  extraItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  thumbStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedThumbWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#ffffff',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  stackedThumb: {
    width: '100%',
    height: '100%',
  },
  stackedThumbPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
  },
  metaSection: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    marginRight: 6,
  },
  customerName: {
    fontSize: 13,
    flexShrink: 1,
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  destinationText: {
    fontSize: 12,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  totalAmount: {
    fontSize: 18,
    marginTop: 1,
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  badgeCOD: {
    backgroundColor: '#fef3c7',
  },
  badgePrepaid: {
    backgroundColor: '#d1fae5',
  },
  badgeFulfilled: {
    backgroundColor: '#dcfce7',
  },
  badgeUnfulfilled: {
    backgroundColor: '#fef9c3',
  },
  pillText: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
  viewDetailBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginLeft: 2,
  },
  awbBanner: {
    marginTop: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  awbBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dateFilterContainer: {
    marginBottom: 12,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  activeDateBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeDateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  clearDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateInputGroup: {
    marginBottom: 8,
  },
  dateInputLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: 6,
    color: '#475569',
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInputField: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  quickDateBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fee2e2',
    borderRadius: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  modalApplyBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
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
  salesOverviewCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  salesOverviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  salesOverviewIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openGraphShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  salesOverviewStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  salesMiniStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  salesMiniStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#e2e8f0',
  },
});

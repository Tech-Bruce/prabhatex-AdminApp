import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Image,
  Dimensions,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../../src/api/api';
import { colors } from '../../src/theme/colors';

// ── Helpers & Formatting ──────────────────────────────────────────────────────

const formatOrderId = (order: any) => {
  if (!order) return 'PT0100';
  if (order.displayOrderId) return order.displayOrderId;
  if (order.orderNumber) {
    return 'PT' + String(Number(order.orderNumber) + 100).padStart(4, '0');
  }
  const id = String(order.id || '');
  if (id.includes('-')) return 'PT' + id.slice(-4).toUpperCase();
  const num = parseInt(id, 10);
  if (!isNaN(num)) return 'PT' + (num + 100).toString().padStart(4, '0');
  return id ? 'PT' + id : 'PT0100';
};

const formatCurrency = (val: number | string) => {
  return '₹' + Number(val || 0).toLocaleString('en-IN');
};

const formatDateTime = (dateStr: any) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDateVal = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getProductImage = (product: any) => {
  if (!product) return null;
  let imgs = product.productImages;
  if (typeof imgs === 'string') {
    try {
      imgs = JSON.parse(imgs);
    } catch {
      imgs = [imgs];
    }
  }
  if (Array.isArray(imgs) && imgs.length > 0 && imgs[0]) {
    return imgs[0];
  }
  return null;
};

const getItemImage = (item: any, product: any) => {
  if (!item && !product) return null;
  if (item?.image) return item.image;
  const prod = product || item?.product;
  if (prod) {
    if (item?.color && Array.isArray(prod.colors)) {
      const targetColor = String(item.color).trim().toLowerCase();
      const matched = prod.colors.find((c: any) => {
        const name = typeof c === 'string' ? c : (c.name || c.color);
        return name && String(name).trim().toLowerCase() === targetColor;
      });
      if (matched && Array.isArray(matched.images) && matched.images.length > 0 && matched.images[0]) {
        return matched.images[0];
      }
    }
    return getProductImage(prod);
  }
  return null;
};

const isOrderMovedToFulfillment = (order: any) => {
  if (!order) return false;
  const status = String(order.status || '').toLowerCase().trim();
  if (status === 'shipped' || status === 'delivered') return true;
  if (order.awbNo && String(order.awbNo).trim()) return true;
  if (order.courierMeta?.externalLabelGenerated) return true;
  return false;
};

const isOrderCancelled = (order: any) => {
  if (!order) return false;
  return String(order.status || '').toLowerCase().trim() === 'cancelled';
};

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  pending: { color: '#f59e0b', label: 'Pending', icon: 'clock-outline' },
  paid: { color: '#f59e0b', label: 'Paid', icon: 'credit-card-check-outline' },
  processing: { color: '#3b82f6', label: 'Processing', icon: 'cog-outline' },
  shipped: { color: '#8b5cf6', label: 'Shipped', icon: 'truck-delivery-outline' },
  delivered: { color: '#10b981', label: 'Delivered', icon: 'check-circle-outline' },
  cancelled: { color: '#ef4444', label: 'Cancelled', icon: 'close-circle-outline' },
};

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'Past 7 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
];

export default function OrderGroupsScreen() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filters
  const [scopeFilter, setScopeFilter] = useState<'multiple' | 'all' | 'single'>('multiple');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<'unfulfilled' | 'all' | 'fulfilled'>('unfulfilled');
  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Custom date picker modal
  const [showDateModal, setShowDateModal] = useState(false);
  const [customStartInput, setCustomStartInput] = useState('');
  const [customEndInput, setCustomEndInput] = useState('');

  // Accordion state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandAll, setExpandAll] = useState(false);

  // ── Fetch Orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/all-orders');
      if (res.data?.success) {
        setOrders(res.data.orders || []);
      } else {
        setOrders(res.data || []);
      }
    } catch (err: any) {
      console.error('Fetch order groups error:', err);
      Alert.alert('Error', err?.response?.data?.message || 'Failed to load orders for grouping');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  // ── Date Preset Handler ─────────────────────────────────────────────────────
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
      setCustomStartInput(startDate || formatDateVal(now));
      setCustomEndInput(endDate || formatDateVal(now));
      setShowDateModal(true);
    }
  };

  // ── Filter Non-Cancelled Orders ─────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (isOrderCancelled(order)) return false;

      // Fulfillment filter
      const isFulfilled = isOrderMovedToFulfillment(order);
      if (fulfillmentFilter === 'unfulfilled' && isFulfilled) return false;
      if (fulfillmentFilter === 'fulfilled' && !isFulfilled) return false;

      // Date range filter
      if (startDate || endDate) {
        const orderDate = new Date(order.createdAt);
        if (isNaN(orderDate.getTime())) return false;

        if (startDate) {
          const [sy, sm, sd] = startDate.split('-').map(Number);
          const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
          if (orderDate < start) return false;
        }

        if (endDate) {
          const [ey, em, ed] = endDate.split('-').map(Number);
          const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
          if (orderDate > end) return false;
        }
      }

      return true;
    });
  }, [orders, fulfillmentFilter, startDate, endDate]);

  // ── Group Orders by Saree / Product ─────────────────────────────────────────
  const sareeGroups = useMemo(() => {
    const groupMap = new Map<string, any>();

    filteredOrders.forEach((order) => {
      const items = Array.isArray(order.items) ? order.items : [];

      items.forEach((item: any) => {
        const product = item.product || {};
        const productId = item.productId || product.id || 'unknown';
        const sku = product.sku || `SKU-${String(productId).slice(0, 6)}`;
        const sareeName = product.productName || item.name || 'Unlabeled Saree';

        // Unique group key
        const groupKey = productId !== 'unknown' ? String(productId) : (sku || sareeName);

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            groupId: groupKey,
            productId,
            productName: sareeName,
            sku: sku || '—',
            productImages: product.productImages || [],
            colors: product.colors || [],
            unitPrice: Number(item.price || product.price || 0),
            totalQuantity: 0,
            totalRevenue: 0,
            ordersCount: 0,
            customerOrders: [],
            variantBreakdown: {} as Record<string, number>,
            variantImages: {} as Record<string, string>,
            thumbnailImage: getItemImage(item, product),
          });
        }

        const group = groupMap.get(groupKey);
        const qty = Number(item.quantity) || 1;
        const itemPrice = Number(item.price || product.price || 0);
        const itemSubtotal = qty * itemPrice;

        group.totalQuantity += qty;
        group.totalRevenue += itemSubtotal;

        const itemImg = getItemImage(item, product);
        if (itemImg && !group.thumbnailImage) {
          group.thumbnailImage = itemImg;
        }

        const variantLabel = [item.color, item.size].filter(Boolean).join(' / ') || 'Standard';
        group.variantBreakdown[variantLabel] = (group.variantBreakdown[variantLabel] || 0) + qty;
        if (itemImg && !group.variantImages[variantLabel]) {
          group.variantImages[variantLabel] = itemImg;
        }

        // Customer details
        const addr = order.shippingAddress || {};
        const customerName = addr.fullName || order.user?.username || order.user?.name || 'Customer';
        const customerPhone = addr.phoneNumber || order.user?.phoneNumber || order.phoneNumber || '—';
        const cityState = [addr.city, addr.state].filter(Boolean).join(', ') || '—';
        const fullAddress = [
          addr.addressLine1,
          addr.addressLine2,
          addr.city,
          addr.state,
          addr.zipCode,
        ].filter(Boolean).join(', ');

        group.customerOrders.push({
          orderRecordId: order.id,
          displayOrderId: formatOrderId(order),
          rawOrder: order,
          orderDate: order.createdAt,
          status: order.status || 'pending',
          isFulfilled: isOrderMovedToFulfillment(order),
          paymentMethod: order.paymentMethod || 'COD',
          awbNo: order.awbNo || null,
          courierPartner: order.courierPartner || null,
          itemQuantity: qty,
          itemPrice,
          itemSubtotal,
          color: item.color || null,
          size: item.size || null,
          image: itemImg,
          customer: {
            name: customerName,
            phone: customerPhone,
            cityState,
            fullAddress,
            zipCode: addr.zipCode || '',
          },
        });
      });
    });

    const result = Array.from(groupMap.values()).map((grp) => {
      grp.ordersCount = grp.customerOrders.length;
      return grp;
    });

    // Default sort by demand (highest qty first)
    return result.sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [filteredOrders]);

  // ── Filtered & Searched Groups ──────────────────────────────────────────────
  const processedGroups = useMemo(() => {
    let list = sareeGroups;

    // Scope Filter: 'multiple' (2+ orders) | 'all' | 'single' (1 order)
    if (scopeFilter === 'multiple') {
      list = list.filter((g) => g.ordersCount >= 2);
    } else if (scopeFilter === 'single') {
      list = list.filter((g) => g.ordersCount === 1);
    }

    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, '');

      list = list.filter((group) => {
        const matchSaree =
          group.productName.toLowerCase().includes(q) ||
          group.sku.toLowerCase().includes(q);

        if (matchSaree) return true;

        const matchCustomer = group.customerOrders.some((co: any) => {
          const nameMatch = co.customer.name.toLowerCase().includes(q);
          const orderIdMatch = co.displayOrderId.toLowerCase().includes(q);
          const awbMatch = co.awbNo && co.awbNo.toLowerCase().includes(q);
          const cityMatch = co.customer.cityState.toLowerCase().includes(q);

          let phoneMatch = false;
          if (qDigits.length >= 3) {
            const coDigits = String(co.customer.phone || '').replace(/\D/g, '');
            phoneMatch = coDigits.includes(qDigits);
          } else {
            phoneMatch = String(co.customer.phone || '').toLowerCase().includes(q);
          }

          return nameMatch || orderIdMatch || awbMatch || cityMatch || phoneMatch;
        });

        return matchCustomer;
      });
    }

    return list;
  }, [sareeGroups, scopeFilter, searchTerm]);

  // ── KPI Summary Stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSarees = sareeGroups.length;
    const multiOrderSarees = sareeGroups.filter((g) => g.ordersCount >= 2).length;
    const singleOrderSarees = sareeGroups.filter((g) => g.ordersCount === 1).length;
    let totalUnits = 0;
    let totalRevenue = 0;

    processedGroups.forEach((g) => {
      totalUnits += g.totalQuantity;
      totalRevenue += g.totalRevenue;
    });

    return {
      totalSarees,
      multiOrderSarees,
      singleOrderSarees,
      totalUnits,
      totalRevenue,
    };
  }, [sareeGroups, processedGroups]);

  // ── Expand/Collapse ─────────────────────────────────────────────────────────
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const current = prev[groupId] !== undefined ? prev[groupId] : expandAll;
      return { ...prev, [groupId]: !current };
    });
  };

  const toggleExpandAll = () => {
    const nextVal = !expandAll;
    setExpandAll(nextVal);
    const updated: Record<string, boolean> = {};
    processedGroups.forEach((g) => {
      updated[g.groupId] = nextVal;
    });
    setExpandedGroups(updated);
  };

  const isGroupExpanded = (groupId: string) => {
    if (expandedGroups[groupId] !== undefined) {
      return expandedGroups[groupId];
    }
    return expandAll;
  };

  const handleCallCustomer = (phone: string) => {
    if (!phone || phone === '—') return;
    const cleaned = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate call');
    });
  };

  const navigateToOrderDetail = (order: any) => {
    router.push({
      pathname: '/order-detail',
      params: { order: JSON.stringify(order) },
    });
  };

  const handleApplyCustomDates = () => {
    setStartDate(customStartInput);
    setEndDate(customEndInput);
    setShowDateModal(false);
  };

  const handleClearDates = () => {
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setShowDateModal(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Typography variant="h1" color={colors.primary} style={styles.headerTitle}>
              Group Orders
            </Typography>
            <Typography variant="caption" color={colors.textSecondary} weight="bold">
              Aggregated by Saree / Product
            </Typography>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onRefresh}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="refresh" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 160 },
        ]}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* ── KPI Metric Cards ── */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, styles.kpiCardHighlight]}>
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#fef3c7' }]}>
                <MaterialCommunityIcons name="crown" size={18} color="#b45309" />
              </View>
              <Typography variant="caption" color="#b45309" weight="extrabold" style={{ fontSize: 11 }}>
                PRIORITY
              </Typography>
            </View>
            <Typography variant="h2" color="#78350f" weight="extrabold" style={styles.kpiValue}>
              {stats.multiOrderSarees}
            </Typography>
            <Typography variant="caption" color="#92400e" weight="bold">
              Multi-Order Sarees (2+)
            </Typography>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#eff6ff' }]}>
                <MaterialCommunityIcons name="layers-outline" size={18} color="#1d4ed8" />
              </View>
              <Typography variant="caption" color="#64748b" weight="bold" style={{ fontSize: 11 }}>
                CATALOG
              </Typography>
            </View>
            <Typography variant="h2" color="#0f172a" weight="extrabold" style={styles.kpiValue}>
              {stats.totalSarees}
            </Typography>
            <Typography variant="caption" color="#64748b" weight="bold">
              Total Grouped Sarees
            </Typography>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#f3e8ff' }]}>
                <MaterialCommunityIcons name="package-variant-closed" size={18} color="#7e22ce" />
              </View>
            </View>
            <Typography variant="h2" color="#0f172a" weight="extrabold" style={styles.kpiValue}>
              {stats.totalUnits}
            </Typography>
            <Typography variant="caption" color="#64748b" weight="bold">
              Total Units Demanded
            </Typography>
          </View>

          <View style={styles.kpiCard}>
            <View style={styles.kpiTop}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#ecfdf5' }]}>
                <MaterialCommunityIcons name="currency-inr" size={18} color="#047857" />
              </View>
            </View>
            <Typography variant="h2" color="#047857" weight="extrabold" style={styles.kpiValue}>
              {formatCurrency(stats.totalRevenue)}
            </Typography>
            <Typography variant="caption" color="#64748b" weight="bold">
              Matching Value
            </Typography>
          </View>
        </View>

        {/* ── Search Bar ── */}
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search saree, SKU, customer name, phone, order #..."
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Scope Filter Pills (Multiple, All, Single) ── */}
        <View style={styles.sectionHeader}>
          <Typography variant="caption" color="#64748b" weight="extrabold" style={styles.sectionTitle}>
            ORDER SCOPE
          </Typography>
        </View>
        <View style={styles.scopeTabsContainer}>
          <TouchableOpacity
            style={[styles.scopeTab, scopeFilter === 'multiple' && styles.scopeTabActive]}
            onPress={() => setScopeFilter('multiple')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="account-multiple"
              size={16}
              color={scopeFilter === 'multiple' ? '#ffffff' : '#475569'}
              style={{ marginRight: 6 }}
            />
            <Typography
              variant="caption"
              weight="extrabold"
              color={scopeFilter === 'multiple' ? '#ffffff' : '#334155'}
            >
              Multiple ({stats.multiOrderSarees})
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopeTab, scopeFilter === 'all' && styles.scopeTabActive]}
            onPress={() => setScopeFilter('all')}
            activeOpacity={0.8}
          >
            <Typography
              variant="caption"
              weight="extrabold"
              color={scopeFilter === 'all' ? '#ffffff' : '#334155'}
            >
              All Sarees ({stats.totalSarees})
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scopeTab, scopeFilter === 'single' && styles.scopeTabActive]}
            onPress={() => setScopeFilter('single')}
            activeOpacity={0.8}
          >
            <Typography
              variant="caption"
              weight="extrabold"
              color={scopeFilter === 'single' ? '#ffffff' : '#334155'}
            >
              Single ({stats.singleOrderSarees})
            </Typography>
          </TouchableOpacity>
        </View>

        {/* ── Fulfillment Segmented Control ── */}
        <View style={styles.fulfillmentSegment}>
          {[
            { id: 'unfulfilled', label: 'Unfulfilled' },
            { id: 'all', label: 'All Fulfillment' },
            { id: 'fulfilled', label: 'Fulfilled' },
          ].map((tab) => {
            const isActive = fulfillmentFilter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.fulfillmentTab, isActive && styles.fulfillmentTabActive]}
                onPress={() => setFulfillmentFilter(tab.id as any)}
                activeOpacity={0.8}
              >
                <Typography
                  variant="caption"
                  weight={isActive ? 'extrabold' : 'semibold'}
                  color={isActive ? colors.primary : '#64748b'}
                  style={{ fontSize: 12 }}
                >
                  {tab.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Date Presets Scroll Bar ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datePresetsList}>
          {DATE_PRESETS.map((p) => {
            const isActive = datePreset === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.dateChip, isActive && styles.dateChipActive]}
                onPress={() => applyDatePreset(p.id)}
                activeOpacity={0.8}
              >
                {p.id === 'custom' && (
                  <MaterialCommunityIcons
                    name="calendar-range"
                    size={14}
                    color={isActive ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Typography
                  variant="caption"
                  weight={isActive ? 'extrabold' : 'semibold'}
                  color={isActive ? '#ffffff' : '#475569'}
                  style={{ fontSize: 12 }}
                >
                  {p.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Active Date Range Notice (if active) ── */}
        {(startDate || endDate) && (
          <View style={styles.activeDateRangeBanner}>
            <MaterialCommunityIcons name="calendar-clock" size={16} color="#0369a1" style={{ marginRight: 6 }} />
            <Typography variant="caption" color="#0369a1" weight="bold" style={{ flex: 1, fontSize: 12 }}>
              Date Range: {startDate || 'Start'} to {endDate || 'End'}
            </Typography>
            <TouchableOpacity onPress={handleClearDates}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#0369a1" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Action Bar: Count & Expand All Toggle ── */}
        <View style={styles.groupsActionBar}>
          <Typography variant="body" color="#0f172a" weight="extrabold">
            {processedGroups.length} {processedGroups.length === 1 ? 'Saree Group' : 'Saree Groups'}
          </Typography>

          <TouchableOpacity style={styles.expandAllBtn} onPress={toggleExpandAll} activeOpacity={0.7}>
            <MaterialCommunityIcons
              name={expandAll ? 'chevron-up-circle-outline' : 'chevron-down-circle-outline'}
              size={18}
              color={colors.primary}
              style={{ marginRight: 4 }}
            />
            <Typography variant="caption" color={colors.primary} weight="bold">
              {expandAll ? 'Collapse All' : 'Expand All'}
            </Typography>
          </TouchableOpacity>
        </View>

        {/* ── Groups List ── */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Typography variant="caption" color="#64748b" weight="bold" style={{ marginTop: 12 }}>
              Aggregating saree orders...
            </Typography>
          </View>
        ) : processedGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="package-variant" size={44} color="#94a3b8" />
            </View>
            <Typography variant="h3" color="#0f172a" weight="bold" style={{ marginTop: 14 }}>
              No Grouped Sarees Found
            </Typography>
            <Typography variant="body" color="#64748b" style={styles.emptySubtext}>
              {searchTerm
                ? 'No sarees or customers match your search query.'
                : 'No orders match the current scope, fulfillment, or date filter.'}
            </Typography>
            <TouchableOpacity
              style={styles.resetFiltersBtn}
              onPress={() => {
                setSearchTerm('');
                setScopeFilter('all');
                setFulfillmentFilter('all');
                handleClearDates();
              }}
              activeOpacity={0.8}
            >
              <Typography variant="caption" weight="extrabold" color="#ffffff">
                Reset All Filters
              </Typography>
            </TouchableOpacity>
          </View>
        ) : (
          processedGroups.map((group) => {
            const isExpanded = isGroupExpanded(group.groupId);
            const isMulti = group.ordersCount >= 2;

            return (
              <View key={group.groupId} style={[styles.groupCard, isMulti && styles.groupCardMulti]}>
                {/* ── Group Header (Accordion Toggle) ── */}
                <TouchableOpacity
                  style={styles.groupHeaderRow}
                  onPress={() => toggleGroup(group.groupId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.groupThumbWrapper}>
                    {group.thumbnailImage ? (
                      <Image source={{ uri: group.thumbnailImage }} style={styles.groupThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.groupThumbPlaceholder}>
                        <MaterialCommunityIcons name="image-outline" size={24} color="#94a3b8" />
                      </View>
                    )}
                  </View>

                  <View style={styles.groupInfoCol}>
                    <View style={styles.groupTitleRow}>
                      <Typography variant="body" weight="extrabold" color="#0f172a" numberOfLines={2} style={styles.groupNameText}>
                        {group.productName}
                      </Typography>
                    </View>

                    <View style={styles.groupMetaRow}>
                      <View style={styles.skuBadge}>
                        <Typography variant="caption" weight="extrabold" color="#475569" style={{ fontSize: 11 }}>
                          {group.sku}
                        </Typography>
                      </View>

                      {group.unitPrice > 0 && (
                        <Typography variant="caption" weight="bold" color="#0f172a" style={{ fontSize: 12 }}>
                          {formatCurrency(group.unitPrice)}
                        </Typography>
                      )}
                    </View>

                    {/* Quantity & Orders Badge Row */}
                    <View style={styles.groupPillRow}>
                      <View style={[styles.orderCountPill, isMulti ? styles.pillMulti : styles.pillSingle]}>
                        <MaterialCommunityIcons
                          name={isMulti ? 'crown' : 'account-outline'}
                          size={13}
                          color={isMulti ? '#b45309' : '#475569'}
                          style={{ marginRight: 4 }}
                        />
                        <Typography
                          variant="caption"
                          weight="extrabold"
                          color={isMulti ? '#b45309' : '#334155'}
                          style={{ fontSize: 11 }}
                        >
                          {group.ordersCount} {group.ordersCount === 1 ? 'Order' : 'Orders'}
                        </Typography>
                      </View>

                      <View style={styles.totalQtyPill}>
                        <MaterialCommunityIcons name="package-variant-closed" size={13} color="#1e40af" style={{ marginRight: 4 }} />
                        <Typography variant="caption" weight="extrabold" color="#1e40af" style={{ fontSize: 11 }}>
                          {group.totalQuantity} {group.totalQuantity === 1 ? 'Unit' : 'Units'}
                        </Typography>
                      </View>
                    </View>
                  </View>

                  <View style={styles.chevronWrapper}>
                    <MaterialCommunityIcons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color="#64748b"
                    />
                  </View>
                </TouchableOpacity>

                {/* ── Variant Breakdown Row ── */}
                {Object.keys(group.variantBreakdown).length > 0 && (
                  <View style={styles.variantsRow}>
                    <Typography variant="caption" color="#64748b" weight="bold" style={{ marginRight: 6, fontSize: 11, marginBottom: 4 }}>
                      Breakdown:
                    </Typography>
                    <View style={styles.variantsChipsWrap}>
                      {Object.entries(group.variantBreakdown).map(([variant, count]) => (
                        <View key={variant} style={styles.variantBadge}>
                          <Typography variant="caption" weight="bold" color="#334155" style={{ fontSize: 11 }}>
                            {variant}: <Typography variant="caption" weight="extrabold" color={colors.primary}>{count as number}</Typography>
                          </Typography>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* ── Customer Orders Sublist (Expanded) ── */}
                {isExpanded && (
                  <View style={styles.expandedSublist}>
                    <View style={styles.sublistHeader}>
                      <Typography variant="caption" weight="extrabold" color="#475569" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                        CUSTOMER ORDERS ({group.customerOrders.length})
                      </Typography>
                    </View>

                    {group.customerOrders.map((co: any, idx: number) => {
                      const cfg = STATUS_CONFIG[String(co.status).toLowerCase()] || STATUS_CONFIG.pending;
                      const isCOD = String(co.paymentMethod || '').toLowerCase() === 'cod';

                      return (
                        <View key={`${co.orderRecordId}-${idx}`} style={styles.customerOrderCard}>
                          {/* Top Row: Order ID, Status, Fulfillment */}
                          <View style={styles.orderTopRow}>
                            <View style={styles.orderIdBadge}>
                              <Typography variant="caption" weight="extrabold" color={colors.primary} style={{ fontSize: 12 }}>
                                {co.displayOrderId}
                              </Typography>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <View style={[styles.statusMiniBadge, { backgroundColor: cfg.color + '15', borderColor: cfg.color + '35' }]}>
                                <View style={[styles.statusMiniDot, { backgroundColor: cfg.color }]} />
                                <Typography variant="caption" weight="bold" style={{ color: cfg.color, fontSize: 11 }}>
                                  {cfg.label}
                                </Typography>
                              </View>

                              <View style={[styles.fulfillMiniBadge, co.isFulfilled ? styles.fulfillDone : styles.fulfillPending]}>
                                <Typography
                                  variant="caption"
                                  weight="extrabold"
                                  color={co.isFulfilled ? '#047857' : '#854d0e'}
                                  style={{ fontSize: 10 }}
                                >
                                  {co.isFulfilled ? 'FULFILLED' : 'UNFULFILLED'}
                                </Typography>
                              </View>
                            </View>
                          </View>

                          {/* Customer Details Row */}
                          <View style={styles.customerDetailsRow}>
                            <View style={{ flex: 1 }}>
                              <Typography variant="body" weight="extrabold" color="#0f172a" numberOfLines={1}>
                                {co.customer.name}
                              </Typography>
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <MaterialCommunityIcons name="map-marker-outline" size={14} color="#64748b" style={{ marginRight: 2 }} />
                                <Typography variant="caption" color="#64748b" numberOfLines={1} style={{ fontSize: 11 }}>
                                  {co.customer.cityState}
                                </Typography>
                              </View>
                              <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10, marginTop: 2 }}>
                                {formatDateTime(co.orderDate)}
                              </Typography>
                            </View>

                            {/* Phone / Call Button */}
                            {co.customer.phone && co.customer.phone !== '—' && (
                              <TouchableOpacity
                                style={styles.callButton}
                                onPress={() => handleCallCustomer(co.customer.phone)}
                                activeOpacity={0.7}
                              >
                                <MaterialCommunityIcons name="phone" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                                <Typography variant="caption" color="#ffffff" weight="extrabold" style={{ fontSize: 11 }}>
                                  Call
                                </Typography>
                              </TouchableOpacity>
                            )}
                          </View>

                          {/* Order Specs & Payment */}
                          <View style={styles.itemMetaRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              {co.color && (
                                <View style={styles.tagPill}>
                                  <Typography variant="caption" weight="semibold" color="#334155" style={{ fontSize: 11 }}>
                                    Color: {co.color}
                                  </Typography>
                                </View>
                              )}
                              <View style={[styles.tagPill, { backgroundColor: '#f1f5f9' }]}>
                                <Typography variant="caption" weight="extrabold" color="#0f172a" style={{ fontSize: 11 }}>
                                  Qty: {co.itemQuantity}
                                </Typography>
                              </View>
                              <View style={[styles.tagPill, isCOD ? styles.tagCOD : styles.tagPrepaid]}>
                                <Typography
                                  variant="caption"
                                  weight="extrabold"
                                  color={isCOD ? '#b45309' : '#047857'}
                                  style={{ fontSize: 10 }}
                                >
                                  {isCOD ? 'COD' : 'PREPAID'}
                                </Typography>
                              </View>
                            </View>

                            <Typography variant="body" weight="extrabold" color="#0f172a">
                              {formatCurrency(co.itemSubtotal)}
                            </Typography>
                          </View>

                          {/* AWB Banner if present */}
                          {co.awbNo && (
                            <View style={styles.miniAwbBanner}>
                              <MaterialCommunityIcons name="truck-delivery-outline" size={14} color="#1e40af" style={{ marginRight: 4 }} />
                              <Typography variant="caption" color="#1e40af" weight="extrabold" style={{ fontSize: 11 }}>
                                {(co.courierPartner || 'AWB').toUpperCase()}: {co.awbNo}
                              </Typography>
                            </View>
                          )}

                          {/* View Order Detail Button */}
                          <TouchableOpacity
                            style={styles.viewOrderDetailBtn}
                            onPress={() => navigateToOrderDetail(co.rawOrder)}
                            activeOpacity={0.8}
                          >
                            <Typography variant="caption" color={colors.primary} weight="extrabold" style={{ fontSize: 12 }}>
                              Open Order Details
                            </Typography>
                            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
        {/* Extra spacer ensuring the bottom card & actions are never obscured by bottom tab bar */}
        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ── Custom Date Range Modal ── */}
      <Modal visible={showDateModal} transparent animationType="fade" onRequestClose={() => setShowDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h3" color="#0f172a" weight="extrabold">
                Custom Date Range
              </Typography>
              <TouchableOpacity onPress={() => setShowDateModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Typography variant="caption" color="#475569" weight="bold" style={{ marginBottom: 4 }}>
                Start Date (YYYY-MM-DD)
              </Typography>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-10-01"
                placeholderTextColor="#94a3b8"
                value={customStartInput}
                onChangeText={setCustomStartInput}
                autoCapitalize="none"
              />

              <Typography variant="caption" color="#475569" weight="bold" style={{ marginTop: 12, marginBottom: 4 }}>
                End Date (YYYY-MM-DD)
              </Typography>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-10-26"
                placeholderTextColor="#94a3b8"
                value={customEndInput}
                onChangeText={setCustomEndInput}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={handleClearDates} activeOpacity={0.8}>
                <Typography variant="caption" weight="bold" color="#64748b">
                  Clear Dates
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalApplyBtn} onPress={handleApplyCustomDates} activeOpacity={0.8}>
                <Typography variant="caption" weight="extrabold" color="#ffffff">
                  Apply Filter
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Stylesheet ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 180,
  },

  // ── KPI Grid ──
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  kpiCardHighlight: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  kpiTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 22,
    marginBottom: 2,
  },

  // ── Search Box ──
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
    padding: 0,
  },

  // ── Section Title ──
  sectionHeader: {
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // ── Scope Tabs ──
  scopeTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
  },
  scopeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  scopeTabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Fulfillment Segment ──
  fulfillmentSegment: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 3,
    marginBottom: 12,
  },
  fulfillmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 7,
  },
  fulfillmentTabActive: {
    backgroundColor: '#f1f5f9',
  },

  // ── Date Presets ──
  datePresetsList: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  activeDateRangeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 12,
  },

  // ── Action Bar ──
  groupsActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 10,
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },

  // ── Group Card ──
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  groupCardMulti: {
    borderColor: '#fed7aa',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  groupThumbWrapper: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupThumb: {
    width: '100%',
    height: '100%',
  },
  groupThumbPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfoCol: {
    flex: 1,
    marginLeft: 12,
  },
  groupTitleRow: {
    marginBottom: 4,
  },
  groupNameText: {
    fontSize: 14,
    lineHeight: 18,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  skuBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  groupPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillMulti: {
    backgroundColor: '#fef3c7',
  },
  pillSingle: {
    backgroundColor: '#f1f5f9',
  },
  totalQtyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  chevronWrapper: {
    marginLeft: 8,
  },

  // ── Variant Breakdown ──
  variantsRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  variantsChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    marginTop: 2,
  },
  variantBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  // ── Sublist ──
  expandedSublist: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  sublistHeader: {
    marginBottom: 10,
  },
  customerOrderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderIdBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statusMiniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  fulfillMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fulfillDone: {
    backgroundColor: '#d1fae5',
  },
  fulfillPending: {
    backgroundColor: '#fef3c7',
  },
  customerDetailsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    marginTop: 2,
  },
  tagPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagCOD: {
    backgroundColor: '#fef3c7',
  },
  tagPrepaid: {
    backgroundColor: '#ecfdf5',
  },
  miniAwbBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
  },
  viewOrderDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },

  // ── Empty & Loading ──
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySubtext: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
  },
  resetFiltersBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalBody: {
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  modalApplyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
});

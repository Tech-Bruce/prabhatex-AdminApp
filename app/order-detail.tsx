import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Image, PanResponder, Animated, Dimensions, TextInput, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../src/components/Typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../src/api/api';
import { colors } from '../src/theme/colors';
import { orderGalleryStore } from '../src/utils/orderGalleryStore';
import { CameraView, useCameraPermissions } from 'expo-camera';

const formatOrderId = (id: any) => {
  if (!id) return 'PT0100';
  const s = id.toString();
  if (s.includes('-')) return 'PT' + s.slice(-4).toUpperCase();
  const num = parseInt(s, 10);
  if (isNaN(num)) return 'PT' + s;
  return 'PT' + (num + 100).toString().padStart(4, '0');
};

const SCREEN_WIDTH = Dimensions.get('window').width;

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
  const partner = (courierPartner || '').toLowerCase();
  if (partner.includes('dtdc')) return `https://www.dtdc.in/trace.asp?strCnno=${awbNo}`;
  if (partner.includes('professional')) return `https://tpcglobe.com/track-info.aspx?id=${awbNo}`;
  if (partner.includes('india post') || partner.includes('indian post'))
    return `https://www.indiapost.gov.in/vas/pages/trackConsignment.aspx`;
  return 'https://www.stcourier.com/';
};

// ── Status Pill ──
const StatusPill = ({ label, type }: { label: string; type: 'success' | 'warning' | 'info' | 'neutral' }) => {
  const bg = { success: '#ecfdf5', warning: '#fffbeb', info: '#eff6ff', neutral: '#f3f4f6' }[type];
  const fg = { success: '#047857', warning: '#b45309', info: '#1d4ed8', neutral: '#374151' }[type];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.pillDot, { backgroundColor: fg }]} />
      <Typography variant="caption" weight="bold" color={fg} style={{ letterSpacing: 0.3 }}>{label}</Typography>
    </View>
  );
};

export default function OrderDetailScreen() {
  const params = useLocalSearchParams();
  const initialOrder = params.order ? JSON.parse(params.order as string) : null;
  const [order, setOrder] = useState<any>(initialOrder);

  const [trackingHistory, setTrackingHistory] = useState<any[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [awbInput, setAwbInput] = useState('');
  const [courierInput, setCourierInput] = useState('ST Courier');

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
    setAwbInput(data);
    setIsScanning(false);
  };

  useEffect(() => {
    if (!order?.awbNo) return;
    const fetchTracking = async () => {
      try {
        setLoadingTracking(true);
        const res = await api.get(`/track/${encodeURIComponent(order.awbNo)}`);
        if (res.data.success && res.data.tracking) {
          if (res.data.tracking.result) {
            setTrackingHistory(res.data.tracking.result);
          }
          setOrder((prev: any) => ({
            ...prev,
            status: res.data.tracking.status || prev.status,
            shippingStatus: res.data.tracking.shippingStatus ?? prev.shippingStatus,
          }));
        }
      } catch (err) {
        console.log('Failed to fetch tracking', err);
      } finally {
        setLoadingTracking(false);
      }
    };
    fetchTracking();
  }, [order?.awbNo]);

  const currentIndex = orderGalleryStore.orders.findIndex(o => o.id === order?.id);
  const totalOrders = orderGalleryStore.orders.length;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateSlide = (toValue: number, callback?: () => void) => {
    Animated.spring(slideAnim, { toValue, friction: 8, tension: 60, useNativeDriver: true }).start(callback);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_e, gs) => Math.abs(gs.dx) > 30 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderMove: (_e, gs) => slideAnim.setValue(gs.dx),
      onPanResponderRelease: (_e, gs) => {
        const cIdx = currentIndexRef.current;
        const total = orderGalleryStore.orders.length;
        if (gs.dx > 80 && cIdx > 0) {
          animateSlide(SCREEN_WIDTH, () => {
            setTrackingHistory([]); setOrder(orderGalleryStore.orders[cIdx - 1]); setAwbInput('');
            slideAnim.setValue(-SCREEN_WIDTH); animateSlide(0);
          });
        } else if (gs.dx < -80 && cIdx >= 0 && cIdx < total - 1) {
          animateSlide(-SCREEN_WIDTH, () => {
            setTrackingHistory([]); setOrder(orderGalleryStore.orders[cIdx + 1]); setAwbInput('');
            slideAnim.setValue(SCREEN_WIDTH); animateSlide(0);
          });
        } else { animateSlide(0); }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => animateSlide(0),
    })
  ).current;

  const handleUnfulfill = () => {
    Alert.alert('Unfulfill Order', 'This will mark the order as unfulfilled. AWB details will be kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unfulfill', style: 'destructive', onPress: async () => {
        try {
          setLoadingAction(true);
          const res = await api.put('/update-status', { orderId: order.id, unfulfill: true });
          if (res.data.success) {
            setOrder((p: any) => ({ ...p, status: 'processing', shippingStatus: null }));
            setTrackingHistory([]);
          }
        } catch { Alert.alert('Error', 'Failed to unfulfill'); }
        finally { setLoadingAction(false); }
      }}
    ]);
  };

  const handleFulfill = async () => {
    if (!awbInput) return Alert.alert('Required', 'Please enter an AWB number.');
    try {
      setLoadingAction(true);
      const res = await api.put('/update-status', { orderId: order.id, status: 'shipped', awbNo: awbInput, courierPartner: courierInput });
      if (res.data.success) setOrder((p: any) => ({ ...p, status: 'shipped', awbNo: awbInput, courierPartner: courierInput }));
    } catch { Alert.alert('Error', 'Failed to fulfill order'); }
    finally { setLoadingAction(false); }
  };

  // ── Refund State & Handlers ──
  const [refundModalVisible, setRefundModalVisible] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [selectedRefundItems, setSelectedRefundItems] = useState<{ [id: string]: boolean }>({});
  const [refundQuantities, setRefundQuantities] = useState<{ [id: string]: number }>({});
  const [refundAmounts, setRefundAmounts] = useState<{ [id: string]: string }>({});
  const [refundReason, setRefundReason] = useState('Customer Return');
  const [customReason, setCustomReason] = useState('');
  const [restockInventory, setRestockInventory] = useState(true);

  const openRefundModal = () => {
    const initialSelected: { [id: string]: boolean } = {};
    const initialQtys: { [id: string]: number } = {};
    const initialAmts: { [id: string]: string } = {};
    let firstSelectableId: string | null = null;

    (order?.items || []).forEach((item: any) => {
      const isAlreadyRefunded = item.refundStatus === 'refunded';
      if (!isAlreadyRefunded) {
        if (!firstSelectableId) firstSelectableId = item.id;
        initialSelected[item.id] = false;
        initialQtys[item.id] = item.quantity;
        initialAmts[item.id] = String(parseFloat((Number(item.price) * item.quantity).toFixed(2)));
      }
    });

    if (firstSelectableId) {
      initialSelected[firstSelectableId] = true;
    }

    setSelectedRefundItems(initialSelected);
    setRefundQuantities(initialQtys);
    setRefundAmounts(initialAmts);
    setRefundReason('Customer Return');
    setCustomReason('');
    setRestockInventory(true);
    setRefundModalVisible(true);
  };

  const toggleSelectRefundItem = (itemId: string) => {
    setSelectedRefundItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleRefundQtyChange = (itemId: string, delta: number, maxQty: number, unitPrice: number) => {
    const current = refundQuantities[itemId] || 1;
    const next = Math.min(Math.max(1, current + delta), maxQty);
    setRefundQuantities(prev => ({ ...prev, [itemId]: next }));
    setRefundAmounts(prev => ({ ...prev, [itemId]: String(parseFloat((Number(unitPrice) * next).toFixed(2))) }));
  };

  const calculateTotalRefund = () => {
    return Object.keys(selectedRefundItems)
      .filter(id => selectedRefundItems[id])
      .reduce((sum, id) => sum + (parseFloat(refundAmounts[id]) || 0), 0);
  };

  const handleProcessRefund = async () => {
    const selectedItemIds = Object.keys(selectedRefundItems).filter(id => selectedRefundItems[id]);
    if (selectedItemIds.length === 0) {
      Alert.alert('Required', 'Please select at least one item to refund.');
      return;
    }

    const totalRefund = calculateTotalRefund();
    if (totalRefund <= 0) {
      Alert.alert('Invalid Amount', 'Refund amount must be greater than zero.');
      return;
    }

    if (!order?.cashfreeOrderId) {
      Alert.alert('Online Payment Required', 'Only online prepaid orders with a valid Cashfree transaction can be refunded.');
      return;
    }

    Alert.alert(
      'Confirm Online Refund',
      `Process direct online refund of ₹${totalRefund.toLocaleString('en-IN')} for ${selectedItemIds.length} item(s) via Cashfree Payment Gateway?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process Online Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              setRefundLoading(true);
              const itemsPayload = selectedItemIds.map(id => ({
                orderItemId: id,
                quantity: refundQuantities[id] || 1,
                refundAmount: parseFloat(refundAmounts[id]) || undefined,
                reason: customReason ? `${refundReason}: ${customReason}` : refundReason,
              }));

              const res = await api.post(`/orders/${order.id}/refund`, {
                items: itemsPayload,
                reason: customReason ? `${refundReason}: ${customReason}` : refundReason,
                refundMethod: 'cashfree',
                restockInventory,
              });

              if (res.data.success && res.data.order) {
                setOrder(res.data.order);
                const idx = orderGalleryStore.orders.findIndex(o => o.id === order.id);
                if (idx !== -1) {
                  orderGalleryStore.orders[idx] = res.data.order;
                }
                setRefundModalVisible(false);
                Alert.alert('Success', `Online refund of ₹${totalRefund.toLocaleString('en-IN')} processed successfully!`);
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to process refund');
            } finally {
              setRefundLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="body" color={'#374151'}>Order not found</Typography>
        </View>
      </SafeAreaView>
    );
  }

  const itemsSubtotal = order.items?.reduce((s: number, i: any) => s + parseFloat(i.price) * i.quantity, 0) || 0;
  const totalQty = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0;
  const isPaid = order.status !== 'pending' && order.status !== 'cancelled';
  const isShipped = order.status === 'shipped' || order.status === 'delivered';
  const trackingUrl = order.awbNo ? getCourierTrackingUrl(order.awbNo, order.courierPartner) : null;
  const shippingCost = Math.max(0, order.totalAmount - itemsSubtotal);
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Typography variant="body" weight="bold" color={colors.text} style={{ fontSize: 17 }}>
            {formatOrderId(order.orderNumber || order.id)}
          </Typography>
          {totalOrders > 1 && (
            <Typography variant="caption" color={'#374151'} style={{ marginTop: 2 }}>
              {currentIndex + 1} of {totalOrders}
            </Typography>
          )}
        </View>

        <View style={{ width: 24 }} />
      </View>

      {/* ── Body ── */}
      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }} {...panResponder.panHandlers}>
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* ── Order Summary Bar ── */}
          <View style={styles.summaryBar}>
            <View style={{ flex: 1 }}>
              <Typography variant="caption" color={'#374151'} style={{ marginBottom: 4 }}>Date</Typography>
              <Typography variant="body" color={colors.text} weight="bold">{orderDate}</Typography>
            </View>
            <View style={styles.summaryBarDivider} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Typography variant="caption" color={'#374151'} style={{ marginBottom: 4 }}>Payment</Typography>
              <Typography variant="body" color={colors.text} weight="bold">
                Prepaid
              </Typography>
            </View>
            <View style={styles.summaryBarDivider} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Typography variant="caption" color={'#374151'} style={{ marginBottom: 4 }}>Total</Typography>
              <Typography variant="body" color={colors.primary} weight="bold">
                ₹{Number(order.totalAmount).toLocaleString('en-IN')}
              </Typography>
            </View>
          </View>

          {/* ── Status Pills ── */}
          <View style={styles.pillRow}>
            <StatusPill label={isShipped ? 'Fulfilled' : 'Unfulfilled'} type={isShipped ? 'success' : 'warning'} />
            <StatusPill label={isPaid ? 'Paid' : 'Unpaid'} type={isPaid ? 'info' : 'neutral'} />
            {order.refundStatus === 'refunded' && (
              <StatusPill label="Fully Refunded" type="neutral" />
            )}
            {order.refundStatus === 'partial' && (
              <StatusPill label="Partially Refunded" type="warning" />
            )}
          </View>

          {/* ── Products ── */}
          <View style={styles.section}>
            <Typography variant="body" weight="bold" color={colors.text} style={styles.sectionTitle}>
              Products ({totalQty})
            </Typography>
            {order.items?.map((item: any, i: number) => (
              <View key={i} style={[styles.productRow, i < order.items.length - 1 && styles.productRowBorder]}>
                <View style={styles.productThumb}>
                  {item.product?.productImages?.[0] ? (
                    <Image source={{ uri: item.product.productImages[0] }} style={styles.productThumbImg} />
                  ) : (
                    <MaterialCommunityIcons name="package-variant" size={22} color={'#374151'} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography variant="body" color={colors.text} weight="bold" numberOfLines={2} style={{ fontSize: 14 }}>
                    {item.product?.productName || 'Product'}
                  </Typography>
                  <Typography variant="caption" color={'#374151'} style={{ marginTop: 3 }}>
                    SKU: {item.product?.sku || item.productId?.substring(0, 8) || '—'}
                  </Typography>
                  {(item.size || item.color) && (
                    <Typography variant="caption" color={'#374151'} style={{ marginTop: 2 }}>
                      {item.size ? `Size: ${item.size}  ` : ''}{item.color ? `Color: ${item.color}` : ''}
                    </Typography>
                  )}
                  {item.refundStatus === 'refunded' && (
                    <View style={styles.refundTag}>
                      <MaterialCommunityIcons name="backup-restore" size={11} color="#92400e" />
                      <Typography variant="caption" weight="bold" color="#92400e" style={{ fontSize: 11, marginLeft: 4 }}>
                        Refunded (₹{Number(item.refundAmount || (item.price * item.quantity)).toLocaleString('en-IN')})
                      </Typography>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Typography
                    variant="body"
                    color={item.refundStatus === 'refunded' ? '#9ca3af' : colors.text}
                    weight="bold"
                    style={{ fontSize: 15, textDecorationLine: item.refundStatus === 'refunded' ? 'line-through' : 'none' }}
                  >
                    ₹{Number(item.price).toLocaleString('en-IN')}
                  </Typography>
                  <Typography variant="caption" color={'#374151'} style={{ marginTop: 3 }}>
                    Qty: {item.quantity}
                  </Typography>
                </View>
              </View>
            ))}

            {/* Summary */}
            <View style={styles.summaryBlock}>
              <View style={styles.summaryLine}>
                <Typography variant="body" color={'#374151'}>Subtotal</Typography>
                <Typography variant="body" color={colors.text} weight="bold">₹{itemsSubtotal.toLocaleString('en-IN')}</Typography>
              </View>
              <View style={styles.summaryLine}>
                <Typography variant="body" color={'#374151'}>Shipping</Typography>
                <Typography variant="body" color={colors.text} weight="bold">
                  {shippingCost > 0 ? `₹${shippingCost.toLocaleString('en-IN')}` : 'Free'}
                </Typography>
              </View>
              {Number(order.totalRefunded) > 0 && (
                <View style={styles.summaryLine}>
                  <Typography variant="body" color="#b45309" weight="bold">Total Refunded</Typography>
                  <Typography variant="body" color="#b45309" weight="bold">-₹{Number(order.totalRefunded).toLocaleString('en-IN')}</Typography>
                </View>
              )}
              <View style={[styles.summaryLine, styles.totalLine]}>
                <Typography variant="body" color={colors.text} weight="bold" style={{ fontSize: 16 }}>
                  {Number(order.totalRefunded) > 0 ? 'Net Total' : 'Total'}
                </Typography>
                <Typography variant="body" color={colors.primary} weight="bold" style={{ fontSize: 18 }}>
                  ₹{Number(Math.max(0, (order.totalAmount || 0) - (order.totalRefunded || 0))).toLocaleString('en-IN')}
                </Typography>
              </View>
            </View>
          </View>

          {/* ── Customer ── */}
          <View style={styles.section}>
            <Typography variant="body" weight="bold" color={colors.text} style={styles.sectionTitle}>Customer</Typography>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.avatar}>
                <Typography variant="body" weight="bold" color="#fff" style={{ fontSize: 16 }}>
                  {(order.user?.username || order.shippingAddress?.fullName || 'G').charAt(0).toUpperCase()}
                </Typography>
              </View>
              <View style={{ marginLeft: 12 }}>
                <Typography variant="body" color={colors.text} weight="bold">
                  {capitalizeName(order.user?.username || order.shippingAddress?.fullName)}
                </Typography>
                <Typography variant="caption" color={'#374151'} style={{ marginTop: 2 }}>
                  {order.user?.email || 'Customer'}
                </Typography>
              </View>
            </View>
          </View>

          {/* ── Shipping Address ── */}
          <View style={styles.section}>
            <Typography variant="body" weight="bold" color={colors.text} style={styles.sectionTitle}>Shipping Address</Typography>
            <Typography variant="body" color={colors.text} weight="bold" style={{ marginBottom: 4 }}>
              {capitalizeName(order.shippingAddress?.fullName)}
            </Typography>
            <Typography variant="body" color={'#374151'} style={{ lineHeight: 22 }}>
              {order.shippingAddress?.street}{'\n'}
              {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.zipCode}{'\n'}
              India
            </Typography>
            {(order.shippingAddress?.phoneNumber || order.contactNumber) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <MaterialCommunityIcons name="phone-outline" size={15} color={'#374151'} />
                <Typography variant="body" color={colors.text} style={{ marginLeft: 6 }}>
                  {order.shippingAddress?.phoneNumber || order.contactNumber}
                </Typography>
              </View>
            )}
          </View>

          {/* ── Fulfillment / Tracking ── */}
          {!isShipped ? (
            <View style={styles.section}>
              <Typography variant="body" weight="bold" color={colors.text} style={styles.sectionTitle}>Fulfillment</Typography>

              <Typography variant="caption" color={'#374151'} weight="bold" style={{ marginBottom: 6, letterSpacing: 0.4 }}>
                AWB NUMBER
              </Typography>
              <View style={styles.inputRow}>
                <View style={styles.input}>
                  <TextInput
                    style={styles.inputText}
                    placeholder="Enter AWB number"
                    placeholderTextColor="#9ca3af"
                    value={awbInput}
                    onChangeText={setAwbInput}
                    selectionColor={colors.primary}
                  />
                </View>
                <TouchableOpacity style={styles.scanBtn} onPress={handleScanPress}>
                  <MaterialCommunityIcons name="barcode-scan" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <Typography variant="caption" color={'#374151'} weight="bold" style={{ marginBottom: 6, marginTop: 16, letterSpacing: 0.4 }}>
                COURIER PARTNER
              </Typography>
              <View style={styles.input}>
                <TextInput
                  style={styles.inputText}
                  value={courierInput}
                  onChangeText={setCourierInput}
                  selectionColor={colors.primary}
                />
              </View>

              <TouchableOpacity
                style={[styles.fulfillBtn, !awbInput && { opacity: 0.5 }]}
                onPress={handleFulfill}
                disabled={loadingAction || !awbInput}
                activeOpacity={0.8}
              >
                {loadingAction ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Typography variant="body" color="#fff" weight="bold">Mark as Fulfilled</Typography>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography variant="body" weight="bold" color={colors.text} style={{ fontSize: 15 }}>Tracking</Typography>
                {trackingUrl && (
                  <TouchableOpacity onPress={() => Linking.openURL(trackingUrl)}>
                    <Typography variant="caption" color={colors.primary} weight="bold">View on web</Typography>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.trackingMeta}>
                <View style={{ flex: 1 }}>
                  <Typography variant="caption" color={'#374151'}>AWB</Typography>
                  <Typography variant="body" color={colors.text} weight="bold" style={{ marginTop: 2 }}>{order.awbNo}</Typography>
                </View>
                <View style={styles.trackingMetaDivider} />
                <View style={{ flex: 1 }}>
                  <Typography variant="caption" color={'#374151'}>Courier</Typography>
                  <Typography variant="body" color={colors.text} weight="bold" style={{ marginTop: 2 }}>{order.courierPartner}</Typography>
                </View>
              </View>

              {loadingTracking ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
              ) : trackingHistory.length > 0 ? (
                <View style={{ marginTop: 20 }}>
                  {trackingHistory.map((ev, i) => (
                    <View key={i} style={styles.timelineRow}>
                      <View style={styles.timelineGutter}>
                        <View style={[styles.dot, i === 0 && styles.dotActive]} />
                        {i < trackingHistory.length - 1 && <View style={styles.line} />}
                      </View>
                      <View style={styles.timelineBody}>
                        <Typography variant="body" color={i === 0 ? colors.text : '#374151'} weight={i === 0 ? 'bold' : 'normal'} style={{ fontSize: 14 }}>
                          {formatStatusName(ev.status || ev.Status || ev.Activity)}
                        </Typography>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 }}>
                          {ev.location && (
                            <Typography variant="caption" color={'#374151'} style={{ marginRight: 10 }}>{ev.location}</Typography>
                          )}
                          {ev.date && (
                            <Typography variant="caption" color={'#374151'}>
                              {new Date(ev.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Typography variant="body" color={'#374151'} style={{ textAlign: 'center', marginVertical: 20 }}>
                  No tracking updates yet
                </Typography>
              )}

              <TouchableOpacity style={styles.unfulfillBtn} onPress={handleUnfulfill} disabled={loadingAction}>
                <Typography variant="body" color={colors.error} weight="bold">Undo Fulfillment</Typography>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Bottom Action Card: Refund Button ── */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={styles.refundIconCircle}>
                <MaterialCommunityIcons name="backup-restore" size={18} color="#b45309" />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Typography variant="body" weight="bold" color={colors.text} style={{ fontSize: 14 }}>
                  Order Refund
                </Typography>
                <Typography variant="caption" color={'#374151'} style={{ marginTop: 1 }}>
                  Refund selected products, adjust inventory & process gateway refunds
                </Typography>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.refundMainBtn,
                order.refundStatus === 'refunded' && styles.refundBtnDisabled
              ]}
              onPress={openRefundModal}
              disabled={order.refundStatus === 'refunded'}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="backup-restore"
                size={18}
                color={order.refundStatus === 'refunded' ? '#9ca3af' : '#fff'}
                style={{ marginRight: 6 }}
              />
              <Typography
                variant="body"
                weight="bold"
                color={order.refundStatus === 'refunded' ? '#9ca3af' : '#fff'}
              >
                {order.refundStatus === 'refunded' ? 'Order Fully Refunded' : 'Refund Order / Items'}
              </Typography>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>

      {/* ── Refund Modal (Mobile App) ── */}
      <Modal visible={refundModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.refundModalCard}>
            {/* Header */}
            <View style={styles.refundModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.refundIconCircle}>
                  <MaterialCommunityIcons name="backup-restore" size={18} color="#b45309" />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Typography variant="h3" weight="bold" color={colors.text}>Process Refund</Typography>
                  <Typography variant="caption" color={'#6b7280'}>Order #{formatOrderId(order.orderNumber || order.id)}</Typography>
                </View>
              </View>
              <TouchableOpacity onPress={() => !refundLoading && setRefundModalVisible(false)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.58 }} contentContainerStyle={{ padding: 16 }}>
              <Typography variant="caption" weight="bold" color={'#6b7280'} style={{ marginBottom: 10, letterSpacing: 0.5 }}>
                SELECT PRODUCTS TO REFUND
              </Typography>

              {order.items?.map((item: any) => {
                const isRefunded = item.refundStatus === 'refunded';
                const isSelected = Boolean(selectedRefundItems[item.id]);
                const currentQty = refundQuantities[item.id] || item.quantity;
                const maxQty = item.quantity;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.refundItemCard,
                      isSelected && styles.refundItemCardSelected,
                      isRefunded && { opacity: 0.6, backgroundColor: '#f9fafb' }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={() => !isRefunded && !refundLoading && toggleSelectRefundItem(item.id)}
                        disabled={isRefunded || refundLoading}
                        style={{ marginRight: 10 }}
                      >
                        <MaterialCommunityIcons
                          name={isRefunded ? 'checkbox-marked-circle' : isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                          size={22}
                          color={isRefunded ? '#9ca3af' : isSelected ? colors.primary : '#9ca3af'}
                        />
                      </TouchableOpacity>

                      <View style={styles.productThumbSmall}>
                        {item.product?.productImages?.[0] ? (
                          <Image source={{ uri: item.product.productImages[0] }} style={{ width: '100%', height: '100%', borderRadius: 6 }} />
                        ) : (
                          <MaterialCommunityIcons name="package-variant" size={18} color="#9ca3af" />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Typography variant="body" weight="bold" color={colors.text} numberOfLines={1} style={{ fontSize: 13 }}>
                          {item.product?.productName || 'Product'}
                        </Typography>
                        <Typography variant="caption" color={'#6b7280'} style={{ marginTop: 2 }}>
                          {item.size ? `Size: ${item.size} • ` : ''}Qty: {item.quantity} • ₹{Number(item.price).toLocaleString('en-IN')}
                        </Typography>
                      </View>
                    </View>

                    {isRefunded ? (
                      <View style={{ marginTop: 8, paddingLeft: 32 }}>
                        <Typography variant="caption" weight="bold" color="#b45309">
                          Already Refunded (₹{Number(item.refundAmount || (item.price * item.quantity)).toLocaleString('en-IN')})
                        </Typography>
                      </View>
                    ) : isSelected ? (
                      <View style={styles.refundItemControls}>
                        {maxQty > 1 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Typography variant="caption" color={'#374151'} style={{ marginRight: 8 }}>Qty to refund:</Typography>
                            <TouchableOpacity
                              onPress={() => handleRefundQtyChange(item.id, -1, maxQty, item.price)}
                              style={styles.qtyStepperBtn}
                            >
                              <MaterialCommunityIcons name="minus" size={14} color="#000" />
                            </TouchableOpacity>
                            <Typography variant="body" weight="bold" style={{ marginHorizontal: 10 }}>{currentQty}</Typography>
                            <TouchableOpacity
                              onPress={() => handleRefundQtyChange(item.id, 1, maxQty, item.price)}
                              style={styles.qtyStepperBtn}
                            >
                              <MaterialCommunityIcons name="plus" size={14} color="#000" />
                            </TouchableOpacity>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: maxQty > 1 ? 8 : 0 }}>
                          <Typography variant="caption" color={'#374151'} style={{ marginRight: 8 }}>Refund Amount (₹):</Typography>
                          <TextInput
                            style={styles.refundAmountInput}
                            keyboardType="numeric"
                            value={refundAmounts[item.id] || ''}
                            onChangeText={(val) => setRefundAmounts(prev => ({ ...prev, [item.id]: val }))}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}

              {/* Online Payment Notice & Restock Option */}
              <View style={[styles.section, { padding: 12, marginTop: 8, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <MaterialCommunityIcons name="credit-card-check-outline" size={16} color="#15803d" />
                  <Typography variant="caption" weight="bold" color={'#15803d'} style={{ letterSpacing: 0.5 }}>
                    DIRECT ONLINE REFUND (CASHFREE)
                  </Typography>
                </View>
                <Typography variant="caption" color={'#166534'} style={{ fontSize: 12, lineHeight: 17 }}>
                  Refund amount will be automatically reversed to customer's original online payment source (UPI, Card, or Netbanking).
                </Typography>
                {order.cashfreeOrderId ? (
                  <Typography variant="caption" color={'#15803d'} style={{ fontSize: 11, marginTop: 4 }}>
                    Cashfree Order ID: {order.cashfreeOrderId}
                  </Typography>
                ) : (
                  <Typography variant="caption" color={'#b45309'} style={{ fontSize: 11, marginTop: 4 }}>
                    ⚠️ No online Cashfree transaction found on this order.
                  </Typography>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#dcfce7' }}>
                  <Typography variant="body" color={'#374151'} style={{ fontSize: 13 }}>
                    Restock items back to inventory
                  </Typography>
                  <Switch
                    value={restockInventory}
                    onValueChange={setRestockInventory}
                    trackColor={{ false: '#d1d5db', true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {/* Reason */}
              <View style={{ marginTop: 8 }}>
                <Typography variant="caption" weight="bold" color={'#6b7280'} style={{ marginBottom: 8, letterSpacing: 0.5 }}>
                  REFUND REASON
                </Typography>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {['Customer Return', 'Defective', 'Wrong Item', 'Out of Stock', 'Customer Request'].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRefundReason(r)}
                      style={[styles.reasonChip, refundReason === r && styles.reasonChipActive]}
                    >
                      <Typography variant="caption" weight="bold" color={refundReason === r ? '#fff' : '#374151'}>
                        {r}
                      </Typography>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={[styles.input, { height: 42 }]}
                  placeholder="Additional note (optional)..."
                  placeholderTextColor="#9ca3af"
                  value={customReason}
                  onChangeText={setCustomReason}
                />
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.refundModalFooter}>
              <View>
                <Typography variant="caption" color={'#6b7280'}>Total Refund</Typography>
                <Typography variant="h2" weight="bold" color={colors.primary} style={{ fontSize: 18 }}>
                  ₹{calculateTotalRefund().toLocaleString('en-IN')}
                </Typography>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setRefundModalVisible(false)}
                  disabled={refundLoading}
                  style={styles.cancelBtn}
                >
                  <Typography variant="body" color={'#374151'} weight="bold">Cancel</Typography>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleProcessRefund}
                  disabled={refundLoading || calculateTotalRefund() <= 0 || !order?.cashfreeOrderId}
                  style={[styles.confirmRefundBtn, (refundLoading || calculateTotalRefund() <= 0 || !order?.cashfreeOrderId) && { opacity: 0.5 }]}
                >
                  {refundLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Typography variant="body" color="#fff" weight="bold">Confirm Online Refund</Typography>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Camera Scanner Modal */}
      <Modal visible={isScanning} animationType="slide" transparent={false}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h2" color="#fff">Scan AWB Barcode</Typography>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },

  // ── Body ──
  body: {
    padding: 16,
    paddingBottom: 40,
  },

  // ── Summary Bar ──
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryBarDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },

  // ── Status Pills ──
  pillRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  // ── Section Card ──
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 14,
  },

  // ── Products ──
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  productRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productThumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // ── Summary ──
  summaryBlock: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLine: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 0,
  },

  // ── Customer ──
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Inputs ──
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 15,
    color: colors.text,
  },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fulfillBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },

  // ── Tracking ──
  trackingMeta: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trackingMetaDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  timelineGutter: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginTop: 4,
    zIndex: 2,
  },
  dotActive: {
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#d1fae5',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 2,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  timelineBody: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 16,
  },
  unfulfillBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },

  // ── Refund Styles ──
  refundTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  refundIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundMainBtn: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundBtnDisabled: {
    backgroundColor: '#e5e7eb',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  refundModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  refundModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  refundItemCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refundItemCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fffbfb',
  },
  productThumbSmall: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundItemControls: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  qtyStepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refundAmountInput: {
    flex: 1,
    height: 36,
    backgroundColor: colors.background,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.text,
  },

  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  reasonChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  refundModalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmRefundBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

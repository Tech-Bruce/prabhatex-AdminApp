import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Image, PanResponder, Animated, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../src/components/Typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../src/api/api';
import { colors } from '../src/theme/colors';
import { orderGalleryStore } from '../src/utils/orderGalleryStore';

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
  if (partner.includes('professional')) return 'https://www.tpcglobe.com/';
  if (partner.includes('india post') || partner.includes('indian post'))
    return `https://www.indiapost.gov.in/vas/pages/trackConsignment.aspx`;
  return `https://www.stcourier.com/tracking?awb=${awbNo}`;
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

  useEffect(() => {
    if (!order?.awbNo) return;
    const fetchTracking = async () => {
      try {
        setLoadingTracking(true);
        const res = await api.get(`/track/${encodeURIComponent(order.awbNo)}`);
        if (res.data.success && res.data.tracking?.result) {
          setTrackingHistory(res.data.tracking.result);
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
                {order.paymentMethod?.toLowerCase() === 'cod' ? 'COD' : 'Prepaid'}
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
                    SKU: {item.product?.sku || '—'}
                  </Typography>
                </View>
                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Typography variant="body" color={colors.text} weight="bold" style={{ fontSize: 15 }}>
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
              <View style={[styles.summaryLine, styles.totalLine]}>
                <Typography variant="body" color={colors.text} weight="bold" style={{ fontSize: 16 }}>Total</Typography>
                <Typography variant="body" color={colors.primary} weight="bold" style={{ fontSize: 18 }}>
                  ₹{Number(order.totalAmount).toLocaleString('en-IN')}
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
                <TouchableOpacity style={styles.scanBtn}>
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

        </ScrollView>
      </Animated.View>
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
});

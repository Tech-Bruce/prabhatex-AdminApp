import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Modal,
  Image,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { colors } from '../../src/theme/colors';
import { api } from '../../src/api/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Line as SvgLine,
  Circle as SvgCircle,
  Text as SvgText,
  G,
} from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Formatting Utilities ──────────────────────────────────────────────────────

const formatCurrency = (val: number | string) => {
  const num = Number(val) || 0;
  return '₹' + num.toLocaleString('en-IN');
};

const formatCompactCurrency = (val: number | string) => {
  const num = Number(val) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}k`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatCompactNumber = (val: number | string) => {
  const num = Number(val) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
};

const formatDateVal = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [, m, d] = parts.map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[m - 1]}`;
  }
  if (parts.length === 2) {
    const [y, m] = parts.map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[m - 1]} '${String(y).slice(-2)}`;
  }
  return dateStr;
};

const formatOrderId = (id: any) => {
  if (!id) return 'PT0100';
  const s = String(id);
  if (s.includes('-')) return 'PT' + s.slice(-4).toUpperCase();
  const num = parseInt(s, 10);
  if (!isNaN(num)) return 'PT' + (num + 100).toString().padStart(4, '0');
  return 'PT' + s;
};

// ── SVG Curve Calculations ───────────────────────────────────────────────────

const createSmoothPath = (pts: { x: number; y: number }[]) => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
};

const createAreaPath = (pts: { x: number; y: number }[], baseY: number) => {
  if (pts.length === 0) return '';
  const lineD = createSmoothPath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${lineD} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
};

// ── Date Presets ──────────────────────────────────────────────────────────────
const PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'today', label: 'Today' },
  { id: '7days', label: '7 Days' },
  { id: '30days', label: '30 Days' },
  { id: '90days', label: '90 Days' },
  { id: 'custom', label: 'Custom' },
];

export default function LiveViewScreen() {
  const insets = useSafeAreaInsets();

  // Filter State
  const [activePreset, setActivePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  // Graph View Preferences ('curve' | 'bars') and Metric ('revenue' | 'orders')
  const [graphViewMode, setGraphViewMode] = useState<'curve' | 'bars'>('curve');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [selectedDayItem, setSelectedDayItem] = useState<any>(null);

  // Data States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [presenceData, setPresenceData] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [prevRevenueData, setPrevRevenueData] = useState<any>(null);
  const [ordersAnalytics, setOrdersAnalytics] = useState<any>(null);
  const [productsAnalytics, setProductsAnalytics] = useState<any>(null);
  const [allOrdersList, setAllOrdersList] = useState<any[]>([]);

  // Pulse animation for live beacon
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // ── Date Ranges Computation ─────────────────────────────────────────────────
  const computeDateParams = useCallback(() => {
    const now = new Date();

    if (activePreset === 'all') {
      const endStr = formatDateVal(now);
      return {
        current: { startDate: '2020-01-01', endDate: endStr },
        previous: { startDate: '2015-01-01', endDate: '2019-12-31' },
        presence: { days: 90 },
        rangeLabel: 'Overall Lifetime History',
      };
    }

    if (activePreset === 'custom' && startDate && endDate) {
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - diffDays + 1);

      return {
        current: { startDate, endDate },
        previous: { startDate: formatDateVal(prevStart), endDate: formatDateVal(prevEnd) },
        presence: { startDate, endDate },
        rangeLabel: `${formatDateLabel(startDate)} - ${formatDateLabel(endDate)}`,
      };
    }

    if (activePreset === 'today') {
      const todayStr = formatDateVal(now);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = formatDateVal(yesterday);
      return {
        current: { startDate: todayStr, endDate: todayStr },
        previous: { startDate: yStr, endDate: yStr },
        presence: { days: 1 },
        rangeLabel: 'Today',
      };
    }

    if (activePreset === 'thisMonth') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startStr = formatDateVal(startOfMonth);
      const endStr = formatDateVal(now);
      const daysInCurrentRange = Math.max(1, now.getDate());

      const prevEnd = new Date(startOfMonth);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - daysInCurrentRange + 1);

      return {
        current: { startDate: startStr, endDate: endStr },
        previous: { startDate: formatDateVal(prevStart), endDate: formatDateVal(prevEnd) },
        presence: { days: daysInCurrentRange },
        rangeLabel: `${formatDateLabel(startStr)} - ${formatDateLabel(endStr)}`,
      };
    }

    // Presets by number of days (7, 30, 90)
    const days = activePreset === '7days' ? 7 : activePreset === '90days' ? 90 : 30;
    const start = new Date(now);
    start.setDate(start.getDate() - days + 1);
    const startStr = formatDateVal(start);
    const endStr = formatDateVal(now);

    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);

    return {
      current: { startDate: startStr, endDate: endStr },
      previous: { startDate: formatDateVal(prevStart), endDate: formatDateVal(prevEnd) },
      presence: { days },
      rangeLabel: `Past ${days} Days`,
    };
  }, [activePreset, startDate, endDate]);

  // ── Master Fetch Function ───────────────────────────────────────────────────
  const fetchTelemetry = useCallback(async (isSilent = false) => {
    isSilent ? setRefreshing(true) : setLoading(true);
    try {
      const { current, previous, presence } = computeDateParams();

      const [resPresence, resRevenue, resPrevRevenue, resOrders, resProducts, resAllOrders] =
        await Promise.allSettled([
          api.get('/presence', { params: presence }),
          api.get('/dashboard/analytics/revenue', { params: current }),
          api.get('/dashboard/analytics/revenue', { params: previous }),
          api.get('/dashboard/analytics/orders', { params: current }),
          api.get('/dashboard/analytics/products', { params: current }),
          api.get('/all-orders'),
        ]);

      if (resPresence.status === 'fulfilled') setPresenceData(resPresence.value.data?.data);
      if (resRevenue.status === 'fulfilled') setRevenueData(resRevenue.value.data);
      if (resPrevRevenue.status === 'fulfilled') setPrevRevenueData(resPrevRevenue.value.data);
      if (resOrders.status === 'fulfilled') setOrdersAnalytics(resOrders.value.data);
      if (resProducts.status === 'fulfilled') setProductsAnalytics(resProducts.value.data);
      if (resAllOrders.status === 'fulfilled') {
        const raw = resAllOrders.value.data?.orders || resAllOrders.value.data || [];
        setAllOrdersList(Array.isArray(raw) ? raw : []);
      }
    } catch (err) {
      console.error('Error fetching live command analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [computeDateParams]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Auto-refresh presence every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const { presence } = computeDateParams();
      api.get('/presence', { params: presence })
        .then((res) => {
          if (res.data?.data) setPresenceData(res.data.data);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [computeDateParams]);

  // ── Overall Lifetime Report (All Orders in Store History) ────────────────────
  const overallLifetimeReport = useMemo(() => {
    let lifetimeSales = 0;
    let lifetimeOrders = 0;
    let codCount = 0;
    let prepaidCount = 0;
    let deliveredCount = 0;
    let shippedCount = 0;
    let cancelledCount = 0;
    let inProgressCount = 0;

    const validStatuses = ['paid', 'processing', 'shipped', 'delivered'];

    allOrdersList.forEach((o: any) => {
      const s = String(o.status || '').toLowerCase().trim();
      const amt = Number(o.totalAmount) || 0;
      const isCod = String(o.paymentMethod || '').toLowerCase().trim() === 'cod';

      if (s === 'delivered') deliveredCount++;
      else if (s === 'shipped') shippedCount++;
      else if (s === 'cancelled') cancelledCount++;
      else inProgressCount++;

      if (isCod) codCount++;
      else prepaidCount++;

      if (validStatuses.includes(s) || (s !== 'cancelled' && amt > 0)) {
        lifetimeSales += amt;
        lifetimeOrders++;
      }
    });

    const lifetimeAov = lifetimeOrders > 0 ? Math.round(lifetimeSales / lifetimeOrders) : 0;

    return {
      lifetimeSales,
      lifetimeOrders,
      lifetimeAov,
      codCount,
      prepaidCount,
      deliveredCount,
      shippedCount,
      cancelledCount,
      inProgressCount,
    };
  }, [allOrdersList]);

  // ── Timeframe Filtered KPI Metrics ──────────────────────────────────────────
  const metrics = useMemo(() => {
    const dailyCurrent = revenueData?.daily || [];
    const dailyPrev = prevRevenueData?.daily || [];

    let totalSales = dailyCurrent.reduce((sum: number, r: any) => sum + (Number(r.revenue) || 0), 0);
    let prevSales = dailyPrev.reduce((sum: number, r: any) => sum + (Number(r.revenue) || 0), 0);

    let totalOrders = dailyCurrent.reduce((sum: number, r: any) => sum + (Number(r.orders) || 0), 0);
    let prevOrders = dailyPrev.reduce((sum: number, r: any) => sum + (Number(r.orders) || 0), 0);

    if (activePreset === 'all') {
      totalSales = overallLifetimeReport.lifetimeSales || totalSales;
      totalOrders = overallLifetimeReport.lifetimeOrders || totalOrders;
    }

    const aov = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const prevAov = prevOrders > 0 ? Math.round(prevSales / prevOrders) : 0;

    const sessions = Number(presenceData?.totalSessions || 0);
    const prevSessions = Number(presenceData?.previousTotalSessions || (sessions * 0.95));

    const conversionRate = sessions > 0 ? (totalOrders / sessions) * 100 : 0;
    const prevConversion = prevSessions > 0 ? (prevOrders / prevSessions) * 100 : 0;

    const calcTrend = (curr: number, prev: number) => {
      if (!prev && !curr) return { label: '0.0%', positive: true, diff: 0 };
      if (!prev) return { label: 'New', positive: true, diff: 100 };
      const diff = ((curr - prev) / prev) * 100;
      return {
        label: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
        positive: diff >= 0,
        diff,
      };
    };

    return {
      totalSales,
      salesTrend: calcTrend(totalSales, prevSales),
      totalOrders,
      ordersTrend: calcTrend(totalOrders, prevOrders),
      aov,
      aovTrend: calcTrend(aov, prevAov),
      sessions,
      sessionsTrend: calcTrend(sessions, prevSessions),
      conversionRate,
      conversionTrend: calcTrend(conversionRate, prevConversion),
    };
  }, [revenueData, prevRevenueData, presenceData, activePreset, overallLifetimeReport]);

  // ── Sales Ups & Downs Analysis ──────────────────────────────────────────────
  const salesAnalysis = useMemo(() => {
    // When "all" is active and monthly revenue is available, use monthly to show multi-year ups and downs
    const isAll = activePreset === 'all';
    const sourceList: any[] = (isAll && revenueData?.monthly?.length) ? revenueData.monthly : (revenueData?.daily || []);

    if (sourceList.length === 0) {
      return {
        peakDay: null,
        troughDay: null,
        avgRevenue: 0,
        historySeries: [],
        maxVal: 1,
        upPeriodsCount: 0,
        downPeriodsCount: 0,
      };
    }

    let peak = sourceList[0];
    let trough: any = null;
    let sumRev = 0;
    let upPeriodsCount = 0;
    let downPeriodsCount = 0;

    sourceList.forEach((item) => {
      const rev = Number(item.revenue) || 0;
      sumRev += rev;
      if (rev > (Number(peak.revenue) || 0)) {
        peak = item;
      }
      if (rev > 0) {
        if (!trough || rev < Number(trough.revenue)) {
          trough = item;
        }
      }
    });

    const avgRevenue = Math.round(sumRev / sourceList.length);

    // Calculate period-over-period ups and downs
    const historySeries = sourceList.map((item, idx) => {
      const rev = Number(item.revenue) || 0;
      const orders = Number(item.orders) || 0;
      const label = item.month || item.date || `Day ${idx + 1}`;
      let dayChangePct = 0;
      let isUp = true;

      if (idx > 0) {
        const prevRev = Number(sourceList[idx - 1].revenue) || 0;
        if (prevRev > 0) {
          dayChangePct = ((rev - prevRev) / prevRev) * 100;
          isUp = dayChangePct >= 0;
        } else if (rev > 0) {
          dayChangePct = 100;
          isUp = true;
        }
      }

      if (idx > 0) {
        if (isUp) upPeriodsCount++;
        else downPeriodsCount++;
      }

      return {
        ...item,
        date: label,
        revenue: rev,
        orders,
        dayChangePct,
        isUp,
        isPeak: label === (peak.month || peak.date),
      };
    });

    const maxRevenue = Math.max(...historySeries.map((d) => d.revenue), 1000);
    const maxOrders = Math.max(...historySeries.map((d) => d.orders), 1);

    const peakDay = historySeries.find((d) => d.isPeak) || historySeries[0] || null;
    const troughDay = trough ? (historySeries.find((d) => d.date === (trough.month || trough.date)) || historySeries[0]) : (historySeries[0] || null);

    return {
      peakDay,
      troughDay,
      avgRevenue,
      historySeries,
      maxVal: chartMetric === 'revenue' ? maxRevenue : maxOrders,
      upPeriodsCount,
      downPeriodsCount,
    };
  }, [revenueData, activePreset, chartMetric]);

  const activeDayDisplay = selectedDayItem || salesAnalysis.peakDay || (salesAnalysis.historySeries.length > 0 ? salesAnalysis.historySeries[salesAnalysis.historySeries.length - 1] : null);

  // ── Curve Graph Points Calculation ──────────────────────────────────────────
  const graphDimensions = useMemo(() => {
    const cardPadding = 32;
    const width = SCREEN_WIDTH - cardPadding;
    const height = 180;
    const paddingLeft = 46;
    const paddingRight = 16;
    const paddingTop = 24;
    const paddingBottom = 26;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const baseY = height - paddingBottom;

    const series = salesAnalysis.historySeries;
    const maxVal = salesAnalysis.maxVal || 1;

    const points = series.map((item, idx) => {
      const val = chartMetric === 'revenue' ? item.revenue : item.orders;
      const x = series.length <= 1
        ? paddingLeft + plotWidth / 2
        : paddingLeft + (idx / (series.length - 1)) * plotWidth;
      const y = paddingTop + (1 - val / maxVal) * plotHeight;
      return { x, y, item };
    });

    return {
      width,
      height,
      paddingLeft,
      paddingTop,
      plotWidth,
      plotHeight,
      baseY,
      points,
      linePath: createSmoothPath(points),
      areaPath: createAreaPath(points, baseY),
      maxVal,
    };
  }, [salesAnalysis, chartMetric]);

  // ── Order Payment & Fulfillment Distribution ────────────────────────────────
  const orderDistribution = useMemo(() => {
    const cod = Number(ordersAnalytics?.codCount || overallLifetimeReport.codCount || 0);
    const online = Number(ordersAnalytics?.onlineCount || overallLifetimeReport.prepaidCount || 0);
    const totalPay = cod + online || 1;
    const codPct = Math.round((cod / totalPay) * 100);
    const onlinePct = 100 - codPct;

    const delivered = Number(ordersAnalytics?.deliveredCount || overallLifetimeReport.deliveredCount || 0);
    const shipped = Number(ordersAnalytics?.shippedCount || overallLifetimeReport.shippedCount || 0);
    const pending = Number(ordersAnalytics?.pendingCount || overallLifetimeReport.inProgressCount || 0);
    const cancelled = Number(ordersAnalytics?.cancelledCount || overallLifetimeReport.cancelledCount || 0);
    const totalFulfill = delivered + shipped + pending + cancelled || 1;

    return {
      cod,
      online,
      codPct,
      onlinePct,
      delivered,
      shipped,
      pending,
      cancelled,
      deliveredPct: Math.round((delivered / totalFulfill) * 100),
      shippedPct: Math.round((shipped / totalFulfill) * 100),
      pendingPct: Math.round((pending / totalFulfill) * 100),
      cancelledPct: Math.round((cancelled / totalFulfill) * 100),
    };
  }, [ordersAnalytics, overallLifetimeReport]);

  const liveVisitors = Number(presenceData?.activeVisitors || 0);
  const locations = presenceData?.locations || [];
  const topProducts = (productsAnalytics?.mostOrdered || []).slice(0, 5);

  const applyCustomRange = () => {
    if (!tempStart || !tempEnd) return;
    setStartDate(tempStart);
    setEndDate(tempEnd);
    setActivePreset('custom');
    setCustomModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <View style={styles.badgeRow}>
            <View style={styles.livePulseContainer}>
              <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.solidCircle} />
            </View>
            <Typography variant="caption" weight="extrabold" color="#16a34a" style={styles.badgeText}>
              LIVE TELEMETRY COMMAND
            </Typography>
          </View>
          <Typography variant="h1" color="#0f172a" weight="extrabold" style={styles.titleText}>
            Sales & Live View
          </Typography>
        </View>

        <View style={styles.headerRightCol}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => fetchTelemetry(true)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Presets Filter Ribbon (All Time, This Month, Today, 7D, 30D, 90D, Custom) ── */}
      <View style={styles.presetsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsScroll}>
          {PRESETS.map((p) => {
            const isActive = activePreset === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.presetChip, isActive && styles.presetChipActive]}
                onPress={() => {
                  if (p.id === 'custom') {
                    setTempStart(startDate || formatDateVal(new Date()));
                    setTempEnd(endDate || formatDateVal(new Date()));
                    setCustomModalVisible(true);
                  } else {
                    setActivePreset(p.id);
                  }
                }}
                activeOpacity={0.8}
              >
                {p.id === 'all' && (
                  <MaterialCommunityIcons
                    name="infinity"
                    size={14}
                    color={isActive ? '#ffffff' : '#64748b'}
                    style={{ marginRight: 4 }}
                  />
                )}
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
                  weight={isActive ? 'extrabold' : 'bold'}
                  color={isActive ? '#ffffff' : '#475569'}
                  style={{ fontSize: 12 }}
                >
                  {p.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 140 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchTelemetry(true)} colors={[colors.primary]} />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Typography variant="caption" weight="bold" color="#64748b" style={{ marginTop: 12 }}>
              Aggregating live store intelligence...
            </Typography>
          </View>
        ) : (
          <>
            {/* ── OVERALL LIFETIME SALES REPORT CARD (Permanent High-Level View) ── */}
            <View style={styles.lifetimeReportCard}>
              <View style={styles.lifetimeTopRow}>
                <View style={styles.lifetimeHeaderBadge}>
                  <MaterialCommunityIcons name="shield-star" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Typography variant="caption" color="#ffffff" weight="extrabold" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                    OVERALL STORE LIFETIME PERFORMANCE
                  </Typography>
                </View>
                <Typography variant="caption" color="#fecaca" weight="bold">
                  All-Time Aggregate
                </Typography>
              </View>

              <View style={styles.lifetimeSalesRow}>
                <View>
                  <Typography variant="h1" color="#ffffff" weight="extrabold" style={styles.lifetimeSalesNumber}>
                    {formatCurrency(overallLifetimeReport.lifetimeSales)}
                  </Typography>
                  <Typography variant="caption" color="#fee2e2" weight="bold" style={{ fontSize: 12, marginTop: 2 }}>
                    Total Gross Sales Made Since Inception
                  </Typography>
                </View>

                <View style={styles.lifetimeOrdersBadge}>
                  <Typography variant="caption" color="#991b1b" weight="extrabold" style={{ fontSize: 10 }}>
                    TOTAL ORDERS
                  </Typography>
                  <Typography variant="h2" color="#7f1d1d" weight="extrabold">
                    {overallLifetimeReport.lifetimeOrders.toLocaleString('en-IN')}
                  </Typography>
                </View>
              </View>

              {/* Lifetime Metric Highlights */}
              <View style={styles.lifetimeFooterRow}>
                <View style={styles.lifetimeMetricCol}>
                  <Typography variant="caption" color="#fecaca" style={{ fontSize: 11 }}>
                    Lifetime AOV
                  </Typography>
                  <Typography variant="body" color="#ffffff" weight="extrabold" style={{ marginTop: 2 }}>
                    {formatCurrency(overallLifetimeReport.lifetimeAov)}
                  </Typography>
                </View>

                <View style={styles.lifetimeMetricDivider} />

                <View style={styles.lifetimeMetricCol}>
                  <Typography variant="caption" color="#fecaca" style={{ fontSize: 11 }}>
                    Delivered
                  </Typography>
                  <Typography variant="body" color="#ffffff" weight="extrabold" style={{ marginTop: 2 }}>
                    {overallLifetimeReport.deliveredCount}
                  </Typography>
                </View>

                <View style={styles.lifetimeMetricDivider} />

                <View style={styles.lifetimeMetricCol}>
                  <Typography variant="caption" color="#fecaca" style={{ fontSize: 11 }}>
                    In Progress
                  </Typography>
                  <Typography variant="body" color="#ffffff" weight="extrabold" style={{ marginTop: 2 }}>
                    {overallLifetimeReport.inProgressCount}
                  </Typography>
                </View>

                <View style={styles.lifetimeMetricDivider} />

                <View style={styles.lifetimeMetricCol}>
                  <Typography variant="caption" color="#fecaca" style={{ fontSize: 11 }}>
                    Prepaid / COD
                  </Typography>
                  <Typography variant="body" color="#ffffff" weight="extrabold" style={{ marginTop: 2 }}>
                    {overallLifetimeReport.prepaidCount} / {overallLifetimeReport.codCount}
                  </Typography>
                </View>
              </View>
            </View>

            {/* ── Real-Time Active Shoppers Banner ── */}
            <View style={styles.liveShoppersBanner}>
              <View style={styles.liveShoppersLeft}>
                <View style={styles.livePill}>
                  <View style={styles.greenPulse} />
                  <Typography variant="caption" color="#15803d" weight="extrabold" style={{ fontSize: 11 }}>
                    REAL-TIME STORE TRAFFIC
                  </Typography>
                </View>
                <View style={styles.visitorsCountRow}>
                  <Typography variant="h1" color="#0f172a" weight="extrabold" style={{ fontSize: 32 }}>
                    {liveVisitors}
                  </Typography>
                  <Typography variant="body" color="#475569" weight="bold" style={{ marginLeft: 8 }}>
                    Active Shoppers Now
                  </Typography>
                </View>
                <Typography variant="caption" color="#64748b" style={{ marginTop: 2 }}>
                  Active storefront interactions detected during the last 65 seconds
                </Typography>
              </View>

              <View style={styles.liveShoppersRight}>
                <View style={styles.sessionBox}>
                  <Typography variant="caption" color="#64748b" weight="bold" style={{ fontSize: 10 }}>
                    SESSIONS
                  </Typography>
                  <Typography variant="body" color="#0f172a" weight="extrabold">
                    {formatCompactNumber(metrics.sessions)}
                  </Typography>
                  <View style={[styles.miniTrendPill, { backgroundColor: metrics.sessionsTrend.positive ? '#dcfce7' : '#fee2e2' }]}>
                    <Typography
                      variant="caption"
                      weight="extrabold"
                      color={metrics.sessionsTrend.positive ? '#15803d' : '#b91c1c'}
                      style={{ fontSize: 9 }}
                    >
                      {metrics.sessionsTrend.label}
                    </Typography>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Executive KPI Metric Cards (2x2) for Selected Timeframe ── */}
            <View style={styles.sectionTitleRow}>
              <Typography variant="caption" weight="extrabold" color="#64748b" style={styles.sectionHeaderTitle}>
                {activePreset === 'all' ? 'LIFETIME TELEMETRY BREAKDOWN' : `${activePreset.toUpperCase()} TELEMETRY METRICS`}
              </Typography>
            </View>

            <View style={styles.kpiGrid}>
              {/* Gross Revenue Card */}
              <View style={[styles.kpiCard, styles.kpiHighlight]}>
                <View style={styles.kpiTopRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#fee2e2' }]}>
                    <MaterialCommunityIcons name="currency-inr" size={18} color={colors.primary} />
                  </View>
                  <View style={[styles.trendBadge, { backgroundColor: metrics.salesTrend.positive ? '#dcfce7' : '#fee2e2' }]}>
                    <MaterialCommunityIcons
                      name={metrics.salesTrend.positive ? 'trending-up' : 'trending-down'}
                      size={13}
                      color={metrics.salesTrend.positive ? '#15803d' : '#b91c1c'}
                      style={{ marginRight: 2 }}
                    />
                    <Typography
                      variant="caption"
                      weight="extrabold"
                      color={metrics.salesTrend.positive ? '#15803d' : '#b91c1c'}
                      style={{ fontSize: 11 }}
                    >
                      {metrics.salesTrend.label}
                    </Typography>
                  </View>
                </View>
                <Typography variant="h2" color="#0f172a" weight="extrabold" style={styles.kpiNumber}>
                  {formatCompactCurrency(metrics.totalSales)}
                </Typography>
                <Typography variant="caption" color="#475569" weight="bold">
                  Gross Revenue
                </Typography>
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10, marginTop: 2 }}>
                  Exact: {formatCurrency(metrics.totalSales)}
                </Typography>
              </View>

              {/* Orders Placed Card */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#eff6ff' }]}>
                    <MaterialCommunityIcons name="shopping-outline" size={18} color="#2563eb" />
                  </View>
                  <View style={[styles.trendBadge, { backgroundColor: metrics.ordersTrend.positive ? '#dcfce7' : '#fee2e2' }]}>
                    <MaterialCommunityIcons
                      name={metrics.ordersTrend.positive ? 'trending-up' : 'trending-down'}
                      size={13}
                      color={metrics.ordersTrend.positive ? '#15803d' : '#b91c1c'}
                      style={{ marginRight: 2 }}
                    />
                    <Typography
                      variant="caption"
                      weight="extrabold"
                      color={metrics.ordersTrend.positive ? '#15803d' : '#b91c1c'}
                      style={{ fontSize: 11 }}
                    >
                      {metrics.ordersTrend.label}
                    </Typography>
                  </View>
                </View>
                <Typography variant="h2" color="#0f172a" weight="extrabold" style={styles.kpiNumber}>
                  {metrics.totalOrders.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="#475569" weight="bold">
                  Completed Orders
                </Typography>
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10, marginTop: 2 }}>
                  Processed sales
                </Typography>
              </View>

              {/* Average Order Value (AOV) */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#fef3c7' }]}>
                    <MaterialCommunityIcons name="scale-balance" size={18} color="#b45309" />
                  </View>
                  <View style={[styles.trendBadge, { backgroundColor: metrics.aovTrend.positive ? '#dcfce7' : '#fee2e2' }]}>
                    <Typography
                      variant="caption"
                      weight="extrabold"
                      color={metrics.aovTrend.positive ? '#15803d' : '#b91c1c'}
                      style={{ fontSize: 11 }}
                    >
                      {metrics.aovTrend.label}
                    </Typography>
                  </View>
                </View>
                <Typography variant="h2" color="#0f172a" weight="extrabold" style={styles.kpiNumber}>
                  {formatCurrency(metrics.aov)}
                </Typography>
                <Typography variant="caption" color="#475569" weight="bold">
                  Average Order Value
                </Typography>
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10, marginTop: 2 }}>
                  Mean cart size
                </Typography>
              </View>

              {/* Conversion Rate */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiTopRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#f3e8ff' }]}>
                    <MaterialCommunityIcons name="percent" size={18} color="#7e22ce" />
                  </View>
                  <View style={[styles.trendBadge, { backgroundColor: metrics.conversionTrend.positive ? '#dcfce7' : '#fee2e2' }]}>
                    <Typography
                      variant="caption"
                      weight="extrabold"
                      color={metrics.conversionTrend.positive ? '#15803d' : '#b91c1c'}
                      style={{ fontSize: 11 }}
                    >
                      {metrics.conversionTrend.label}
                    </Typography>
                  </View>
                </View>
                <Typography variant="h2" color="#0f172a" weight="extrabold" style={styles.kpiNumber}>
                  {metrics.conversionRate.toFixed(2)}%
                </Typography>
                <Typography variant="caption" color="#475569" weight="bold">
                  Store Conversion
                </Typography>
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10, marginTop: 2 }}>
                  Shopper-to-order ratio
                </Typography>
              </View>
            </View>

            {/* ── Sales Ups & Downs Intelligence Panel ── */}
            <View style={styles.upsDownsCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={20} color={colors.primary} style={{ marginRight: 6 }} />
                  <Typography variant="body" weight="extrabold" color="#0f172a">
                    Sales Ups & Downs Intelligence
                  </Typography>
                </View>
                <View style={styles.trajectoryChip}>
                  <Typography variant="caption" weight="extrabold" color="#16a34a" style={{ fontSize: 11 }}>
                    {salesAnalysis.upPeriodsCount} Rising • {salesAnalysis.downPeriodsCount} Dips
                  </Typography>
                </View>
              </View>

              <View style={styles.intelligenceGrid}>
                {/* Peak Day Box */}
                <View style={[styles.intelligenceBox, styles.peakBox]}>
                  <View style={styles.intelHeader}>
                    <MaterialCommunityIcons name="crown" size={16} color="#b45309" />
                    <Typography variant="caption" color="#92400e" weight="extrabold" style={{ marginLeft: 4, fontSize: 11 }}>
                      PEAK RECORD
                    </Typography>
                  </View>
                  <Typography variant="h3" weight="extrabold" color="#78350f" style={{ marginTop: 4 }}>
                    {formatCurrency(salesAnalysis.peakDay?.revenue || 0)}
                  </Typography>
                  <Typography variant="caption" weight="bold" color="#92400e" style={{ fontSize: 11, marginTop: 2 }}>
                    {salesAnalysis.peakDay ? formatDateLabel(salesAnalysis.peakDay.month || salesAnalysis.peakDay.date) : '—'} • {salesAnalysis.peakDay?.orders || 0} orders
                  </Typography>
                </View>

                {/* Lowest / Drop Day Box */}
                <View style={[styles.intelligenceBox, styles.troughBox]}>
                  <View style={styles.intelHeader}>
                    <MaterialCommunityIcons name="arrow-collapse-down" size={16} color="#475569" />
                    <Typography variant="caption" color="#475569" weight="extrabold" style={{ marginLeft: 4, fontSize: 11 }}>
                      LOWEST DIP
                    </Typography>
                  </View>
                  <Typography variant="h3" weight="extrabold" color="#334155" style={{ marginTop: 4 }}>
                    {formatCurrency(salesAnalysis.troughDay?.revenue || 0)}
                  </Typography>
                  <Typography variant="caption" weight="bold" color="#64748b" style={{ fontSize: 11, marginTop: 2 }}>
                    {salesAnalysis.troughDay ? formatDateLabel(salesAnalysis.troughDay.month || salesAnalysis.troughDay.date) : '—'} • {salesAnalysis.troughDay?.orders || 0} orders
                  </Typography>
                </View>

                {/* Daily Average Run-Rate */}
                <View style={[styles.intelligenceBox, styles.avgBox]}>
                  <View style={styles.intelHeader}>
                    <MaterialCommunityIcons name="speedometer" size={16} color="#1d4ed8" />
                    <Typography variant="caption" color="#1e40af" weight="extrabold" style={{ marginLeft: 4, fontSize: 11 }}>
                      AVERAGE RUN-RATE
                    </Typography>
                  </View>
                  <Typography variant="h3" weight="extrabold" color="#1e3a8a" style={{ marginTop: 4 }}>
                    {formatCurrency(salesAnalysis.avgRevenue)}
                  </Typography>
                  <Typography variant="caption" weight="bold" color="#1e40af" style={{ fontSize: 11, marginTop: 2 }}>
                    {activePreset === 'all' ? 'Monthly run-rate' : 'Daily sales run-rate'}
                  </Typography>
                </View>
              </View>
            </View>

            {/* ── Interactive Historical Performance Graph (Curve & Bars) ── */}
            <View style={styles.chartSectionCard}>
              <View style={styles.chartHeaderRow}>
                <View>
                  <Typography variant="body" weight="extrabold" color="#0f172a">
                    {chartMetric === 'revenue' ? 'Sales Revenue Graph' : 'Orders Volume Graph'}
                  </Typography>
                  <Typography variant="caption" color="#64748b">
                    Visual ups & downs trajectory curve
                  </Typography>
                </View>

                {/* Graph Controls: Curve vs Bar View & Revenue vs Orders */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {/* Mode Toggle (Curve vs Bars) */}
                  <View style={styles.miniModeToggle}>
                    <TouchableOpacity
                      style={[styles.miniModeBtn, graphViewMode === 'curve' && styles.miniModeBtnActive]}
                      onPress={() => setGraphViewMode('curve')}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name="chart-bell-curve"
                        size={15}
                        color={graphViewMode === 'curve' ? '#ffffff' : '#64748b'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.miniModeBtn, graphViewMode === 'bars' && styles.miniModeBtnActive]}
                      onPress={() => setGraphViewMode('bars')}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name="chart-bar"
                        size={15}
                        color={graphViewMode === 'bars' ? '#ffffff' : '#64748b'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Metric Toggle */}
                  <View style={styles.metricToggleBar}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, chartMetric === 'revenue' && styles.toggleBtnActive]}
                      onPress={() => setChartMetric('revenue')}
                      activeOpacity={0.8}
                    >
                      <Typography
                        variant="caption"
                        weight="extrabold"
                        color={chartMetric === 'revenue' ? '#ffffff' : '#64748b'}
                        style={{ fontSize: 11 }}
                      >
                        ₹ Rev
                      </Typography>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.toggleBtn, chartMetric === 'orders' && styles.toggleBtnActive]}
                      onPress={() => setChartMetric('orders')}
                      activeOpacity={0.8}
                    >
                      <Typography
                        variant="caption"
                        weight="extrabold"
                        color={chartMetric === 'orders' ? '#ffffff' : '#64748b'}
                        style={{ fontSize: 11 }}
                      >
                        Orders
                      </Typography>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Selected Day Floating Inspector */}
              {activeDayDisplay && (
                <View style={styles.inspectorBar}>
                  <View>
                    <Typography variant="caption" color="#64748b" weight="bold" style={{ fontSize: 11 }}>
                      {formatDateLabel(activeDayDisplay.date)} ({activeDayDisplay.date})
                    </Typography>
                    <Typography variant="body" weight="extrabold" color="#0f172a">
                      {formatCurrency(activeDayDisplay.revenue)} • {activeDayDisplay.orders} Orders
                    </Typography>
                  </View>

                  {activeDayDisplay.dayChangePct !== undefined && activeDayDisplay.dayChangePct !== 0 && (
                    <View style={[styles.dayChangePill, { backgroundColor: activeDayDisplay.isUp ? '#dcfce7' : '#fee2e2' }]}>
                      <MaterialCommunityIcons
                        name={activeDayDisplay.isUp ? 'arrow-top-right' : 'arrow-bottom-right'}
                        size={14}
                        color={activeDayDisplay.isUp ? '#15803d' : '#b91c1c'}
                      />
                      <Typography
                        variant="caption"
                        weight="extrabold"
                        color={activeDayDisplay.isUp ? '#15803d' : '#b91c1c'}
                        style={{ fontSize: 11, marginLeft: 2 }}
                      >
                        {activeDayDisplay.dayChangePct >= 0 ? '+' : ''}
                        {activeDayDisplay.dayChangePct.toFixed(1)}% vs prior
                      </Typography>
                    </View>
                  )}
                </View>
              )}

              {/* ── GRAPH VISUALIZATION (SVG Curve or Bars) ── */}
              {salesAnalysis.historySeries.length === 0 ? (
                <View style={styles.emptyChartWrap}>
                  <Typography variant="body" color="#94a3b8">
                    No sales recorded in this timeframe
                  </Typography>
                </View>
              ) : graphViewMode === 'curve' ? (
                /* High-End SVG Curve Graph */
                <View style={styles.svgGraphContainer}>
                  <Svg width={graphDimensions.width} height={graphDimensions.height}>
                    <Defs>
                      <SvgLinearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                        <Stop offset="65%" stopColor="#3b82f6" stopOpacity="0.10" />
                        <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                      </SvgLinearGradient>
                    </Defs>

                    {/* Dotted Horizontal Gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const yPos = graphDimensions.paddingTop + graphDimensions.plotHeight * (1 - ratio);
                      return (
                        <G key={ratio}>
                          <SvgLine
                            x1={graphDimensions.paddingLeft}
                            y1={yPos}
                            x2={graphDimensions.width - 16}
                            y2={yPos}
                            stroke="#f1f5f9"
                            strokeWidth="1"
                            strokeDasharray="4, 4"
                          />
                          <SvgText
                            x={graphDimensions.paddingLeft - 6}
                            y={yPos + 4}
                            fontSize="9"
                            fill="#94a3b8"
                            textAnchor="end"
                            fontWeight="bold"
                          >
                            {chartMetric === 'revenue'
                              ? formatCompactCurrency(graphDimensions.maxVal * ratio)
                              : formatCompactNumber(Math.round(graphDimensions.maxVal * ratio))}
                          </SvgText>
                        </G>
                      );
                    })}

                    {/* Area Gradient Fill */}
                    {graphDimensions.areaPath ? (
                      <Path d={graphDimensions.areaPath} fill="url(#curveGradient)" />
                    ) : null}

                    {/* Smooth Curve Path Line */}
                    {graphDimensions.linePath ? (
                      <Path
                        d={graphDimensions.linePath}
                        fill="none"
                        stroke={chartMetric === 'revenue' ? '#2563eb' : '#7c3aed'}
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    ) : null}

                    {/* Peak & Selected Data Circles */}
                    {graphDimensions.points.map((pt, idx) => {
                      const isPeak = pt.item.isPeak;
                      const isSelected = activeDayDisplay?.date === pt.item.date;

                      if (!isPeak && !isSelected && graphDimensions.points.length > 25 && idx % 2 !== 0) {
                        return null;
                      }

                      return (
                        <G key={idx}>
                          {isPeak && (
                            <SvgCircle
                              cx={pt.x}
                              cy={pt.y}
                              r="8"
                              fill="#fef3c7"
                              opacity="0.8"
                            />
                          )}
                          <SvgCircle
                            cx={pt.x}
                            cy={pt.y}
                            r={isPeak || isSelected ? 5 : 3}
                            fill={isPeak ? '#d97706' : isSelected ? colors.primary : '#2563eb'}
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                        </G>
                      );
                    })}
                  </Svg>

                  {/* Transparent Interactive Touch Columns Overlay */}
                  <View style={styles.touchOverlay} pointerEvents="box-none">
                    {graphDimensions.points.map((pt, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.touchColumn,
                          {
                            left: Math.max(0, pt.x - 14),
                            width: 28,
                          },
                        ]}
                        onPress={() => setSelectedDayItem(pt.item)}
                        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                        activeOpacity={0.7}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                /* Bar Timeline Mode */
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartBarsScroll}>
                  {salesAnalysis.historySeries.map((item, idx) => {
                    const currentVal = chartMetric === 'revenue' ? item.revenue : item.orders;
                    const heightPct = Math.max(8, Math.round((currentVal / salesAnalysis.maxVal) * 100));
                    const isSelected = activeDayDisplay?.date === item.date;

                    return (
                      <TouchableOpacity
                        key={item.date || idx}
                        style={styles.barColumn}
                        onPress={() => setSelectedDayItem(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.barTrack}>
                          {item.isPeak && (
                            <MaterialCommunityIcons
                              name="crown"
                              size={12}
                              color="#d97706"
                              style={styles.peakCrown}
                            />
                          )}
                          <View
                            style={[
                              styles.barFill,
                              { height: `${heightPct}%` },
                              item.isPeak && styles.barPeak,
                              isSelected && styles.barSelected,
                              currentVal === 0 && styles.barZero,
                            ]}
                          />
                        </View>
                        <Typography
                          variant="caption"
                          color={isSelected ? colors.primary : '#64748b'}
                          weight={isSelected ? 'extrabold' : 'bold'}
                          style={{ fontSize: 9, marginTop: 6 }}
                        >
                          {item.date ? (item.date.length > 5 ? item.date.slice(5) : item.date) : ''}
                        </Typography>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* ── Day-by-Day Historical Sales Ledger ── */}
            <View style={styles.historyTableCard}>
              <View style={styles.cardHeaderRow}>
                <Typography variant="body" weight="extrabold" color="#0f172a">
                  Historical Sales Ledger
                </Typography>
                <Typography variant="caption" color="#64748b" weight="bold">
                  {salesAnalysis.historySeries.length} Periods Recorded
                </Typography>
              </View>

              <View style={styles.tableHeader}>
                <Typography variant="caption" weight="extrabold" color="#64748b" style={{ flex: 1.2, fontSize: 11 }}>
                  PERIOD
                </Typography>
                <Typography variant="caption" weight="extrabold" color="#64748b" style={{ flex: 1.3, textAlign: 'right', fontSize: 11 }}>
                  REVENUE
                </Typography>
                <Typography variant="caption" weight="extrabold" color="#64748b" style={{ flex: 0.9, textAlign: 'right', fontSize: 11 }}>
                  ORDERS
                </Typography>
                <Typography variant="caption" weight="extrabold" color="#64748b" style={{ flex: 1.2, textAlign: 'right', fontSize: 11 }}>
                  UPS & DOWNS
                </Typography>
              </View>

              {salesAnalysis.historySeries.slice().reverse().map((row, idx) => (
                <View key={row.date || idx} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                  <View style={{ flex: 1.2 }}>
                    <Typography variant="caption" weight="extrabold" color="#0f172a" style={{ fontSize: 12 }}>
                      {formatDateLabel(row.date)}
                    </Typography>
                    <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10 }}>
                      {row.date}
                    </Typography>
                  </View>

                  <View style={{ flex: 1.3, alignItems: 'flex-end' }}>
                    <Typography variant="caption" weight="extrabold" color="#0f172a" style={{ fontSize: 12 }}>
                      {formatCurrency(row.revenue)}
                    </Typography>
                    {row.isPeak && (
                      <Typography variant="caption" weight="extrabold" color="#b45309" style={{ fontSize: 9 }}>
                        PEAK PERIOD
                      </Typography>
                    )}
                  </View>

                  <Typography variant="caption" weight="bold" color="#334155" style={{ flex: 0.9, textAlign: 'right', fontSize: 12 }}>
                    {row.orders}
                  </Typography>

                  <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                    {row.dayChangePct !== 0 ? (
                      <View style={[styles.trendChip, { backgroundColor: row.isUp ? '#dcfce7' : '#fee2e2' }]}>
                        <MaterialCommunityIcons
                          name={row.isUp ? 'arrow-up' : 'arrow-down'}
                          size={11}
                          color={row.isUp ? '#15803d' : '#b91c1c'}
                        />
                        <Typography
                          variant="caption"
                          weight="extrabold"
                          color={row.isUp ? '#15803d' : '#b91c1c'}
                          style={{ fontSize: 10 }}
                        >
                          {row.dayChangePct >= 0 ? '+' : ''}
                          {row.dayChangePct.toFixed(0)}%
                        </Typography>
                      </View>
                    ) : (
                      <Typography variant="caption" color="#94a3b8" style={{ fontSize: 11 }}>
                        —
                      </Typography>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* ── Payment Method & Fulfillment Split ── */}
            <View style={styles.splitGrid}>
              {/* Payment Split */}
              <View style={styles.splitCard}>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={{ marginBottom: 10 }}>
                  Payment Method Split
                </Typography>

                <View style={styles.splitBar}>
                  <View style={[styles.splitBarPart, { flex: orderDistribution.onlinePct || 1, backgroundColor: '#10b981' }]} />
                  <View style={[styles.splitBarPart, { flex: orderDistribution.codPct || 1, backgroundColor: '#f59e0b' }]} />
                </View>

                <View style={styles.splitLegendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
                    <View>
                      <Typography variant="caption" weight="extrabold" color="#0f172a" style={{ fontSize: 12 }}>
                        Online ({orderDistribution.onlinePct}%)
                      </Typography>
                      <Typography variant="caption" color="#64748b" style={{ fontSize: 11 }}>
                        {orderDistribution.online} orders
                      </Typography>
                    </View>
                  </View>

                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
                    <View>
                      <Typography variant="caption" weight="extrabold" color="#0f172a" style={{ fontSize: 12 }}>
                        COD ({orderDistribution.codPct}%)
                      </Typography>
                      <Typography variant="caption" color="#64748b" style={{ fontSize: 11 }}>
                        {orderDistribution.cod} orders
                      </Typography>
                    </View>
                  </View>
                </View>
              </View>

              {/* Fulfillment Distribution */}
              <View style={styles.splitCard}>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={{ marginBottom: 10 }}>
                  Order Fulfillment Status
                </Typography>

                <View style={styles.fulfillmentPillsGrid}>
                  <View style={[styles.statusBox, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                    <Typography variant="caption" color="#047857" weight="extrabold">
                      DELIVERED
                    </Typography>
                    <Typography variant="h3" color="#065f46" weight="extrabold" style={{ marginTop: 2 }}>
                      {orderDistribution.delivered}
                    </Typography>
                  </View>

                  <View style={[styles.statusBox, { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }]}>
                    <Typography variant="caption" color="#6d28d9" weight="extrabold">
                      SHIPPED
                    </Typography>
                    <Typography variant="h3" color="#5b21b6" weight="extrabold" style={{ marginTop: 2 }}>
                      {orderDistribution.shipped}
                    </Typography>
                  </View>

                  <View style={[styles.statusBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                    <Typography variant="caption" color="#b45309" weight="extrabold">
                      PENDING
                    </Typography>
                    <Typography variant="h3" color="#92400e" weight="extrabold" style={{ marginTop: 2 }}>
                      {orderDistribution.pending}
                    </Typography>
                  </View>

                  <View style={[styles.statusBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                    <Typography variant="caption" color="#b91c1c" weight="extrabold">
                      CANCELLED
                    </Typography>
                    <Typography variant="h3" color="#991b1b" weight="extrabold" style={{ marginTop: 2 }}>
                      {orderDistribution.cancelled}
                    </Typography>
                  </View>
                </View>
              </View>
            </View>

            {/* ── Top Selling Sarees / Velocity Leaderboard ── */}
            {topProducts.length > 0 && (
              <View style={styles.topProductsCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="star-shooting" size={20} color="#eab308" style={{ marginRight: 6 }} />
                    <Typography variant="body" weight="extrabold" color="#0f172a">
                      Top Performing Products
                    </Typography>
                  </View>
                  <Typography variant="caption" weight="bold" color="#64748b">
                    By Volume & Sales
                  </Typography>
                </View>

                {topProducts.map((p: any, idx: number) => {
                  let img = null;
                  if (p.productImages) {
                    try {
                      const parsed = typeof p.productImages === 'string' ? JSON.parse(p.productImages) : p.productImages;
                      img = Array.isArray(parsed) ? parsed[0] : parsed;
                    } catch {
                      img = p.productImages;
                    }
                  }

                  return (
                    <View key={p.id || idx} style={styles.productRow}>
                      <View style={styles.rankBadge}>
                        <Typography variant="caption" weight="extrabold" color="#475569" style={{ fontSize: 11 }}>
                          #{idx + 1}
                        </Typography>
                      </View>

                      <View style={styles.productThumbBox}>
                        {img ? (
                          <Image source={{ uri: img }} style={styles.productThumb} resizeMode="cover" />
                        ) : (
                          <MaterialCommunityIcons name="tag" size={18} color="#94a3b8" />
                        )}
                      </View>

                      <View style={styles.productInfoCol}>
                        <Typography variant="body" weight="bold" color="#0f172a" numberOfLines={1}>
                          {p.productName || 'Saree Item'}
                        </Typography>
                        <Typography variant="caption" color="#64748b">
                          {p.totalSold || 0} units sold
                        </Typography>
                      </View>

                      <View style={{ alignItems: 'flex-end' }}>
                        <Typography variant="body" weight="extrabold" color="#0f172a">
                          {formatCurrency(p.totalRevenue || 0)}
                        </Typography>
                        <Typography variant="caption" color="#16a34a" weight="bold" style={{ fontSize: 10 }}>
                          TOP DEMAND
                        </Typography>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Active Shopper Geography / Regional Presence ── */}
            <View style={styles.geoCard}>
              <View style={styles.cardHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="map-marker-radius" size={20} color="#0284c7" style={{ marginRight: 6 }} />
                  <Typography variant="body" weight="extrabold" color="#0f172a">
                    Active Regional Shoppers
                  </Typography>
                </View>
                <Typography variant="caption" weight="bold" color="#0284c7">
                  Live Traffic
                </Typography>
              </View>

              {locations.length === 0 ? (
                <View style={styles.emptyGeoWrap}>
                  <MaterialCommunityIcons name="map-outline" size={32} color="#94a3b8" />
                  <Typography variant="caption" color="#94a3b8" style={{ marginTop: 6 }}>
                    Live customer geographic hubs will appear here as visitors browse
                  </Typography>
                </View>
              ) : (
                <View style={styles.locationsGrid}>
                  {locations.slice(0, 6).map((loc: any, idx: number) => (
                    <View key={idx} style={styles.geoItem}>
                      <View style={styles.geoItemLeft}>
                        <View style={styles.geoGreenDot} />
                        <View>
                          <Typography variant="body" weight="bold" color="#0f172a">
                            {loc.country || 'India'}
                          </Typography>
                          <Typography variant="caption" color="#64748b" style={{ fontSize: 10 }}>
                            {loc.latestPage || 'Storefront'}
                          </Typography>
                        </View>
                      </View>
                      <View style={styles.geoCountBadge}>
                        <Typography variant="caption" weight="extrabold" color="#0284c7" style={{ fontSize: 11 }}>
                          {loc.visitors} Active
                        </Typography>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Extra spacer for scroll clearance */}
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* ── Custom Date Range Modal ── */}
      <Modal visible={customModalVisible} transparent animationType="fade" onRequestClose={() => setCustomModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h3" color="#0f172a" weight="extrabold">
                Custom Analytics Range
              </Typography>
              <TouchableOpacity onPress={() => setCustomModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                value={tempStart}
                onChangeText={setTempStart}
                autoCapitalize="none"
              />

              <Typography variant="caption" color="#475569" weight="bold" style={{ marginTop: 12, marginBottom: 4 }}>
                End Date (YYYY-MM-DD)
              </Typography>
              <TextInput
                style={styles.modalInput}
                placeholder="2026-10-26"
                placeholderTextColor="#94a3b8"
                value={tempEnd}
                onChangeText={setTempEnd}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCustomModalVisible(false)}
                activeOpacity={0.8}
              >
                <Typography variant="caption" weight="bold" color="#64748b">
                  Cancel
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalApplyBtn} onPress={applyCustomRange} activeOpacity={0.8}>
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

// ── Corporate Modern Stylesheet ───────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitleCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livePulseContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  pulseCircle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#86efac',
    opacity: 0.7,
  },
  solidCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  badgeText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: 22,
    marginTop: 2,
  },
  headerRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  // ── Presets Ribbon ──
  presetsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 10,
  },
  presetsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  // ── Scroll Container ──
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  // ── Lifetime Report Card ──
  lifetimeReportCard: {
    backgroundColor: '#850404',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#850404',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  lifetimeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lifetimeHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  lifetimeSalesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  lifetimeSalesNumber: {
    fontSize: 28,
  },
  lifetimeOrdersBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  lifetimeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  lifetimeMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  lifetimeMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  // ── Live Shoppers Banner ──
  liveShoppersBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  liveShoppersLeft: {
    flex: 1,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 6,
  },
  greenPulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
    marginRight: 6,
  },
  visitorsCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  liveShoppersRight: {
    marginLeft: 12,
  },
  sessionBox: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  miniTrendPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },

  // ── Section Title ──
  sectionTitleRow: {
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },

  // ── KPI Grid ──
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiHighlight: {
    borderColor: '#fecaca',
    backgroundColor: '#fffdfd',
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiNumber: {
    fontSize: 20,
    marginBottom: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },

  // ── Ups & Downs Intelligence ──
  upsDownsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trajectoryChip: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  intelligenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intelligenceBox: {
    flex: 1,
    minWidth: '31%',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
  },
  peakBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  troughBox: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  avgBox: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  intelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ── Chart Section ──
  chartSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  miniModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  miniModeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniModeBtnActive: {
    backgroundColor: colors.primary,
  },
  metricToggleBar: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  inspectorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  dayChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyChartWrap: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── SVG Graph ──
  svgGraphContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: -8,
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  touchColumn: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },

  // ── Bar Track ──
  chartBarsScroll: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 10,
    gap: 8,
  },
  barColumn: {
    alignItems: 'center',
    width: 32,
  },
  barTrack: {
    height: 140,
    width: 20,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  peakCrown: {
    position: 'absolute',
    top: 2,
    zIndex: 2,
  },
  barFill: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 10,
  },
  barPeak: {
    backgroundColor: '#d97706',
  },
  barSelected: {
    backgroundColor: colors.primary,
  },
  barZero: {
    backgroundColor: '#e2e8f0',
    height: 4,
  },

  // ── History Table ──
  historyTableCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  tableRowAlt: {
    backgroundColor: '#fcfdfd',
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // ── Splits ──
  splitGrid: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 14,
  },
  splitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  splitBar: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    marginBottom: 12,
  },
  splitBarPart: {
    height: '100%',
  },
  splitLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  fulfillmentPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBox: {
    flex: 1,
    minWidth: '47%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },

  // ── Top Products ──
  topProductsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rankBadge: {
    width: 24,
    alignItems: 'center',
  },
  productThumbBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginLeft: 6,
    marginRight: 10,
  },
  productThumb: {
    width: '100%',
    height: '100%',
  },
  productInfoCol: {
    flex: 1,
    marginRight: 10,
  },

  // ── Geography ──
  geoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  emptyGeoWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  locationsGrid: {
    gap: 8,
  },
  geoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  geoItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  geoGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 10,
  },
  geoCountBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { useAuth } from '../../src/context/AuthContext';
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

// ── SVG Curve Math ────────────────────────────────────────────────────────────

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

// ── Tabs & Periods ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'revenue', label: 'Revenue', icon: 'cash' },
  { id: 'orders', label: 'Orders', icon: 'package-variant-closed' },
  { id: 'products', label: 'Products', icon: 'tag-multiple' },
  { id: 'customers', label: 'Customers', icon: 'account-group' },
];

const PERIODS = [
  { id: 'overall', label: 'Overall' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'daily', label: 'Daily' },
];

function KPIChip({
  label,
  value,
  icon,
  colorHex,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: string;
  colorHex: string;
  subtitle?: string;
}) {
  return (
    <View style={[styles.kpiChip, { borderLeftColor: colorHex }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" weight="bold" style={{ color: '#64748b', letterSpacing: 0.8, fontSize: 10 }}>
          {label.toUpperCase()}
        </Typography>
        <Typography variant="body">{icon}</Typography>
      </View>
      <Typography variant="h2" weight="bold" color="#0f172a" style={{ marginTop: 6, fontSize: 18 }}>
        {value}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="#94a3b8" style={{ marginTop: 2, fontSize: 10 }}>
          {subtitle}
        </Typography>
      ) : null}
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('revenue');
  const [period, setPeriod] = useState('overall'); // Default to 'overall' so user sees overall report immediately!
  const [data, setData] = useState<any>(null);
  const [allOrdersList, setAllOrdersList] = useState<any[]>([]);
  const [overallRevenueData, setOverallRevenueData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Graph preferences
  const [graphViewMode, setGraphViewMode] = useState<'curve' | 'bars'>('curve');
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
    ]).start();
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = period === 'overall' ? {} : { period };

      const [resAnalytics, resAllOrders, resOverallRevenue] = await Promise.allSettled([
        api.get(`/dashboard/analytics/${activeTab}`, { params }),
        api.get('/all-orders'),
        api.get('/dashboard/analytics/revenue', { params: { startDate: '2020-01-01', endDate: '2026-12-31' } }),
      ]);

      if (resAnalytics.status === 'fulfilled') {
        setData(resAnalytics.value.data);
      }
      if (resAllOrders.status === 'fulfilled') {
        const raw = resAllOrders.value.data?.orders || resAllOrders.value.data || [];
        setAllOrdersList(Array.isArray(raw) ? raw : []);
      }
      if (resOverallRevenue.status === 'fulfilled') {
        setOverallRevenueData(resOverallRevenue.value.data);
      }

      animateIn();
    } catch (err) {
      console.error('Fetch dashboard telemetry error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Overall Lifetime Performance Summary (Across Store History) ─────────────
  const overallLifetimeReport = useMemo(() => {
    let lifetimeSales = 0;
    let lifetimeOrders = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let inProgressCount = 0;
    let codCount = 0;
    let prepaidCount = 0;

    const validStatuses = ['paid', 'processing', 'shipped', 'delivered'];

    allOrdersList.forEach((o: any) => {
      const s = String(o.status || '').toLowerCase().trim();
      const amt = Number(o.totalAmount) || 0;
      const isCod = String(o.paymentMethod || '').toLowerCase().trim() === 'cod';

      if (s === 'delivered') deliveredCount++;
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
    const deliveryRate = lifetimeOrders > 0 ? Math.round((deliveredCount / lifetimeOrders) * 100) : 0;

    return {
      lifetimeSales,
      lifetimeOrders,
      lifetimeAov,
      deliveredCount,
      cancelledCount,
      inProgressCount,
      codCount,
      prepaidCount,
      deliveryRate,
    };
  }, [allOrdersList]);

  // ── Sales Ups & Downs Analysis ──────────────────────────────────────────────
  const salesAnalysis = useMemo(() => {
    let sourceList: any[] = [];
    if (period === 'overall') {
      sourceList = overallRevenueData?.monthly?.length
        ? overallRevenueData.monthly
        : (data?.monthly || data?.daily || []);
    } else {
      sourceList = data?.[period] || [];
    }

    if (sourceList.length === 0) {
      return {
        peakItem: null,
        troughItem: null,
        historySeries: [],
        maxVal: 1,
        avgRevenue: 0,
        upCount: 0,
        downCount: 0,
        totalPeriodSales: 0,
        totalPeriodOrders: 0,
      };
    }

    let peak = sourceList[0];
    let trough: any = null;
    let sumRev = 0;
    let sumOrders = 0;
    let upCount = 0;
    let downCount = 0;

    sourceList.forEach((item) => {
      const rev = Number(item.revenue) || 0;
      const ord = Number(item.orders) || 0;
      sumRev += rev;
      sumOrders += ord;

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

    const historySeries = sourceList.map((item, idx) => {
      const rev = Number(item.revenue) || 0;
      const orders = Number(item.orders) || 0;
      const label = item.date || item.week || item.month || `P${idx + 1}`;
      let changePct = 0;
      let isUp = true;

      if (idx > 0) {
        const prevRev = Number(sourceList[idx - 1].revenue) || 0;
        if (prevRev > 0) {
          changePct = ((rev - prevRev) / prevRev) * 100;
          isUp = changePct >= 0;
        } else if (rev > 0) {
          changePct = 100;
          isUp = true;
        }
      }

      if (idx > 0) {
        if (isUp) upCount++;
        else downCount++;
      }

      return {
        ...item,
        label,
        revenue: rev,
        orders,
        changePct,
        isUp,
        isPeak: label === (peak.date || peak.week || peak.month),
        isTrough: trough && label === (trough.date || trough.week || trough.month),
      };
    });

    const maxRevenue = Math.max(...historySeries.map((d) => d.revenue), 1000);
    const maxOrders = Math.max(...historySeries.map((d) => d.orders), 1);

    const peakItem = historySeries.find((d) => d.isPeak) || historySeries[0] || null;
    const troughItem = historySeries.find((d) => d.isTrough) || historySeries[0] || null;

    return {
      peakItem,
      troughItem,
      historySeries,
      maxVal: chartMetric === 'revenue' ? maxRevenue : maxOrders,
      avgRevenue,
      upCount,
      downCount,
      totalPeriodSales: sumRev,
      totalPeriodOrders: sumOrders,
    };
  }, [data, overallRevenueData, period, chartMetric]);

  const activeDisplayItem =
    selectedPoint ||
    salesAnalysis.peakItem ||
    (salesAnalysis.historySeries.length > 0 ? salesAnalysis.historySeries[salesAnalysis.historySeries.length - 1] : null);

  // ── SVG Curve Dimensions ────────────────────────────────────────────────────
  const graphDimensions = useMemo(() => {
    const cardPadding = 32;
    const width = SCREEN_WIDTH - cardPadding;
    const height = 180;
    const paddingLeft = 44;
    const paddingRight = 16;
    const paddingTop = 22;
    const paddingBottom = 26;
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    const baseY = height - paddingBottom;

    const series = salesAnalysis.historySeries;
    const maxVal = salesAnalysis.maxVal || 1;

    const points = series.map((item, idx) => {
      const val = chartMetric === 'revenue' ? item.revenue : item.orders;
      const x =
        series.length <= 1
          ? paddingLeft + plotWidth / 2
          : paddingLeft + (idx / (series.length - 1)) * plotWidth;
      const y = paddingTop + (1 - val / maxVal) * plotHeight;
      return { ...item, x, y, val };
    });

    const linePath = createSmoothPath(points);
    const areaPath = createAreaPath(points, baseY);

    const gridLines = [
      { y: paddingTop, label: chartMetric === 'revenue' ? formatCompactCurrency(maxVal) : formatCompactNumber(maxVal) },
      { y: paddingTop + plotHeight * 0.5, label: chartMetric === 'revenue' ? formatCompactCurrency(maxVal * 0.5) : formatCompactNumber(Math.round(maxVal * 0.5)) },
      { y: baseY, label: '0' },
    ];

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      plotWidth,
      plotHeight,
      baseY,
      points,
      linePath,
      areaPath,
      gridLines,
    };
  }, [salesAnalysis, chartMetric]);

  // ── Render Revenue Tab ──────────────────────────────────────────────────────
  const renderRevenue = () => {
    const isOverall = period === 'overall';
    const totalRev = isOverall ? overallLifetimeReport.lifetimeSales : salesAnalysis.totalPeriodSales;
    const totalOrd = isOverall ? overallLifetimeReport.lifetimeOrders : salesAnalysis.totalPeriodOrders;
    const avgOrd = totalOrd > 0 ? Math.round(totalRev / totalOrd) : 0;

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* ── 1. Executive Overall Lifetime Performance Card ── */}
        <Card style={styles.lifetimeHeroCard}>
          <LinearGradient
            colors={['#1e1b4b', '#312e81', '#1e293b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.lifetimeHeroGradient}
          >
            <View style={styles.lifetimeHeroHeader}>
              <View style={styles.lifetimeHeroBadge}>
                <MaterialCommunityIcons name="shield-crown" size={14} color="#fbbf24" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="extrabold" color="#fbbf24" style={{ fontSize: 10, letterSpacing: 0.8 }}>
                  STORE LIFETIME REPORT
                </Typography>
              </View>

              <TouchableOpacity
                style={styles.viewLiveViewBtn}
                onPress={() => router.push('/live-view')}
                activeOpacity={0.8}
              >
                <Typography variant="caption" weight="bold" color="#a5b4fc" style={{ fontSize: 11 }}>
                  Live Monitor ↗
                </Typography>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12 }}>
              <Typography variant="caption" color="#cbd5e1" weight="medium" style={{ fontSize: 12 }}>
                All-Time Gross Sales Revenue
              </Typography>
              <Typography variant="h1" weight="extrabold" color="#ffffff" style={styles.lifetimeAmountText}>
                {formatCurrency(overallLifetimeReport.lifetimeSales)}
              </Typography>
            </View>

            {/* Lifetime 3-column stats */}
            <View style={styles.lifetimeStatsRow}>
              <View style={styles.lifetimeStatBox}>
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 11 }}>Lifetime Orders</Typography>
                <Typography variant="body" weight="extrabold" color="#ffffff" style={{ fontSize: 15, marginTop: 2 }}>
                  {overallLifetimeReport.lifetimeOrders.toLocaleString('en-IN')}
                </Typography>
              </View>
              <View style={styles.lifetimeStatDivider} />
              <View style={styles.lifetimeStatBox}>
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 11 }}>Lifetime AOV</Typography>
                <Typography variant="body" weight="extrabold" color="#38bdf8" style={{ fontSize: 15, marginTop: 2 }}>
                  {formatCurrency(overallLifetimeReport.lifetimeAov)}
                </Typography>
              </View>
              <View style={styles.lifetimeStatDivider} />
              <View style={styles.lifetimeStatBox}>
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 11 }}>Delivery Rate</Typography>
                <Typography variant="body" weight="extrabold" color="#34d399" style={{ fontSize: 15, marginTop: 2 }}>
                  {overallLifetimeReport.deliveryRate}%
                </Typography>
              </View>
            </View>

            {/* Quick status chips */}
            <View style={styles.lifetimeChipsRow}>
              <View style={[styles.lifetimeMiniChip, { backgroundColor: '#10b98125', borderColor: '#10b98150' }]}>
                <MaterialCommunityIcons name="check-circle" size={12} color="#34d399" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" color="#34d399" style={{ fontSize: 11 }}>
                  {overallLifetimeReport.deliveredCount} Delivered
                </Typography>
              </View>
              <View style={[styles.lifetimeMiniChip, { backgroundColor: '#38bdf825', borderColor: '#38bdf850' }]}>
                <MaterialCommunityIcons name="progress-clock" size={12} color="#38bdf8" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" color="#38bdf8" style={{ fontSize: 11 }}>
                  {overallLifetimeReport.inProgressCount} Processing
                </Typography>
              </View>
              <View style={[styles.lifetimeMiniChip, { backgroundColor: '#f43f5e25', borderColor: '#f43f5e50' }]}>
                <MaterialCommunityIcons name="close-circle" size={12} color="#fb7185" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" color="#fb7185" style={{ fontSize: 11 }}>
                  {overallLifetimeReport.cancelledCount} Cancelled
                </Typography>
              </View>
            </View>
          </LinearGradient>
        </Card>

        {/* ── 2. Timeframe KPI Grid ── */}
        <View style={styles.kpiGrid}>
          <KPIChip
            label={isOverall ? 'Lifetime Gross' : `${period} Revenue`}
            value={formatCompactCurrency(totalRev)}
            subtitle={isOverall ? 'Store inception to now' : `Total for ${period}`}
            icon="💰"
            colorHex="#4f46e5"
          />
          <KPIChip
            label={isOverall ? 'Lifetime Orders' : `${period} Orders`}
            value={totalOrd.toLocaleString('en-IN')}
            subtitle={`${overallLifetimeReport.codCount} COD • ${overallLifetimeReport.prepaidCount} Paid`}
            icon="📦"
            colorHex="#8b5cf6"
          />
          <KPIChip
            label="Average Order"
            value={formatCurrency(avgOrd)}
            subtitle="Per successful transaction"
            icon="🎯"
            colorHex="#0ea5e9"
          />
          <KPIChip
            label="Peak Volume"
            value={salesAnalysis.peakItem ? formatCompactCurrency(salesAnalysis.peakItem.revenue) : '—'}
            subtitle={salesAnalysis.peakItem ? formatDateLabel(salesAnalysis.peakItem.label || salesAnalysis.peakItem.date || salesAnalysis.peakItem.month) : 'High watermark'}
            icon="⚡"
            colorHex="#f59e0b"
          />
        </View>

        {/* ── 3. Interactive Sales Ups & Downs Graph ── */}
        <Card style={styles.contentCard}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Typography variant="h3" weight="bold" color="#0f172a">
                  Sales Ups & Downs
                </Typography>
                <View style={styles.trendLiveBadge}>
                  <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={12} color="#4f46e5" style={{ marginRight: 3 }} />
                  <Typography variant="caption" weight="bold" color="#4f46e5" style={{ fontSize: 10 }}>
                    {period.toUpperCase()} TRAJECTORY
                  </Typography>
                </View>
              </View>
              <Typography variant="caption" color="#64748b" style={{ marginTop: 2 }}>
                Visualize revenue momentum, peaks, and dips
              </Typography>
            </View>

            {/* Metric Toggle: Revenue vs Orders */}
            <View style={styles.chartToggleGroup}>
              <TouchableOpacity
                style={[styles.chartToggleBtn, chartMetric === 'revenue' && styles.chartToggleBtnActive]}
                onPress={() => setChartMetric('revenue')}
              >
                <Typography variant="caption" weight="bold" color={chartMetric === 'revenue' ? '#ffffff' : '#64748b'} style={{ fontSize: 11 }}>
                  ₹ Rev
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chartToggleBtn, chartMetric === 'orders' && styles.chartToggleBtnActive]}
                onPress={() => setChartMetric('orders')}
              >
                <Typography variant="caption" weight="bold" color={chartMetric === 'orders' ? '#ffffff' : '#64748b'} style={{ fontSize: 11 }}>
                  Orders
                </Typography>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Highlight Node Inspector Card */}
          {activeDisplayItem ? (
            <View style={styles.nodeInspectorBanner}>
              <View style={{ flex: 1 }}>
                <Typography variant="caption" color="#64748b" weight="bold" style={{ fontSize: 11 }}>
                  {formatDateLabel(activeDisplayItem.label || activeDisplayItem.date || activeDisplayItem.month)}
                </Typography>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={{ fontSize: 16 }}>
                  {chartMetric === 'revenue' ? formatCurrency(activeDisplayItem.revenue) : `${activeDisplayItem.orders} Orders`}
                </Typography>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                {activeDisplayItem.isPeak ? (
                  <View style={styles.peakIndicatorBadge}>
                    <MaterialCommunityIcons name="crown" size={12} color="#b45309" style={{ marginRight: 3 }} />
                    <Typography variant="caption" weight="extrabold" color="#b45309" style={{ fontSize: 10 }}>
                      HIGHEST PEAK
                    </Typography>
                  </View>
                ) : activeDisplayItem.isTrough ? (
                  <View style={styles.troughIndicatorBadge}>
                    <MaterialCommunityIcons name="arrow-down" size={12} color="#dc2626" style={{ marginRight: 3 }} />
                    <Typography variant="caption" weight="extrabold" color="#dc2626" style={{ fontSize: 10 }}>
                      LOWEST DIP
                    </Typography>
                  </View>
                ) : (
                  <View style={[styles.trendPill, activeDisplayItem.isUp ? styles.trendPillUp : styles.trendPillDown]}>
                    <MaterialCommunityIcons
                      name={activeDisplayItem.isUp ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={activeDisplayItem.isUp ? '#059669' : '#dc2626'}
                      style={{ marginRight: 3 }}
                    />
                    <Typography
                      variant="caption"
                      weight="extrabold"
                      color={activeDisplayItem.isUp ? '#059669' : '#dc2626'}
                      style={{ fontSize: 10 }}
                    >
                      {Number(activeDisplayItem.changePct || 0) >= 0 ? '+' : ''}{Number(activeDisplayItem.changePct || 0).toFixed(1)}%
                    </Typography>
                  </View>
                )}
                <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10, marginTop: 2 }}>
                  {chartMetric === 'revenue' ? `${activeDisplayItem.orders || 0} orders placed` : formatCurrency(activeDisplayItem.revenue)}
                </Typography>
              </View>
            </View>
          ) : null}

          {/* SVG Canvas */}
          {salesAnalysis.historySeries.length === 0 ? (
            <View style={styles.emptyState}>
              <Typography variant="body" color="#94a3b8">No telemetry data recorded for this period</Typography>
            </View>
          ) : (
            <View style={styles.svgContainer}>
              <Svg width={graphDimensions.width} height={graphDimensions.height}>
                <Defs>
                  <SvgLinearGradient id="dashRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#4f46e5" stopOpacity="0.45" />
                    <Stop offset="70%" stopColor="#818cf8" stopOpacity="0.12" />
                    <Stop offset="100%" stopColor="#c7d2fe" stopOpacity="0.0" />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="dashBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#4f46e5" stopOpacity="0.9" />
                    <Stop offset="100%" stopColor="#818cf8" stopOpacity="0.3" />
                  </SvgLinearGradient>
                </Defs>

                {/* Gridlines */}
                {graphDimensions.gridLines.map((gl, i) => (
                  <G key={i}>
                    <SvgLine
                      x1={graphDimensions.paddingLeft}
                      y1={gl.y}
                      x2={graphDimensions.width - graphDimensions.paddingRight}
                      y2={gl.y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <SvgText
                      x={graphDimensions.paddingLeft - 6}
                      y={gl.y + 3}
                      fill="#94a3b8"
                      fontSize="9"
                      fontWeight="600"
                      textAnchor="end"
                    >
                      {gl.label}
                    </SvgText>
                  </G>
                ))}

                {/* Graph View: Curve Line vs Bars */}
                {graphViewMode === 'curve' ? (
                  <>
                    {/* Area fill under curve */}
                    {graphDimensions.areaPath ? (
                      <Path d={graphDimensions.areaPath} fill="url(#dashRevenueGradient)" />
                    ) : null}

                    {/* Smooth Bezier stroke */}
                    {graphDimensions.linePath ? (
                      <Path
                        d={graphDimensions.linePath}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}

                    {/* Nodes along the curve */}
                    {graphDimensions.points.map((pt, idx) => {
                      const isSelected = selectedPoint && (selectedPoint.label === pt.label);
                      const isPeak = pt.isPeak;
                      const isTrough = pt.isTrough;

                      return (
                        <G key={idx}>
                          {isPeak ? (
                            <SvgCircle cx={pt.x} cy={pt.y} r={7} fill="#f59e0b" opacity="0.3" />
                          ) : null}
                          <SvgCircle
                            cx={pt.x}
                            cy={pt.y}
                            r={isSelected ? 5.5 : isPeak ? 4.5 : 3}
                            fill={isPeak ? '#f59e0b' : isTrough ? '#ef4444' : '#4f46e5'}
                            stroke="#ffffff"
                            strokeWidth={isSelected ? '2' : '1.5'}
                          />
                        </G>
                      );
                    })}
                  </>
                ) : (
                  // Bar tracks
                  graphDimensions.points.map((pt, idx) => {
                    const barWidth = Math.max(6, Math.min(22, (graphDimensions.plotWidth / graphDimensions.points.length) * 0.65));
                    const barHeight = Math.max(2, graphDimensions.baseY - pt.y);
                    return (
                      <G key={idx}>
                        <Path
                          d={`M ${pt.x - barWidth / 2} ${graphDimensions.baseY} L ${pt.x - barWidth / 2} ${pt.y + 4} Q ${pt.x - barWidth / 2} ${pt.y} ${pt.x} ${pt.y} Q ${pt.x + barWidth / 2} ${pt.y} ${pt.x + barWidth / 2} ${pt.y + 4} L ${pt.x + barWidth / 2} ${graphDimensions.baseY} Z`}
                          fill={pt.isPeak ? '#f59e0b' : 'url(#dashBarGradient)'}
                        />
                      </G>
                    );
                  })
                )}
              </Svg>

              {/* Interactive Node Touch Targets */}
              <View style={styles.touchOverlay} pointerEvents="box-none">
                {graphDimensions.points.map((pt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.nodeTouchTarget, { left: pt.x - 18, top: 0, height: graphDimensions.height }]}
                    onPress={() => setSelectedPoint(pt)}
                    activeOpacity={0.6}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Graph footer mode switcher */}
          <View style={styles.chartFooterRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[styles.styleToggleBtn, graphViewMode === 'curve' && styles.styleToggleBtnActive]}
                onPress={() => setGraphViewMode('curve')}
              >
                <MaterialCommunityIcons name="chart-bell-curve" size={13} color={graphViewMode === 'curve' ? '#4f46e5' : '#64748b'} />
                <Typography variant="caption" weight="bold" color={graphViewMode === 'curve' ? '#4f46e5' : '#64748b'} style={{ marginLeft: 4, fontSize: 11 }}>
                  Smooth Curve
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.styleToggleBtn, graphViewMode === 'bars' && styles.styleToggleBtnActive]}
                onPress={() => setGraphViewMode('bars')}
              >
                <MaterialCommunityIcons name="chart-bar" size={13} color={graphViewMode === 'bars' ? '#4f46e5' : '#64748b'} />
                <Typography variant="caption" weight="bold" color={graphViewMode === 'bars' ? '#4f46e5' : '#64748b'} style={{ marginLeft: 4, fontSize: 11 }}>
                  Bar Track
                </Typography>
              </TouchableOpacity>
            </View>

            <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10 }}>
              Tap any point to inspect
            </Typography>
          </View>
        </Card>

        {/* ── 4. Ups & Downs Intelligence Ledger ── */}
        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Ups & Downs Intelligence</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>
            PERFORMANCE DISPERSION & DRIFT
          </Typography>

          <View style={styles.intelligenceGrid}>
            <View style={[styles.intelBox, { borderLeftColor: '#f59e0b' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="lightning-bolt" size={14} color="#f59e0b" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" color="#64748b" style={{ fontSize: 10 }}>
                  PEAK SPIKE
                </Typography>
              </View>
              <Typography variant="body" weight="extrabold" color="#0f172a" style={{ marginTop: 4, fontSize: 14 }}>
                {salesAnalysis.peakItem ? formatCurrency(salesAnalysis.peakItem.revenue) : '—'}
              </Typography>
              <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10 }}>
                {salesAnalysis.peakItem ? formatDateLabel(salesAnalysis.peakItem.label || salesAnalysis.peakItem.date || salesAnalysis.peakItem.month) : 'Highest recorded'}
              </Typography>
            </View>

            <View style={[styles.intelBox, { borderLeftColor: '#ef4444' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="arrow-collapse-down" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" color="#64748b" style={{ fontSize: 10 }}>
                  LOWEST DIP
                </Typography>
              </View>
              <Typography variant="body" weight="extrabold" color="#0f172a" style={{ marginTop: 4, fontSize: 14 }}>
                {salesAnalysis.troughItem ? formatCurrency(salesAnalysis.troughItem.revenue) : '—'}
              </Typography>
              <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10 }}>
                {salesAnalysis.troughItem ? formatDateLabel(salesAnalysis.troughItem.label || salesAnalysis.troughItem.date || salesAnalysis.troughItem.month) : 'Base baseline'}
              </Typography>
            </View>

            <View style={[styles.intelBox, { borderLeftColor: '#10b981' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="trending-up" size={14} color="#10b981" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" color="#64748b" style={{ fontSize: 10 }}>
                  GROWTH RUNS
                </Typography>
              </View>
              <Typography variant="body" weight="extrabold" color="#10b981" style={{ marginTop: 4, fontSize: 14 }}>
                {salesAnalysis.upCount} Periods Up
              </Typography>
              <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10 }}>
                vs {salesAnalysis.downCount} dips
              </Typography>
            </View>

            <View style={[styles.intelBox, { borderLeftColor: '#6366f1' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calculator" size={14} color="#6366f1" style={{ marginRight: 4 }} />
                <Typography variant="caption" weight="bold" color="#64748b" style={{ fontSize: 10 }}>
                  AVERAGE RUN-RATE
                </Typography>
              </View>
              <Typography variant="body" weight="extrabold" color="#0f172a" style={{ marginTop: 4, fontSize: 14 }}>
                {formatCompactCurrency(salesAnalysis.avgRevenue)}
              </Typography>
              <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10 }}>
                Per {period === 'overall' ? 'month' : period.slice(0, -2)}
              </Typography>
            </View>
          </View>
        </Card>

        {/* ── 5. Detailed Breakdown Table with Ups & Downs Tags ── */}
        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Chronological Breakdown</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>
            {period.toUpperCase()} RECORDINGS WITH DIRECTIONAL TREND
          </Typography>

          {salesAnalysis.historySeries.length === 0 ? (
            <View style={styles.emptyState}>
              <Typography variant="body" color="#94a3b8">No records available</Typography>
            </View>
          ) : (
            salesAnalysis.historySeries
              .slice()
              .reverse()
              .slice(0, 15)
              .map((r: any, i: number) => {
                const label = formatDateLabel(r.label || r.date || r.week || r.month);
                const isPeak = r.isPeak;

                return (
                  <View key={i} style={styles.ledgerItem}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Typography variant="body" weight="bold" color="#1e293b" style={{ fontSize: 14 }}>
                          {label}
                        </Typography>
                        {isPeak ? (
                          <View style={styles.miniPeakBadge}>
                            <Typography variant="caption" weight="extrabold" color="#b45309" style={{ fontSize: 9 }}>
                              PEAK
                            </Typography>
                          </View>
                        ) : null}
                      </View>
                      <Typography variant="caption" color="#64748b" style={{ fontSize: 11, marginTop: 1 }}>
                        {r.orders} orders placed
                      </Typography>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Typography variant="body" weight="extrabold" color="#0f172a" style={{ fontSize: 14 }}>
                        {formatCurrency(r.revenue)}
                      </Typography>
                      {r.changePct !== undefined && r.changePct !== 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
                          <MaterialCommunityIcons
                            name={r.isUp ? 'arrow-up' : 'arrow-down'}
                            size={12}
                            color={r.isUp ? '#10b981' : '#ef4444'}
                          />
                          <Typography
                            variant="caption"
                            weight="bold"
                            color={r.isUp ? '#10b981' : '#ef4444'}
                            style={{ fontSize: 10, marginLeft: 2 }}
                          >
                            {Number(r.changePct || 0) > 0 ? '+' : ''}{Number(r.changePct || 0).toFixed(1)}%
                          </Typography>
                        </View>
                      ) : (
                        <Typography variant="caption" color="#94a3b8" style={{ fontSize: 10 }}>
                          Baseline
                        </Typography>
                      )}
                    </View>
                  </View>
                );
              })
          )}
        </Card>
      </Animated.View>
    );
  };

  const renderOrders = () => {
    if (!data) return null;
    const statusDist = data.statusDistribution || [];
    const dvp = data.deliveredVsPending || {};
    const pm = data.paymentMethod || {};
    const dailyOrders = data.dailyOrders || [];

    const total = statusDist.reduce((s: number, item: any) => s + parseInt(item.count), 0);
    const totalPm = (pm.cod || 0) + (pm.online || 0);

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={styles.kpiGrid}>
          <KPIChip label="Delivered" value={dvp.delivered || 0} icon="✅" colorHex="#10b981" />
          <KPIChip label="In Progress" value={dvp.pending || 0} icon="⏳" colorHex="#f59e0b" />
          <KPIChip label="Shipped" value={dvp.shipped || 0} icon="🚚" colorHex="#0ea5e9" />
          <KPIChip label="Cancelled" value={dvp.cancelled || 0} icon="❌" colorHex="#f43f5e" />
        </View>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Payment Methods</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>COD VS ONLINE</Typography>
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">Cash on Delivery</Typography>
              <Typography variant="body" color="#64748b">
                {pm.cod || 0} ({totalPm ? Math.round((pm.cod / totalPm) * 100) : 0}%)
              </Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { width: `${totalPm ? Math.round((pm.cod / totalPm) * 100) : 0}%`, backgroundColor: '#f59e0b' },
                ]}
              />
            </View>
          </View>
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">Online Payment</Typography>
              <Typography variant="body" color="#64748b">
                {pm.online || 0} ({totalPm ? Math.round((pm.online / totalPm) * 100) : 0}%)
              </Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { width: `${totalPm ? Math.round((pm.online / totalPm) * 100) : 0}%`, backgroundColor: '#6366f1' },
                ]}
              />
            </View>
          </View>
        </Card>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Order Status</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>ALL TIME DISTRIBUTION</Typography>

          {statusDist.length === 0 ? (
            <View style={styles.emptyState}><Typography variant="body" color="#94a3b8">No orders yet</Typography></View>
          ) : (
            statusDist.map((s: any, i: number) => {
              const count = parseInt(s.count);
              const pct = total ? Math.round((count / total) * 100) : 0;

              return (
                <View key={i} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Typography variant="body" weight="bold" color="#1e293b" style={{ textTransform: 'capitalize' }}>
                      {s.status}
                    </Typography>
                    <Typography variant="body" color="#64748b">{count} ({pct}%)</Typography>
                  </View>
                  <View style={styles.progressBarBg}>
                    <Animated.View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: '#8b5cf6' }]} />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Daily Orders</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>LAST 30 DAYS</Typography>
          {dailyOrders.length === 0 ? (
            <View style={styles.emptyState}><Typography variant="body" color="#94a3b8">No recent order data</Typography></View>
          ) : (
            dailyOrders.slice(0, 10).map((d: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" weight="bold" color="#1e293b">{d.date}</Typography>
                </View>
                <Typography variant="body" weight="bold" color="#6366f1">{d.count} orders</Typography>
              </View>
            ))
          )}
        </Card>
      </Animated.View>
    );
  };

  const renderProducts = () => {
    if (!data) return null;
    const topProducts = data.mostOrdered || data.topSellingProducts || [];
    const topByStock = data.topByStock || [];
    const noSales = data.noSalesProducts || [];

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={styles.kpiGrid}>
          <KPIChip label="Top Sellers" value={topProducts.length} icon="🏆" colorHex="#6366f1" />
          <KPIChip label="No Sales" value={noSales.length} icon="📭" colorHex="#f43f5e" />
          <KPIChip label="Well Stocked" value={topByStock.length} icon="📦" colorHex="#10b981" />
        </View>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Most Ordered Products</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>BY UNITS SOLD</Typography>

          {topProducts.length === 0 ? (
            <View style={styles.emptyState}><Typography variant="body" color="#94a3b8">No sales data yet</Typography></View>
          ) : (
            topProducts.slice(0, 10).map((p: any, i: number) => {
              const maxSold = Math.max(...topProducts.map((t: any) => t.totalSold));
              const pct = maxSold ? (p.totalSold / maxSold) * 100 : 0;
              const barColors = ['#f59e0b', '#10b981', '#6366f1', '#0ea5e9', '#f43f5e'];

              return (
                <View key={i} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Typography variant="body" weight="bold" color="#1e293b" numberOfLines={1} style={{ flex: 1, marginRight: 10 }}>
                      {p.productName}
                    </Typography>
                    <Typography variant="body" weight="bold" color="#64748b">{p.totalSold} units</Typography>
                  </View>
                  <View style={styles.progressBarBg}>
                    <Animated.View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: barColors[i % barColors.length] }]} />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Top Products by Stock</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>MOST STOCKED ITEMS</Typography>

          {topByStock.length === 0 ? (
            <View style={styles.emptyState}><Typography variant="body" color="#94a3b8">No product data</Typography></View>
          ) : (
            topByStock.slice(0, 10).map((p: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" weight="bold" color="#1e293b" numberOfLines={1}>{p.productName}</Typography>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Typography variant="body" weight="bold" color="#10b981">{p.stockQuantity}</Typography>
                  <Typography variant="caption" color="#64748b">pcs</Typography>
                </View>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Products With No Sales</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>{noSales.length} PRODUCTS NEVER ORDERED</Typography>

          {noSales.length === 0 ? (
            <View style={styles.emptyState}><Typography variant="body" color="#10b981">All products have at least one sale!</Typography></View>
          ) : (
            noSales.slice(0, 10).map((p: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" weight="bold" color="#1e293b" numberOfLines={1}>{p.productName}</Typography>
                  <Typography variant="caption" color="#64748b">Stock: {p.stockQuantity}</Typography>
                </View>
                <Typography variant="body" weight="bold" color="#0f172a">₹{Number(p.finalPrice || p.price).toLocaleString()}</Typography>
              </View>
            ))
          )}
        </Card>
      </Animated.View>
    );
  };

  const renderCustomers = () => {
    if (!data) return null;
    const topCustomers = data.topCustomers || [];
    const newMonthly = data.newUsersMonthly || [];

    const total = data.totalUsers || 0;
    const active = data.activeCustomers || 0;
    const returning = data.returningCustomers || 0;
    const oneTime = data.oneTimeBuyers || 0;
    const never = data.neverOrdered || 0;
    const totalSegments = returning + oneTime + never;

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={styles.kpiGrid}>
          <KPIChip label="Total Users" value={total} icon="👥" colorHex="#6366f1" />
          <KPIChip label="Active (30D)" value={active} icon="🔥" colorHex="#10b981" />
          <KPIChip label="Returning" value={returning} icon="🔄" colorHex="#8b5cf6" />
          <KPIChip label="Never Ordered" value={never} icon="😴" colorHex="#f43f5e" />
        </View>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">New Users Per Month</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>LAST 6 MONTHS SIGN-UP TREND</Typography>

          {newMonthly.length === 0 ? (
            <View style={styles.emptyState}><Typography variant="body" color="#94a3b8">No sign-up data</Typography></View>
          ) : (
            newMonthly.map((m: any, i: number) => {
              const maxCount = Math.max(...newMonthly.map((t: any) => parseInt(t.count)));
              const pct = maxCount ? (parseInt(m.count) / maxCount) * 100 : 0;
              return (
                <View key={i} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Typography variant="body" weight="bold" color="#1e293b">{m.month}</Typography>
                    <Typography variant="body" weight="bold" color="#6366f1">{m.count} users</Typography>
                  </View>
                  <View style={styles.progressBarBg}>
                    <Animated.View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: '#6366f1', opacity: 0.8 }]} />
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Customer Segments</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>RETURNING VS ONE-TIME VS INACTIVE</Typography>

          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">Returning (2+ orders)</Typography>
              <Typography variant="body" color="#64748b">
                {returning} ({totalSegments ? Math.round((returning / totalSegments) * 100) : 0}%)
              </Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${totalSegments ? Math.round((returning / totalSegments) * 100) : 0}%`, backgroundColor: '#6366f1' }]} />
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">One-time buyers</Typography>
              <Typography variant="body" color="#64748b">
                {oneTime} ({totalSegments ? Math.round((oneTime / totalSegments) * 100) : 0}%)
              </Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${totalSegments ? Math.round((oneTime / totalSegments) * 100) : 0}%`, backgroundColor: '#8b5cf6' }]} />
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">Never ordered</Typography>
              <Typography variant="body" color="#64748b">
                {never} ({totalSegments ? Math.round((never / totalSegments) * 100) : 0}%)
              </Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${totalSegments ? Math.round((never / totalSegments) * 100) : 0}%`, backgroundColor: '#64748b' }]} />
            </View>
          </View>
        </Card>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Top Customers</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>BY TOTAL SPEND</Typography>

          {topCustomers.length === 0 ? (
            <View style={styles.emptyState}><Typography variant="body" color="#94a3b8">No customer data yet</Typography></View>
          ) : (
            topCustomers.slice(0, 10).map((c: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={styles.avatarCircle}>
                  <Typography variant="body" weight="bold" color="#4f46e5">{c.name ? c.name.charAt(0).toUpperCase() : 'U'}</Typography>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Typography variant="body" weight="bold" color="#1e293b">{c.name || 'Unknown'}</Typography>
                  <Typography variant="caption" color="#64748b">{c.totalOrders} orders</Typography>
                </View>
                <Typography variant="body" weight="bold" color="#10b981">₹{Number(c.totalSpent).toLocaleString()}</Typography>
              </View>
            ))
          )}
        </Card>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Typography variant="h2" weight="extrabold" color="#0f172a">Overview</Typography>
          <Typography variant="body" color="#64748b">Welcome back, {user?.username || 'Admin'}</Typography>
        </View>

        <TouchableOpacity
          style={styles.liveViewHeaderBtn}
          onPress={() => router.push('/live-view')}
          activeOpacity={0.8}
        >
          <View style={styles.liveDotCircle} />
          <Typography variant="caption" weight="extrabold" color="#b91c1c" style={{ fontSize: 11 }}>
            LIVE VIEW
          </Typography>
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? '#4f46e5' : '#64748b'}
              />
              <Typography
                variant="body"
                weight="bold"
                color={activeTab === tab.id ? '#4f46e5' : '#64748b'}
                style={{ marginLeft: 6 }}
              >
                {tab.label}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* PERIOD TOGGLE (only for Revenue) */}
      {activeTab === 'revenue' && (
        <View style={styles.periodToggleContainer}>
          <View style={styles.periodToggleBox}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => {
                  setPeriod(p.id);
                  setSelectedPoint(null);
                }}
                style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
              >
                <Typography
                  variant="caption"
                  weight="bold"
                  color={period === p.id ? '#ffffff' : '#475569'}
                  style={{ fontSize: 11 }}
                >
                  {p.label}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* CONTENT */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : (
          <>
            {activeTab === 'revenue' && renderRevenue()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'customers' && renderCustomers()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveViewHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDotCircle: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#dc2626',
    marginRight: 6,
  },

  tabContainer: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: '#4f46e5' },

  periodToggleContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  periodToggleBox: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 3,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
  },
  periodBtnActive: {
    backgroundColor: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },

  scrollArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 300 },

  // Lifetime Hero Banner
  lifetimeHeroCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3730a3',
    shadowColor: '#312e81',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  lifetimeHeroGradient: {
    padding: 20,
  },
  lifetimeHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lifetimeHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewLiveViewBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  lifetimeAmountText: {
    fontSize: 28,
    lineHeight: 34,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  lifetimeStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  lifetimeStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  lifetimeStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  lifetimeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  lifetimeMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiChip: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  contentCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 16,
  },

  // Chart Header & Controls
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trendLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  chartToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 2,
  },
  chartToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chartToggleBtnActive: {
    backgroundColor: '#4f46e5',
  },

  // Active Highlight Node Inspector
  nodeInspectorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  peakIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  troughIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendPillUp: {
    backgroundColor: '#d1fae5',
  },
  trendPillDown: {
    backgroundColor: '#fee2e2',
  },

  // SVG & Overlay
  svgContainer: {
    position: 'relative',
    marginVertical: 4,
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  nodeTouchTarget: {
    position: 'absolute',
    width: 36,
  },

  chartFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    marginTop: 6,
  },
  styleToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 6,
  },
  styleToggleBtnActive: {
    backgroundColor: '#eef2ff',
  },

  // Ups & Downs Intelligence Grid
  intelligenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  intelBox: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 3.5,
  },

  // Ledger
  ledgerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  miniPeakBadge: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
  },

  emptyState: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },

  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },

  progressBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
});

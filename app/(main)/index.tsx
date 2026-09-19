import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme/colors';
import { api } from '../../src/api/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TABS = [
  { id: 'revenue', label: 'Revenue', icon: 'cash' },
  { id: 'orders', label: 'Orders', icon: 'package-variant-closed' },
  { id: 'products', label: 'Products', icon: 'tag-multiple' },
  { id: 'customers', label: 'Customers', icon: 'account-group' }
];

const PERIODS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' }
];

function KPIChip({ label, value, icon, colorHex }: { label: string, value: string | number, icon: string, colorHex: string }) {
  return (
    <View style={[styles.kpiChip, { borderLeftColor: colorHex }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="caption" weight="bold" style={{ color: '#64748b', letterSpacing: 1 }}>{label.toUpperCase()}</Typography>
        <Typography variant="body">{icon}</Typography>
      </View>
      <Typography variant="h2" weight="bold" color="#0f172a" style={{ marginTop: 8 }}>{value}</Typography>
    </View>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('revenue');
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    fetchData();
  }, [activeTab, period]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      })
    ]).start();
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/dashboard/analytics/${activeTab}`, { params: { period } });
      setData(res.data);
      animateIn();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderRevenue = () => {
    if (!data) return null;
    const raw = data[period] || [];
    const revenues = raw.map((r: any) => parseFloat(r.revenue) || 0);
    const orders = raw.map((r: any) => parseInt(r.orders) || 0);
    
    const totalRevenue = revenues.reduce((s: number, v: number) => s + v, 0);
    const totalOrders = orders.reduce((s: number, v: number) => s + v, 0);
    const avgOrder = totalOrders ? (totalRevenue / totalOrders).toFixed(0) : 0;

    return (
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <View style={styles.kpiGrid}>
          <KPIChip label="Total Revenue" value={`₹${(totalRevenue / 1000).toFixed(1)}k`} icon="💰" colorHex="#4f46e5" />
          <KPIChip label="Total Orders" value={totalOrders} icon="📦" colorHex="#8b5cf6" />
          <KPIChip label="Avg Order" value={`₹${Number(avgOrder).toLocaleString()}`} icon="🎯" colorHex="#0ea5e9" />
        </View>

        <Card style={styles.contentCard}>
          <Typography variant="h3" weight="bold" color="#0f172a">Revenue Trends</Typography>
          <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>{period.toUpperCase()} BREAKDOWN</Typography>
          
          {raw.length === 0 ? (
            <View style={styles.emptyState}>
              <Typography variant="body" color="#94a3b8">No revenue data for this period</Typography>
            </View>
          ) : (
            raw.slice(0, 10).map((r: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" weight="bold" color="#1e293b">{r.date || r.week || r.month}</Typography>
                  <Typography variant="caption" color="#64748b">{r.orders} orders</Typography>
                </View>
                <Typography variant="body" weight="bold" color="#10b981">₹{Number(r.revenue).toLocaleString()}</Typography>
              </View>
            ))
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
              <Typography variant="body" color="#64748b">{pm.cod || 0} ({totalPm ? Math.round((pm.cod / totalPm) * 100) : 0}%)</Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${totalPm ? Math.round((pm.cod / totalPm) * 100) : 0}%`, backgroundColor: '#f59e0b' }]} />
            </View>
          </View>
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">Online Payment</Typography>
              <Typography variant="body" color="#64748b">{pm.online || 0} ({totalPm ? Math.round((pm.online / totalPm) * 100) : 0}%)</Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${totalPm ? Math.round((pm.online / totalPm) * 100) : 0}%`, backgroundColor: '#6366f1' }]} />
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
                    <Typography variant="body" weight="bold" color="#1e293b" style={{ textTransform: 'capitalize' }}>{s.status}</Typography>
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
                    <Typography variant="body" weight="bold" color="#1e293b" numberOfLines={1} style={{ flex: 1, marginRight: 10 }}>{p.productName}</Typography>
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
              <Typography variant="body" color="#64748b">{returning} ({totalSegments ? Math.round((returning / totalSegments) * 100) : 0}%)</Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${totalSegments ? Math.round((returning / totalSegments) * 100) : 0}%`, backgroundColor: '#6366f1' }]} />
            </View>
          </View>
          
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">One-time buyers</Typography>
              <Typography variant="body" color="#64748b">{oneTime} ({totalSegments ? Math.round((oneTime / totalSegments) * 100) : 0}%)</Typography>
            </View>
            <View style={styles.progressBarBg}>
              <Animated.View style={[styles.progressBarFill, { width: `${totalSegments ? Math.round((oneTime / totalSegments) * 100) : 0}%`, backgroundColor: '#8b5cf6' }]} />
            </View>
          </View>
          
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Typography variant="body" weight="bold" color="#1e293b">Never ordered</Typography>
              <Typography variant="body" color="#64748b">{never} ({totalSegments ? Math.round((never / totalSegments) * 100) : 0}%)</Typography>
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
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {TABS.map(tab => (
            <TouchableOpacity 
              key={tab.id} 
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
            >
              <MaterialCommunityIcons name={tab.icon as any} size={18} color={activeTab === tab.id ? '#4f46e5' : '#64748b'} />
              <Typography variant="body" weight="bold" color={activeTab === tab.id ? '#4f46e5' : '#64748b'} style={{ marginLeft: 6 }}>
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
            {PERIODS.map(p => (
              <TouchableOpacity 
                key={p.id} 
                onPress={() => setPeriod(p.id)}
                style={[styles.periodBtn, period === p.id && styles.periodBtnActive]}
              >
                <Typography variant="caption" weight="bold" color={period === p.id ? '#fff' : '#475569'}>{p.label}</Typography>
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
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#f8fafc' },
  
  tabContainer: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, marginRight: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#4f46e5' },
  
  periodToggleContainer: { paddingHorizontal: 20, paddingTop: 16, alignItems: 'flex-end' },
  periodToggleBox: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 2 },
  periodBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  periodBtnActive: { backgroundColor: '#1e293b' },
  
  scrollArea: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 300 },
  
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiChip: { flexBasis: '47%', flexGrow: 1, backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  
  contentCard: { padding: 20, borderRadius: 16, backgroundColor: '#ffffff', shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 16 },
  
  emptyState: { height: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },
  
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  
  progressBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  rankBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center' },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e0e7ff' }
});

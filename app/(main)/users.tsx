import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Linking,
  BackHandler,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { api } from '../../src/api/api';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { AppAlert } from '../../src/context/AlertContext';

interface User {
  id: number;
  username: string;
  email: string;
  phoneNumber?: string;
  role: string;
  createdAt: string;
  avatar?: string;
}

interface Presence {
  activeVisitors: number;
  activeCustomers: number;
  activeUserIds: (number | string)[];
}

type FilterTab = 'all' | 'online' | 'admin' | 'user';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [presence, setPresence] = useState<Presence>({
    activeVisitors: 0,
    activeCustomers: 0,
    activeUserIds: [],
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/more');
    }
  }, []);

  // Hardware back button for Android
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  const fetchUsers = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 9000);

    try {
      const response = await api.get('/getUserData', { signal: controller.signal });
      clearTimeout(abortTimer);

      const raw = response.data;
      let list: User[] = [];

      if (Array.isArray(raw)) {
        list = raw;
      } else if (Array.isArray(raw?.data)) {
        list = raw.data;
      } else if (Array.isArray(raw?.users)) {
        list = raw.users;
      } else if (raw?.data && typeof raw.data === 'object') {
        list = Object.values(raw.data);
      }

      setUsers(list);
    } catch (error: any) {
      clearTimeout(abortTimer);
      console.error('[UsersScreen] Fetch error:', error);
      const isAbort = error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED';
      const msg = isAbort
        ? 'Request timed out. Please check your connection and try again.'
        : error?.response?.data?.message ||
          error?.message ||
          'Failed to load users from backend.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchPresence = useCallback(async () => {
    try {
      const response = await api.get('/presence');
      const data = response.data?.data || response.data;
      if (data && typeof data === 'object') {
        setPresence({
          activeVisitors: Number(data.activeVisitors || 0),
          activeCustomers: Number(data.activeCustomers || 0),
          activeUserIds: Array.isArray(data.activeUserIds) ? data.activeUserIds : [],
        });
      }
    } catch (error) {
      console.log('[UsersScreen] Presence sync notice:', error);
    }
  }, []);

  // Safety watchdog: ensure loading never stays stuck in true
  useEffect(() => {
    const watchdog = setTimeout(() => {
      setLoading((curr) => {
        if (curr) {
          setErrorMessage('Taking longer than expected. Please tap "Try Again".');
          return false;
        }
        return curr;
      });
    }, 10000);
    return () => clearTimeout(watchdog);
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchPresence();
    const interval = setInterval(fetchPresence, 15000);
    return () => clearInterval(interval);
  }, [fetchUsers, fetchPresence]);

  const onRefresh = useCallback(() => {
    fetchUsers(true);
    fetchPresence();
  }, [fetchUsers, fetchPresence]);

  const handleDeleteUser = (userId: number, username: string) => {
    AppAlert.alert(
      'Delete User',
      `Are you sure you want to delete "${username}" (ID: ${userId})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(userId);
              const response = await api.delete(`/user/${userId}`);
              if (response.data?.success || response.status === 200) {
                setUsers((prev) => prev.filter((user) => user.id !== userId));
                AppAlert.alert('Success', 'User deleted successfully');
              } else {
                throw new Error(response.data?.message || 'Failed to delete user');
              }
            } catch (error: any) {
              AppAlert.alert(
                'Delete Failed',
                error?.response?.data?.message || error?.message || 'Failed to delete user'
              );
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const activeUserIds = useMemo(() => {
    return new Set((presence.activeUserIds || []).map(String));
  }, [presence.activeUserIds]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    return (users || []).filter((user) => {
      const isOnline = activeUserIds.has(String(user.id));
      const role = String(user.role || '').toLowerCase();

      if (filterTab === 'online' && !isOnline) return false;
      if (filterTab === 'admin' && role !== 'admin') return false;
      if (filterTab === 'user' && role === 'admin') return false;

      if (!normalizedSearch) return true;

      const username = String(user.username || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const phone = String(user.phoneNumber || '').toLowerCase();
      const id = String(user.id || '');

      return (
        username.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        phone.includes(normalizedSearch) ||
        id.includes(normalizedSearch)
      );
    });
  }, [users, filterTab, activeUserIds, normalizedSearch]);

  const onlineCount = useMemo(() => {
    return (users || []).filter((u) => activeUserIds.has(String(u.id))).length;
  }, [users, activeUserIds]);

  const adminCount = useMemo(() => {
    return (users || []).filter((u) => String(u.role || '').toLowerCase() === 'admin').length;
  }, [users]);

  const handleCall = (phone?: string) => {
    if (!phone) return;
    const cleanNumber = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleanNumber}`).catch(() => {
      AppAlert.alert('Notice', 'Could not open phone dialer.');
    });
  };

  const handleEmail = (email?: string) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {
      AppAlert.alert('Notice', 'Could not open email client.');
    });
  };

  // Header Component for Virtualized FlatList
  const renderHeader = () => (
    <View style={styles.headerSection}>
      {/* ── Stats Cards Row ── */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#ede9fe' }]}>
            <MaterialCommunityIcons name="account-group" size={20} color="#7c3aed" />
          </View>
          <View style={styles.statTextBox}>
            <Typography variant="h3" weight="extrabold" color="#0f172a">
              {users.length}
            </Typography>
            <Typography variant="label" weight="bold" color="#334155">
              TOTAL USERS
            </Typography>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#ecfdf5' }]}>
            <MaterialCommunityIcons name="pulse" size={20} color="#059669" />
          </View>
          <View style={styles.statTextBox}>
            <Typography variant="h3" weight="extrabold" color="#0f172a">
              {presence.activeVisitors || 0}
            </Typography>
            <Typography variant="label" weight="bold" color="#334155">
              VISITORS
            </Typography>
          </View>
        </Card>

        <Card style={styles.statCard}>
          <View style={[styles.statIconBox, { backgroundColor: '#eff6ff' }]}>
            <MaterialCommunityIcons name="account-check" size={20} color="#2563eb" />
          </View>
          <View style={styles.statTextBox}>
            <Typography variant="h3" weight="extrabold" color="#0f172a">
              {presence.activeCustomers || onlineCount}
            </Typography>
            <Typography variant="label" weight="bold" color="#334155">
              ONLINE
            </Typography>
          </View>
        </Card>
      </View>

      {/* ── Search Input ── */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color="#0f172a"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, email, phone or ID..."
          placeholderTextColor="#475569"
          value={searchTerm}
          onChangeText={setSearchTerm}
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#0f172a" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Pills ── */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterPill, filterTab === 'all' && styles.filterPillActive]}
          onPress={() => setFilterTab('all')}
        >
          <Typography
            variant="label"
            weight="extrabold"
            color={filterTab === 'all' ? '#ffffff' : '#0f172a'}
          >
            All ({users.length})
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filterTab === 'online' && styles.filterPillActive]}
          onPress={() => setFilterTab('online')}
        >
          <View style={[styles.pillDot, { backgroundColor: '#10b981' }]} />
          <Typography
            variant="label"
            weight="extrabold"
            color={filterTab === 'online' ? '#ffffff' : '#0f172a'}
          >
            Online ({onlineCount})
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filterTab === 'admin' && styles.filterPillActive]}
          onPress={() => setFilterTab('admin')}
        >
          <Typography
            variant="label"
            weight="extrabold"
            color={filterTab === 'admin' ? '#ffffff' : '#0f172a'}
          >
            Admins ({adminCount})
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, filterTab === 'user' && styles.filterPillActive]}
          onPress={() => setFilterTab('user')}
        >
          <Typography
            variant="label"
            weight="extrabold"
            color={filterTab === 'user' ? '#ffffff' : '#0f172a'}
          >
            Customers ({Math.max(0, users.length - adminCount)})
          </Typography>
        </TouchableOpacity>
      </View>

      {/* Section Header */}
      {!loading && !errorMessage && (
        <View style={styles.listHeaderRow}>
          <Typography variant="label" weight="extrabold" color="#0f172a">
            SHOWING {filteredUsers.length} OF {users.length} USERS
          </Typography>
        </View>
      )}
    </View>
  );

  // Modern Card UI with Delete Icon Button & Dark Typography
  const renderUserItem = ({ item: user }: { item: User }) => {
    const isOnline = activeUserIds.has(String(user.id));
    const isAdmin = String(user.role || '').toLowerCase() === 'admin';
    const isDeleting = deletingId === user.id;

    const initials = (user.username || 'U')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return (
      <View key={user.id} style={styles.userCard}>
        {/* Top Header: Avatar, Name, Role, ID & Delete Icon */}
        <View style={styles.userCardHeader}>
          <View style={styles.userMainInfo}>
            <View
              style={[
                styles.avatarCircle,
                isAdmin ? styles.avatarAdmin : styles.avatarUser,
              ]}
            >
              <Typography
                variant="body"
                weight="extrabold"
                color={isAdmin ? '#ffffff' : colors.primary}
              >
                {initials}
              </Typography>
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Typography variant="body" weight="extrabold" color="#0f172a" style={{ fontSize: 16 }}>
                  {user.username || 'Unnamed User'}
                </Typography>
                {isAdmin && (
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={17}
                    color={colors.primary}
                  />
                )}
              </View>

              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.roleBadge,
                    isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser,
                  ]}
                >
                  <Typography
                    variant="label"
                    weight="extrabold"
                    color={isAdmin ? '#ffffff' : '#0f172a'}
                    style={{ fontSize: 10, letterSpacing: 0.5 }}
                  >
                    {isAdmin ? 'ADMIN' : 'CUSTOMER'}
                  </Typography>
                </View>

                <View style={styles.idBadge}>
                  <Typography variant="label" weight="bold" color="#1e293b" style={{ fontSize: 11 }}>
                    ID #{user.id}
                  </Typography>
                </View>
              </View>
            </View>
          </View>

          {/* Delete Icon Button */}
          <TouchableOpacity
            style={styles.deleteIconButton}
            onPress={() => handleDeleteUser(user.id, user.username)}
            disabled={isDeleting}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#dc2626" />
            )}
          </TouchableOpacity>
        </View>

        {/* Status & Join Date Row */}
        <View style={styles.statusRow}>
          {isOnline ? (
            <View style={[styles.statusBadge, { backgroundColor: '#ecfdf5' }]}>
              <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
              <Typography variant="label" weight="extrabold" color="#047857">
                Active Now
              </Typography>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: '#f1f5f9' }]}>
              <View style={[styles.statusDot, { backgroundColor: '#475569' }]} />
              <Typography variant="label" weight="bold" color="#0f172a">
                Offline
              </Typography>
            </View>
          )}

          <View style={styles.joinDateWrap}>
            <MaterialCommunityIcons name="calendar-month-outline" size={14} color="#0f172a" />
            <Typography variant="label" weight="bold" color="#0f172a" style={{ marginLeft: 4 }}>
              Joined {formatDate(user.createdAt)}
            </Typography>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Contact Info Rows */}
        <View style={styles.contactDetails}>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleEmail(user.email)}
            disabled={!user.email}
            activeOpacity={0.7}
          >
            <View style={styles.contactIconWrap}>
              <MaterialCommunityIcons name="email-outline" size={16} color={colors.primary} />
            </View>
            <Typography
              variant="caption"
              weight="bold"
              color="#0f172a"
              style={styles.contactText}
              numberOfLines={1}
            >
              {user.email || 'No email registered'}
            </Typography>
            {user.email && (
              <MaterialCommunityIcons name="open-in-new" size={14} color="#0f172a" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleCall(user.phoneNumber)}
            disabled={!user.phoneNumber}
            activeOpacity={0.7}
          >
            <View style={[styles.contactIconWrap, { backgroundColor: '#dcfce7' }]}>
              <MaterialCommunityIcons name="phone-outline" size={16} color="#15803d" />
            </View>
            <Typography
              variant="caption"
              weight="bold"
              color="#0f172a"
              style={styles.contactText}
              numberOfLines={1}
            >
              {user.phoneNumber || 'No phone number'}
            </Typography>
            {user.phoneNumber && (
              <MaterialCommunityIcons name="phone" size={14} color="#15803d" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Top Bar ── */}
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View>
            <Typography variant="h2" weight="extrabold" color={colors.primary}>
              Users Directory
            </Typography>
            <Typography variant="caption" weight="bold" color="#0f172a" style={{ marginTop: 2 }}>
              Registered customers & administrators
            </Typography>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshIconBtn}
          onPress={onRefresh}
          disabled={loading || refreshing}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Main List / States ── */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Typography variant="body" weight="bold" color="#0f172a" style={{ marginTop: 12 }}>
            Loading users from backend...
          </Typography>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Card style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={44} color="#dc2626" />
            <Typography
              variant="h4"
              weight="extrabold"
              color="#991b1b"
              style={{ marginTop: 10, textAlign: 'center' }}
            >
              Could Not Load Users
            </Typography>
            <Typography
              variant="caption"
              weight="medium"
              color="#7f1d1d"
              style={{ marginTop: 6, textAlign: 'center' }}
            >
              {errorMessage}
            </Typography>
            <Button
              title="Try Again"
              variant="primary"
              size="small"
              onPress={() => fetchUsers(false)}
              style={{ marginTop: 16, minWidth: 120 }}
            />
          </Card>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderUserItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="account-search-outline" size={44} color="#0f172a" />
              <Typography
                variant="h4"
                weight="extrabold"
                color="#0f172a"
                style={{ marginTop: 10, textAlign: 'center' }}
              >
                No Users Found
              </Typography>
              <Typography
                variant="caption"
                weight="bold"
                color="#334155"
                style={{ marginTop: 4, textAlign: 'center' }}
              >
                {searchTerm
                  ? `No user matches "${searchTerm}"`
                  : 'No users registered yet.'}
              </Typography>
              {(searchTerm.length > 0 || filterTab !== 'all') && (
                <Button
                  title="Clear Filters"
                  variant="outline"
                  size="small"
                  onPress={() => {
                    setSearchTerm('');
                    setFilterTab('all');
                  }}
                  style={{ marginTop: 14 }}
                />
              )}
            </Card>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  refreshIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  listContent: {
    padding: 16,
    paddingBottom: 110,
  },
  headerSection: {
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextBox: {
    marginLeft: 8,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  centerContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fecaca',
    width: '100%',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#fff',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  userCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarAdmin: {
    backgroundColor: colors.primary,
  },
  avatarUser: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fee2e2',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  roleBadgeAdmin: {
    backgroundColor: colors.primary,
  },
  roleBadgeUser: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  idBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deleteIconButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  joinDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  contactDetails: {
    gap: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  contactIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
  },
});

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { api } from '../../src/api/api';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface User {
  id: number;
  username: string;
  email: string;
  phoneNumber?: string;
  role: string;
  createdAt: string;
}

interface Presence {
  activeVisitors: number;
  activeCustomers: number;
  activeUserIds: (number | string)[];
}

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [presence, setPresence] = useState<Presence>({ activeVisitors: 0, activeCustomers: 0, activeUserIds: [] });

  useEffect(() => {
    fetchUsers();
    fetchPresence();
    const interval = setInterval(fetchPresence, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/getUserData');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresence = async () => {
    try {
      const response = await api.get('/presence');
      if (response.data?.success) {
        setPresence(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching presence:', error);
    }
  };

  const handleDeleteUser = (userId: number) => {
    Alert.alert(
      'Delete User',
      'Are you sure you want to delete this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/user/${userId}`);
              if (response.data.success) {
                setUsers((prev) => prev.filter((user) => user.id !== userId));
                Alert.alert('Success', 'User deleted successfully');
              }
            } catch (error: any) {
              console.error(error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const activeUserIds = new Set((presence.activeUserIds || []).map(String));

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredUsers = users.filter((user) => {
    if (!normalizedSearch) return true;
    const phone = String(user.phoneNumber || '').toLowerCase();
    return (
      user.username?.toLowerCase().includes(normalizedSearch) ||
      user.email?.toLowerCase().includes(normalizedSearch) ||
      phone.includes(normalizedSearch)
    );
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Users' }} />

      <View style={styles.header}>
        <Typography variant="h2" weight="extrabold" color="#0f172a">User Management</Typography>
        <Typography variant="caption" color="#64748b" style={{ marginTop: 4 }}>
          Manage all registered users
        </Typography>
      </View>

      <Input
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder="Search name, email, or mobile..."
        style={styles.searchInput}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#8b5cf6' }]}>
              <MaterialCommunityIcons name="account-group" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Typography variant="h2" weight="bold" color="#4c1d95">{users.length}</Typography>
              <Typography variant="label" weight="bold" color="#6d28d9">TOTAL USERS</Typography>
            </View>
          </Card>

          <Card style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#10b981' }]}>
              <MaterialCommunityIcons name="pulse" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Typography variant="h2" weight="bold" color="#064e3b">{presence.activeVisitors || 0}</Typography>
              <Typography variant="label" weight="bold" color="#047857">VISITORS ONLINE</Typography>
            </View>
          </Card>
          
          <Card style={styles.statCard}>
            <View style={[styles.iconContainer, { backgroundColor: '#3b82f6' }]}>
              <MaterialCommunityIcons name="account-check" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Typography variant="h2" weight="bold" color="#1e3a8a">{presence.activeCustomers || 0}</Typography>
              <Typography variant="label" weight="bold" color="#1d4ed8">CUSTOMERS ONLINE</Typography>
            </View>
          </Card>
        </View>
      </ScrollView>

      <View style={styles.listHeader}>
        <Typography variant="label" weight="bold" color="#94a3b8">
          {filteredUsers.length} OF {users.length} USERS
        </Typography>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : filteredUsers.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Typography variant="body" weight="bold" color="#64748b" align="center">No Users Found</Typography>
        </Card>
      ) : (
        filteredUsers.map((user) => {
          const isActive = activeUserIds.has(String(user.id));
          return (
            <Card key={user.id} style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={{ flex: 1 }}>
                  <Typography variant="h4" weight="bold" color="#0f172a">{user.username}</Typography>
                  <Typography variant="caption" color="#64748b">ID: {user.id}</Typography>
                </View>
                <View style={[styles.roleBadge, user.role === 'admin' ? styles.roleAdmin : styles.roleUser]}>
                  <Typography 
                    variant="label" 
                    weight="bold" 
                    color={user.role === 'admin' ? '#fff' : '#334155'}
                  >
                    {user.role}
                  </Typography>
                </View>
              </View>

              <View style={styles.statusRow}>
                {isActive ? (
                  <View style={[styles.statusBadge, { backgroundColor: '#ecfdf5' }]}>
                    <View style={[styles.statusDot, { backgroundColor: '#10b981' }]} />
                    <Typography variant="label" weight="bold" color="#047857">Active now</Typography>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: '#f1f5f9' }]}>
                    <View style={[styles.statusDot, { backgroundColor: '#cbd5e1' }]} />
                    <Typography variant="label" weight="bold" color="#64748b">Offline</Typography>
                  </View>
                )}
              </View>

              <View style={styles.contactInfo}>
                <View style={styles.contactRow}>
                  <MaterialCommunityIcons name="email-outline" size={16} color="#94a3b8" />
                  <Typography variant="caption" color="#334155" style={{ marginLeft: 8 }}>{user.email}</Typography>
                </View>
                <View style={styles.contactRow}>
                  <MaterialCommunityIcons name="phone-outline" size={16} color="#94a3b8" />
                  <Typography variant="caption" color="#334155" style={{ marginLeft: 8 }}>{user.phoneNumber || '--'}</Typography>
                </View>
                <View style={styles.contactRow}>
                  <MaterialCommunityIcons name="calendar-blank-outline" size={16} color="#94a3b8" />
                  <Typography variant="caption" color="#334155" style={{ marginLeft: 8 }}>
                    {new Date(user.createdAt).toLocaleDateString('en-IN')}
                  </Typography>
                </View>
              </View>

              <Button 
                title="Delete User"
                variant="outline"
                size="small"
                onPress={() => handleDeleteUser(user.id)}
                style={styles.deleteButton}
                textStyle={{ color: '#ef4444' }}
              />
            </Card>
          );
        })
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 20 },
  searchInput: { backgroundColor: '#fff' },
  statsContainer: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, minWidth: 160 },
  iconContainer: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  listHeader: { alignItems: 'flex-end', marginBottom: 12 },
  loadingContainer: { padding: 40 },
  emptyCard: { padding: 40, backgroundColor: '#fff' },
  userCard: { marginBottom: 16, padding: 16 },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  roleAdmin: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  roleUser: { backgroundColor: '#f1f5f9', borderColor: '#cbd5e1' },
  statusRow: { marginTop: 12, marginBottom: 16 },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  contactInfo: { gap: 8, marginBottom: 20 },
  contactRow: { flexDirection: 'row', alignItems: 'center' },
  deleteButton: { borderColor: '#fecaca', backgroundColor: '#fef2f2', marginTop: 8 },
});

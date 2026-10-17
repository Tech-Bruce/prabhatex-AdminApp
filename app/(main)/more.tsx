import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { colors } from '../../src/theme/colors';

export default function MoreScreen() {
  const { logout } = useAuth();

  const menuItems = [
    { title: 'Live View', icon: 'access-point', onPress: () => router.push('/live-view') },
    { title: 'Manage Banners', icon: 'image-multiple', onPress: () => router.push('/banners') },
    { title: 'Categories', icon: 'shape-outline', onPress: () => router.push('/categories') },
    { title: 'Upload Labels', icon: 'cloud-upload-outline', onPress: () => router.push('/upload-labels') },
    { title: 'Product Inventory', icon: 'tag-multiple', onPress: () => router.push('/products') },
    { title: 'Upload Product', icon: 'cloud-upload', onPress: () => router.push('/product-editor') },
    { title: 'Users', icon: 'account-group', onPress: () => router.push('/users') },
    { title: 'Delivery Charges', icon: 'truck-delivery-outline', onPress: () => router.push('/delivery-charges') },
    { title: 'Product Reviews', icon: 'star-outline', onPress: () => router.push('/reviews') },
    { title: 'Google Reviews', icon: 'google', onPress: () => router.push('/google-reviews') },
    { title: 'Settings', icon: 'cog-outline', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Subtle background glow effect */}
      <View style={styles.backgroundGlow} />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerProfile}>
          <View style={styles.avatarContainer}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={{ width: '100%', height: '100%', borderRadius: 20 }} 
              resizeMode="contain"
            />
          </View>
          <View style={styles.profileText}>
            <Typography variant="h3" color="#ffffff">Prabha Executive</Typography>
            <Typography variant="caption" color={colors.secondary} style={styles.roleText}>ADMINISTRATOR DESK</Typography>
          </View>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="shield-check" size={18} color={colors.secondary} />
          </View>
        </View>

        <View style={styles.menuGroup}>
          <Typography variant="caption" color="#8c7a7a" style={styles.groupTitle}>OVERVIEW & CATALOG</Typography>
          <View style={styles.menuContainer}>
            {menuItems.slice(0, 6).map((item, index) => (
              <TouchableOpacity key={index} style={[styles.menuItem, index === 5 && styles.lastMenuItem]} activeOpacity={0.7} onPress={item.onPress}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconWrapper}>
                    <MaterialCommunityIcons name={item.icon as any} size={22} color={colors.secondary} />
                  </View>
                  <Typography variant="body" weight="semibold" style={styles.menuText}>{item.title}</Typography>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#4a3f3f" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.menuGroup}>
          <Typography variant="caption" color="#8c7a7a" style={styles.groupTitle}>CUSTOMERS & SETTINGS</Typography>
          <View style={styles.menuContainer}>
            {menuItems.slice(6).map((item, index) => (
              <TouchableOpacity key={index} style={[styles.menuItem, index === menuItems.slice(6).length - 1 && styles.lastMenuItem]} activeOpacity={0.7} onPress={item.onPress}>
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconWrapper}>
                    <MaterialCommunityIcons name={item.icon as any} size={22} color={colors.secondary} />
                  </View>
                  <Typography variant="body" weight="semibold" style={styles.menuText}>{item.title}</Typography>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#4a3f3f" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.8} onPress={logout}>
          <MaterialCommunityIcons name="logout" size={20} color="#ff4d4d" />
          <Typography variant="body" weight="bold" color="#ff4d4d" style={styles.logoutText}>Secure Sign Out</Typography>
        </TouchableOpacity>
        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0a0505' },
  backgroundGlow: {
    position: 'absolute',
    top: -150,
    left: -100,
    width: 400,
    height: 400,
    backgroundColor: '#850404',
    borderRadius: 200,
    opacity: 0.15,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
    paddingTop: 10,
  },
  headerProfile: {
    backgroundColor: 'rgba(133, 4, 4, 0.4)',
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 192, 33, 0.15)',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  avatarText: {
    fontWeight: '900',
    fontSize: 30,
  },
  profileText: {
    marginLeft: 16,
    flex: 1,
  },
  roleText: {
    marginTop: 4,
    letterSpacing: 2,
    fontWeight: '800',
    fontSize: 10,
  },
  headerBadge: {
    backgroundColor: 'rgba(245, 192, 33, 0.15)',
    padding: 8,
    borderRadius: 14,
  },
  menuGroup: {
    marginBottom: 20,
  },
  groupTitle: {
    marginLeft: 28,
    marginBottom: 8,
    letterSpacing: 1.5,
    fontWeight: '700',
    fontSize: 10,
  },
  menuContainer: {
    backgroundColor: 'rgba(28, 21, 21, 0.8)',
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 192, 33, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    marginLeft: 16,
    color: '#e5e7eb',
    fontSize: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 77, 77, 0.1)',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 77, 0.2)',
  },
  logoutText: {
    marginLeft: 8,
    letterSpacing: 0.5,
  }
});

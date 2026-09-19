import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { api } from '../../src/api/api';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Types for Banner
interface Banner {
  id: number;
  image: string;
  link: string | null;
  orderIndex: number;
}

export default function BannersScreen() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [bannerLink, setBannerLink] = useState('');

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await api.get('/getBanners');
      setBanners(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
      Alert.alert('Error', 'Failed to fetch banners');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const handleUpload = async () => {
    if (!image) {
      Alert.alert('Required', 'Please select a banner image first.');
      return;
    }

    const normalizedLink = bannerLink.trim();
    if (normalizedLink && !normalizedLink.startsWith('/') && !/^https?:\/\//i.test(normalizedLink)) {
      Alert.alert('Invalid Link', 'Enter a site path such as /all-products or a complete https:// link.');
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append('image', {
        uri: image.uri,
        name: image.fileName || 'banner.jpg',
        type: image.mimeType || 'image/jpeg',
      } as any);

      if (normalizedLink) {
        formData.append('link', normalizedLink);
      }

      await api.post('/uploadBanner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Banner uploaded successfully!');
      setImage(null);
      setBannerLink('');
      fetchBanners();
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to upload banner');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Banner',
      'Are you sure you want to delete this banner?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/deleteBanner/${id}`);
              Alert.alert('Success', 'Banner removed successfully!');
              setBanners((prev) => prev.filter((b) => b.id !== id));
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete banner');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Banners' }} />
        
        <View style={styles.header}>
        <Typography variant="h2" weight="extrabold" color="#111827">Homepage Banners</Typography>
        <Typography variant="body" color="#6b7280" style={{ marginTop: 6 }}>
          Upload and manage hero banners for the storefront to promote your products.
        </Typography>
      </View>

      <Card style={styles.uploadCard}>
        <Typography variant="h4" weight="bold" style={{ marginBottom: 8, color: '#111827' }}>Upload New Banner</Typography>
        <Typography variant="label" color="#6b7280" style={{ marginBottom: 20 }}>
          For optimal visual aesthetic, upload wide landscape dimensions (16:9).
        </Typography>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploading}>
          {image ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <View style={styles.changeImageOverlay}>
                <Ionicons name="camera-outline" size={24} color="#fff" />
                <Typography variant="label" weight="medium" color="#fff" style={{ marginTop: 4 }}>Change Image</Typography>
              </View>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="cloud-upload-outline" size={48} color="#850404" style={{ marginBottom: 12 }} />
              <Typography variant="body" weight="bold" color="#850404">Tap to Select Image</Typography>
              <Typography variant="label" color="#9ca3af" style={{ marginTop: 8 }}>JPG, PNG, WEBP (Max 5MB)</Typography>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Typography variant="label" weight="bold" color="#374151" style={{ marginBottom: 8 }}>
            Banner Destination (optional)
          </Typography>
          <Input
            value={bannerLink}
            onChangeText={setBannerLink}
            placeholder="e.g. /all-products or https://example.com"
            disabled={uploading}
          />
        </View>

        <Button 
          title={uploading ? 'Uploading...' : 'Publish Banner'} 
          onPress={handleUpload} 
          disabled={uploading || !image}
          style={styles.uploadButton}
        />
      </Card>

      <View style={styles.listHeader}>
        <Typography variant="h3" weight="bold" color="#111827">Active Banners</Typography>
        <View style={styles.countBadge}>
          <Typography variant="label" weight="bold" color="#850404">{banners.length} Banners</Typography>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#850404" />
        </View>
      ) : banners.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="images-outline" size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
          <Typography variant="h4" weight="bold" color="#374151" align="center">No Active Banners</Typography>
          <Typography variant="body" color="#6b7280" align="center" style={{ marginTop: 8, maxWidth: '80%' }}>
            Upload an image above to display hero promotions on your storefront.
          </Typography>
        </Card>
      ) : (
        banners.map((banner, index) => (
          <Card key={banner.id} style={styles.bannerCard}>
            <Image source={{ uri: banner.image }} style={styles.bannerImage} />
            <View style={styles.bannerDetails}>
              <View style={styles.bannerInfo}>
                <Typography variant="body" weight="bold" color="#111827">Banner #{index + 1}</Typography>
                {banner.link ? (
                  <View style={styles.linkContainer}>
                    <Ionicons name="link-outline" size={14} color="#850404" style={{ marginRight: 4 }} />
                    <Typography variant="label" color="#850404" numberOfLines={1} style={{ flex: 1 }}>
                      {banner.link}
                    </Typography>
                  </View>
                ) : (
                  <View style={styles.linkContainer}>
                    <Ionicons name="home-outline" size={14} color="#6b7280" style={{ marginRight: 4 }} />
                    <Typography variant="label" color="#6b7280">Storefront Hero</Typography>
                  </View>
                )}
              </View>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={() => handleDelete(banner.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#dc2626" />
              </TouchableOpacity>
            </View>
          </Card>
        ))
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
    marginTop: 12,
  },
  uploadCard: {
    marginBottom: 32,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  imagePicker: {
    height: 200,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    marginBottom: 24,
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeImageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
  },
  inputGroup: {
    marginBottom: 24,
  },
  uploadButton: {
    backgroundColor: '#850404',
    borderRadius: 12,
    paddingVertical: 14,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  countBadge: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyCard: {
    paddingVertical: 60,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 16,
  },
  bannerCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  bannerImage: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
    backgroundColor: '#f3f4f6',
  },
  bannerDetails: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  bannerInfo: {
    flex: 1,
    paddingRight: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
});


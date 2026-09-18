import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { api } from '../../src/api/api';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { Stack } from 'expo-router';

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
        <Typography variant="caption" color="#6b7280" style={{ marginTop: 4 }}>
          Upload and manage hero banners for the storefront.
        </Typography>
      </View>

      <Card style={styles.uploadCard}>
        <Typography variant="h4" weight="bold" style={{ marginBottom: 8 }}>Upload New Banner</Typography>
        <Typography variant="label" color="#6b7280" style={{ marginBottom: 16 }}>
          For optimal visual aesthetic, upload wide landscape dimensions (16:9).
        </Typography>

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} disabled={uploading}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholder}>
              <Typography variant="body" weight="medium" color="#850404">✦ Tap to Select Image</Typography>
              <Typography variant="label" color="#9ca3af" style={{ marginTop: 4 }}>JPG, PNG, WEBP</Typography>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Typography variant="label" weight="bold" color="#374151" style={{ marginBottom: 6 }}>
            Banner destination (optional)
          </Typography>
          <Input
            value={bannerLink}
            onChangeText={setBannerLink}
            placeholder="/all-products or https://example.com"
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
        <Typography variant="h3" weight="bold">Active Banners</Typography>
        <View style={styles.countBadge}>
          <Typography variant="label" weight="bold" color="#4b5563">Total: {banners.length}</Typography>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#850404" />
        </View>
      ) : banners.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Typography variant="body" weight="bold" color="#6b7280" align="center">No active homepage banners</Typography>
          <Typography variant="caption" color="#9ca3af" align="center" style={{ marginTop: 4 }}>
            Upload an image above to display hero promotions.
          </Typography>
        </Card>
      ) : (
        banners.map((banner) => (
          <Card key={banner.id} style={styles.bannerCard}>
            <Image source={{ uri: banner.image }} style={styles.bannerImage} />
            <View style={styles.bannerDetails}>
              <View style={{ flex: 1 }}>
                <Typography variant="caption" weight="extrabold">Banner #{banner.id}</Typography>
                {banner.link ? (
                  <Typography variant="label" color="#850404" style={{ marginTop: 4 }} numberOfLines={1}>
                    Links to: {banner.link}
                  </Typography>
                ) : (
                  <Typography variant="label" color="#6b7280" style={{ marginTop: 4 }}>Storefront Hero</Typography>
                )}
              </View>
              <Button 
                title="Delete" 
                variant="outline" 
                size="small" 
                onPress={() => handleDelete(banner.id)} 
                textStyle={{ color: '#dc2626' }}
                style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
              />
            </View>
          </Card>
        ))
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f7f4' },
  container: {
    flex: 1,
    backgroundColor: '#f8f7f4',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    marginTop: 8,
  },
  uploadCard: {
    marginBottom: 32,
  },
  imagePicker: {
    height: 180,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  uploadButton: {
    backgroundColor: '#850404',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  countBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyCard: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderStyle: 'dashed',
  },
  bannerCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
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
    backgroundColor: '#fdfdfc',
  },
});

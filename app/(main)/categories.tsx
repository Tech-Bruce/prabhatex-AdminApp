import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { api } from '../../src/api/api';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Category {
  id: number;
  category: string;
  categoryImage: string;
}

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      // Adding timestamp to prevent caching as done in web hook
      const res = await api.get(`/getCategory?t=${new Date().getTime()}`);
      if (res.data.success) {
        const sortedData = (res.data.data || []).sort((a: Category, b: Category) => b.id - a.id);
        setCategories(sortedData);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert('Error', 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCategoryName('');
    setImageUri(null);
  };

  const handleEditClick = (cat: Category) => {
    setEditingId(cat.id);
    setCategoryName(cat.category);
    setImageUri(null); // Keep null to signify no new image is selected unless chosen
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/deleteCategory/${id}`);
              if (res.data.success) {
                setCategories((prev) => prev.filter((c) => c.id !== id));
                Alert.alert('Success', 'Category deleted successfully');
                if (editingId === id) resetForm();
              }
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Validation Error', 'Category name is required.');
      return;
    }
    if (!editingId && !imageUri) {
      Alert.alert('Validation Error', 'Please select an image for the new category.');
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append('category', categoryName);

      if (imageUri) {
        const localUri = imageUri;
        const filename = localUri.split('/').pop() || 'category.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('categoryImage', { uri: localUri, name: filename, type } as any);
      }

      const isUpdate = !!editingId;
      const endpoint = isUpdate ? `/updateCategory/${editingId}` : '/createCategory';
      
      const res = isUpdate 
        ? await api.put(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

      if (res.data.success) {
        Alert.alert('Success', isUpdate ? 'Category updated!' : 'Category created!');
        resetForm();
        fetchCategories(); // Reload the list
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Categories' }} />
        
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Typography variant="h2" weight="extrabold" color="#111827">Category Management</Typography>
            <View style={styles.badge}>
              <Typography variant="label" weight="bold" color="#850404" style={{ fontSize: 10 }}>INVENTORY</Typography>
            </View>
          </View>
          <Typography variant="caption" color="#6b7280" style={{ marginTop: 4 }}>
            Organize and structure product catalog collections.
          </Typography>
        </View>

        <Card style={styles.uploadCard}>
          <View style={styles.uploadCardHeader}>
            <LinearGradient colors={['#850404', '#f5c021']} style={styles.iconBox}>
              <MaterialCommunityIcons name={editingId ? "pencil" : "plus"} size={24} color="#fff" />
            </LinearGradient>
            <View style={{ marginLeft: 12 }}>
              <Typography variant="h3" weight="bold" color="#111827">
                {editingId ? "Update Category" : "Create New Category"}
              </Typography>
              <Typography variant="caption" color="#6b7280">
                Define designation and upload a thumbnail
              </Typography>
            </View>
          </View>

          <Input
            label="Category Designation"
            value={categoryName}
            onChangeText={setCategoryName}
            placeholder="Ex: Traditional Silk Sarees"
            editable={!submitting}
          />

          <Typography variant="label" color="#374151" style={{ marginTop: 12, marginBottom: 8, fontWeight: '700' }}>
            Thumbnail Visual {editingId && <Typography variant="caption" color="#9ca3af">(optional on edit)</Typography>}
          </Typography>
          <TouchableOpacity onPress={pickImage} disabled={submitting} style={styles.imagePickerBtn}>
            <MaterialCommunityIcons name="image-outline" size={20} color={imageUri ? "#850404" : "#9ca3af"} />
            <Typography variant="body" color={imageUri ? "#850404" : "#6b7280"} style={{ marginLeft: 8, flex: 1 }} numberOfLines={1}>
              {imageUri ? 'Image Selected' : 'Choose file...'}
            </Typography>
            <View style={styles.browseBadge}>
              <Typography variant="label" weight="bold" color="#374151">BROWSE</Typography>
            </View>
          </TouchableOpacity>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          )}

          <View style={styles.actionRow}>
            {editingId && (
              <Button
                title="Cancel"
                variant="outline"
                onPress={resetForm}
                disabled={submitting}
                style={{ flex: 1, marginRight: 8 }}
              />
            )}
            <Button
              title={submitting ? "Saving..." : (editingId ? "Save Changes" : "Publish Category")}
              onPress={handleSubmit}
              disabled={submitting}
              style={{ flex: 2, backgroundColor: '#850404' }}
            />
          </View>
        </Card>

        <View style={styles.listHeader}>
          <Typography variant="h3" weight="bold" color="#111827">Active Categories ({categories.length})</Typography>
          <TouchableOpacity onPress={fetchCategories} disabled={loading} style={styles.refreshBtn}>
            <MaterialCommunityIcons name="refresh" size={16} color="#6b7280" />
            <Typography variant="label" weight="bold" color="#6b7280" style={{ marginLeft: 4 }}>REFRESH</Typography>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#111827" />
          </View>
        ) : categories.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="folder-outline" size={48} color="#d1d5db" />
            <Typography variant="h4" weight="bold" color="#4b5563" style={{ marginTop: 12 }}>No Categories Found</Typography>
            <Typography variant="caption" color="#6b7280" style={{ marginTop: 4 }}>Create your first merchandise category above.</Typography>
          </Card>
        ) : (
          <View style={styles.grid}>
            {categories.map((cat) => (
              <Card key={cat.id} style={styles.catCard}>
                <Image source={{ uri: cat.categoryImage }} style={styles.catImage} />
                <View style={styles.catContent}>
                  <Typography variant="body" weight="bold" color="#111827" numberOfLines={1}>{cat.category}</Typography>
                  
                  <View style={styles.catActions}>
                    <TouchableOpacity onPress={() => handleEditClick(cat)} style={[styles.actionBtn, { borderColor: '#d1d5db', borderWidth: 1 }]}>
                      <MaterialCommunityIcons name="pencil" size={16} color="#374151" />
                      <Typography variant="label" weight="bold" color="#374151" style={{ marginLeft: 4 }}>Edit</Typography>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(cat.id)} style={[styles.actionBtn, { backgroundColor: '#fff1f2', borderColor: '#fecdd3', borderWidth: 1 }]}>
                      <MaterialCommunityIcons name="delete" size={16} color="#e11d48" />
                      <Typography variant="label" weight="bold" color="#e11d48" style={{ marginLeft: 4 }}>Delete</Typography>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>
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
    marginBottom: 20,
  },
  badge: {
    backgroundColor: 'rgba(133, 4, 4, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(133, 4, 4, 0.2)',
  },
  uploadCard: {
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  uploadCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 16,
  },
  browseBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  loadingContainer: {
    padding: 40,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  catCard: {
    width: '100%',
    padding: 0,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  catImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f3f4f6',
  },
  catContent: {
    padding: 16,
  },
  catActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 8,
  }
});

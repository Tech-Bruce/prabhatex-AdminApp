import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, TextInput, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { api } from '../../src/api/api';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProductEditorScreen() {
  const { id } = useLocalSearchParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [categories, setCategories] = useState<any[]>([]);

  const [form, setForm] = useState({
    productName: '',
    sku: '',
    price: '',
    finalPrice: '',
    stockQuantity: '',
    weight: '',
    type: 'None',
    categoryId: '',
    productDescription: ''
  });

  const [imagesList, setImagesList] = useState<{ url: string, file: any }[]>([]);
  const [globalSizes, setGlobalSizes] = useState<{ size: string, stock: string }[]>([]);
  
  const [newSize, setNewSize] = useState('');
  const [newStock, setNewStock] = useState('');

  // COLORS / VARIANTS
  const [colors, setColors] = useState<{ name: string, imagesList: { url: string, file: any }[], stockQuantity: number, sizes: { size: string, stock: string }[] }[]>([]);
  const [newColorName, setNewColorName] = useState('');

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  useEffect(() => {
    fetchCategories();
    if (isEdit) {
      fetchProductData(id as string);
    }
  }, [id]);

  const fetchCategories = async () => {
    try {
      const res = await api.get(`/getCategory?t=${Date.now()}`);
      if (res.data.success) setCategories(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const fetchProductData = async (productId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/getProductById/${productId}`);
      if (res.data.success && res.data.data) {
        const p = res.data.data;
        setForm({
          productName: p.productName || '',
          sku: p.sku || '',
          price: String(p.price || ''),
          finalPrice: String(p.finalPrice || ''),
          stockQuantity: String(p.stockQuantity || ''),
          weight: String(p.weight || ''),
          type: p.type || 'None',
          categoryId: String(p.categoryId || ''),
          productDescription: p.productDescription || ''
        });
        
        if (p.productImages) {
          setImagesList(p.productImages.map((url: string) => ({ url, file: null })));
        }
        if (p.sizes) {
          setGlobalSizes(p.sizes.map((s: any) => ({ size: s.size, stock: String(s.stock) })));
        }
        if (p.colors) {
          setColors(p.colors.map((c: any) => ({
            name: c.color || c.name,
            imagesList: (c.images || []).map((url: string) => ({ url, file: null })),
            stockQuantity: c.stockQuantity || 0,
            sizes: (c.sizes || []).map((s: any) => ({ size: s.size, stock: String(s.stock) }))
          })));
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch product details');
    } finally {
      setLoading(false);
    }
  };

  const pickImages = async (isColor: boolean, colorIndex?: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImgs = result.assets.map(asset => ({
        url: asset.uri,
        file: { uri: asset.uri, type: 'image/jpeg', name: asset.uri.split('/').pop() || 'image.jpg' }
      }));
      
      if (isColor && colorIndex !== undefined) {
        setColors(prev => {
          const next = [...prev];
          next[colorIndex].imagesList = [...next[colorIndex].imagesList, ...newImgs];
          return next;
        });
      } else {
        setImagesList(prev => [...prev, ...newImgs]);
      }
    }
  };

  const removeImage = (isColor: boolean, imgIndex: number, colorIndex?: number) => {
    if (isColor && colorIndex !== undefined) {
      setColors(prev => {
        const next = [...prev];
        next[colorIndex].imagesList = next[colorIndex].imagesList.filter((_, i) => i !== imgIndex);
        return next;
      });
    } else {
      setImagesList(prev => prev.filter((_, i) => i !== imgIndex));
    }
  };

  const syncGlobalStock = (sizesArray: {size: string, stock: string}[]) => {
    const total = sizesArray.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
    setForm(prev => ({ ...prev, stockQuantity: String(total) }));
  };

  const addGlobalSize = () => {
    if (!newSize.trim() || !newStock.trim()) return Alert.alert('Error', 'Please enter size and stock');
    const next = [...globalSizes, { size: newSize.trim(), stock: newStock.trim() }];
    setGlobalSizes(next);
    syncGlobalStock(next);
    setNewSize(''); setNewStock('');
  };

  const removeGlobalSize = (index: number) => {
    const next = globalSizes.filter((_, i) => i !== index);
    setGlobalSizes(next);
    syncGlobalStock(next);
  };

  const addColorVariant = () => {
    if (!newColorName.trim()) return Alert.alert('Error', 'Please enter a color name');
    setColors(prev => [...prev, { name: newColorName.trim(), imagesList: [], stockQuantity: 0, sizes: [] }]);
    setNewColorName('');
  };
  const removeColorVariant = (index: number) => setColors(prev => prev.filter((_, i) => i !== index));

  const addColorSize = (colorIndex: number) => {
    if (!newSize.trim() || !newStock.trim()) return Alert.alert('Error', 'Please enter size and stock for color');
    setColors(prev => {
      const next = [...prev];
      next[colorIndex].sizes.push({ size: newSize.trim(), stock: newStock.trim() });
      next[colorIndex].stockQuantity = next[colorIndex].sizes.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
      return next;
    });
    setNewSize(''); setNewStock('');
  };

  const handleSave = async () => {
    if (!form.productName.trim()) return Alert.alert('Error', 'Product Name is required');
    if (!form.sku.trim()) return Alert.alert('Error', 'SKU is required');
    if (!form.price) return Alert.alert('Error', 'Base Price is required');
    if (!form.categoryId) return Alert.alert('Error', 'Category is required');
    if (!isEdit && imagesList.length === 0) return Alert.alert('Error', 'Primary image is required');

    setSaving(true);
    try {
      const fd = new FormData();
      Object.keys(form).forEach(k => fd.append(k, form[k as keyof typeof form]));

      // Primary Images exactly as web app
      const newFiles = imagesList.filter(item => item.file !== null).map(item => item.file);
      const existingUrls = imagesList.filter(item => item.file === null).map(item => item.url);
      newFiles.forEach(img => fd.append("images", img as any));
      fd.append("existingProductImages", JSON.stringify(existingUrls));

      // Color Variants exactly as web app
      const colorMeta = colors.map(c => {
        const newColorFiles = c.imagesList.filter(item => item.file !== null).map(item => item.file);
        const existingColorUrls = c.imagesList.filter(item => item.file === null).map(item => item.url);
        newColorFiles.forEach(img => fd.append("color_images", img as any));
        return {
          name: c.name,
          imageCount: newColorFiles.length,
          existingImages: existingColorUrls,
          stockQuantity: c.stockQuantity || 0,
          sizes: c.sizes.map(s => ({ size: s.size, stock: Number(s.stock) }))
        };
      });
      fd.append("colors", JSON.stringify(colorMeta));
      fd.append("sizes", JSON.stringify(globalSizes.map(s => ({ size: s.size, stock: Number(s.stock) }))));

      if (isEdit) {
        await api.put(`/${id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        Alert.alert('Success', 'Product updated', [{ text: 'OK', onPress: () => router.back() }]);
      } else {
        await api.post('/uploadProduct', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        Alert.alert('Success', 'Product created', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#0f172a" /></View>;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ title: isEdit ? 'Edit Product' : 'Create Product' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* HEADER */}
        <View style={{ marginBottom: 24 }}>
          <Typography variant="caption" weight="bold" color="#6366f1" style={{ letterSpacing: 1, marginBottom: 4 }}>PRODUCT CATALOGUE</Typography>
          <Typography variant="h2" weight="extrabold" color="#0f172a">{isEdit ? 'Edit Product' : 'Create Product'}</Typography>
          <Typography variant="body" color="#64748b" style={{ marginTop: 4 }}>Add product details, inventory, variants, and images.</Typography>
        </View>

        {/* 1. PRODUCT IDENTITY */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}><Typography variant="label" weight="bold" color="#4f46e5">1</Typography></View>
            <View style={styles.sectionHeaderText}>
              <Typography variant="h3" weight="bold" color="#0f172a">Product Identity</Typography>
              <Typography variant="caption" color="#64748b">Name and unique SKU code</Typography>
            </View>
          </View>
          <View style={styles.formGroup}>
            <View style={styles.inputWrap}>
              <Input label="PRODUCT NAME *" value={form.productName} onChangeText={(t) => setForm(p => ({...p, productName: t}))} placeholder="Ex: Premium Silk Saree" />
            </View>
            <View style={styles.inputWrap}>
              <Input label="SKU CODE *" value={form.sku} onChangeText={(t) => setForm(p => ({...p, sku: t}))} placeholder="TX-2024-001" />
            </View>
          </View>
        </Card>

        {/* 2. PRICING & INVENTORY */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}><Typography variant="label" weight="bold" color="#4f46e5">2</Typography></View>
            <View style={styles.sectionHeaderText}>
              <Typography variant="h3" weight="bold" color="#0f172a">Pricing & Inventory</Typography>
              <Typography variant="caption" color="#64748b">Set prices and manage stock</Typography>
            </View>
          </View>
          <View style={styles.formGroup}>
            <View style={styles.inputWrap}>
              <Input label="BASE PRICE *" value={form.price} onChangeText={(t) => setForm(p => ({...p, price: t}))} keyboardType="numeric" placeholder="0.00" />
            </View>
            <View style={styles.inputWrap}>
              <Input label="SELLING PRICE" value={form.finalPrice} onChangeText={(t) => setForm(p => ({...p, finalPrice: t}))} keyboardType="numeric" placeholder="0.00" />
            </View>
            <View style={styles.inputWrap}>
              <Input label="STOCK QTY *" value={form.stockQuantity} onChangeText={(t) => setForm(p => ({...p, stockQuantity: t}))} keyboardType="numeric" placeholder="0" />
            </View>
            <View style={styles.inputWrap}>
              <Input label="COLLECTION" value={form.type} onChangeText={(t) => setForm(p => ({...p, type: t}))} placeholder="Ex: Summer" />
            </View>
            <View style={styles.inputWrap}>
              <Input label="PRODUCT WEIGHT (G)" value={form.weight} onChangeText={(t) => setForm(p => ({...p, weight: t}))} keyboardType="numeric" placeholder="e.g. 500" />
            </View>
            
            <View style={styles.subSection}>
              <Typography variant="body" weight="bold" color="#0f172a">Size inventory</Typography>
              <Typography variant="caption" color="#64748b" style={{ marginBottom: 16 }}>Add each available size with its specific sellable quantity.</Typography>
              
              {globalSizes.map((s, i) => (
                <View key={i} style={styles.sizeRow}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="body" weight="bold" color="#0f172a">{s.size}</Typography>
                  </View>
                  <View style={styles.stockBadge}>
                    <Typography variant="caption" weight="bold" color="#475569">Qty: {s.stock}</Typography>
                  </View>
                  <TouchableOpacity onPress={() => removeGlobalSize(i)} style={styles.removeSizeBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addSizeRow}>
                <TextInput placeholder="Size (e.g. XL)" value={newSize} onChangeText={setNewSize} style={styles.sizeInput} />
                <TextInput placeholder="Qty" value={newStock} onChangeText={setNewStock} keyboardType="numeric" style={styles.stockInput} />
                <TouchableOpacity onPress={addGlobalSize} style={styles.addSizeActionBtn}>
                  <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                  <Typography variant="label" weight="bold" color="#fff" style={{ marginLeft: 4 }}>Add size</Typography>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Card>

        {/* 3. CLASSIFICATION */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}><Typography variant="label" weight="bold" color="#4f46e5">3</Typography></View>
            <View style={styles.sectionHeaderText}>
              <Typography variant="h3" weight="bold" color="#0f172a">Classification</Typography>
              <Typography variant="caption" color="#64748b">Assign product to a category</Typography>
            </View>
          </View>
          <View style={styles.formGroup}>
            <Typography variant="label" weight="bold" color="#475569" style={{ marginBottom: 8, marginLeft: 4 }}>
              CATEGORY <Text style={{ color: '#ef4444' }}>*</Text>
            </Typography>
            <TouchableOpacity 
              style={styles.dropdownSelector} 
              onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              <Typography variant="body" color={form.categoryId ? "#0f172a" : "#94a3b8"}>
                {form.categoryId ? categories.find(c => String(c.id) === form.categoryId)?.category || 'Select a category...' : 'Select a category...'}
              </Typography>
              <MaterialCommunityIcons name={showCategoryDropdown ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
            </TouchableOpacity>

            {showCategoryDropdown && (
              <ScrollView style={styles.dropdownList} nestedScrollEnabled={true}>
                {categories.map(cat => (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={[styles.dropdownItem, form.categoryId === String(cat.id) && styles.dropdownItemActive]}
                    onPress={() => {
                      setForm(p => ({...p, categoryId: String(cat.id)}));
                      setShowCategoryDropdown(false);
                    }}
                  >
                    <Typography variant="body" weight={form.categoryId === String(cat.id) ? "bold" : "normal"} color={form.categoryId === String(cat.id) ? "#4f46e5" : "#334155"}>
                      {cat.category}
                    </Typography>
                    {form.categoryId === String(cat.id) && <MaterialCommunityIcons name="check" size={18} color="#4f46e5" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </Card>

        {/* 4. DESCRIPTION */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}><Typography variant="label" weight="bold" color="#4f46e5">4</Typography></View>
            <View style={styles.sectionHeaderText}>
              <Typography variant="h3" weight="bold" color="#0f172a">Product Description</Typography>
              <Typography variant="caption" color="#64748b">Describe material, occasion, care</Typography>
            </View>
          </View>
          <View style={styles.formGroup}>
            <Input label="DESCRIPTION" value={form.productDescription} onChangeText={(t) => setForm(p => ({...p, productDescription: t}))} multiline style={styles.textArea} placeholder="Material, occasion, care instructions, dimensions..." />
          </View>
        </Card>

        {/* 5. COLOR VARIANTS */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}><Typography variant="label" weight="bold" color="#4f46e5">5</Typography></View>
            <View style={styles.sectionHeaderText}>
              <Typography variant="h3" weight="bold" color="#0f172a">Color Variants</Typography>
              <Typography variant="caption" color="#64748b">Add color options with images</Typography>
            </View>
          </View>
          <View style={styles.formGroup}>
            {colors.map((color, cIdx) => (
              <View key={cIdx} style={styles.colorVariantBox}>
                <View style={styles.colorVariantHeader}>
                  <Typography variant="body" weight="bold" color="#0f172a">{color.name}</Typography>
                  <TouchableOpacity onPress={() => removeColorVariant(cIdx)} style={styles.deleteVariantBtn}>
                    <MaterialCommunityIcons name="close" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorImagesScroller}>
                  {color.imagesList.map((img, iIdx) => (
                    <View key={iIdx} style={styles.imageWrapSm}>
                      <Image source={{ uri: img.url }} style={styles.imagePreview} />
                      <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(true, iIdx, cIdx)}><MaterialCommunityIcons name="close" size={14} color="#fff" /></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addImgBtnSm} onPress={() => pickImages(true, cIdx)}>
                    <MaterialCommunityIcons name="camera-plus" size={18} color="#64748b" />
                  </TouchableOpacity>
                </ScrollView>

                {color.sizes.map((s, sIdx) => (
                  <View key={sIdx} style={[styles.sizeRow, styles.sizeRowInner]}>
                    <Typography variant="body" weight="bold" style={{ flex: 1 }} color="#0f172a">{s.size}</Typography>
                    <View style={styles.stockBadgeInner}>
                      <Typography variant="caption" color="#475569">Qty: {s.stock}</Typography>
                    </View>
                  </View>
                ))}
                
                <View style={styles.addSizeRowInner}>
                  <TextInput placeholder="Size" value={newSize} onChangeText={setNewSize} style={[styles.sizeInput, styles.inputSmall]} />
                  <TextInput placeholder="Qty" value={newStock} onChangeText={setNewStock} keyboardType="numeric" style={[styles.stockInput, styles.inputSmall]} />
                  <TouchableOpacity onPress={() => addColorSize(cIdx)} style={styles.addSizeActionBtnSm}>
                    <Typography variant="label" weight="bold" color="#4f46e5">Add</Typography>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.addColorBox}>
              <TextInput placeholder="Color name (e.g. Midnight Blue)" value={newColorName} onChangeText={setNewColorName} style={styles.colorNameInput} />
              <TouchableOpacity onPress={addColorVariant} style={styles.addColorBtn}>
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Typography variant="label" weight="bold" color="#fff" style={{ marginLeft: 4 }}>Add Color</Typography>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* 6. PRIMARY IMAGES */}
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.stepBadge}><Typography variant="label" weight="bold" color="#4f46e5">6</Typography></View>
            <View style={styles.sectionHeaderText}>
              <Typography variant="h3" weight="bold" color="#0f172a">Primary Images</Typography>
              <Typography variant="caption" color="#64748b">Main product photos shown in listings</Typography>
            </View>
          </View>

          
          <View style={styles.uploadArea}>
            <View style={styles.uploadCircle}>
              <MaterialCommunityIcons name="cloud-upload" size={24} color="#4f46e5" />
            </View>
            <Typography variant="body" weight="bold" color="#1e293b" style={{ marginTop: 12 }}>Tap here to upload</Typography>
            <Typography variant="caption" color="#64748b" style={{ marginTop: 4 }}>PNG, JPG, WEBP • Max 10 files</Typography>
            <TouchableOpacity onPress={() => pickImages(false)} style={styles.browseBtn}>
              <Typography variant="label" weight="bold" color="#0f172a">Browse Files</Typography>
            </TouchableOpacity>
          </View>

          {imagesList.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }}>
              {imagesList.map((img, idx) => (
                <View key={idx} style={styles.imageWrap}>
                  <Image source={{ uri: img.url }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImgBtn} onPress={() => removeImage(false, idx)}>
                    <MaterialCommunityIcons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>

        <TouchableOpacity 
          onPress={handleSave} 
          disabled={saving}
          style={styles.publishBtn}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Typography variant="body" weight="bold" color="#fff" style={{ marginLeft: 8 }}>{isEdit ? "Update Product" : "Publish Product"}</Typography>
            </>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 60 },
  
  sectionCard: { padding: 20, marginBottom: 20, borderRadius: 16, backgroundColor: '#ffffff', shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#f1f5f9' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sectionHeaderText: { flex: 1 },
  stepBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e0e7ff' },
  
  formGroup: { marginTop: 20 },
  inputWrap: { marginBottom: 12 },
  
  responsiveRow: { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  flexHalf: { flexBasis: '48%', flexGrow: 1, minWidth: 130 },
  
  subSection: { marginTop: 8, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  
  textArea: { height: 120, textAlignVertical: 'top' },
  
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: '#cbd5e1' },
  dropdownList: { marginTop: 8, backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#94a3b8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3, maxHeight: 200 },
  dropdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemActive: { backgroundColor: '#eef2ff' },
  
  sizeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  sizeRowInner: { backgroundColor: '#ffffff', paddingVertical: 10, marginBottom: 8 },
  stockBadge: { backgroundColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  stockBadgeInner: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  removeSizeBtn: { marginLeft: 16, padding: 4 },
  
  addSizeRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  addSizeRowInner: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  sizeInput: { flex: 2, minWidth: 100, backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: '#cbd5e1' },
  stockInput: { flex: 1, minWidth: 70, backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: '#cbd5e1' },
  inputSmall: { height: 42 },
  
  addSizeActionBtn: { backgroundColor: '#4f46e5', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 10, height: 48, flexGrow: 1 },
  addSizeActionBtnSm: { backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, borderRadius: 10, height: 42 },
  
  colorVariantBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  colorVariantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  deleteVariantBtn: { backgroundColor: '#fee2e2', padding: 6, borderRadius: 20 },
  colorImagesScroller: { marginBottom: 16 },
  
  addColorBox: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  colorNameInput: { flex: 2, minWidth: 150, backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: '#cbd5e1' },
  addColorBtn: { backgroundColor: '#4f46e5', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 10, height: 50, flexGrow: 1 },
  
  uploadArea: { alignItems: 'center', padding: 32, borderRadius: 16, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', backgroundColor: '#f8fafc', marginTop: 16 },
  uploadCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  browseBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  
  imageWrap: { width: 88, height: 88, borderRadius: 12, marginRight: 12, backgroundColor: '#e2e8f0', overflow: 'hidden', borderWidth: 1, borderColor: '#cbd5e1' },
  imageWrapSm: { width: 64, height: 64, borderRadius: 10, marginRight: 10, backgroundColor: '#e2e8f0', overflow: 'hidden', borderWidth: 1, borderColor: '#cbd5e1' },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  removeImgBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  
  addImgBtnSm: { width: 64, height: 64, borderRadius: 10, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  
  publishBtn: { backgroundColor: '#4f46e5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 16, marginTop: 12, shadowColor: '#4f46e5', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }
});

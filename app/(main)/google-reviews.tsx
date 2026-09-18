import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { api } from '../../src/api/api';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

interface GoogleReview {
  id: number;
  name: string;
  rating: number;
  review: string;
}

const EMPTY_FORM = { name: '', review: '', rating: 5 };

export default function GoogleReviewsScreen() {
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/google-reviews');
      setReviews(response.data?.data || []);
    } catch (error) {
      console.error('Error fetching google reviews:', error);
      Alert.alert('Error', 'Failed to load Google reviews');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.review.trim()) {
      Alert.alert('Validation', 'Name and review text are required.');
      return;
    }
    
    try {
      setSaving(true);
      const response = editingId
        ? await api.put(`/google-reviews/${editingId}`, form)
        : await api.post('/google-reviews', form);
        
      const saved = response.data?.data;
      
      setReviews((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? saved : item))
          : [saved, ...current]
      );
      
      Alert.alert('Success', editingId ? 'Google review updated' : 'Google review added');
      resetForm();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to save Google review');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: GoogleReview) => {
    setEditingId(item.id);
    setForm({ name: item.name, review: item.review, rating: item.rating });
  };

  const removeReview = (item: GoogleReview) => {
    Alert.alert(
      'Delete Review',
      `Delete the review from ${item.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/google-reviews/${item.id}`);
              setReviews((current) => current.filter((r) => r.id !== item.id));
              if (editingId === item.id) resetForm();
              Alert.alert('Success', 'Google review deleted');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete Google review');
            }
          },
        },
      ]
    );
  };

  const renderStars = (rating: number, interactive = false) => {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity 
            key={star} 
            disabled={!interactive}
            onPress={() => interactive && setForm({ ...form, rating: star })}
          >
            <MaterialCommunityIcons
              name="star"
              size={24}
              color={star <= rating ? '#fbbf24' : '#e2e8f0'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Google Reviews' }} />

      <View style={styles.header}>
        <Typography variant="h2" weight="extrabold" color="#0f172a">Google Reviews</Typography>
        <Typography variant="caption" color="#64748b" style={{ marginTop: 4 }}>
          Manage the reviews shown as notifications on the storefront.
        </Typography>
      </View>

      <Card style={styles.formCard}>
        <View style={styles.formHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="comment-plus-outline" size={24} color="#0f172a" />
            <Typography variant="h4" weight="bold" color="#0f172a">
              {editingId ? 'Edit Review' : 'Add Review'}
            </Typography>
          </View>
          {editingId && (
            <TouchableOpacity onPress={resetForm} style={styles.iconBtn}>
              <MaterialCommunityIcons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        <Input
          label="Name"
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
          placeholder="Customer name"
          maxLength={120}
        />

        <Typography variant="label" color="#374151" style={{ marginBottom: 6, fontWeight: '700' }}>
          Stars
        </Typography>
        <View style={{ marginBottom: 16 }}>
          {renderStars(form.rating, true)}
        </View>

        <Typography variant="label" color="#374151" style={{ marginBottom: 6, fontWeight: '700' }}>
          Review
        </Typography>
        <TextInput
          value={form.review}
          onChangeText={(text) => setForm({ ...form, review: text })}
          multiline
          numberOfLines={4}
          maxLength={1500}
          placeholder="Enter the Google review"
          style={styles.textArea}
        />

        <View style={styles.formActions}>
          {editingId && (
            <Button
              title="Cancel"
              variant="outline"
              onPress={resetForm}
              disabled={saving}
              style={{ flex: 1, marginRight: 8 }}
            />
          )}
          <Button
            title={saving ? 'Saving...' : editingId ? 'Update Review' : 'Add Review'}
            onPress={handleSubmit}
            disabled={saving}
            style={{ flex: 2, backgroundColor: '#850404' }}
          />
        </View>
      </Card>

      <View style={styles.listHeader}>
        <Typography variant="h3" weight="bold">Published Reviews</Typography>
        <TouchableOpacity onPress={fetchReviews} disabled={loading} style={styles.refreshButton}>
          <MaterialCommunityIcons name="refresh" size={16} color="#64748b" />
          <Typography variant="label" weight="bold" color="#64748b" style={{ marginLeft: 4 }}>REFRESH</Typography>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      ) : reviews.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Typography variant="body" weight="bold" color="#64748b" align="center">No Google reviews added yet.</Typography>
        </Card>
      ) : (
        reviews.map((item) => (
          <Card key={item.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.avatar}>
                <Typography variant="h4" weight="bold" color="#fff">
                  {item.name.charAt(0).toUpperCase()}
                </Typography>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Typography variant="body" weight="bold" color="#0f172a" numberOfLines={1}>
                  {item.name}
                </Typography>
                <View style={{ marginTop: 2 }}>{renderStars(item.rating, false)}</View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity onPress={() => startEdit(item)} style={styles.iconBtn}>
                  <MaterialCommunityIcons name="pencil" size={20} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeReview(item)} style={styles.iconBtn}>
                  <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
            <Typography variant="body" color="#475569" style={{ marginTop: 12, lineHeight: 22 }}>
              {item.review}
            </Typography>
          </Card>
        ))
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20 },
  formCard: { marginBottom: 24 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  textArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    marginBottom: 16,
    fontSize: 16,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  loadingContainer: { padding: 40 },
  emptyCard: { padding: 40, alignItems: 'center', borderStyle: 'dashed' },
  reviewCard: { marginBottom: 16 },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#850404', justifyContent: 'center', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 },
});

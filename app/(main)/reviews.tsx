import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { api } from '../../src/api/api';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Review {
  id: number;
  rating: number;
  comment: string;
  product?: { productName: string };
  user?: { username: string; email: string };
}

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await api.get('/review');
      if (res.data.success) {
        setReviews(res.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      Alert.alert('Error', 'Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.delete(`/review/${id}`);
              if (res.data.success) {
                setReviews((prev) => prev.filter((r) => r.id !== id));
                Alert.alert('Success', 'Review deleted successfully');
              }
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete review');
            }
          },
        },
      ]
    );
  };

  const handleEditClick = (review: Review) => {
    setEditingId(review.id);
    setEditRating(review.rating);
    setEditComment(review.comment || "");
  };

  const handleSaveEdit = async (id: number) => {
    try {
      setUpdating(true);
      const res = await api.put(`/review/${id}`, {
        rating: editRating,
        comment: editComment,
      });
      if (res.data.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, rating: editRating, comment: editComment } : r))
        );
        setEditingId(null);
        Alert.alert('Success', 'Review updated successfully');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update review');
    } finally {
      setUpdating(false);
    }
  };

  const renderStars = (rating: number, interactive = false) => {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity 
            key={star} 
            disabled={!interactive}
            onPress={() => interactive && setEditRating(star)}
          >
            <MaterialCommunityIcons
              name="star"
              size={18}
              color={star <= rating ? '#fbbf24' : '#e2e8f0'} // amber-400 : slate-200
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Reviews' }} />

      <View style={styles.header}>
        <Typography variant="h2" weight="extrabold" color="#0f172a">Product Reviews</Typography>
        <Typography variant="caption" color="#64748b" style={{ marginTop: 4 }}>
          Manage customer reviews for all products.
        </Typography>
      </View>

      <View style={styles.listHeader}>
        <Typography variant="label" weight="bold" color="#94a3b8">
          TOTAL REVIEWS: {reviews.length}
        </Typography>
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
          <MaterialCommunityIcons name="comment-text-multiple-outline" size={48} color="#cbd5e1" style={{ marginBottom: 16 }} />
          <Typography variant="body" weight="bold" color="#64748b" align="center">No Reviews Found</Typography>
        </Card>
      ) : (
        reviews.map((review) => {
          const isEditing = editingId === review.id;

          return (
            <Card key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Typography variant="body" weight="bold" color="#0f172a" numberOfLines={1}>
                    {review.product?.productName || 'Unknown Product'}
                  </Typography>
                  <Typography variant="caption" color="#64748b" style={{ marginTop: 2 }}>
                    By {review.user?.username || 'Unknown'} ({review.user?.email || 'N/A'})
                  </Typography>
                </View>
                
                {!isEditing && (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity onPress={() => handleEditClick(review)} style={styles.iconBtn}>
                      <MaterialCommunityIcons name="pencil" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(review.id)} style={styles.iconBtn}>
                      <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              {isEditing ? (
                <View style={styles.editContainer}>
                  <Typography variant="label" weight="bold" color="#334155" style={{ marginBottom: 8 }}>
                    Edit Rating:
                  </Typography>
                  <View style={{ marginBottom: 16 }}>
                    {renderStars(editRating, true)}
                  </View>
                  
                  <Typography variant="label" weight="bold" color="#334155" style={{ marginBottom: 8 }}>
                    Edit Comment:
                  </Typography>
                  <TextInput
                    value={editComment}
                    onChangeText={setEditComment}
                    multiline
                    style={styles.editInput}
                    placeholder="Enter review comment..."
                  />

                  <View style={styles.editActions}>
                    <Button 
                      title="Cancel" 
                      variant="outline" 
                      size="small" 
                      onPress={() => setEditingId(null)} 
                      disabled={updating}
                      style={{ flex: 1, marginRight: 8 }}
                    />
                    <Button 
                      title={updating ? "Saving..." : "Save Changes"} 
                      size="small" 
                      onPress={() => handleSaveEdit(review.id)} 
                      disabled={updating}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.displayContainer}>
                  <View style={{ marginBottom: 12 }}>
                    {renderStars(review.rating, false)}
                  </View>
                  <Typography variant="body" color="#334155" style={{ lineHeight: 22 }}>
                    {review.comment || <Typography variant="body" color="#94a3b8" style={{ fontStyle: 'italic' }}>No comment provided.</Typography>}
                  </Typography>
                </View>
              )}
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
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  loadingContainer: { padding: 40 },
  emptyCard: { padding: 40, backgroundColor: '#fff', alignItems: 'center' },
  reviewCard: { marginBottom: 16, padding: 0, overflow: 'hidden' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, backgroundColor: '#fdfdfc' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 },
  divider: { height: 1, backgroundColor: '#f1f5f9' },
  displayContainer: { padding: 16 },
  editContainer: { padding: 16, backgroundColor: '#f8fafc' },
  editInput: { 
    borderWidth: 1, 
    borderColor: '#cbd5e1', 
    borderRadius: 8, 
    padding: 12, 
    minHeight: 80, 
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    marginBottom: 16
  },
  editActions: { flexDirection: 'row', justifyContent: 'space-between' }
});

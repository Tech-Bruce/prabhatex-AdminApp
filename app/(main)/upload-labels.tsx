import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Typography } from '../../src/components/Typography';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { api } from '../../src/api/api';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function UploadLabelsScreen() {
  const [stats, setStats] = useState({ total: 0, used: 0, available: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/available-labels');
      const data = res.data;
      setStats({
        total: data.total || 0,
        used: data.used || 0,
        available: (data.total || 0) - (data.used || 0)
      });
    } catch (err) {
      console.error("Failed to fetch label stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv', 
          'application/vnd.ms-excel', 
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);
        handleUpload(file);
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUpload = async (file: DocumentPicker.DocumentPickerAsset) => {
    setUploading(true);
    const formData = new FormData();
    
    // In React Native, we append the file to FormData like this
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'text/csv'
    } as any);

    try {
      const res = await api.post('/upload-labels', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = res.data;
      Alert.alert('Success', `Uploaded successfully! ${data.uploaded} tracking IDs processed.`);
      setStats({
        total: data.total || 0,
        used: data.used || 0,
        available: data.available || 0
      });
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setFileName('');
    }
  };

  const handleDeleteUnused = () => {
    if (stats.available === 0) return;

    Alert.alert(
      'Delete Unused Labels',
      'Are you sure you want to delete all unused tracking labels? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoadingStats(true);
              const res = await api.delete('/labels/unused');
              Alert.alert('Success', res.data.message || 'Deleted unused labels');
              setStats({
                total: res.data.total || 0,
                used: res.data.used || 0,
                available: res.data.available || 0
              });
            } catch (err: any) {
              console.error(err);
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete unused labels');
            } finally {
              setLoadingStats(false);
            }
          }
        }
      ]
    );
  };

  const isLowBalance = !loadingStats && stats.available < 50;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Stack.Screen options={{ title: 'Tracking Labels' }} />
        
        <View style={styles.header}>
          <Typography variant="h2" weight="extrabold" color="#1e293b">Upload Tracking Labels</Typography>
          <Typography variant="body" color="#64748b" style={{ marginTop: 4 }}>
            Manage your shipment tracking ID inventory.
          </Typography>
        </View>

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: '#f1f5f9' }]}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color="#64748b" />
            </View>
            <View style={{ marginTop: 12 }}>
              <Typography variant="h2" weight="extrabold" color="#334155">{loadingStats ? '-' : stats.total}</Typography>
              <Typography variant="caption" weight="bold" color="#94a3b8" style={{ marginTop: 2, letterSpacing: 0.5 }}>TOTAL UPLOADED</Typography>
            </View>
          </Card>

          <Card style={styles.statCard}>
            <View style={[styles.iconWrap, { backgroundColor: '#eef2ff' }]}>
              <MaterialCommunityIcons name="cube-send" size={24} color="#6366f1" />
            </View>
            <View style={{ marginTop: 12 }}>
              <Typography variant="h2" weight="extrabold" color="#4338ca">{loadingStats ? '-' : stats.used}</Typography>
              <Typography variant="caption" weight="bold" color="#818cf8" style={{ marginTop: 2, letterSpacing: 0.5 }}>USED LABELS</Typography>
            </View>
          </Card>

          <Card style={Object.assign({}, styles.statCard, { width: '100%', flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }, isLowBalance ? { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1 } : { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1 })}>
            <View style={{ flex: 1 }}>
              <Typography variant="caption" weight="bold" color={isLowBalance ? '#ef4444' : '#10b981'} style={{ letterSpacing: 0.5 }}>AVAILABLE BALANCE</Typography>
              <Typography variant="h1" weight="extrabold" color={isLowBalance ? '#b91c1c' : '#047857'} style={{ marginTop: 4 }}>{loadingStats ? '-' : stats.available}</Typography>
            </View>
            <View style={[styles.iconWrap, isLowBalance ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#d1fae5' }, { width: 56, height: 56, borderRadius: 28 }]}>
              <MaterialCommunityIcons name={isLowBalance ? "alert-circle" : "check-circle"} size={32} color={isLowBalance ? '#ef4444' : '#10b981'} />
            </View>
          </Card>
        </View>

        {isLowBalance && (
          <View style={styles.alertBox}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#dc2626" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Typography variant="body" weight="bold" color="#991b1b">Low Balance Alert!</Typography>
              <Typography variant="caption" color="#b91c1c" style={{ marginTop: 4 }}>
                You only have {stats.available} tracking IDs remaining. Please upload a new CSV file to ensure you don't run out.
              </Typography>
            </View>
          </View>
        )}

        <Card style={styles.uploadArea}>
          <LinearGradient colors={['#eef2ff', '#e0e7ff']} style={styles.uploadCircle}>
            <MaterialCommunityIcons name="cloud-upload" size={36} color="#4f46e5" />
          </LinearGradient>
          
          <Typography variant="h3" weight="bold" color="#1e293b" style={{ marginTop: 16 }}>Upload CSV or Excel File</Typography>
          <Typography variant="caption" color="#64748b" align="center" style={{ marginTop: 8, paddingHorizontal: 20 }}>
            Select a file containing your allocated tracking IDs. Must have a header column named "TrackingId".
          </Typography>

          <TouchableOpacity onPress={handlePickDocument} disabled={uploading} style={styles.uploadBtn}>
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="cloud-upload" size={20} color="#fff" />
                <Typography variant="body" weight="bold" color="#fff" style={{ marginLeft: 8 }}>Browse File</Typography>
              </>
            )}
          </TouchableOpacity>
          {fileName && (
            <Typography variant="caption" color="#64748b" style={{ marginTop: 12 }}>Processing: {fileName}</Typography>
          )}
        </Card>

        <View style={{ marginTop: 24 }}>
          <Button
            title="Delete Unused Labels"
            variant="outline"
            onPress={handleDeleteUnused}
            disabled={loadingStats || stats.available === 0 || uploading}
            style={{ borderColor: '#ef4444' }}
            textStyle={{ color: '#ef4444' }}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statCard: { width: '48%', padding: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  alertBox: {
    flexDirection: 'row',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  uploadArea: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
  },
  uploadCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBtn: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  }
});

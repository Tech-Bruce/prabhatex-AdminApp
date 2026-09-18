import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../src/components/Typography';
import { Button } from '../../src/components/Button';
import { api } from '../../src/api/api';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../src/theme/colors';

const { width } = Dimensions.get('window');

const INDIA_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh",
  "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand",
  "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const DEFAULT_RATE = 50;

const initializeCharges = () =>
  Object.fromEntries(INDIA_STATES.map((s) => [s, { perKgRate: DEFAULT_RATE, freeAbove: "" }]));

export default function DeliveryChargesScreen() {
  const insets = useSafeAreaInsets();
  const [charges, setCharges] = useState<Record<string, { perKgRate: number; freeAbove: string | number }>>(initializeCharges());
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(true);
  
  // UI States
  const [saving, setSaving] = useState(false);
  const [expandedState, setExpandedState] = useState<string | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState("");

  useEffect(() => {
    fetchCharges();
  }, []);

  const fetchCharges = async () => {
    try {
      const res = await api.get("/delivery-charges");
      if (res.data.success && res.data.charges) {
        const dbCharges = res.data.charges;
        setCharges((prev) => {
          const updated = { ...prev };
          dbCharges.forEach((c: any) => {
            if (updated[c.state]) {
              updated[c.state] = {
                perKgRate: Number(c.perKgRate),
                freeAbove: c.freeAbove > 0 ? String(c.freeAbove) : "",
              };
            }
          });
          return updated;
        });
        setSaved(true);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load delivery charges');
    }
  };

  const filtered = useMemo(
    () => INDIA_STATES.filter((s) => s.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const handleChange = (state: string, field: string, value: any) => {
    setCharges((prev) => ({
      ...prev,
      [state]: { ...prev[state], [field]: value },
    }));
    setSaved(false);
  };

  const handleBulkApply = () => {
    if (!bulkRate) {
      Alert.alert('Validation', 'Enter a bulk value to apply.');
      return;
    }
    setCharges((prev) => {
      const updated = { ...prev };
      filtered.forEach((s) => {
        updated[s] = {
          ...updated[s],
          ...(bulkRate ? { perKgRate: Number(bulkRate) } : {}),
        };
      });
      return updated;
    });
    setBulkRate("");
    setIsBulkModalOpen(false);
    setSaved(false);
    Alert.alert('Success', `Applied ₹${bulkRate}/kg to ${filtered.length} state(s)`);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = Object.entries(charges).map(([state, data]) => ({
        state,
        perKgRate: data.perKgRate,
        freeAbove: data.freeAbove ? Number(data.freeAbove) : 0,
      }));
      const res = await api.put("/delivery-charges", { charges: payload });
      if (res.data.success) {
        setSaved(true);
        Alert.alert('Success', 'Delivery charges saved successfully!');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || "Failed to save delivery charges");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (state: string) => {
    setCharges((prev) => ({
      ...prev,
      [state]: { perKgRate: DEFAULT_RATE, freeAbove: "" },
    }));
    setSaved(false);
    Alert.alert('Reset', `${state} restored to default settings.`);
  };

  const totalConfigured = INDIA_STATES.filter(
    (s) => charges[s].perKgRate !== DEFAULT_RATE || charges[s].freeAbove !== ""
  ).length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Premium Gradient Header */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={[styles.headerGradient, { paddingTop: insets.top + 20 }]}>
        <View style={styles.headerTop}>
          <View>
            <Typography variant="h2" weight="extrabold" color="#fff">Delivery Rates</Typography>
            <Typography variant="body" color="#94a3b8" style={{ marginTop: 4 }}>
              Manage shipping constraints
            </Typography>
          </View>
          <TouchableOpacity style={styles.bulkBtn} onPress={() => setIsBulkModalOpen(true)}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#fbbf24" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Typography variant="h3" weight="bold" color="#fff">{INDIA_STATES.length}</Typography>
            <Typography variant="caption" color="#94a3b8">Regions</Typography>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Typography variant="h3" weight="bold" color="#38bdf8">{totalConfigured}</Typography>
            <Typography variant="caption" color="#94a3b8">Customized</Typography>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Typography variant="h3" weight="bold" color="#10b981">₹{DEFAULT_RATE}</Typography>
            <Typography variant="caption" color="#94a3b8">Base Rate</Typography>
          </View>
        </View>
      </LinearGradient>

      {/* Floating Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <MaterialCommunityIcons name="magnify" size={24} color="#94a3b8" style={{ marginLeft: 12 }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search regions..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 12 }}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={{ paddingBottom: 100 }}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="map-search-outline" size={64} color="#cbd5e1" />
            <Typography variant="body" weight="medium" color="#64748b" style={{ marginTop: 16 }}>
              No regions match your search.
            </Typography>
          </View>
        ) : (
          filtered.map((state) => {
            const c = charges[state];
            const isCustom = c.perKgRate !== DEFAULT_RATE || c.freeAbove !== "";
            const isExpanded = expandedState === state;

            return (
              <View key={state} style={[styles.accordionItem, isExpanded && styles.accordionItemExpanded]}>
                <TouchableOpacity 
                  style={styles.accordionHeader} 
                  activeOpacity={0.7}
                  onPress={() => setExpandedState(isExpanded ? null : state)}
                >
                  <View style={styles.accordionHeaderLeft}>
                    <View style={[styles.statusDot, isCustom ? { backgroundColor: '#38bdf8' } : { backgroundColor: '#cbd5e1' }]} />
                    <View>
                      <Typography variant="body" weight="bold" color="#1e293b" numberOfLines={1} style={{ maxWidth: width - 120 }}>
                        {state}
                      </Typography>
                      <Typography variant="caption" color="#64748b" style={{ marginTop: 2 }}>
                        {isCustom ? `₹${c.perKgRate}/kg • Free > ₹${c.freeAbove || 'N/A'}` : 'Default Pricing'}
                      </Typography>
                    </View>
                  </View>
                  <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color="#94a3b8" />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.accordionContent}>
                    <View style={styles.inputsRow}>
                      <View style={styles.inputGroup}>
                        <Typography variant="label" weight="bold" color="#64748b" style={{ marginBottom: 8 }}>
                          Rate Per Kg
                        </Typography>
                        <View style={styles.modernInputContainer}>
                          <Typography variant="body" weight="bold" color="#94a3b8" style={{ paddingLeft: 12 }}>₹</Typography>
                          <TextInput
                            value={String(c.perKgRate)}
                            onChangeText={(val) => handleChange(state, 'perKgRate', val)}
                            keyboardType="numeric"
                            style={styles.modernInput}
                          />
                        </View>
                      </View>
                      
                      <View style={styles.inputGroup}>
                        <Typography variant="label" weight="bold" color="#64748b" style={{ marginBottom: 8 }}>
                          Free Shipping Above
                        </Typography>
                        <View style={styles.modernInputContainer}>
                          <Typography variant="body" weight="bold" color="#94a3b8" style={{ paddingLeft: 12 }}>₹</Typography>
                          <TextInput
                            value={String(c.freeAbove)}
                            onChangeText={(val) => handleChange(state, 'freeAbove', val)}
                            keyboardType="numeric"
                            placeholder="Optional"
                            placeholderTextColor="#cbd5e1"
                            style={styles.modernInput}
                          />
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.actionRow}>
                      <TouchableOpacity onPress={() => handleReset(state)} style={styles.textBtn}>
                        <MaterialCommunityIcons name="restore" size={16} color="#ef4444" />
                        <Typography variant="label" weight="bold" color="#ef4444" style={{ marginLeft: 4 }}>
                          Reset to Default
                        </Typography>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setExpandedState(null)} style={styles.doneBtn}>
                        <Typography variant="label" weight="bold" color="#fff">Done</Typography>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Sticky Bottom Bar for Save */}
      {!saved && (
        <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Button
            title={saving ? "Saving Changes..." : "Publish Changes"}
            onPress={handleSave}
            disabled={saving}
            style={styles.saveBtn}
          />
        </View>
      )}

      {/* Bulk Apply Modal */}
      <Modal visible={isBulkModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="h3" weight="bold" color="#0f172a">Bulk Apply Rate</Typography>
              <TouchableOpacity onPress={() => setIsBulkModalOpen(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Typography variant="body" color="#64748b" style={{ marginBottom: 24 }}>
              Set a uniform Rate/Kg for all {filtered.length} currently filtered regions.
            </Typography>
            
            <View style={styles.modernInputContainer}>
              <Typography variant="body" weight="bold" color="#94a3b8" style={{ paddingLeft: 16 }}>₹</Typography>
              <TextInput
                value={bulkRate}
                onChangeText={setBulkRate}
                placeholder="Enter rate per kg (e.g. 100)"
                keyboardType="numeric"
                style={[styles.modernInput, { fontSize: 18 }]}
                autoFocus
              />
            </View>
            
            <Button
              title={`Apply to ${filtered.length} Regions`}
              onPress={handleBulkApply}
              style={{ marginTop: 24, backgroundColor: '#0f172a' }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 40, // Space for the floating search bar
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bulkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  searchContainer: {
    marginTop: -28,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  listContainer: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  accordionItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  accordionItemExpanded: {
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderColor: '#e2e8f0',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  accordionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  accordionContent: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#fff',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  inputGroup: {
    flex: 1,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 48,
  },
  modernInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  doneBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  saveBtn: {
    backgroundColor: '#38bdf8',
    borderRadius: 16,
    height: 56,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  }
});

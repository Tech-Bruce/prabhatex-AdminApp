import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Typography } from './Typography';

export type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertModalProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
  onDismiss?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK', style: 'default' }],
  onDismiss,
}) => {
  if (!visible) return null;

  // Determine icon and color palette based on type or context
  const getIconConfig = (): {
    name: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    color: string;
    bg: string;
    border: string;
  } => {
    switch (type) {
      case 'success':
        return {
          name: 'check-circle',
          color: '#10b981',
          bg: '#ecfdf5',
          border: '#a7f3d0',
        };
      case 'error':
        return {
          name: 'alert-circle',
          color: '#ef4444',
          bg: '#fef2f2',
          border: '#fca5a5',
        };
      case 'warning':
      case 'confirm':
        return {
          name: 'alert-outline',
          color: '#f59e0b',
          bg: '#fffbeb',
          border: '#fde68a',
        };
      case 'info':
      default:
        return {
          name: 'information-outline',
          color: '#4f46e5',
          bg: '#eef2ff',
          border: '#c7d2fe',
        };
    }
  };

  const iconConfig = getIconConfig();

  // If a button has destructive style, use trash/warning icon override
  const isDestructive = buttons.some((b) => b.style === 'destructive');
  if (isDestructive && (type === 'confirm' || type === 'warning')) {
    iconConfig.name = 'trash-can-outline';
    iconConfig.color = '#ef4444';
    iconConfig.bg = '#fef2f2';
    iconConfig.border = '#fca5a5';
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Icon Circle */}
              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: iconConfig.bg,
                    borderColor: iconConfig.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={iconConfig.name}
                  size={28}
                  color={iconConfig.color}
                />
              </View>

              {/* Title & Message */}
              <Typography
                variant="h3"
                weight="extrabold"
                color="#0f172a"
                style={styles.title}
              >
                {title}
              </Typography>

              {!!message && (
                <Typography
                  variant="body"
                  color="#64748b"
                  style={styles.message}
                >
                  {message}
                </Typography>
              )}

              {/* Buttons Row / Stack */}
              <View
                style={[
                  styles.buttonsContainer,
                  buttons.length > 2 && styles.buttonsStacked,
                ]}
              >
                {buttons.map((btn, index) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestruct = btn.style === 'destructive';

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.button,
                        isCancel && styles.cancelButton,
                        isDestruct && styles.destructiveButton,
                        !isCancel && !isDestruct && styles.primaryButton,
                        buttons.length === 2 && styles.halfButton,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        onDismiss?.();
                        btn.onPress?.();
                      }}
                    >
                      <Typography
                        variant="body"
                        weight="extrabold"
                        color={
                          isCancel
                            ? '#475569'
                            : isDestruct
                            ? '#ffffff'
                            : '#ffffff'
                        }
                      >
                        {btn.text || (isCancel ? 'Cancel' : 'OK')}
                      </Typography>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: Math.min(width - 48, 380),
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    justifyContent: 'center',
  },
  buttonsStacked: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#0f172a',
  },
  destructiveButton: {
    backgroundColor: '#dc2626',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});

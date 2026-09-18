import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getContainerStyle = () => {
    let base = {};
    switch (size) {
      case 'small': base = { paddingVertical: 8, paddingHorizontal: 12 }; break;
      case 'large': base = { paddingVertical: 20, paddingHorizontal: 32 }; break;
      case 'medium':
      default: base = { paddingVertical: 16, paddingHorizontal: 24 }; break;
    }
    switch (variant) {
      case 'secondary':
        return [styles.secondaryContainer, base];
      case 'outline':
        return [styles.outlineContainer, base];
      case 'primary':
      default:
        return [styles.primaryContainer, base];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        getContainerStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.surface} />
      ) : (
        <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  primaryContainer: {
    backgroundColor: colors.secondary,
  },
  primaryText: {
    color: colors.surface,
  },
  secondaryContainer: {
    backgroundColor: colors.primary,
  },
  secondaryText: {
    color: colors.surface,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
    elevation: 0,
    shadowOpacity: 0,
  },
  outlineText: {
    color: colors.primary,
  },
  disabled: {
    opacity: 0.6,
  },
});

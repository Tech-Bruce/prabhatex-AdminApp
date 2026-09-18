import React from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, error, disabled, style, ...props }) => {
  return (
    <View style={styles.container}>
      {label && (
        <Text style={typography.label}>
          {label.replace(' *', '')}
          {label.includes('*') && <Text style={{ color: '#ef4444' }}> *</Text>}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          error ? styles.inputError : null,
          disabled ? styles.inputDisabled : null,
          style,
        ]}
        placeholderTextColor={colors.textSecondary}
        editable={!disabled}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 1.5,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: '#f3f4f6',
  }
});

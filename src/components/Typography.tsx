import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';

interface TypographyProps {
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'label';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  color?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  numberOfLines?: number;
  style?: TextStyle | TextStyle[];
  children: React.ReactNode;
}

export function Typography({
  variant = 'body',
  weight = 'normal',
  color = '#1f2937', // gray-800
  align = 'left',
  numberOfLines,
  style,
  children,
}: TypographyProps) {
  const getFontSize = () => {
    switch (variant) {
      case 'h1': return 28;
      case 'h2': return 24;
      case 'h3': return 20;
      case 'h4': return 18;
      case 'body': return 16;
      case 'caption': return 14;
      case 'label': return 12;
      default: return 16;
    }
  };

  const getFontWeight = (): TextStyle['fontWeight'] => {
    switch (weight) {
      case 'medium': return '500';
      case 'semibold': return '600';
      case 'bold': return '700';
      case 'extrabold': return '800';
      default: return '400';
    }
  };

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: getFontSize(),
          fontWeight: getFontWeight(),
          color,
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

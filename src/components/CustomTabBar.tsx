import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

// Colors exactly matching the App-frontend design
const COLORS = {
  primary: '#6B0000',
  secondary: '#850404',
  ivory: '#FAF6F0',
  gold: '#D5A63A',
  champagne: '#EBD197', // Champage gold for inactive
  activeText: '#FFF9ED', // Warm white
  darkText: '#1A1111'
};

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Custom height excluding safe area
  const BAR_HEIGHT = 75;
  const TOTAL_HEIGHT = BAR_HEIGHT + insets.bottom;

  // Filter out hidden routes (we only want index, orders, more for the Admin bottom bar)
  const visibleRoutes = state.routes.filter(route => {
    const { options } = descriptors[route.key];
    return (options as any).href !== null && ['index', 'orders', 'more'].includes(route.name);
  });

  const tabWidth = width / visibleRoutes.length;

  // Animated value for the sliding circle and curve
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Active index mapped to the filtered routes
  const activeRoute = state.routes[state.index];
  const activeIndex = visibleRoutes.findIndex(r => r.key === activeRoute.key);
  // When on secondary sub-screens (like users, categories, banners, etc.), highlight 'more' (index 2)
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 2;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: safeActiveIndex,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [safeActiveIndex]);

  // SVG background sliding logic
  const svgWidth = width * 3;
  const svgCenter = svgWidth / 2;
  const curveWidth = 110;
  const curveDepth = 45;

  const d = `
    M 0 0
    L ${svgCenter - curveWidth / 2} 0
    C ${svgCenter - curveWidth / 3.5} 0,
      ${svgCenter - curveWidth / 4} ${curveDepth},
      ${svgCenter} ${curveDepth}
    C ${svgCenter + curveWidth / 4} ${curveDepth},
      ${svgCenter + curveWidth / 3.5} 0,
      ${svgCenter + curveWidth / 2} 0
    L ${svgWidth} 0
    L ${svgWidth} ${TOTAL_HEIGHT}
    L 0 ${TOTAL_HEIGHT}
    Z
  `;

  // Translate to correctly position SVG center on X=0
  const baseTranslate = -svgCenter;

  const bgTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      baseTranslate + tabWidth / 2, 
      baseTranslate + tabWidth * 1.5,
      baseTranslate + tabWidth * 2.5
    ],
  });

  const circleTranslateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      tabWidth / 2 - 32, 
      tabWidth * 1.5 - 32,
      tabWidth * 2.5 - 32
    ]
  });

  return (
    <View style={[styles.container, { height: TOTAL_HEIGHT }]}>
      {/* 1. Sliding Background Curve */}
      <View style={[StyleSheet.absoluteFill, styles.bgContainer]}>
        <AnimatedSvg
          width={svgWidth}
          height={TOTAL_HEIGHT}
          style={{ transform: [{ translateX: bgTranslateX }] }}
        >
          <Path d={d} fill={COLORS.primary} />
          {/* Top Gold Border */}
          <Path
            d={`M 0 0 L ${svgCenter - curveWidth / 2} 0 C ${svgCenter - curveWidth / 3.5} 0, ${svgCenter - curveWidth / 4} ${curveDepth}, ${svgCenter} ${curveDepth} C ${svgCenter + curveWidth / 4} ${curveDepth}, ${svgCenter + curveWidth / 3.5} 0, ${svgCenter + curveWidth / 2} 0 L ${svgWidth} 0`}
            fill="none" stroke={COLORS.gold} strokeWidth="2"
          />
        </AnimatedSvg>
      </View>

      {/* 2. Sliding Raised Circle Bubble */}
      <Animated.View style={[styles.centerButton, { transform: [{ translateX: circleTranslateX }] }]}>
        <View style={styles.centerButtonInner} />
      </Animated.View>

      {/* 3. Icons and Labels */}
      <View style={[styles.tabContent, { height: BAR_HEIGHT }]}>
        {visibleRoutes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title !== undefined ? options.title : route.name;
          const isDirectlyActive = activeRoute.name === route.name;
          const isFocused = safeActiveIndex === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isDirectlyActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Determine icon name based on route using MaterialCommunityIcons
          let iconName: any = 'view-dashboard-outline';
          let activeIconName: any = 'view-dashboard';
          if (route.name === 'index') {
            iconName = 'view-dashboard-outline';
            activeIconName = 'view-dashboard';
          }
          if (route.name === 'orders') {
            iconName = 'package-variant';
            activeIconName = 'package-variant-closed';
          }
          if (route.name === 'more') {
            iconName = 'menu';
            activeIconName = 'menu';
          }

          return (
            <TabIcon
              key={route.key}
              iconName={iconName}
              activeIconName={activeIconName}
              label={label}
              isFocused={isFocused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

// Separate component to handle individual icon animations
function TabIcon({ iconName, activeIconName, label, isFocused, onPress }: any) {
  const animatedFocus = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animatedFocus, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [isFocused]);

  const translateY = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -34], // Move UP into the circle
  });

  const labelOpacity = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0], // Hide label when active
  });

  const underlineOpacity = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1], // Show underline when active
  });

  const activeIconOpacity = animatedFocus;
  const inactiveIconOpacity = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      style={styles.tabItem}
    >
      <Animated.View style={[styles.iconWrapper, { transform: [{ translateY }] }]}>
        {/* Cross-fade icons instead of animating color property */}
        <Animated.View style={{ position: 'absolute', opacity: inactiveIconOpacity }}>
          <MaterialCommunityIcons name={iconName} size={26} color={COLORS.champagne} />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', opacity: activeIconOpacity }}>
          <MaterialCommunityIcons name={activeIconName} size={26} color={COLORS.activeText} />
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.tabLabel, { color: COLORS.champagne, opacity: labelOpacity }]}>{label}</Animated.Text>

      {/* Keep the active text fixed at the bottom with the underline */}
      <Animated.View style={[styles.activeStateContainer, { opacity: underlineOpacity }]}>
        <Text style={[styles.tabLabel, { color: COLORS.activeText, bottom: 12 }]}>{label}</Text>
        <View style={styles.activeUnderline} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    backgroundColor: 'transparent',
    position: 'absolute', // Absolute positioning so it sits cleanly on top of the layout
    bottom: 0,
    left: 0,
    right: 0,
  },
  bgContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tabContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    marginBottom: 8, // Push icon slightly up so it's centered before animating
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    position: 'absolute',
    bottom: 12,
  },
  activeStateContainer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 30,
  },
  activeUnderline: {
    position: 'absolute',
    bottom: 6,
    width: 16,
    height: 2,
    backgroundColor: COLORS.gold,
    borderRadius: 1,
  },
  centerButton: {
    position: 'absolute',
    top: -28,
    left: 0,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
  },
  centerButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(213, 166, 58, 0.5)',
    backgroundColor: COLORS.secondary,
  }
});

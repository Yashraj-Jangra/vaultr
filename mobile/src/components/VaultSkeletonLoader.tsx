import React, { useEffect, useState } from "react";
import { StyleSheet, View, LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from "react-native-svg";

interface VaultSkeletonLoaderProps {
  count?: number;
}

export function VaultSkeletonLoader({ count = 5 }: VaultSkeletonLoaderProps) {
  const [rowWidth, setRowWidth] = useState(360);
  const pulse = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    // Gentle breathing baseline
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    // Continuous smooth shimmer wave sweep left to right
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false
    );
  }, []);

  const onRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setRowWidth(w);
  };

  const boneAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(pulse.value, [0, 1], [0.4, 0.65]);
    return { opacity };
  });

  const shimmerAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-160, rowWidth + 60]);
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={styles.skeletonRow}
          onLayout={i === 0 ? onRowLayout : undefined}
        >
          {/* Simulated Icon Badge */}
          <Animated.View style={[styles.iconSkeleton, boneAnimatedStyle]} />

          {/* Simulated Text Lines */}
          <View style={styles.textCol}>
            <Animated.View
              style={[
                styles.titleSkeleton,
                { width: i % 2 === 0 ? "65%" : "50%" },
                boneAnimatedStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.subSkeleton,
                { width: i % 2 === 0 ? "40%" : "30%" },
                boneAnimatedStyle,
              ]}
            />
          </View>

          {/* Simulated Chevron / Trailing Badge */}
          <Animated.View style={[styles.trailingSkeleton, boneAnimatedStyle]} />

          {/* Silky Smooth Shimmer Gradient Sweep */}
          <Animated.View
            style={[styles.shimmerContainer, shimmerAnimatedStyle]}
            pointerEvents="none"
          >
            <Svg width="140" height="100%">
              <Defs>
                <SvgLinearGradient id={`shim-${i}`} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <Stop offset="50%" stopColor="#ffffff" stopOpacity="0.06" />
                  <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </SvgLinearGradient>
              </Defs>
              <Rect width="140" height="100%" fill={`url(#shim-${i})`} />
            </Svg>
          </Animated.View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    gap: 8,
  },
  skeletonRow: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#18181b",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  shimmerContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 140,
  },
  iconSkeleton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#27272a",
    marginRight: 12,
  },
  textCol: {
    flex: 1,
    gap: 8,
  },
  titleSkeleton: {
    height: 14,
    borderRadius: 6,
    backgroundColor: "#27272a",
  },
  subSkeleton: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1f1f23",
  },
  trailingSkeleton: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#27272a",
    marginLeft: 8,
  },
});

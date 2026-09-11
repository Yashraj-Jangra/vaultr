import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Pressable,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { Folder, FolderOpen, ChevronRight, CornerDownRight } from "lucide-react-native";

interface AnimatedFolderRowProps {
  folderPath: string;
  displayName: string;
  depth: number;
  count: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  isLast: boolean;
  onPress: () => void;
  onToggleCollapse: () => void;
  isUncategorized?: boolean;
}

export function AnimatedFolderRow({
  displayName,
  depth,
  count,
  hasChildren,
  isCollapsed,
  isLast,
  onPress,
  onToggleCollapse,
  isUncategorized = false,
}: AnimatedFolderRowProps) {
  // Chevron rotation (0deg collapsed -> 90deg expanded)
  const chevronRot = useSharedValue(isCollapsed ? 0 : 90);

  // Folder open progress (0 = closed, 1 = open)
  const openProgress = useSharedValue(isCollapsed ? 0 : 1);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    chevronRot.value = withSpring(isCollapsed ? 0 : 90, {
      damping: 18,
      stiffness: 280,
      mass: 0.5,
    });
    openProgress.value = withSpring(isCollapsed ? 0 : 1, {
      damping: 18,
      stiffness: 240,
    });
  }, [isCollapsed]);

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRot.value}deg` }],
  }));

  const folderContainerStyle = useAnimatedStyle(() => {
    // Subtle realistic tilt on open (-8deg max), returning cleanly to rest
    const rotX = interpolate(openProgress.value, [0, 1], [0, -8]);
    const scale = interpolate(openProgress.value, [0, 1], [1, 1.03]);
    return {
      transform: [
        { perspective: 600 },
        { rotateX: `${rotX}deg` },
        { scale },
      ],
    };
  });

  const closedIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(openProgress.value, [0, 0.6], [1, 0]);
    return {
      opacity,
      position: "absolute",
    };
  });

  const openedIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(openProgress.value, [0.4, 1], [0, 1]);
    return {
      opacity,
    };
  });

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.985, { damping: 18, stiffness: 350 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 18, stiffness: 350 });
  };

  return (
    <Animated.View
      entering={depth > 0 ? FadeIn.duration(140) : undefined}
      exiting={depth > 0 ? FadeOut.duration(90) : undefined}
    >
      <Animated.View style={rowAnimatedStyle}>
        <Pressable
          style={[
            styles.listRow,
            depth > 0 && { paddingLeft: 12 + depth * 14 },
          ]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          {depth > 0 && (
            <CornerDownRight size={14} color="#71717a" style={{ marginRight: 4 }} />
          )}

          {/* Subtle 3D Animated Folder Icon with Smooth Cross-Dissolve */}
          <Animated.View style={[styles.listRowIcon, folderContainerStyle]}>
            {isUncategorized ? (
              <Folder size={22} color="#52525b" />
            ) : (
              <View style={styles.iconCrossFadeWrap}>
                <Animated.View style={closedIconStyle}>
                  <Folder size={22} color="#a1a1aa" />
                </Animated.View>
                <Animated.View style={openedIconStyle}>
                  <FolderOpen size={22} color="#fafafa" />
                </Animated.View>
              </View>
            )}
          </Animated.View>

          <View style={styles.titleWrap}>
            <Text
              style={[
                styles.listRowTitle,
                isUncategorized && { color: "#a1a1aa" },
              ]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </View>

          <Text style={styles.listRowCount}>{count}</Text>

          {/* Apple-style Rotating Chevron */}
          {hasChildren ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onToggleCollapse();
              }}
              style={styles.chevronBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.65}
            >
              <Animated.View style={chevronAnimatedStyle}>
                <ChevronRight size={16} color={isCollapsed ? "#a1a1aa" : "#fafafa"} />
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <View style={styles.chevronBtn}>
              <ChevronRight size={16} color="#3f3f46" />
            </View>
          )}
        </Pressable>
      </Animated.View>

      {!isLast && <View style={styles.rowDivider} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#111113",
  },
  listRowIcon: {
    marginRight: 12,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCrossFadeWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: {
    flex: 1,
    justifyContent: "center",
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fafafa",
  },
  listRowCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#71717a",
    marginRight: 4,
  },
  chevronBtn: {
    padding: 6,
    marginLeft: 4,
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "#18181b",
    marginLeft: 54,
  },
});

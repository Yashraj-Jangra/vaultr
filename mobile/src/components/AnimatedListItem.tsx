import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

interface AnimatedListItemProps {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedListItem({
  index,
  children,
  style,
}: AnimatedListItemProps) {
  // Sleek, minimal micro-stagger: only applied to the first 5 visible items (max 56ms)
  // Zero delay for scrolled items so FlatLists never stutter or pop in blank while scrolling
  const delay = index < 5 ? index * 14 : 0;

  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(140)}
      exiting={FadeOut.duration(90)}
      layout={LinearTransition.duration(150)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

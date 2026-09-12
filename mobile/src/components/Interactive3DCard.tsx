import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  GestureResponderEvent,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
  Vibration,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { RefreshCw } from "lucide-react-native";

interface Interactive3DCardProps {
  children: React.ReactNode;
  backContent?: React.ReactNode;
  canFlip?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Helper worklet: any rotation angle whose normalized [0, 360) value lies in (90, 270) faces the back
function isBackAngle(angle: number): boolean {
  "worklet";
  const norm = ((Math.round(angle) % 360) + 360) % 360;
  return norm > 90 && norm < 270;
}

export function Interactive3DCard({
  children,
  backContent,
  canFlip = false,
  style,
}: Interactive3DCardProps) {
  const [dimensions, setDimensions] = useState({ width: 340, height: 210 });
  const [flipped, setFlipped] = useState(false);

  // 3D Tilt Values
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Realistic Ambient Depth Shadow & Dynamic Rim Light
  const shadowOffsetX = useSharedValue(0);
  const shadowOffsetY = useSharedValue(0);
  const shadowOpacity = useSharedValue(0.35);
  const rimOpacity = useSharedValue(0.06);

  // 3D Flip Rotation Value in degrees: 0, 360, 720 = front; 180, 540, 900 = back
  const flipRotation = useSharedValue(0);
  const startRotation = useSharedValue(0);
  const isFlippedShared = useSharedValue(false);

  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  // Synchronize React `flipped` state directly with the card's visible face on the UI thread
  useAnimatedReaction(
    () => isBackAngle(flipRotation.value),
    (isBack, prevIsBack) => {
      if (prevIsBack !== null && isBack !== prevIsBack) {
        runOnJS(setFlipped)(isBack);
      }
    }
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const triggerHapticAndSync = (nextFlipped: boolean) => {
    try {
      Vibration.vibrate(12);
    } catch {}
    setFlipped(nextFlipped);
  };

  // Fallback touch events when flipping is disabled
  const handleTouchStart = (e: GestureResponderEvent) => {
    scale.value = withSpring(1.02, { damping: 20, stiffness: 220, mass: 0.6 });
    rimOpacity.value = withTiming(0.16, { duration: 150 });
    shadowOpacity.value = withTiming(0.65, { duration: 150 });

    const { locationX, locationY } = e.nativeEvent;
    updateTilt(locationX, locationY);
  };

  const handleTouchMove = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    updateTilt(locationX, locationY);
  };

  const handleTouchEnd = () => {
    resetTilt();
  };

  const updateTilt = (touchX: number, touchY: number) => {
    const halfW = dimensions.width / 2;
    const halfH = dimensions.height / 2;

    const normX = Math.max(-1, Math.min(1, (touchX - halfW) / halfW));
    const normY = Math.max(-1, Math.min(1, (touchY - halfH) / halfH));

    rotateX.value = withSpring(-normY * 6, { damping: 20, stiffness: 200, mass: 0.6 });
    rotateY.value = withSpring(normX * 8, { damping: 20, stiffness: 200, mass: 0.6 });

    shadowOffsetX.value = withSpring(-normX * 12, { damping: 20, stiffness: 200 });
    shadowOffsetY.value = withSpring(-normY * 10, { damping: 20, stiffness: 200 });

    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      resetTilt();
    }, 600);
  };

  const resetTilt = () => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    rotateX.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.6 });
    rotateY.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.6 });
    scale.value = withSpring(1, { damping: 22, stiffness: 180, mass: 0.6 });
    shadowOffsetX.value = withSpring(0, { damping: 22, stiffness: 180 });
    shadowOffsetY.value = withSpring(0, { damping: 22, stiffness: 180 });
    rimOpacity.value = withTiming(0.06, { duration: 240 });
    shadowOpacity.value = withTiming(0.35, { duration: 240 });
  };

  // Button-triggered flip: always advances +180° in the right direction
  const toggleFlip = () => {
    const currentBase = Math.round(flipRotation.value / 180) * 180;
    const currentlyBack = isBackAngle(currentBase);
    const nextBack = !currentlyBack;
    const targetAngle = currentBase + 180;

    setFlipped(nextBack);
    isFlippedShared.value = nextBack;
    flipRotation.value = withSpring(targetAngle, {
      damping: 18,
      stiffness: 140,
      mass: 0.8,
    });
    try {
      Vibration.vibrate(12);
    } catch {}
  };

  // Pan gesture handler for interactive 3D swipe to flip
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(canFlip && !!backContent)
      .activeOffsetX([-10, 10])
      .failOffsetY([-16, 16])
      .onBegin((e) => {
        "worklet";
        startRotation.value = flipRotation.value;
        scale.value = withSpring(1.03, { damping: 20, stiffness: 240, mass: 0.5 });
        shadowOpacity.value = withTiming(0.65, { duration: 120 });
        rimOpacity.value = withTiming(0.18, { duration: 120 });

        const halfW = dimensions.width / 2;
        const halfH = dimensions.height / 2;
        const normX = Math.max(-1, Math.min(1, (e.x - halfW) / halfW));
        const normY = Math.max(-1, Math.min(1, (e.y - halfH) / halfH));
        rotateX.value = withSpring(-normY * 6, { damping: 20, stiffness: 200, mass: 0.6 });
        rotateY.value = withSpring(normX * 8, { damping: 20, stiffness: 200, mass: 0.6 });
        shadowOffsetX.value = withSpring(-normX * 12, { damping: 20, stiffness: 200 });
        shadowOffsetY.value = withSpring(-normY * 10, { damping: 20, stiffness: 200 });
      })
      .onUpdate((e) => {
        "worklet";
        const halfW = dimensions.width / 2;
        const halfH = dimensions.height / 2;
        const normX = Math.max(-1, Math.min(1, (e.x - halfW) / halfW));
        const normY = Math.max(-1, Math.min(1, (e.y - halfH) / halfH));

        rotateX.value = withSpring(-normY * 6, { damping: 20, stiffness: 200, mass: 0.6 });
        rotateY.value = withSpring(normX * 8, { damping: 20, stiffness: 200, mass: 0.6 });
        shadowOffsetX.value = withSpring(-normX * 12, { damping: 20, stiffness: 200 });
        shadowOffsetY.value = withSpring(-normY * 10, { damping: 20, stiffness: 200 });

        // Map horizontal translation to 3D rotation angle
        const dragFraction = e.translationX / (dimensions.width * 0.75);
        flipRotation.value = startRotation.value + dragFraction * 180;
      })
      .onEnd((e) => {
        "worklet";
        const dragDelta = flipRotation.value - startRotation.value;
        const isFlick = Math.abs(e.velocityX) > 350;
        const passedThreshold = Math.abs(dragDelta) > 35;
        const willFlip = isFlick || passedThreshold;

        const startBase = Math.round(startRotation.value / 180) * 180;
        const wasBack = isBackAngle(startBase);

        // Determine swipe direction:
        // High-velocity flick takes precedence; otherwise check displacement delta.
        let isTurningRight: boolean;
        if (Math.abs(e.velocityX) > 350) {
          isTurningRight = e.velocityX > 0;
        } else {
          isTurningRight = dragDelta > 0;
        }

        let targetAngle: number;
        let nextBack: boolean;

        if (willFlip) {
          // Continuous rotation in the swiped direction (unlimited times):
          // Swiping right always adds +180°
          // Swiping left always subtracts -180°
          targetAngle = isTurningRight ? startBase + 180 : startBase - 180;
          nextBack = !wasBack;
        } else {
          // Snap back to starting face
          targetAngle = startBase;
          nextBack = wasBack;
        }

        isFlippedShared.value = nextBack;

        const initialVelocity = Math.max(-25, Math.min(25, e.velocityX / 35));
        flipRotation.value = withSpring(targetAngle, {
          damping: 18,
          stiffness: 150,
          mass: 0.7,
          velocity: initialVelocity,
        });

        // Only vibrate and sync if the card actually rotated to the other face
        if (nextBack !== wasBack) {
          runOnJS(triggerHapticAndSync)(nextBack);
        }
      })
      .onFinalize((_e, success) => {
        "worklet";
        scale.value = withSpring(1, { damping: 22, stiffness: 180, mass: 0.6 });
        rotateX.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.6 });
        rotateY.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.6 });
        shadowOffsetX.value = withSpring(0, { damping: 22, stiffness: 180 });
        shadowOffsetY.value = withSpring(0, { damping: 22, stiffness: 180 });
        rimOpacity.value = withTiming(0.06, { duration: 240 });
        shadowOpacity.value = withTiming(0.35, { duration: 240 });

        // If gesture was cancelled mid-drag (e.g. vertical scroll takeover), snap to nearest resting face without vibrating
        if (!success) {
          const nearestBase = Math.round(flipRotation.value / 180) * 180;
          flipRotation.value = withSpring(nearestBase, {
            damping: 20,
            stiffness: 180,
          });
          const nearestBack = isBackAngle(nearestBase);
          isFlippedShared.value = nearestBack;
          runOnJS(setFlipped)(nearestBack);
        }
      });
  }, [canFlip, backContent, dimensions.width]);

  // Ambient cast shadow under card scene
  const shadowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: shadowOpacity.value,
    transform: [
      { translateX: shadowOffsetX.value },
      { translateY: shadowOffsetY.value },
      { scale: scale.value * 0.98 },
    ],
  }));

  // Dynamic subtle rim light on border
  const rimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rimOpacity.value,
  }));

  // Front face animation style
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rot = flipRotation.value;
    const normalizedAngle = ((rot % 360) + 360) % 360;
    const isBack = normalizedAngle > 90 && normalizedAngle < 270;
    return {
      transform: [
        { perspective: 1200 },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rot + rotateY.value}deg` },
        { scale: scale.value },
      ],
      backfaceVisibility: "hidden",
      opacity: isBack ? 0 : 1,
      zIndex: isBack ? 0 : 2,
    };
  });

  // Back face animation style
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rot = flipRotation.value;
    const normalizedAngle = ((rot % 360) + 360) % 360;
    const isBack = normalizedAngle > 90 && normalizedAngle < 270;
    return {
      transform: [
        { perspective: 1200 },
        { rotateX: `${rotateX.value}deg` },
        { rotateY: `${rot + 180 + rotateY.value}deg` },
        { scale: scale.value },
      ],
      backfaceVisibility: "hidden",
      opacity: isBack ? 1 : 0,
      zIndex: isBack ? 2 : 0,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
  });

  const renderCardContent = () => (
    <View style={styles.cardScene} onLayout={handleLayout}>
      {/* Front Face */}
      <Animated.View style={[styles.faceWrapper, frontAnimatedStyle]}>
        {children}
        {/* Dynamic Subtle Rim Border */}
        <Animated.View style={[styles.rimHighlight, rimAnimatedStyle]} pointerEvents="none" />
      </Animated.View>

      {/* Back Face (if supported) */}
      {backContent ? (
        <Animated.View style={[styles.faceWrapper, backAnimatedStyle]}>
          {backContent}
          <Animated.View style={[styles.rimHighlight, rimAnimatedStyle]} pointerEvents="none" />
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.outerContainer, style]}>
      {/* Dynamic Ambient Depth Shadow Layer */}
      <Animated.View style={[styles.ambientShadow, shadowAnimatedStyle]} pointerEvents="none" />

      {canFlip && backContent ? (
        <GestureDetector gesture={panGesture}>
          {renderCardContent()}
        </GestureDetector>
      ) : (
        <View
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onResponderRelease={handleTouchEnd}
          onResponderTerminate={handleTouchEnd}
        >
          {renderCardContent()}
        </View>
      )}

      {/* 3D Flip & Interactive Controls Pill */}
      {canFlip && backContent ? (
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.flipPill}
            onPress={toggleFlip}
            activeOpacity={0.75}
          >
            <RefreshCw size={13} color="#a1a1aa" />
            <Text style={styles.flipPillText}>
              {flipped ? "Show Front (EMV Chip)" : "Flip Card (CVV & Magnetic Stripe)"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    position: "relative",
  },
  ambientShadow: {
    position: "absolute",
    top: 14,
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: "#000000",
    borderRadius: 22,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 8,
  },
  cardScene: {
    width: "100%",
    position: "relative",
  },
  faceWrapper: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
  },
  rimHighlight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 0,
    borderColor: "transparent",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  flipPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  flipPillText: {
    fontSize: 11,
    color: "#a1a1aa",
    fontWeight: "500",
  },
});

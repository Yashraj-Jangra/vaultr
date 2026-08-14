import React, { useEffect } from "react";
import { StyleSheet, Text, View, Modal, TouchableOpacity, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useAlertStore, AlertButton } from "../store/alertStore";
import { Illustration } from "./Illustration";
import { X } from "lucide-react-native";

const { width } = Dimensions.get("window");

export function CustomAlertOverlay() {
  const { isVisible, title, message, buttons, options, hide } = useAlertStore();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.93);

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      scale.value = withSpring(1, { damping: 22, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 140 });
      scale.value = withTiming(0.93, { duration: 140 });
    }
  }, [isVisible]);


  const handlePress = (btn: AlertButton) => {
    // Start closing animation, then call the button's onPress and hide the store
    opacity.value = withTiming(0, { duration: 140 });
    scale.value = withTiming(0.93, { duration: 140 }, (finished) => {
      if (finished) {
        runOnJS(hide)();
        if (btn.onPress) {
          runOnJS(btn.onPress)();
        }
      }
    });
  };

  const handleClose = () => {
    if (options?.cancelable === false) return;
    opacity.value = withTiming(0, { duration: 140 });
    scale.value = withTiming(0.93, { duration: 140 }, (finished) => {
      if (finished) {
        runOnJS(hide)();
      }
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Separate primary buttons from secondary/destructive
  const primaryButtons = buttons.filter((b) => b.style !== "cancel" && b.style !== "destructive");
  const secondaryButtons = buttons.filter((b) => b.style === "cancel" || b.style === "destructive");

  const glowBg = options?.glowColor || "rgba(245, 158, 11, 0.08)";

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
        
        <Animated.View style={[styles.surface, surfaceStyle]}>
          {options?.cancelable !== false && (
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <X size={20} color="#737373" />
            </TouchableOpacity>
          )}

          {options?.illustration && (
            <View style={styles.illustrationWrap}>
              <View style={[styles.illustrationGlow, { backgroundColor: glowBg }]} />
              <Illustration name={options.illustration} width={180} height={130} />
            </View>
          )}

          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
          </View>

          <View style={styles.actions}>
            {primaryButtons.map((btn, i) => (
              <TouchableOpacity
                key={`primary-${i}`}
                style={styles.primaryBtn}
                onPress={() => handlePress(btn)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>{btn.text}</Text>
              </TouchableOpacity>
            ))}

            {secondaryButtons.map((btn, i) => (
              <TouchableOpacity
                key={`secondary-${i}`}
                style={styles.ghostBtn}
                onPress={() => handlePress(btn)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.ghostBtnText,
                    btn.style === "destructive" && styles.destructiveText,
                  ]}
                >
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  surface: {
    width: width - 48,
    maxWidth: 380,
    backgroundColor: "#09090b",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(38,38,38,0.8)",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  illustrationWrap: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: -8,
  },
  illustrationGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(245, 158, 11, 0.05)",
    top: 10,
  },
  content: {
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#f4f4f5",
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#a3a3a3",
    lineHeight: 20,
    textAlign: "center",
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: "#f4f4f5",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#09090b",
  },
  ghostBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#a3a3a3",
  },
  destructiveText: {
    color: "#f87171",
  },
});

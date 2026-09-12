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

const OPEN_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const CLOSE_EASING = Easing.bezier(0.2, 0, 0, 1);

export function CustomAlertOverlay() {
  const { isVisible, title, message, buttons, options, hide } = useAlertStore();

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const translateY = useSharedValue(10);

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 240, easing: OPEN_EASING });
      scale.value = withTiming(1, { duration: 240, easing: OPEN_EASING });
      translateY.value = withTiming(0, { duration: 240, easing: OPEN_EASING });
    } else {
      opacity.value = withTiming(0, { duration: 160, easing: CLOSE_EASING });
      scale.value = withTiming(0.96, { duration: 160, easing: CLOSE_EASING });
      translateY.value = withTiming(6, { duration: 160, easing: CLOSE_EASING });
    }
  }, [isVisible]);

  const handlePress = (btn: AlertButton) => {
    opacity.value = withTiming(0, { duration: 160, easing: CLOSE_EASING });
    scale.value = withTiming(0.96, { duration: 160, easing: CLOSE_EASING });
    translateY.value = withTiming(6, { duration: 160, easing: CLOSE_EASING }, (finished) => {
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
    opacity.value = withTiming(0, { duration: 160, easing: CLOSE_EASING });
    scale.value = withTiming(0.96, { duration: 160, easing: CLOSE_EASING });
    translateY.value = withTiming(6, { duration: 160, easing: CLOSE_EASING }, (finished) => {
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
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  // Prioritize actionable buttons on TOP (destructive or primary), cancel button at BOTTOM
  const actionButtons = buttons.filter((b) => b.style !== "cancel");
  const cancelButtons = buttons.filter((b) => b.style === "cancel");
  const orderedButtons = [...actionButtons, ...cancelButtons];

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
            {orderedButtons.map((btn, i) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";

              return (
                <TouchableOpacity
                  key={`btn-${i}`}
                  style={[
                    styles.btnBase,
                    isDestructive
                      ? styles.destructiveBtn
                      : isCancel
                      ? styles.cancelBtn
                      : styles.primaryBtn,
                  ]}
                  onPress={() => handlePress(btn)}
                  activeOpacity={isCancel ? 0.7 : 0.8}
                >
                  <Text
                    style={[
                      styles.btnTextBase,
                      isDestructive
                        ? styles.destructiveBtnText
                        : isCancel
                        ? styles.cancelBtnText
                        : styles.primaryBtnText,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
    gap: 10,
  },
  btnBase: {
    borderRadius: 14,
    paddingVertical: 13,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  btnTextBase: {
    fontSize: 14,
    textAlign: "center",
  },
  primaryBtn: {
    backgroundColor: "#f4f4f5",
  },
  primaryBtnText: {
    fontWeight: "600",
    color: "#09090b",
  },
  destructiveBtn: {
    backgroundColor: "#dc2626",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  destructiveBtnText: {
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  cancelBtn: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelBtnText: {
    fontWeight: "500",
    color: "#d4d4d8",
  },
});

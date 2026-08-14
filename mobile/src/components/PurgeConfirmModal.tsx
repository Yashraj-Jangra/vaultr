import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useVaultStore } from "../store/vaultStore";
import { Illustration } from "./Illustration";
import { Lock, Eye, EyeOff, X, Trash2 } from "lucide-react-native";

export interface PurgeTarget {
  type: "single" | "all";
  id?: string;
  name?: string;
  count?: number;
}

interface PurgeConfirmModalProps {
  open: boolean;
  target: PurgeTarget | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function PurgeConfirmModal({
  open,
  target,
  onClose,
  onConfirm,
}: PurgeConfirmModalProps) {
  const { masterPassword } = useVaultStore();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.93);

  useEffect(() => {
    if (open) {
      setPassword("");
      setShowPassword(false);
      setError("");
      setLoading(false);
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      scale.value = withSpring(1, { damping: 22, stiffness: 220 });
    } else {
      opacity.value = withTiming(0, { duration: 140 });
      scale.value = withTiming(0.93, { duration: 140 });
    }
  }, [open, target]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!open || !target) return null;

  const isAll = target.type === "all";

  const handleClose = () => {
    if (loading) return;
    opacity.value = withTiming(0, { duration: 140 });
    scale.value = withTiming(0.93, { duration: 140 });
    setTimeout(onClose, 140);
  };

  const handleConfirm = async () => {
    if (loading) return;
    setError("");

    if (!password.trim()) {
      setError("Master password is required.");
      return;
    }

    // Verify master password reprompt against active store session
    if (masterPassword && password.trim() !== masterPassword) {
      setError("Incorrect master password. Verification failed.");
      return;
    }

    setLoading(true);
    try {
      await onConfirm();
      setPassword("");
      setError("");
      handleClose();
    } catch (err: any) {
      setError(err?.message || "Failed to purge items.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Animated.View style={[styles.card, surfaceStyle]}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            disabled={loading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color="#71717a" />
          </TouchableOpacity>

          {/* Hero Illustration with Red Ambient Glow */}
          <View style={styles.heroWrap}>
            <View style={styles.ambientGlow} />
            <Illustration
              name="throw-away_k2t5"
              width={200}
              height={140}
            />
          </View>

          {/* Title & Description */}
          <Text style={styles.title}>
            {isAll ? "Empty Entire Trash?" : `Permanently Delete "${target.name}"?`}
          </Text>
          <Text style={styles.desc}>
            This action is <Text style={styles.descDanger}>permanent and irreversible</Text>.{" "}
            {isAll
              ? "All items in Trash will be purged forever from your vault."
              : "This item will be purged forever from your vault."}
          </Text>

          {/* Master Password Input Field */}
          <View style={styles.inputSection}>
            <View style={styles.inputLabelRow}>
              <Lock size={12} color="#a1a1aa" style={{ marginRight: 4 }} />
              <Text style={styles.inputLabel}>Confirm Master Password</Text>
            </View>
            <View style={[styles.inputWrap, !!error && styles.inputWrapError]}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (error) setError("");
                }}
                placeholder="Enter master password..."
                placeholderTextColor="#52525b"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? (
                  <EyeOff size={16} color="#a1a1aa" />
                ) : (
                  <Eye size={16} color="#a1a1aa" />
                )}
              </TouchableOpacity>
            </View>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteBtn, loading && { opacity: 0.7 }]}
              onPress={handleConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Trash2 size={14} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.deleteBtnText}>
                    {isAll ? "Empty Trash" : "Delete Permanently"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#09090b",
    borderWidth: 1,
    borderColor: "rgba(38, 38, 38, 0.8)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  heroWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  ambientGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    top: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fafafa",
    textAlign: "center",
    marginBottom: 6,
  },
  desc: {
    fontSize: 13,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  descDanger: {
    color: "#f87171",
    fontWeight: "600",
  },
  inputSection: {
    width: "100%",
    marginBottom: 20,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#a1a1aa",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputWrapError: {
    borderColor: "#ef4444",
  },
  input: {
    flex: 1,
    height: 44,
    color: "#fafafa",
    fontSize: 14,
  },
  eyeBtn: {
    padding: 6,
  },
  errorText: {
    fontSize: 12,
    color: "#f87171",
    marginTop: 6,
    fontWeight: "500",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#27272a",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#fafafa",
  },
  deleteBtn: {
    flex: 1.2,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#ffffff",
  },
});

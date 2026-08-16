import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, Scan, ShieldAlert } from "lucide-react-native";
import Svg, { Defs, Mask, Rect } from "react-native-svg";
import { colors } from "../theme/colors";
import { parseOtpAuthUri, ParsedOtpAuth } from "../utils/otpauth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCANNER_SIZE = Math.round(SCREEN_WIDTH * 0.72);
const CORNER_RADIUS = 16;

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: (parsed: ParsedOtpAuth) => void;
}

export function QrScannerModal({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [layoutHeight, setLayoutHeight] = useState(SCREEN_HEIGHT - 60);

  // Reset scanned state when modal opens
  React.useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  if (!visible) return null;

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || !data) return;
    setScanned(true);

    const parsed = parseOtpAuthUri(data);
    if (parsed) {
      onScan(parsed);
      onClose();
    } else {
      // Invalid format reset after brief delay
      setTimeout(() => {
        setScanned(false);
      }, 1500);
    }
  };

  const targetX = Math.round((SCREEN_WIDTH - SCANNER_SIZE) / 2);
  const targetY = Math.round(layoutHeight > 0 ? (layoutHeight - SCANNER_SIZE) / 2.3 : 130);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
            <X size={20} color="#fafafa" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Scan size={18} color={colors.accent} />
            <Text style={styles.headerTitle}>Scan 2FA QR Code</Text>
          </View>
        </View>

        {/* Permission Check / Camera Content */}
        {!permission ? (
          <View style={styles.centerMsgBox}>
            <Text style={styles.infoText}>Initializing Camera...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerMsgBox}>
            <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: 16 }} />
            <Text style={styles.titleText}>Camera Access Required</Text>
            <Text style={styles.descText}>
              Vaultr needs camera permission to scan 2FA authenticator QR codes.
            </Text>
            <TouchableOpacity
              style={styles.grantBtn}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={styles.cameraWrapper}
            onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
          >
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torch}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
            >
              {/* Seamless SVG Overlay with Smooth Rounded Cutout (No gaps or unshaded corner pixels) */}
              <Svg
                width="100%"
                height="100%"
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                <Defs>
                  <Mask id="scanner-mask" x="0" y="0" width="100%" height="100%">
                    <Rect width="100%" height="100%" fill="#ffffff" />
                    <Rect
                      x={targetX}
                      y={targetY}
                      width={SCANNER_SIZE}
                      height={SCANNER_SIZE}
                      rx={CORNER_RADIUS}
                      ry={CORNER_RADIUS}
                      fill="#000000"
                    />
                  </Mask>
                </Defs>
                <Rect
                  width="100%"
                  height="100%"
                  fill="rgba(0, 0, 0, 0.65)"
                  mask="url(#scanner-mask)"
                />
              </Svg>

              {/* Corner Guides matching the exact rounded cutout */}
              <View
                style={[
                  styles.scannerTargetBox,
                  {
                    top: targetY,
                    left: targetX,
                  },
                ]}
                pointerEvents="none"
              >
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>

              {/* Instruction subtitle positioned below the target frame */}
              <View
                style={[
                  styles.instructionWrap,
                  {
                    top: targetY + SCANNER_SIZE + 24,
                  },
                ]}
                pointerEvents="none"
              >
                <Text style={styles.instructionText}>
                  Align the 2FA QR code inside the frame
                </Text>
              </View>
            </CameraView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    height: 60,
    backgroundColor: "#09090b",
    borderBottomWidth: 1,
    borderBottomColor: "#18181b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  headerTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#fafafa",
    fontSize: 16,
    fontWeight: "700",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraWrapper: {
    flex: 1,
    position: "relative",
  },
  centerMsgBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#09090b",
  },
  titleText: {
    color: "#fafafa",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  descText: {
    color: "#a1a1aa",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  infoText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  grantBtn: {
    backgroundColor: "#fafafa",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  grantBtnText: {
    color: "#09090b",
    fontSize: 14,
    fontWeight: "700",
  },

  // Corner Guides
  scannerTargetBox: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: "absolute",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#38bdf8",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: CORNER_RADIUS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: CORNER_RADIUS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: CORNER_RADIUS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: CORNER_RADIUS,
  },

  // Instructions
  instructionWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    alignItems: "center",
  },
  instructionText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});

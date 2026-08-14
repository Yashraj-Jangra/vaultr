import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { X, KeyRound, ShieldAlert } from "lucide-react-native";
import { colors } from "../theme/colors";
import { parseOtpAuthUri, ParsedOtpAuth } from "../utils/otpauth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCANNER_SIZE = SCREEN_WIDTH * 0.72;

interface Props {
  visible: boolean;
  onClose: () => void;
  onScan: (parsed: ParsedOtpAuth) => void;
}

export function QrScannerModal({ visible, onClose, onScan }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanned, setScanned] = useState(false);

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
            <KeyRound size={18} color={colors.accent} />
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
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              enableTorch={torch}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
            >
              {/* Overlay with cutout target */}
              <View style={styles.overlay}>
                <View style={styles.overlayTop} />
                <View style={styles.overlayMiddleRow}>
                  <View style={styles.overlaySide} />
                  <View style={styles.scannerTargetBox}>
                    {/* Corner Guides */}
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                  </View>
                  <View style={styles.overlaySide} />
                </View>
                <View style={styles.overlayBottom}>
                  <Text style={styles.instructionText}>
                    Align the 2FA QR code inside the frame
                  </Text>
                </View>
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
  iconBtnActive: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
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
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  overlayMiddleRow: {
    height: SCANNER_SIZE,
    flexDirection: "row",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  scannerTargetBox: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    position: "relative",
  },
  overlayBottom: {
    flex: 1.2,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    paddingTop: 32,
  },
  instructionText: {
    color: "#e4e4e7",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  // Corner accents
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#38bdf8",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
});

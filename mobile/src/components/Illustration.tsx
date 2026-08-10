import React from "react";
import { View, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";

// SVG XML Strings ported directly from /public/illustrations/
const SVG_MAP: Record<string, string> = {
  forgot_password: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="644" viewBox="0 0 800.314 644.708"><g transform="translate(-376.703 -155.001)"><g transform="translate(376.703 394.331)"><path d="M602.879,191.732a41.761,41.761,0,0,0,0,83.522H914.1a41.761,41.761,0,1,0,0-83.522Z" transform="translate(-561.118 -191.732)" fill="#1f1f1f"/><path d="M605.443,202.747a33.309,33.309,0,1,0,0,66.619H916.662a33.309,33.309,0,0,0,0-66.619Z" transform="translate(-563.682 -194.296)" fill="#111"/><path d="M685.91,271.217H623.989a1.492,1.492,0,1,1,0-2.983H685.91a1.492,1.492,0,0,1,0,2.983Z" transform="translate(-575.405 -209.539)" fill="#404040"/><circle cx="11.509" cy="11.509" r="11.509" transform="translate(67.9 24.934)" fill="#a78bfa"/></g><g transform="translate(650.718 262.182)"><path d="M371.108,645.409a10.02,10.02,0,0,1-3.437-.608l-74.652-27.132a10.075,10.075,0,0,1,1.506-19.357L500.7,557.949a10.1,10.1,0,0,1,5.011.292L563.317,576.7a10.077,10.077,0,0,1-.546,19.351L373.64,645.087a10.05,10.05,0,0,1-2.532.323Z" transform="translate(-286.383 -150.45)" fill="#09090b"/><path d="M657.371,105.763a86.173,86.173,0,1,0-86.654,108.605l44.807,101.938,63.516-90.48s-23.808-17.772-40.181-40.642a86.079,86.079,0,0,0,18.512-79.421Z" transform="translate(-271.314 -11.219)" fill="#f87171"/><path d="M769.908,342.528a76.523,76.523,0,0,0-70.29-47.753c-39.017-.376-88.681,9.827-90.728,63.75-3.39,89.283,0,53.346,0,53.346s-26.935,67.068,0,99.417S659.311,607.4,659.311,607.4H822.986s-28.256-74.676-23.4-125.623c3.294-34.583-12.416-96.553-29.677-139.245Z" transform="translate(-296.688 -70.035)" fill="#262626"/></g></g></svg>`,

  secure_login: `<svg xmlns="http://www.w3.org/2000/svg" width="793" height="551" viewBox="0 0 793 551.731"><ellipse cx="158" cy="539.731" rx="158" ry="12" fill="#1f1f1f"/><path d="M996.5,633.411,398.5,632.306l69.3-116.615.331-.552V258.13a23.752,23.752,0,0,1,23.754-23.754H899.792A23.752,23.752,0,0,1,923.546,258.13V516.906Z" transform="translate(-203.5 -174.134)" fill="#18181b"/><path d="M491.35,250.956a7.746,7.746,0,0,0-7.737,7.737V493.03a7.746,7.746,0,0,0,7.737,7.737H903.649a7.746,7.746,0,0,0,7.737-7.737V258.694a7.746,7.746,0,0,0-7.737-7.737Z" transform="translate(-203.5 -174.134)" fill="#0d0d0d"/><circle cx="707.334" cy="77.375" r="77.375" fill="#a78bfa" opacity="0.3"/><path d="M942.89,285.223H878.779a4.425,4.425,0,0,1-4.421-4.421V242.113a4.426,4.426,0,0,1,4.421-4.421H942.89a4.426,4.426,0,0,1,4.421,4.421v38.687A4.425,4.425,0,0,1,942.89,285.223Z" transform="translate(-203.5 -174.134)" fill="#f4f4f5"/></svg>`,

  authentication: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="626" viewBox="0 0 800 626.599"><g transform="translate(-662.08 -202)"><g transform="translate(864.697 429.896)"><path d="M570.063,342.355l49.2-41.552a8.32,8.32,0,0,0,.987-11.712L611.2,278.367a8.32,8.32,0,0,0-11.712-.987l-49.2,41.552a8.32,8.32,0,0,0-.987,11.712l9.056,10.724A8.32,8.32,0,0,0,570.063,342.355Z" transform="translate(-547.337 -275.422)" fill="#a78bfa"/></g><g transform="translate(932.454 202)"><path d="M793.355,341.767H343.509A15.21,15.21,0,0,1,328.39,326.5V148.464A15.21,15.21,0,0,1,343.509,133.2H793.355a15.21,15.21,0,0,1,15.118,15.265V326.5a15.21,15.21,0,0,1-15.118,15.265Z" transform="translate(-328.39 -133.199)" fill="#09090b"/><path d="M789.957,338.253H343.4a15.025,15.025,0,0,1-15.008-15.008V148.207A15.025,15.025,0,0,1,343.4,133.2H789.957a15.025,15.025,0,0,1,15.008,15.008V323.245a15.025,15.025,0,0,1-15.008,15.008Z" transform="translate(-326.634 -131.443)" fill="#18181b"/></g></g></svg>`,

  empty_trash: `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="515" viewBox="0 0 920.304 515.086"><path d="M923.907,706.923H751.691l-.033-.965-8.223-235.18h188.727Zm-170.284-2h168.352l8.117-232.145h-184.587Z" transform="translate(-139.847 -192.456)" fill="#3f3d56"/><g><rect x="639.825" y="321.896" width="13.099" height="162.097" fill="#262626"/><rect x="691.402" y="321.896" width="13.099" height="162.097" fill="#262626"/><rect x="742.978" y="321.896" width="13.099" height="162.097" fill="#262626"/></g></svg>`,

  empty_vault: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><g transform="translate(50 50)"><circle cx="150" cy="150" r="140" fill="none" stroke="#262626" stroke-width="4" stroke-dasharray="8 8"/><path d="M150,50 L230,90 L230,190 C230,245 150,280 150,280 C150,280 70,245 70,190 L70,90 Z" fill="#111" stroke="#333" stroke-width="4"/><path d="M150,75 L210,105 L210,180 C210,225 150,255 150,255 C150,255 90,225 90,180 L90,105 Z" fill="#18181b"/><circle cx="150" cy="155" r="24" fill="#a78bfa" opacity="0.3"/><path d="M142 145 H158 V165 H142 Z" fill="#f4f4f5"/></g></svg>`,
};

interface IllustrationProps {
  name: "forgot_password" | "secure_login" | "authentication" | "empty_trash" | "empty_vault";
  width?: number;
  height?: number;
  style?: any;
}

export function Illustration({ name, width = 160, height = 120, style }: IllustrationProps) {
  const xml = SVG_MAP[name] || SVG_MAP.empty_vault;
  return (
    <View style={[styles.container, style]}>
      {/* Subtle ambient glow wrapper per design guidelines */}
      <View style={styles.ambientGlow} />
      <SvgXml xml={xml} width={width} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ambientGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(167, 139, 250, 0.05)",
  },
});

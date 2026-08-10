/**
 * Native Item Preview Canvas Component (Web-Parity Match)
 * Renders live visual previews for Vault items (Credit Cards, Login Keycards, Secure Notes, Address Labels, Profile Badges).
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View, Image } from "react-native";
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Polygon } from "react-native-svg";
import { Template } from "@vaultr/core";
import { Globe, User, FileText, MapPin } from "lucide-react-native";
import { resolveDomain } from "@vaultr/core";

// ── Brand detection (fallback when no explicit cardBrand) ────────────────────
export function detectCardBrand(cardNumber: string): string {
  const clean = cardNumber.replace(/\D/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "AMEX";
  if (/^(6011|65|64[4-9]|622)/.test(clean)) return "Discover";
  if (/^(60|6521|6522)/.test(clean)) return "RuPay";
  return "";
}

interface ItemPreviewCardProps {
  template: Template;
  name?: string;
  // Login fields
  username?: string;
  url?: string;
  domain?: string;
  // Card fields
  cardholderName?: string;
  cardNumber?: string;
  expMonth?: string;
  expYear?: string;
  cvv?: string;
  cardBrand?: string; // Explicit override (Visa, Mastercard, AMEX, Discover, RuPay, Other)
  expiry?: string;    // Combined "MM / YYYY" from web
  cardName?: string;  // Web uses cardName
  isNumberVisible?: boolean; // Show card number digits when revealed
  // Address fields
  street?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  // Profile fields
  fullName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  idNumber?: string;
  // Note fields
  note?: string;
}

export function ItemPreviewCard(props: ItemPreviewCardProps) {
  const { template } = props;

  if (template === "card") return <CreditCardVisual {...props} />;
  if (template === "login") return <LoginKeycardVisual {...props} />;
  if (template === "note") return <NotePaperVisual {...props} />;
  if (template === "address") return <AddressLabelVisual {...props} />;
  if (template === "profile") return <ProfileBadgeVisual {...props} />;

  return null;
}

// ── 1. EMV Chip (Exact Match) ────────────────────────────────────────────────
function EmvChip() {
  return (
    <View style={chip.outer}>
      <View style={chip.grid}>
        <View style={chip.row}>
          <View style={[chip.cell, chip.borderR, chip.borderB]} />
          <View style={[chip.cell, chip.borderR, chip.borderB]} />
          <View style={[chip.cell, chip.borderB]} />
        </View>
        <View style={chip.row}>
          <View style={[chip.cell, chip.borderR]} />
          <View style={[chip.cell, chip.borderR]} />
          <View style={chip.cell} />
        </View>
      </View>
    </View>
  );
}

const chip = StyleSheet.create({
  outer: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#F5D77D",
    padding: 4,
    justifyContent: "center",
  },
  grid: { flex: 1, gap: 1 },
  row: { flex: 1, flexDirection: "row", gap: 1 },
  cell: { flex: 1, backgroundColor: "rgba(0,0,0,0.08)", borderRadius: 1 },
  borderR: { borderRightWidth: 1, borderRightColor: "rgba(0,0,0,0.15)" },
  borderB: { borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.15)" },
});

// ── 2. Brand Logos ───────────────────────────────────────────────────────────

function VisaLogo() {
  return (
    <Svg width={58} height={20} viewBox="27 176 449 145">
      <Path fill="#FFFFFF" d="M428.322,179.488c4.375,0.002,8.763,0.209,13.121-0.065c3.346-0.21,4.728,0.999,5.386,4.277c3.464,17.256,7.134,34.471,10.733,51.7c5.662,27.105,11.319,54.211,16.994,81.313c0.862,4.115,0.801,4.285-3.251,4.298c-8.862,0.027-17.725-0.055-26.587,0.044c-2.689,0.03-4.024-0.758-4.474-3.648c-0.775-4.977-2.1-9.865-3.049-14.818c-0.38-1.983-1.192-2.855-3.33-2.843c-13.573,0.074-27.147,0.076-40.72-0.004c-1.941-0.011-2.837,0.786-3.427,2.465c-1.858,5.29-3.844,10.535-5.651,15.842c-0.725,2.129-1.966,3.001-4.213,2.989c-10.769-0.061-21.539-0.078-32.308,0.014c-3.281,0.028-3.136-1.364-2.137-3.738c10.047-23.878,20.044-47.777,30.051-71.672c7.624-18.205,15.281-36.396,22.846-54.626c3.209-7.732,8.935-11.501,17.227-11.526C419.796,179.475,424.059,179.486,428.322,179.488z M419.993,220.363c-0.616,0.71-0.823,0.852-0.894,1.044c-5.611,15.372-11.191,30.756-16.834,46.116c-0.948,2.58,0.359,2.852,2.393,2.842c7.513-0.037,15.027-0.064,22.539,0.014c2.364,0.025,3.179-0.583,2.615-3.143c-2.17-9.848-4.132-19.742-6.186-29.616c-1.551-7.798-2.737-13.368-4.025-19.48C422.467,232.045,421.281,226.475,419.993,220.363z" />
      <Path fill="#FFFFFF" d="M120.429,272.953c2.395-6.006,4.807-12.005,7.181-18.019c9.515-24.103,19.052-48.198,28.472-72.338c0.946-2.425,2.307-3.175,4.772-3.152c10.323,0.097,20.647,0.033,30.971,0.045c4.4,0.005,4.541,0.21,2.821,4.317c-10.749,25.66-21.514,51.314-32.27,76.971c-7.937,18.932-15.918,37.846-23.747,56.822c-1.087,2.635-2.628,3.487-5.334,3.461c-10.435-0.103-20.872-0.095-31.307-0.01c-2.628,0.021-3.927-0.745-4.641-3.538c-9.251-36.183-18.757-72.301-27.912-108.508c-1.786-7.065-5.498-11.686-12.119-14.522c-9.423-4.036-19.139-7.055-29.088-9.416c-1.877-0.445-3.919-0.783-2.999-3.657c0.586-1.831,1.953-1.921,3.466-1.921c6.845,0.001,13.69-0.004,20.535-0.004c12.456-0.001,24.912-0.016,37.367,0.005c9.704,0.016,16.333,5.095,18.201,14.602c4.15,21.124,8.026,42.301,12.024,63.455c0.968,5.122,1.977,10.237,2.967,15.356c0.978,4.996,1.191,5.013,1.405,5.029C120.002,272.92,120.215,272.937,120.429,272.953z" />
      <Path fill="#FFFFFF" d="M318.913,176.815c10.742,0.128,21.181,1.975,31.4,5.278c2.579,0.834,3.226,2.057,2.601,4.697c-1.834,7.748-3.483,15.542-5.048,23.35c-0.558,2.787-1.562,3.485-4.33,2.324c-11.42-4.79-23.282-6.515-35.57-4.413c-3.375,0.577-6.428,1.994-8.932,4.403c-3.902,3.754-4.185,8.129-0.662,12.231c3.216,3.746,7.62,5.864,11.853,8.16c7.887,4.278,15.934,8.256,22.971,13.958c14.912,12.081,16.772,29.412,10.043,45.348c-6.455,15.287-19.152,23.361-34.511,27.57c-20.866,5.719-41.557,3.995-61.977-2.51c-4.54-1.446-4.542-1.63-3.552-6.226c1.701-7.894,3.557-15.757,5.082-23.685c0.574-2.982,1.66-3.091,4.059-1.912c11.955,5.875,24.615,8.23,37.892,7.237c4.785-0.358,9.259-1.692,13.175-4.571c5.794-4.26,6.118-11.759,0.737-16.543c-4.673-4.155-10.228-6.859-15.756-9.611c-7.361-3.665-14.298-7.913-20.28-13.681c-12.908-12.445-13.602-28.809-6.062-43.276c7.931-15.217,21.836-22.314,37.836-26.017c8.204-1.895,14.579-2.48,21-2.562C306.123,177.482,312.498,176.897,318.913,176.815z" />
      <Path fill="#FFFFFF" d="M229.57,179.488c4.935,0.003,9.875,0.142,14.803-0.047c3.249-0.125,3.736,1.135,3.103,4.03c-4.19,19.163-8.268,38.351-12.365,57.534c-5.361,25.1-10.764,50.191-15.989,75.32c-0.72,3.464-2.013,4.886-5.732,4.778c-8.965-0.26-17.943-0.078-26.915-0.086c-5.587-0.005-5.596-0.016-4.456-5.34c6.993-32.661,13.988-65.322,20.986-97.982c2.489-11.617,5.068-23.215,7.424-34.859c0.542-2.678,1.787-3.463,4.338-3.391C219.698,179.583,224.635,179.485,229.57,179.488z" />
    </Svg>
  );
}

function MastercardLogo() {
  return (
    <View style={{ width: 44, height: 27, position: "relative" }}>
      <Svg width="100%" height="100%" viewBox="0 0 625.48 388.33">
        <Polygon fill="#ff5f00" fillRule="evenodd" points="228.17 346.82 397.31 346.82 397.31 41.52 228.17 41.52 228.17 346.82" />
        <Path fill="#eb001b" fillRule="evenodd" d="M426.17,500A194.12,194.12,0,0,1,500,347.35a191.92,191.92,0,0,0-119.46-41.51c-106.75,0-193.28,86.93-193.28,194.16s86.53,194.17,193.28,194.17A191.93,191.93,0,0,0,500,652.65,194.12,194.12,0,0,1,426.17,500" transform="translate(-187.26 -305.83)" />
        <Path fill="#f79e1b" fillRule="evenodd" d="M812.74,500c0,107.23-86.54,194.16-193.28,194.16A191.92,191.92,0,0,1,500,652.65a194.72,194.72,0,0,0,0-305.3,191.93,191.93,0,0,1,119.46-41.52c106.74,0,193.28,86.94,193.28,194.17Z" transform="translate(-187.26 -305.83)" />
      </Svg>
    </View>
  );
}

function AmexLogo() {
  return (
    <View style={{ width: 44, height: 27 }}>
      <Svg width="100%" height="100%" viewBox="51 182 424 160">
        <Path
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M475,311.637c0,10.597-6.711,15.542-18.721,15.542h-22.959 v-10.597h22.959c2.119,0,3.885-0.353,4.592-1.06c0.706-0.706,1.412-1.766,1.412-3.179c0-1.412-0.706-2.826-1.412-3.532 c-0.707-0.707-2.119-1.06-4.239-1.06c-10.949-0.354-24.725,0.353-24.725-15.188c0-7.065,4.592-14.836,16.954-14.836h23.666v10.597 h-21.899c-2.119,0-3.533,0-4.592,0.706c-1.06,1.06-1.766,2.119-1.766,3.885c0,1.766,1.06,2.825,2.472,3.532 c1.413,0.353,2.826,0.706,4.592,0.706h6.358c6.711,0,10.949,1.413,13.775,3.885C473.587,303.513,475,306.692,475,311.637 L475,311.637L475,311.637z M425.196,301.04c-2.826-2.472-7.064-3.885-13.775-3.885h-6.358c-1.766,0-3.179-0.354-4.591-0.706 c-1.413-0.707-2.473-1.767-2.473-3.532c0-1.766,0.354-2.826,1.766-3.885c1.06-0.706,2.473-0.706,4.592-0.706h21.899v-10.597H402.59 c-12.715,0-16.954,7.77-16.954,14.836c0,15.541,13.776,14.835,24.725,15.188c2.119,0,3.532,0.353,4.239,1.06 c0.706,0.706,1.413,2.119,1.413,3.532c0,1.413-0.706,2.473-1.413,3.179c-1.06,0.706-2.473,1.06-4.592,1.06h-22.959v10.597h22.959 c12.01,0,18.721-4.945,18.721-15.542C428.728,306.692,427.315,303.513,425.196,301.04L425.196,301.04L425.196,301.04z M379.984,316.935H352.08v-9.891h27.198v-9.89H352.08v-9.184h27.904v-10.243h-39.56v49.451h39.56V316.935L379.984,316.935z M327.708,280.2c-3.885-2.119-8.477-2.473-14.482-2.473h-27.197v49.451h12.009v-18.014h12.716c4.239,0,6.711,0.353,8.477,2.119 c2.119,2.473,2.119,6.712,2.119,9.891v6.005h11.656v-9.537c0-4.591-0.353-6.711-1.766-9.184c-1.06-1.413-3.179-3.179-6.005-4.239 c3.179-1.06,8.477-5.298,8.477-13.069C333.713,285.498,331.594,282.32,327.708,280.2L327.708,280.2L327.708,280.2z M260.597,277.728h-37.795l-15.188,16.248l-14.482-16.248h-47.684v49.451h46.978l15.188-16.248l14.482,16.248h22.96v-16.601h14.835 c10.243,0,20.487-2.826,20.487-16.601C280.376,280.553,269.78,277.728,260.597,277.728L260.597,277.728L260.597,277.728z M318.171,298.214c-1.767,0.706-3.533,0.706-5.652,0.706l-14.482,0.353v-11.303h14.482c2.119,0,4.239,0,5.652,1.06 c1.412,0.706,2.472,2.119,2.472,4.239C320.643,295.389,319.584,297.155,318.171,298.214L318.171,298.214L318.171,298.214z M260.597,300.687h-15.542v-12.716h15.542c4.239,0,7.064,1.766,7.064,6.005C267.661,298.214,264.835,300.687,260.597,300.687 L260.597,300.687L260.597,300.687z M215.031,302.453l18.367-19.427v39.914L215.031,302.453L215.031,302.453z M186.421,316.935 h-29.318v-9.891h26.139v-9.89h-26.139v-9.184h29.671l13.069,14.482L186.421,316.935L186.421,316.935z M442.151,242.053h-16.955 l-22.252-37.088v37.088h-24.018l-4.592-10.95h-24.725l-4.592,10.95H331.24c-5.652,0-13.069-1.413-17.307-5.652 c-3.885-4.239-6.005-9.89-6.005-18.721c0-7.417,1.06-14.129,6.357-19.427c3.532-3.885,9.891-5.651,18.014-5.651h11.303v10.597 H332.3c-4.239,0-6.712,0.706-9.184,2.826c-2.119,2.119-3.179,6.004-3.179,11.303c0,5.298,1.06,9.184,3.179,11.656 c1.766,1.767,4.945,2.473,8.124,2.473h5.298l16.954-38.854h17.661l19.78,46.624v-46.624h18.367l20.84,34.262v-34.262h12.009 V242.053L442.151,242.053z M301.923,192.602h-12.009v49.451h12.009V192.602L301.923,192.602z M276.845,194.721 c-3.885-2.119-8.124-2.119-14.129-2.119h-27.198v49.451h11.656v-18.015h12.715c4.239,0,7.064,0.354,8.831,2.119 c2.119,2.473,1.766,6.712,1.766,9.537v6.358h12.009v-9.891c0-4.238-0.353-6.357-2.119-8.83c-1.06-1.413-3.178-3.179-5.651-4.239 c3.179-1.413,8.477-5.298,8.477-13.069C283.203,200.373,280.73,197.194,276.845,194.721L276.845,194.721L276.845,194.721z M227.041,231.81H199.49v-9.891h27.198v-10.243H199.49v-8.83h27.551v-10.243h-39.56v49.451h39.56V231.81L227.041,231.81z M178.65,192.602h-19.427l-14.482,33.555L129.2,192.602h-19.074v46.624l-20.133-46.624H72.331l-21.193,49.451h12.715l4.592-10.95 h24.725l4.591,10.95h24.019v-38.854l17.308,38.854h10.243l17.308-38.854v38.854h12.009V192.602L178.65,192.602z M370.094,220.507 l-8.124-19.427l-8.124,19.427H370.094L370.094,220.507z M267.661,212.735c-1.766,1.06-3.533,1.06-6.005,1.06h-14.482v-10.95h14.482 c2.119,0,4.591,0,6.005,0.706c1.412,1.06,2.119,2.473,2.119,4.592C269.78,210.263,269.073,212.029,267.661,212.735L267.661,212.735 L267.661,212.735z M72.685,220.507l8.124-19.427l8.124,19.427H72.685L72.685,220.507z"
        />
      </Svg>
    </View>
  );
}

function DiscoverLogo() {
  return (
    <View style={{ width: 66, height: 11 }}>
      <Svg width="100%" height="100%" viewBox="25 213 450 73">
        <Path fill="#231F20" d="M25,216.02c0-1.16,0.17-1.59,1.49-1.57c6.76,0.1,13.53-0.09,20.29,0.12c9.94,0.31,18.98,3.21,26.35,10.23 c5.07,4.83,8.26,10.75,9.52,17.61c2.5,13.68-1.36,25.28-11.77,34.56c-5.69,5.06-12.5,7.61-20.03,8.22 c-8.3,0.67-16.62,0.14-24.93,0.32c-0.99,0.02-0.88-0.52-0.88-1.14C25.03,277.36,25.04,227.34,25,216.02z M38.83,272.15 c-0.01,0.96,0.2,1.27,1.21,1.26c2.77-0.04,5.55-0.01,8.3-0.32c5.03-0.56,9.74-2.01,13.43-5.69c6.19-6.19,8.46-13.72,6.74-22.24 c-1.73-8.58-6.67-14.62-15.23-17.28c-4.17-1.29-8.51-1.21-12.82-1.27c-1.23-0.02-1.66,0.23-1.64,1.58 C38.9,235.48,38.87,264.78,38.83,272.15z" />
        <Path fill="#231F20" d="M444.7,255.72c7.44,9.95,14.76,19.74,22.25,29.76c-1.17,0-2.08,0-2.99,0c-4.18,0-8.37-0.06-12.55,0.04 c-1.27,0.03-1.9-0.44-2.56-1.42c-5.8-8.69-11.64-17.35-17.48-26.01c-0.08-0.12-0.17-0.23-0.23-0.36c-0.35-0.87-1.11-0.81-1.78-0.67 c-0.74,0.15-0.39,0.85-0.39,1.29c-0.02,8.5-0.05,17.01,0.02,25.51c0.01,1.41-0.41,1.69-1.72,1.66c-3.66-0.09-7.33-0.06-10.99-0.01 c-0.92,0.01-1.3-0.16-1.3-1.21c0.03-22.88,0.03-45.77,0.01-68.65c0-0.78,0.08-1.19,1.04-1.17c7.89,0.16,15.79-0.31,23.67,0.29 c5.47,0.42,10.62,1.9,14.83,5.63c5.05,4.48,6.47,10.35,6.12,16.81c-0.5,9.51-5.69,15.79-14.92,18.13 C445.43,255.42,445.13,255.56,444.7,255.72z M428.97,236.48c0,3.14,0.06,6.29-0.03,9.43c-0.03,1.1,0.32,1.32,1.33,1.28 c2.06-0.08,4.12-0.04,6.18-0.26c6.03-0.64,9.46-4.12,9.91-10.16c0.36-4.86-2.12-8.54-6.75-10.06c-3.04-1-6.18-0.89-9.32-0.95 c-1.02-0.02-1.37,0.2-1.35,1.3C429.02,230.19,428.97,233.34,428.97,236.48z" />
        <Path fill="#231F20" d="M366.71,215.87c0-1.07,0.21-1.41,1.36-1.41c12.22,0.05,24.43,0.04,36.65,0.01c0.95,0,1.29,0.18,1.27,1.21 c-0.07,3.29-0.07,6.58,0,9.87c0.02,0.99-0.35,1.12-1.2,1.12c-7.56-0.03-15.13,0.02-22.69-0.05c-1.29-0.01-1.54,0.36-1.52,1.57 c0.08,4.27,0.07,8.55,0,12.82c-0.02,1.07,0.28,1.33,1.33,1.32c7.28-0.05,14.56,0,21.85-0.06c1.15-0.01,1.37,0.34,1.35,1.4 c-0.07,3.15-0.07,6.3,0,9.44c0.02,0.99-0.26,1.23-1.24,1.23c-7.23-0.04-14.47,0.02-21.7-0.06c-1.35-0.01-1.6,0.41-1.58,1.65 c0.06,5.36,0.06,10.71,0,16.07c-0.01,1.07,0.21,1.42,1.36,1.41c7.56-0.06,15.13,0,22.69-0.06c1.13-0.01,1.38,0.31,1.36,1.39 c-0.07,3.24-0.05,6.48-0.01,9.72c0.01,0.78-0.18,1.04-1,1.04c-12.4-0.03-24.81-0.04-37.21,0.01c-1.13,0-1.04-0.55-1.04-1.29 C366.74,272.76,366.75,227.19,366.71,215.87z" />
        <Path fill="#231F20" d="M117.67,264.97c1.87,3.5,4.33,6.34,7.96,7.94c3.9,1.71,7.92,2.31,11.97,0.5c3.68-1.64,5.67-4.58,5.82-8.57 c0.16-3.96-1.96-6.61-5.39-8.32c-3.94-1.97-8.2-3.13-12.23-4.88c-3.93-1.71-7.68-3.69-10.4-7.19c-1.66-2.14-2.58-4.58-2.9-7.2 c-1.43-11.66,4.95-20,14.64-22.74c10.12-2.86,19.23-0.35,27.39,6.07c0.6,0.47,0.81,0.81,0.23,1.53c-2.08,2.6-4.11,5.24-6.07,7.93 c-0.6,0.82-0.86,0.59-1.4,0.01c-2.22-2.37-4.77-4.29-8.07-4.76c-4.17-0.6-8.11-0.06-11.01,3.39c-2.59,3.09-2.02,6.98,1.26,9.31 c2.93,2.08,6.35,3.13,9.66,4.41c3.1,1.2,6.13,2.54,9.03,4.18c5.91,3.35,9.16,8.27,9.59,15.16c0.71,11.64-5.4,21.47-16.8,24.39 c-12.16,3.12-24.04-0.34-31.84-11.85c-0.32-0.48-0.36-0.75,0.09-1.17C112.01,270.43,114.81,267.72,117.67,264.97z" />
        <Path fill="#231F20" d="M292.33,214.49c4.82,0,9.42,0.03,14.02-0.03c0.92-0.01,1.28,0.32,1.6,1.12c4.24,10.72,16.44,41.43,18.32,46.17 c0.86-0.94,13.05-31.87,18.8-46.22c0.23-0.57,0.39-1.08,1.23-1.07c4.69,0.04,9.39,0.02,14.28,0.02 c-1.12,2.68-21.23,50.4-30.18,71.71c-0.35,0.84-0.75,1.12-1.63,1.09c-1.78-0.07-3.57-0.06-5.35,0c-0.79,0.03-1.15-0.26-1.45-0.98 c-5.52-13.38-24.87-60.13-29-70.14C292.76,215.65,292.58,215.13,292.33,214.49z" />
        <Path fill="#231F20" d="M216.82,233.69c-2.62-2.5-5.13-4.61-8.13-6c-11.8-5.45-26,0.4-30.54,12.91c-3.5,9.64-2.34,18.8,4.7,26.62 c4.7,5.23,10.92,7.14,17.85,7.07c5.5-0.06,10.05-2.29,14.07-5.85c0.59-0.52,1.16-1.07,1.74-1.6c0.5,0.27,0.29,0.7,0.29,1.03 c0.02,4.65,0,9.3,0.02,13.95c0,0.71-0.1,1.14-0.87,1.51c-14.24,6.86-32.26,4.14-43.41-7.26c-6.9-7.06-10.29-15.58-10.51-25.45 c-0.36-16.69,10.76-31.25,26.23-35.93c9.49-2.87,18.76-2.32,27.71,2.17c0.48,0.24,0.85,0.45,0.85,1.11 C216.81,223.1,216.82,228.22,216.82,233.69z" />
        <Path fill="#231F20" d="M103.59,283.93c0,1.17-0.17,1.63-1.5,1.59c-3.76-0.11-7.52-0.07-11.28-0.02c-0.91,0.01-1.19-0.22-1.19-1.16 c0.03-22.88,0.03-45.77,0-68.65c0-1.03,0.34-1.23,1.28-1.22c3.71,0.05,7.42,0.08,11.13-0.01c1.23-0.03,1.57,0.27,1.56,1.53 C103.54,227.36,103.55,272.66,103.59,283.93z" />
        <Path fill="#F8A020" d="M300.53,229.54c18.78,21.25,19.07,51.67,0.65,67.95c-18.42,16.28-48.58,12.25-67.36-9 c-18.78-21.25-19.07-51.67-0.65-67.95C251.59,204.27,281.74,208.29,300.53,229.54z" />
      </Svg>
    </View>
  );
}

function RuPayLogo() {
  return (
    <View style={{ width: 50, height: 13 }}>
      <Svg width="100%" height="100%" viewBox="30 199 421 111">
        <Path fill="#FFFFFF" d="M267.073,221.85c1.981-15.684-9.973-22.231-24.895-22.231c-7.004,0-39.208,0-39.208,0 l-23.144,84.353h24.914l7.006-26.007l19.85,0.121C231.595,258.087,262.335,259.387,267.073,221.85z M241.454,230.223 c-3.242,9.045-12.176,7.98-12.176,7.98l-12.198,0.004l4.815-17.92c0,0,7.72,0.039,12.821,0.039 C240.959,220.327,243.224,225.284,241.454,230.223z" />
        <Path fill="#FFFFFF" d="M124.745,222.686h22.725l-9.36,36.007c0,0-2.334,8.029,5.178,8.649 c5.933,0.491,10.349-6.59,11.795-11.386c1.9-6.298,9.288-33.27,9.288-33.27h23.41l-17.815,61.285h-20.441l2.512-8.756 c0,0-10.43,12.715-25.923,11.191c-13.772-1.353-14.96-11.343-12.574-23.805C114.713,256.484,124.745,222.686,124.745,222.686z" />
        <Path fill="#FFFFFF" d="M322.344,253.747c2.994-10.194,6.779-19.848,3.731-25.198c-4.664-8.189-13.095-8.908-25.428-8.908 c-13.627,0-30.451,2.589-35.933,20.709c8.525,0,22.686,0,22.686,0s2.066-6.825,10.583-6.395c7.537,0.38,7.125,5.567,4.347,8.433 c-4.871,5.025-18.325,2.238-33.224,7.408c-13.018,4.516-17.574,21.634-14.746,28.467c2.741,6.623,7.846,7.469,14.731,8.146 c11.059,1.087,19.538-5.08,23.485-8.699c0,4.018,0.105,6.263,0.105,6.263h23.872l-0.057-2.246c0,0-2.127-0.564-1.89-3.553 C314.78,275.983,318.904,265.456,322.344,253.747z M288.019,271.487c-3.893,0.989-8.613,1.522-9.55-2.013 c-2.571-9.692,20.122-12.529,20.122-12.529C298.744,265.775,291.006,270.727,288.019,271.487z" />
        <Path fill="#FFFFFF" d="M119.093,219.261c1.98-15.682-11.819-19.642-26.741-19.642c-7.004,0-39.208,0-39.208,0L30,283.972 h24.914l7.779-28.64l13.975,0.114c0,0,5.767-0.335,5.881,5.082c0.122,5.778-4.282,16.387-3.997,23.444c3.312,0,25.594,0,25.594,0 l-0.057-2.246c0,0-2.127-0.564-1.89-3.553c0.099-1.244,1.472-5.178,3.268-10.485c1.083-2.339,2.718-7.888,2.567-12.408 c-0.189-5.642-3.728-8.259-8.832-10.091C115.115,241.458,119.093,219.261,119.093,219.261z M92.663,230.031 c-3.222,7.463-13.211,6.614-13.211,6.614l-11.629-0.054l4.247-15.804c0,0,10.404,0.039,15.505,0.039 C93.036,220.826,94.742,225.213,92.663,230.031z" />
        <Path fill="#FFFFFF" d="M333.155,222.686h23.144v36.77l20.022-36.77h21.241l-42.824,74.341c0,0-3.975,6.236-8.907,9.535 c-4.052,2.712-9.032,2.591-10.554,2.7c-8.459-0.073-18.662-0.096-18.662-0.096l4.921-17.72l7.965-0.014c0,0,3.644-0.371,5.053-2.17 c1.342-1.713,2.027-3.426,2.027-5.938C336.581,279.557,333.155,222.686,333.155,222.686z" />
        <Polygon fill="#0F8047" points="427.253,208.526 400.531,301.481 450.549,255.003" />
        <Polygon fill="#F0721D" points="410.124,208.526 383.402,301.481 433.42,255.003" />
      </Svg>
    </View>
  );
}

const logoStyles = StyleSheet.create({});

// ── 3. Credit Card Visual (1:1 Web Parity) ──────────────────────────────────

function CreditCardVisual({
  cardholderName = "",
  cardName = "",
  cardNumber = "",
  expMonth = "",
  expYear = "",
  expiry = "",
  cardBrand = "",
  isNumberVisible = false,
}: ItemPreviewCardProps) {

  // Resolve effective brand: explicit > auto-detect from number
  const effectiveBrand = useMemo(() => {
    if (cardBrand && cardBrand.toLowerCase() !== "auto-detect") return cardBrand;
    return detectCardBrand(cardNumber);
  }, [cardBrand, cardNumber]);

  const isVisa = effectiveBrand?.toLowerCase() === "visa";
  const isMC = effectiveBrand?.toLowerCase() === "mastercard";
  const isAmex = effectiveBrand?.toLowerCase() === "amex";
  const isDiscover = effectiveBrand?.toLowerCase() === "discover";
  const isRuPay = effectiveBrand?.toLowerCase() === "rupay";

  // Background themes matching web exactly
  const theme = useMemo(() => {
    if (isVisa) return { bg: "#151233", border: "#2B1B54" };
    if (isMC) return { bg: "#141415", border: "#26262a" };
    if (isAmex) return { bg: "#090909", border: "rgba(245,158,11,0.3)" };
    if (isDiscover) return { bg: "#0C0603", border: "#2A1409" };
    if (isRuPay) return { bg: "#02080D", border: "#004e92" };
    if (effectiveBrand?.toLowerCase() === "other") return { bg: "#0f1d1a", border: "#1a3330" };
    return { bg: "#121215", border: "#242429" };
  }, [isVisa, isMC, isAmex, isDiscover, isRuPay, effectiveBrand]);

  // Format card number: last group visible, rest bullet-masked
  const num = cardNumber.replace(/\D/g, "");
  const groups = isAmex ? [4, 6, 5] : [4, 4, 4, 4];
  const digitGroups: string[] = [];
  let charIndex = 0;
  for (let g = 0; g < groups.length; g++) {
    let group = "";
    const isLastGroup = g === groups.length - 1;
    for (let i = 0; i < groups[g]; i++) {
      const idx = charIndex++;
      if (idx < num.length) {
        group += (isLastGroup || isNumberVisible) ? num[idx] : "•";
      } else {
        group += "-";
      }
    }
    digitGroups.push(group);
  }
  const formattedNumber = digitGroups.length
    ? digitGroups.join("  ")
    : "•••• •••• •••• ••••";

  // Expiry: combine from parts or use pre-combined web format
  const expiryStr = useMemo(() => {
    if (expiry) return expiry; // web format "MM / YYYY"
    if (expMonth || expYear) {
      return `${expMonth.padStart(2, "0") || "MM"} / ${expYear || "YY"}`;
    }
    return "00/00";
  }, [expiry, expMonth, expYear]);

  const displayName = cardholderName || cardName || "CARDHOLDER NAME";

  return (
    <View style={[card.container, { backgroundColor: theme.bg, borderColor: theme.border }]}>

      {/* Background Graphics Layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {isVisa && (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 320 200" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="visaWave" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#8E2DE2" stopOpacity="0.4" />
                <Stop offset="100%" stopColor="#4A00E0" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d="M-20,100 C80,40 180,160 340,80 L340,200 L-20,200 Z" fill="url(#visaWave)" />
            <Path d="M-20,130 C120,70 160,180 340,110 L340,200 L-20,200 Z" fill="url(#visaWave)" opacity="0.6" />
          </Svg>
        )}
        {isMC && (
          <>
            <View style={card.mcGlow1} />
            <View style={card.mcGlow2} />
          </>
        )}
        {isAmex && (
          <>
            <View style={card.amexBorder1} />
            <View style={card.amexBorder2} />
          </>
        )}
        {isDiscover && (
          <>
            <View style={card.discoverArc1} />
            <View style={card.discoverArc2} />
            <View style={card.discoverArc3} />
          </>
        )}
        {isRuPay && (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 320 200" preserveAspectRatio="none">
            <Path d="M0,40 L320,40 M0,80 L320,80 M0,120 L320,120 M0,160 L320,160" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            <Path d="M60,0 L60,200 M120,0 L120,200 M180,0 L180,200 M240,0 L240,200" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
          </Svg>
        )}
      </View>

      {/* Top Row: EMV Chip (left) + Brand Logo (right) */}
      <View style={card.topRow}>
        <EmvChip />
        <View style={card.logoWrap}>
          {isVisa && <VisaLogo />}
          {isMC && <MastercardLogo />}
          {isAmex && <AmexLogo />}
          {isDiscover && <DiscoverLogo />}
          {isRuPay && <RuPayLogo />}
          {!isVisa && !isMC && !isAmex && !isDiscover && !isRuPay && effectiveBrand ? (
            <Text style={card.fallbackBrandText}>{effectiveBrand.toUpperCase()}</Text>
          ) : null}
        </View>
      </View>

      {/* Card Number */}
      <View style={card.numberWrap}>
        <Text style={card.numberText} numberOfLines={1}>{num.length > 0 ? formattedNumber : "•••• •••• •••• ••••"}</Text>
      </View>

      {/* Bottom Row: Name + Expiry */}
      <View style={card.bottomRow}>
        <View style={card.colLeft}>
          <Text style={card.metaLabel}>Cardholder Name</Text>
          <Text style={card.nameText} numberOfLines={1}>{displayName}</Text>
        </View>
        <View style={card.colRight}>
          <Text style={card.metaLabel}>Expiry Date</Text>
          <Text style={card.expiryText}>{expiryStr}</Text>
        </View>
      </View>
    </View>
  );
}

// ── 4. Login Keycard with SiteIcon ───────────────────────────────────────────

function LoginKeycardVisual({ name, username, url, domain }: ItemPreviewCardProps) {
  const [faviconError, setFaviconError] = React.useState(false);

  const effectiveDomain = useMemo(() => {
    return resolveDomain(domain, name || "", url);
  }, [domain, name, url]);

  const displayDomain = useMemo(() => {
    if (!url) return effectiveDomain || "vaultr.auth";
    try {
      const clean = url.startsWith("http") ? url : `https://${url}`;
      return new URL(clean).hostname;
    } catch {
      return url;
    }
  }, [url, effectiveDomain]);

  const faviconSrc = effectiveDomain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(effectiveDomain)}&sz=64`
    : null;

  return (
    <View style={[login.container]}>
      {/* Ambient glow */}
      <View style={login.glow} pointerEvents="none" />

      {/* Top Row: Label + Site Favicon */}
      <View style={login.topRow}>
        <View>
          <Text style={login.cardTag}>ACCESS KEYCARD</Text>
          <Text style={login.title} numberOfLines={1}>{name || "Untitled Login"}</Text>
        </View>
        {/* Site favicon or fallback Globe */}
        <View style={login.faviconBox}>
          {faviconSrc && !faviconError ? (
            <Image
              source={{ uri: faviconSrc }}
              style={login.faviconImg}
              onError={() => setFaviconError(true)}
            />
          ) : (
            <Globe size={20} color="rgba(255,255,255,0.4)" />
          )}
        </View>
      </View>

      {/* Identity row */}
      <View style={login.identityWrap}>
        <Text style={login.identityLabel}>IDENTITY</Text>
        <Text style={login.identityValue} numberOfLines={1}>{username || "username@email.com"}</Text>
      </View>

      {/* Footer */}
      <View style={login.footer}>
        <Text style={login.footerLabel}>ENCRYPTED KEY</Text>
        <Text style={login.footerDomain} numberOfLines={1}>{displayDomain}</Text>
      </View>
    </View>
  );
}

// ── 5. Secure Note Paper ─────────────────────────────────────────────────────

function NotePaperVisual({ name, note }: ItemPreviewCardProps) {
  return (
    <View style={note_.container}>
      {/* Top amber gradient bar */}
      <View style={note_.topBar} />

      <View style={note_.bodyWrap}>
        <View style={note_.header}>
          <View style={note_.headerLeft}>
            <FileText size={13} color="#e5e5e5" />
            <Text style={note_.title} numberOfLines={1}>{name || "Secure Note"}</Text>
          </View>
          <Text style={note_.confidentialTag}>CONFIDENTIAL</Text>
        </View>
        <Text style={note_.content} numberOfLines={4}>
          {note || "Type secure note contents below..."}
        </Text>
      </View>

      <Text style={note_.footer}>AES-256 ENCRYPTED BUFFER</Text>
    </View>
  );
}

// ── 6. Address Label ─────────────────────────────────────────────────────────

function AddressLabelVisual({
  name, street = "", line2 = "", city = "", state = "", zip = "", country = "",
}: ItemPreviewCardProps) {
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? " " + zip : "");

  return (
    <View style={addr.container}>
      {/* Stamp box */}
      <View style={addr.stampBox}>
        <Globe size={13} color="#737373" />
        <Text style={addr.stampText}>POSTAGE</Text>
      </View>

      <View style={addr.body}>
        <View style={addr.titleRow}>
          <MapPin size={13} color="#ffffff" />
          <Text style={addr.title} numberOfLines={1}>{name || "Shipping Address"}</Text>
        </View>
        <Text style={addr.line} numberOfLines={1}>{street || "123 Main Street"}</Text>
        {line2 ? <Text style={addr.line} numberOfLines={1}>{line2}</Text> : null}
        <Text style={addr.line} numberOfLines={1}>{cityStateZip || "City, State ZIP"}</Text>
        <Text style={addr.country} numberOfLines={1}>{(country || "United States").toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ── 7. Profile Badge ─────────────────────────────────────────────────────────

function ProfileBadgeVisual({ name, fullName = "", email = "", phone = "", dob, idNumber = "" }: ItemPreviewCardProps) {
  return (
    <View style={prof.container}>
      {/* Left white accent bar */}
      <View style={prof.accentBar} />

      {/* Top: Title + Chip */}
      <View style={prof.topRow}>
        <View>
          <Text style={prof.tag}>SECURE ACCESS BADGE</Text>
          <Text style={prof.name} numberOfLines={1}>{fullName || name || "Identity Profile"}</Text>
        </View>
        <View style={prof.chipOuter}>
          <View style={chip.grid}>
            <View style={chip.row}>
              <View style={[chip.cell, chip.borderR, chip.borderB]} />
              <View style={[chip.cell, chip.borderR, chip.borderB]} />
              <View style={[chip.cell, chip.borderB]} />
            </View>
            <View style={chip.row}>
              <View style={[chip.cell, chip.borderR]} />
              <View style={[chip.cell, chip.borderR]} />
              <View style={chip.cell} />
            </View>
          </View>
        </View>
      </View>

      {/* Middle: Avatar + meta */}
      <View style={prof.middle}>
        <View style={prof.avatar}>
          <User size={22} color="#a3a3a3" />
          <View style={prof.onlineDot} />
        </View>
        <View style={prof.metaCol}>
          <Text style={prof.metaLine} numberOfLines={1}>
            <Text style={prof.metaKey}>EMAIL: </Text>{email || "email@domain.com"}
          </Text>
          <Text style={prof.metaLine} numberOfLines={1}>
            <Text style={prof.metaKey}>PHONE: </Text>{phone || "+1 (555) 000-0000"}
          </Text>
          {dob ? (
            <Text style={prof.metaLine} numberOfLines={1}>
              <Text style={prof.metaKey}>DOB: </Text>{dob}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Footer */}
      <View style={prof.footer}>
        <Text style={prof.footerLeft}>AES-256 ENCRYPTED IDENTITY</Text>
        <Text style={prof.footerRight}>{idNumber ? `ID: ${idNumber}` : "VAULTR PASS"}</Text>
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 20;
const CARD_ASPECT = 1.586; // Standard payment card

const card = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  logoWrap: { alignItems: "flex-end", justifyContent: "center" },
  fallbackBrandText: { fontSize: 13, fontWeight: "900", color: "#ffffff", letterSpacing: 1.5, fontStyle: "italic" },
  mcGlow1: {
    position: "absolute", top: -30, right: -20, width: 110, height: 110,
    borderRadius: 55, backgroundColor: "rgba(235,0,27,0.15)",
  },
  mcGlow2: {
    position: "absolute", top: -25, right: -45, width: 110, height: 110,
    borderRadius: 55, backgroundColor: "rgba(247,158,27,0.15)",
  },
  amexBorder1: {
    position: "absolute", top: 12, bottom: 12, left: 12, right: 12,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(245,158,11,0.2)",
  },
  amexBorder2: {
    position: "absolute", top: 16, bottom: 16, left: 16, right: 16,
    borderRadius: 11, borderWidth: 1, borderColor: "rgba(245,158,11,0.1)",
  },
  discoverArc1: {
    position: "absolute", right: -60, top: -40, width: 200, height: 200,
    borderRadius: 100, borderWidth: 1.5, borderColor: "rgba(249,115,22,0.15)",
  },
  discoverArc2: {
    position: "absolute", right: -40, top: 90, width: 160, height: 160,
    borderRadius: 80, borderWidth: 1, borderColor: "rgba(249,115,22,0.1)",
  },
  discoverArc3: {
    position: "absolute", right: -20, top: 0, width: 130, height: 130,
    borderRadius: 65, borderWidth: 1, borderColor: "rgba(249,115,22,0.05)",
  },
  numberWrap: { zIndex: 10, marginVertical: 8 },
  numberText: { fontSize: 17, fontFamily: "monospace", fontWeight: "600", color: "#ffffff", letterSpacing: 2.5 },
  bottomRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", zIndex: 10 },
  colLeft: { flex: 1, marginRight: 12 },
  colRight: { alignItems: "flex-end" },
  metaLabel: { fontSize: 8.5, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 0.8, marginBottom: 2, textTransform: "uppercase" },
  nameText: { fontSize: 13, fontWeight: "700", color: "#ffffff", letterSpacing: 0.8, textTransform: "uppercase" },
  expiryText: { fontSize: 13, fontFamily: "monospace", fontWeight: "600", color: "#e4e4e7" },
});

const login = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "#1e1e24",
    backgroundColor: "#0d0d10",
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  glow: {
    position: "absolute", top: -30, right: -30, width: 120, height: 120,
    borderRadius: 60, backgroundColor: "rgba(255,255,255,0.03)",
  },
  topRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
  },
  cardTag: { fontSize: 9, fontWeight: "800", color: "#737373", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { fontSize: 17, fontWeight: "700", color: "#ffffff", marginTop: 4, maxWidth: 200 },
  faviconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#141418", borderWidth: 1, borderColor: "#27272a",
    alignItems: "center", justifyContent: "center",
  },
  faviconImg: { width: 26, height: 26, resizeMode: "contain" },
  identityWrap: {},
  identityLabel: { fontSize: 8.5, fontWeight: "800", color: "rgba(255,255,255,0.3)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 },
  identityValue: { fontSize: 12, fontFamily: "monospace", color: "#e4e4e7" },
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: "#1f1f23", paddingTop: 10,
  },
  footerLabel: { fontSize: 8.5, fontFamily: "monospace", color: "#525252" },
  footerDomain: { fontSize: 11, fontWeight: "600", color: "#ffffff" },
});

const note_ = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "#222226",
    backgroundColor: "#111113",
    overflow: "hidden",
    position: "relative",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 22,
  },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: "#ca8a04" },
  bodyWrap: { flex: 1, marginTop: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#222226", paddingBottom: 6 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 7, flex: 1, marginRight: 8 },
  title: { fontSize: 13, fontWeight: "700", color: "#ffffff", flex: 1 },
  confidentialTag: { fontSize: 8, fontWeight: "800", color: "#ca8a04", letterSpacing: 1.2, textTransform: "uppercase" },
  content: { fontSize: 11, fontFamily: "monospace", color: "#71717a", lineHeight: 17 },
  footer: { fontSize: 8, fontFamily: "monospace", color: "#404040", textAlign: "right" },
});

const addr = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#22242b",
    backgroundColor: "#0d0e12",
    overflow: "hidden",
    position: "relative",
    padding: 20,
    justifyContent: "space-between",
  },
  stampBox: {
    position: "absolute", top: 14, right: 14,
    width: 44, height: 48, borderRadius: 6,
    borderWidth: 1, borderColor: "#27272a",
    backgroundColor: "#18181b",
    alignItems: "center", justifyContent: "center", gap: 3,
  },
  stampText: { fontSize: 7, fontWeight: "700", color: "#71717a", textTransform: "uppercase" },
  body: { gap: 3, paddingRight: 56 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  title: { fontSize: 15, fontWeight: "700", color: "#ffffff", flex: 1 },
  line: { fontSize: 12, fontFamily: "monospace", color: "#d4d4d8" },
  country: { fontSize: 10, fontWeight: "700", color: "#737373", letterSpacing: 1, marginTop: 4, textTransform: "uppercase" },
});

const prof = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: "#23232a",
    backgroundColor: "#0f0f13",
    overflow: "hidden",
    position: "relative",
    padding: 20,
    justifyContent: "space-between",
  },
  accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: "#ffffff" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tag: { fontSize: 8.5, fontFamily: "monospace", fontWeight: "800", color: "#737373", letterSpacing: 1.5, textTransform: "uppercase" },
  name: { fontSize: 15, fontWeight: "700", color: "#ffffff", marginTop: 2 },
  chipOuter: { width: 36, height: 26, borderRadius: 5, backgroundColor: "#d4af37", padding: 4, justifyContent: "center" },
  middle: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", alignItems: "center", justifyContent: "center", position: "relative" },
  onlineDot: { position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#10b981", borderWidth: 2, borderColor: "#0f0f13" },
  metaCol: { flex: 1, gap: 3 },
  metaLine: { fontSize: 10.5, fontFamily: "monospace", color: "#a3a3a3" },
  metaKey: { fontSize: 9, color: "#525252", textTransform: "uppercase" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#1f1f25", paddingTop: 8 },
  footerLeft: { fontSize: 8, fontFamily: "monospace", color: "#525252" },
  footerRight: { fontSize: 10, fontWeight: "700", color: "#ffffff", letterSpacing: 0.8 },
});

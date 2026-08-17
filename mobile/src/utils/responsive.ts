import { useWindowDimensions } from "react-native";

export const BREAKPOINTS = {
  PHONE_MAX: 599,
  TABLET_MIN: 600,
  DESKTOP_MIN: 1024,
  CARD_MAX_WIDTH: 380,
  CARD_ASPECT_RATIO: 1.586,
};

export interface ResponsiveInfo {
  width: number;
  height: number;
  isLandscape: boolean;
  isTablet: boolean;
  isSplitView: boolean;
  cardMaxWidth: number;
  cardAspectRatio: number;
  numColumns: number;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isLandscape = width > height;
  const isTablet = Math.min(width, height) >= 600 || width >= 768;
  const isSplitView = (width >= 600 && isLandscape) || width >= 768;
  const numColumns = width >= 900 ? 3 : width >= 600 ? 2 : 1;

  return {
    width,
    height,
    isLandscape,
    isTablet,
    isSplitView,
    cardMaxWidth: BREAKPOINTS.CARD_MAX_WIDTH,
    cardAspectRatio: BREAKPOINTS.CARD_ASPECT_RATIO,
    numColumns,
  };
}

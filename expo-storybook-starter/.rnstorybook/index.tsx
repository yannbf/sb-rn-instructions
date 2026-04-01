import AsyncStorage from "@react-native-async-storage/async-storage";
import { view } from "./storybook.requires";

const isChromatic = process.env.EXPO_PUBLIC_CHROMATIC === "true";

const StorybookUIRoot = view.getStorybookUI({
  storage: {
    getItem: AsyncStorage.getItem,
    setItem: AsyncStorage.setItem,
  },
  // Chromatic capture settings (only active in Chromatic builds)
  ...(isChromatic && {
    enableWebsockets: true,
    host: "react-native.capture.chromatic.com",
    port: 7007,
    secured: true,
    onDeviceUI: false,
    shouldPersistSelection: false,
  }),
});

export default StorybookUIRoot;

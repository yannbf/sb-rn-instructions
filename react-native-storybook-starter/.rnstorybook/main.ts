import { StorybookConfig } from '@storybook/react-native';

const isChromatic = process.env.CHROMATIC === 'true';

const main: StorybookConfig = {
  stories: ['../components/**/*.stories.?(ts|tsx|js|jsx)'],
  addons: isChromatic
    ? []
    : [
        '@storybook/addon-ondevice-controls',
        '@storybook/addon-ondevice-actions',
        '@storybook/addon-ondevice-backgrounds',
        '@storybook/addon-ondevice-notes',
      ],
};

export default main;

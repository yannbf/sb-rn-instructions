import { HomeScreen } from './src/screens/Home';
import StorybookUIRoot from './.rnstorybook';

const isStorybook = process.env.STORYBOOK_ENABLED === 'true';

export default isStorybook ? StorybookUIRoot : HomeScreen;

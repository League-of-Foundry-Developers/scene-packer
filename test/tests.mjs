import {registerConstantsTestBatch} from './constants.test.mjs';

Hooks.on('quenchReady', async (quench) => {
  registerConstantsTestBatch(quench);
});

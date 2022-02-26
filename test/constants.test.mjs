import {CONSTANTS} from '../scripts/constants.js';

export function registerConstantsTestBatch(quench) {
  quench.registerBatch(`${CONSTANTS.MODULE_NAME}.constants.versions`, (context) => {
    const {describe, it, assert} = context;

    describe('Version 7', function () {
      it('compares against 0.6.x', function () {
        for (const version of ['0.6.0', '0.6.9', '0.6.10']) {
          assert.equal(CONSTANTS.IsV7orNewer(version), false, `${version} should not be V7 or newer`);
          assert.equal(CONSTANTS.IsV7(version), false, `${version} should not be V7`);
        }
      });
      it('compares against 0.7.x', function () {
        for (const version of ['0.7.0', '0.7.9', '0.7.10']) {
          assert.equal(CONSTANTS.IsV7orNewer(version), true, `${version} should be V7 or newer`);
          assert.equal(CONSTANTS.IsV7(version), true, `${version} should be V7`);
        }
      });
      it('compares against 0.8.x', function () {
        for (const version of ['0.8.0', '0.8.1', '0.8.8']) {
          assert.equal(CONSTANTS.IsV7orNewer(version), true, `${version} should be V7 or newer`);
          assert.equal(CONSTANTS.IsV7(version), false, `${version} should not be V7`);
        }
      });
      it('compares against 9.x', function () {
        for (const version of ['9.220', '9.0']) {
          assert.equal(CONSTANTS.IsV7orNewer(version), true, `${version} should be V7 or newer`);
          assert.equal(CONSTANTS.IsV7(version), false, `${version} should not be V7`);
        }
      });
    });

    describe('Version 8', function () {
      it('compares against 0.6.x', function () {
        for (const version of ['0.6.0', '0.6.9', '0.6.10']) {
          assert.equal(CONSTANTS.IsV8orNewer(version), false, `${version} should not be V8 or newer`);
          assert.equal(CONSTANTS.IsV8(version), false, `${version} should not be V8`);
        }
      });
      it('compares against 0.7.x', function () {
        for (const version of ['0.7.0', '0.7.9', '0.7.10']) {
          assert.equal(CONSTANTS.IsV8orNewer(version), false, `${version} should not be V8 or newer`);
          assert.equal(CONSTANTS.IsV8(version), false, `${version} should not be V8`);
        }
      });
      it('compares against 0.8.x', function () {
        for (const version of ['0.8.0', '0.8.1', '0.8.8']) {
          assert.equal(CONSTANTS.IsV8orNewer(version), true, `${version} should be V8 or newer`);
          assert.equal(CONSTANTS.IsV8(version), true, `${version} should be V8`);
        }
      });
      it('compares against 9.x', function () {
        for (const version of ['9.220', '9.0']) {
          assert.equal(CONSTANTS.IsV8orNewer(version), true, `${version} should be V8 or newer`);
          assert.equal(CONSTANTS.IsV8(version), false, `${version} should not be V8`);
        }
      });
    });

    describe('Version 9', function () {
      it('compares against 0.6.x', function () {
        for (const version of ['0.6.0', '0.6.9', '0.6.10']) {
          assert.equal(CONSTANTS.IsV9orNewer(version), false, `${version} should not be V9 or newer`);
          assert.equal(CONSTANTS.IsV9(version), false, `${version} should not be V9`);
        }
      });
      it('compares against 0.7.x', function () {
        for (const version of ['0.7.0', '0.7.9', '0.7.10']) {
          assert.equal(CONSTANTS.IsV9orNewer(version), false, `${version} should not be V9 or newer`);
          assert.equal(CONSTANTS.IsV9(version), false, `${version} should not be V9`);
        }
      });
      it('compares against 0.8.x', function () {
        for (const version of ['0.8.0', '0.8.1', '0.8.8']) {
          assert.equal(CONSTANTS.IsV9orNewer(version), false, `${version} should not be V9 or newer`);
          assert.equal(CONSTANTS.IsV9(version), false, `${version} should not be V9`);
        }
      });
      it('compares against 9.x', function () {
        for (const version of ['9.220', '9.0']) {
          assert.equal(CONSTANTS.IsV9orNewer(version), true, `${version} should be V9 or newer`);
          assert.equal(CONSTANTS.IsV9(version), true, `${version} should be V9`);
        }
      });
    });
  }, {displayName: `${CONSTANTS.MODULE_NAME}: Version comparisons`});
}

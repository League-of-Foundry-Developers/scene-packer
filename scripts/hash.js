import stringify from './lib/fast-json-stable-stringify/index.js';
import Hashes from './lib/jshashes/hashes.js';

export default class Hash {
  /**
   * Generates a SHA-1 hash of the given object entity.
   * @param {Object} entity - The entity to generate a hash for.
   * @return {string}
   */
  static SHA1(entity) {
    if (!entity) {
      return '';
    }

    const SHA1 = new Hashes.SHA1;

    if (typeof entity.toObject === 'function') {
      entity = entity.toObject();
    } else if (typeof entity.toJSON === 'function') {
      entity = entity.toJSON();
    }
    let data = mergeObject(entity, {}, {inplace: false});
    if (data.flags && data.flags['scene-packer']?.hash) {
      // Don't include an existing hash in the hash
      delete data.flags['scene-packer'].hash;
    }

    if (data._id) {
      // Don't include an existing id in the hash
      delete data._id;
    }

    return SHA1.hex(stringify(data, {cycles: true}));
  }
}

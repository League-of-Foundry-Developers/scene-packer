import {CONSTANTS} from './constants.js';
import {libWrapper} from './shim.js';
import Hash from './hash.js';

/**
 * Utilise libWrapper to ensure we get a sourceId for each of our compendium imports
 */
Hooks.once('setup', function () {
  // Set the sourceId when exporting to a compendium
  ['Actor', 'Item', 'JournalEntry', 'Macro', 'Playlist', 'RollTable', 'Scene'].forEach(item => {
    libWrapper.register(
      'scene-packer',
      `${item}.prototype.toCompendium`,
      function (wrapped, ...args) {
        // const [ pack, options={} ] = args;

        // Keep sort orders when exporting to compendium via Compendium Folders
        if (typeof args === 'undefined') {
          args = [];
        }
        // args[0] has a pack value when dragging a document to a compendium, and also when
        // exporting via the default export process, so we can skip these cases.
        if (typeof args[0] === 'undefined') {
          if (typeof args[1] === 'undefined') {
            args[1] = {};
          }
          if (typeof args[1].clearSort === 'undefined') {
            args[1].clearSort = false;
          }
        }

        let data = wrapped.bind(this)(...args);

        const newFlags = {};
        newFlags[CONSTANTS.MODULE_NAME] = {sourceId: this.uuid};
        const defaultPermission = this?.ownership?.default || this?.data?.permission?.default;
        if (defaultPermission) {
          newFlags[CONSTANTS.MODULE_NAME][ScenePacker.FLAGS_DEFAULT_PERMISSION] = defaultPermission;
        }
        if (!data.flags) {
          data.flags = {};
        }
        mergeObject(data.flags, newFlags);

        return data;
      },
      'WRAPPER',
    );
  });

  // Add hashes to entities imported from compendiums to support upgrade diffs.
  for (const type of ['Folder', 'Playlist', 'Macro', 'Item', 'Actor', 'RollTable', 'JournalEntry', 'Scene']) {
    Hooks.on(`preCreate${type}`, (entity, createData) => {
      const newFlags = {};
      newFlags[CONSTANTS.MODULE_NAME] = {hash: Hash.SHA1(entity)};
      if (CONSTANTS.IsV10orNewer()) {
        entity.updateSource({flags: newFlags});
      } else {
        entity.data.update({flags: newFlags});
      }
    });
  }

  // Clean up temporary compendium folder entities when importing all from a compendium.
  libWrapper.register(
    'scene-packer',
    'CompendiumCollection.prototype.importAll',
    async function (wrapped, ...args) {
      const data = await wrapped.bind(this)(...args);
      if (game.modules.get('compendium-folders')?.active) {
        // Compendium folders is active, it will handle the cleanup
        return data;
      }

      let tempEntities = data.filter(e => e.name === CONSTANTS.CF_TEMP_ENTITY_NAME);
      if (tempEntities.length) {
        Dialog.confirm({
          title: game.i18n.format('SCENE-PACKER.notifications.import-entities.cf-clean-up-title', {
            name: CONSTANTS.CF_TEMP_ENTITY_NAME,
          }),
          content: game.i18n.format('SCENE-PACKER.notifications.import-entities.cf-clean-up', {
            name: CONSTANTS.CF_TEMP_ENTITY_NAME,
            count: tempEntities.length,
          }),
          yes: () => {
            const callback = m => m.find(e => e.name === 'Clean up #[CF_tempEntity] entries')?.execute();
            game.packs.get('scene-packer.macros').getDocuments().then(callback);
          },
        });
      }
      return data;
    },
    'WRAPPER',
  );
});

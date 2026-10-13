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
        const defaultPermission = this?.ownership?.default ?? this?.data?.permission?.default;
        if (defaultPermission) {
          newFlags[CONSTANTS.MODULE_NAME][ScenePacker.FLAGS_DEFAULT_PERMISSION] = defaultPermission;
        }
        if (!data.flags) {
          data.flags = {};
        }
        foundry.utils.mergeObject(data.flags, newFlags);

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
  // The global CompendiumCollection is deprecated in v13, and removed in v15.
  const compendiumCollectionPath = foundry.documents?.collections?.CompendiumCollection
    ? 'foundry.documents.collections.CompendiumCollection'
    : 'CompendiumCollection';
  libWrapper.register(
    'scene-packer',
    `${compendiumCollectionPath}.prototype.importAll`,
    async function (wrapped, ...args) {
      const data = await wrapped.bind(this)(...args);
      if (game.modules.get('compendium-folders')?.active) {
        // Compendium folders is active, it will handle the cleanup
        return data;
      }

      let tempEntities = data.filter(e => e.name === CONSTANTS.CF_TEMP_ENTITY_NAME);
      if (tempEntities.length) {
        const title = game.i18n.format('SCENE-PACKER.notifications.import-entities.cf-clean-up-title', {
          name: CONSTANTS.CF_TEMP_ENTITY_NAME,
        });
        const content = game.i18n.format('SCENE-PACKER.notifications.import-entities.cf-clean-up', {
          name: CONSTANTS.CF_TEMP_ENTITY_NAME,
          count: tempEntities.length,
        });
        const cleanUp = () => {
          const callback = m => m.find(e => e.name === 'Clean up #[CF_tempEntity] entries')?.execute();
          game.packs.get('scene-packer.macros').getDocuments().then(callback);
        };
        // The V1 Dialog is deprecated in v13, and removed in v16.
        const DialogV2 = foundry.applications?.api?.DialogV2;
        if (DialogV2) {
          DialogV2.confirm({window: {title}, content}).then(confirmed => confirmed && cleanUp());
        } else {
          Dialog.confirm({title, content, yes: cleanUp});
        }
      }
      return data;
    },
    'WRAPPER',
  );
});

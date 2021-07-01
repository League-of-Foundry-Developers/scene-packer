import {libWrapper} from './shim.js';

/**
 * Utilise libWrapper to ensure we get a sourceId for each of our compendium imports
 */
Hooks.once('setup', function () {
    if (isNewerVersion('0.8.0', game.data.version)) {
      // Wrap things < 0.8.0
      libWrapper.register(
        'scene-packer',
        'Entity.prototype.toCompendium',
        function (wrapped, ...args) {
          const newFlags = {};
          newFlags[ScenePacker.MODULE_NAME] = {sourceId: this.uuid};
          if (this.data?.permission?.default) {
            newFlags[ScenePacker.MODULE_NAME][ScenePacker.FLAGS_DEFAULT_PERMISSION] = this.data.permission.default;
          }
          if (!this.data.flags) {
            this.data.flags = {};
          }
          mergeObject(this.data.flags, newFlags);

          return wrapped.bind(this)(...args);
        },
        'WRAPPER',
      );

      libWrapper.register(
        'scene-packer',
        'Scene.prototype.toCompendium',
        async function (wrapped, ...args) {
          const data = await wrapped.bind(this)(...args);
          if (!data.thumb?.startsWith('data:')) {
            // Try to generate a thumbnail if it isn't already a data image
            try {
              const t = await this.createThumbnail({img: data.img || undefined});
              data.thumb = t?.thumb;
            } catch (e) {
              console.error(`Could not regenerate thumbnail for ${data?.name}.`, e);
            }
          }
          return data;
        },
        'WRAPPER',
      );

      libWrapper.register(
        'scene-packer',
        'EntityCollection.prototype.importFromCollection',
        async function (wrapped, ...args) {
          // const [ collection, entryId, updateData, options ] = args;

          const entName = this.object.entity;
          const pack = game.packs.get(args[0]);
          if (pack.metadata.entity !== entName) {
            return wrapped.bind(this)(...args);
          }

          // Sometimes the updateData argument isn't set
          if (!args[2]) {
            args[2] = {};
          }
          // Set the source uuid of the entity if it isn't already set in updateData
          if (!args[2]['flags.core.sourceId'] && !args[2].flags?.core?.sourceId) {
            const source = await pack.getEntity(args[1]);
            args[2]['flags.core.sourceId'] = source.uuid;
          }
          // Patch "Sight angle must be between 1 and 360 degrees." error
          if (args[2].token?.sightAngle === 0) {
            args[2].token.sightAngle = 360;
          }
          if (args[2].token?.lightAngle === 0) {
            args[2].token.lightAngle = 360;
          }

          return wrapped.bind(this)(...args);
        },
        'WRAPPER',
      );

      libWrapper.register(
        'scene-packer',
        'Compendium.prototype.importAll',
        async function ({folderId = null, folderName = ''} = {}) {
          // Need to specify the sourceId, so copied and modified from foundry.js

          // Step 1 - optionally, create a folder
          if (FOLDER_ENTITY_TYPES.includes(this.entity)) {
            const f = folderId ? game.folders.get(folderId, {strict: true}) : await Folder.create({
              name: folderName || this.metadata.label,
              type: this.entity,
              parent: null,
            });
            folderId = f.id;
            folderName = f.name;
          }

          // Step 2 - load all content
          const entities = await this.getContent();
          ui.notifications.info(game.i18n.format('COMPENDIUM.ImportAllStart', {
            number: entities.length,
            type: this.entity,
            folder: folderName,
          }));

          // Step 3 - import all content
          const created = await this.cls.create(entities.map(e => {
            e.data['flags.core.sourceId'] = e.uuid; // Modified from original source
            e.data.folder = folderId;

            // Patch "Sight angle must be between 1 and 360 degrees." error
            if (e.data.token?.sightAngle === 0) {
              e.data.token.sightAngle = 360;
            }
            if (e.data.token?.lightAngle === 0) {
              e.data.token.lightAngle = 360;
            }

            return e.data;
          }));
          ui.notifications.info(game.i18n.format('COMPENDIUM.ImportAllFinish', {
            number: entities.length, // Modified from original source
            type: this.entity,
            folder: folderName,
          }));
          return created;
        },
        'OVERRIDE',
      );
    } else {
      // Wrap things >= 0.8.0

      // Set the sourceId when exporting to a compendium
      ['Actor', 'Item', 'JournalEntry', 'Macro', 'Playlist', 'RollTable', 'Scene'].forEach(item => {
        libWrapper.register(
          'scene-packer',
          `${item}.prototype.toCompendium`,
          function (wrapped, ...args) {
            // const [ pack ] = args;
            let data = wrapped.bind(this)(...args);

            const newFlags = {};
            newFlags[ScenePacker.MODULE_NAME] = {sourceId: this.uuid};
            if (data?.permission?.default) {
              newFlags[ScenePacker.MODULE_NAME][ScenePacker.FLAGS_DEFAULT_PERMISSION] = data.permission.default;
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
    }
  },
);

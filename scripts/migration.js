import { CONSTANTS } from './constants.js';

export default class Migration {

  /**
   * Migrate the data within the given module's compendiums to fix up differences between v8, v9 and v10.
   * @param {string} moduleName The name of the module to migrate.
   */
  static async MigrateCompendiums(moduleName) {
    if (CONSTANTS.IsV10orNewer()) {
      const module = game.modules.get(moduleName);
      // D&D 5e had a breaking change in v2.0.1 where a *lot* of images were replaced. Try to fix these up automatically.
      // Would only have occurred if the module supports v9 or below.
      const minimumModuleCompatibility = module.compatibility?.minimum ?? game.version;
      if (minimumModuleCompatibility === '10' || isNewerVersion(minimumModuleCompatibility, '10')) {
        return;
      }

      if (game.system?.id === 'dnd5e' && (module.system === 'dnd5e' || module.packs.some(p => p.system === 'dnd5e'))) {
        // Turn off compatibility warnings while migrating content
        const existingCompatibilityLogMode = CONFIG.compatibility.mode;
        CONFIG.compatibility.mode = CONST.COMPATIBILITY_MODES.SILENT;

        if (isNewerVersion('2.0.0', game.settings.get(moduleName, CONSTANTS.SETTING_SYSTEM_MIGRATION_VERSION))) {
          let notificationShown = false;
          // Trigger a notification to display after a short delay (most modules will complete within this timeframe).
          let timeout = setTimeout(() => {
            ui.notifications.info(
              game.i18n.format('SCENE-PACKER.welcome.migration-wait', {
                module: moduleName,
              }),
            );
            notificationShown = true;
          }, 500);
          // Mark this module as having been migrated
          await game.settings.set(moduleName, CONSTANTS.SETTING_SYSTEM_MIGRATION_VERSION, game.system.version);

          for (const pack of game.packs.filter(p => p?.metadata?.packageName === moduleName)) {
            if (!['Actor', 'Item', 'Scene'].includes(pack.documentName)) {
              continue;
            }
            let migrationData = {};
            try {
              migrationData = await dnd5e.migrations.getMigrationData();
            } catch (err) {
              migrationData = {};
              err.message = `Failed to get dnd5e system migration data: ${err.message}`;
              console.error(err);
            }

            // Unlock the pack for editing
            const wasLocked = pack.locked;
            await pack.configure({ locked: false });

            switch (pack.documentName) {
              case 'Actor':
                for (const doc of await pack.getDocuments()) {
                  let updateData = {};
                  const actorData = doc.toObject();
                  updateData = Migration.MigrateDnd5eTokenImage(actorData, updateData);

                  // Save the entry, if data was changed
                  if (!foundry.utils.isEmpty(updateData)) {
                    console.log(`Migrating Actor document "${doc.name}" in Compendium "${pack.collection}"`);
                    await doc.update(updateData);
                  }

                  try {
                    const updateData = dnd5e.migrations.migrateActorData(doc.toObject(), migrationData);
                    if (!foundry.utils.isEmpty(updateData)) {
                      console.log(`Migrating Actor document "${doc.name}" in Compendium "${pack.collection}"`);
                      await doc.update(updateData, { enforceTypes: false });
                    }
                  } catch (err) {
                    err.message = `Failed dnd5e system migration for Actor "${doc.name}" in Compendium "${pack.collection}": ${err.message}`;
                    console.error(err);
                  }
                }
                break;
              case 'Item':
                for (const doc of await pack.getDocuments()) {
                  try {
                    const updateData = dnd5e.migrations.migrateItemData(doc.toObject(), migrationData);
                    if (!foundry.utils.isEmpty(updateData)) {
                      console.log(`Migrating Item document "${doc.name}" in Compendium "${pack.collection}"`);
                      await doc.update(updateData, { enforceTypes: false });
                    }
                  } catch (err) {
                    err.message = `Failed dnd5e system migration for Item "${doc.name}" in Compendium "${pack.collection}": ${err.message}`;
                    console.error(err);
                  }
                }
                break;
              case 'Scene':
                for (const doc of await pack.getDocuments()) {
                  for (const token of (doc.tokens || [])) {
                    let updateData = {};
                    updateData = Migration.MigrateDnd5eTokenImage(token, updateData);

                    // Save the entry, if data was changed
                    if (foundry.utils.isEmpty(updateData)) {
                      continue;
                    }
                    console.log(`Migrating Token document "${token.name}" in Scene "${doc.name}" in Compendium "${pack.collection}"`);
                    await doc.updateEmbeddedDocuments('Token', [foundry.utils.mergeObject({ _id: token.id }, updateData)]);
                  }
                }
                break;
            }

            // Apply the original locked status for the pack
            await pack.configure({ locked: wasLocked });
          }
          clearTimeout(timeout);
          if (notificationShown) {
            ui.notifications.info(
              game.i18n.format('SCENE-PACKER.welcome.migration-complete', {
                module: moduleName,
              }),
            );
          }
        }

        // Restore the compatibility warnings if they are enabled
        CONFIG.compatibility.mode = existingCompatibilityLogMode;
      }
    }
  }

  /**
   * Migrate any dnd5e system token images from PNG to WEBP.
   * Code based on dnd5e system, but updated to handle paths in V9 and below.
   * @param {object} actorData    Actor or token data to migrate.
   * @param {object} updateData   Existing update to expand upon.
   * @returns {object}            The updateData to apply
   */
  static MigrateDnd5eTokenImage(actorData, updateData) {
    const oldSystemPNG = /^systems\/dnd5e\/tokens\/([a-z]+)\/([A-z]+).png$/;
    for (const path of ['img', 'token.img', 'texture.src', 'prototypeToken.texture.src']) {
      const v = foundry.utils.getProperty(actorData, path);
      if (v && oldSystemPNG.test(v)) {
        const [type, fileName] = v.match(oldSystemPNG).slice(1);
        updateData[path] = `systems/dnd5e/tokens/${type}/${fileName}.webp`;
      }
    }
    return updateData;
  }
}

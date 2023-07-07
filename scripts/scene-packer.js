import AdventureConverter from './adventure-converter/adventure-converter.js';
import AssetReport from './asset-report.js';
import { Compressor } from './export-import/compressor.js';
import { CONSTANTS } from './constants.js';
import Exporter from './export-import/exporter.js';
import Hash from './hash.js';
import Migration from './migration.js';
import MoulinetteImporter from './export-import/moulinette-importer.js';
import Report from './report.js';
import WelcomeJournal from './welcome-journal.js';
import ZipImporter from './export-import/zip-importer.js';

/**
 * Tracks the initialised instances of Scene Packer and also exposes some methods to globalThis.
 * Static methods of ScenePacker are automatically added to this object at a later stage.
 */
const globalScenePacker = {
  instances: {},
  ShowPerformanceReport: Report.RenderReport,
  AssetReport: AssetReport,
  MODULE_NAME: CONSTANTS.MODULE_NAME,
  MINIMUM_SUPPORTED_PACKER_VERSION: CONSTANTS.MINIMUM_SUPPORTED_PACKER_VERSION,
  FLAGS_DEFAULT_PERMISSION: CONSTANTS.FLAGS_DEFAULT_PERMISSION,
  Compressor,
  MoulinetteImporter: MoulinetteImporter,
  AdventureConverter: AdventureConverter,
  WelcomeJournal: WelcomeJournal,
};

/**
 * You can use this ScenePacker to "fix" Actors and Journal Pins on a Scene.
 * This code supports relinking Actor Tokens, even if their token name doesn't match the Actor.
 *
 * See the Journal entries in the compendium for how to use.
 */
export default class ScenePacker {
  /** @type {String|null} */
  adventureName = null;
  /** @type {String|null} */
  moduleName = null;
  /** @type {String|null} */
  welcomeJournal = null;
  /** @type {String[]} */
  additionalJournals = [];
  /** @type {String[]} */
  additionalMacros = [];
  /** @type {{creatures: String[], journals: String[], macros: String[], playlists: String[], modules: String[]}} */
  packs = {
    creatures: [],
    journals: [],
    macros: [],
    playlists: [],
    modules: [],
  };
  allowImportPrompts = true;

  /**
   * @param {String} adventureName The human-readable name of the adventure.
   * @param {String} moduleName The name of the module this is part of.
   * @param {String[]} creaturePacks Set which Actor packs should be used when searching for Actors.
   * @param {String[]} journalPacks Set which Journal packs should be used when searching for Journals.
   * @param {String[]} macroPacks Set which Macro packs should be used when searching for Macros.
   * @param {String[]} additionalModulePacks Set which additional module's packs should be used when searching for entities.
   * @param {String[]} playlistPacks Set which Playlist packs should be used when searching for Playlists.
   * @param {String} welcomeJournal Set the name of the journal to be imported and automatically opened after activation.
   * @param {String[]} additionalJournals Set which journals (by name) should be automatically imported.
   * @param {String[]} additionalMacros Set which macros (by name) should be automatically imported.
   * @param {Boolean} allowImportPrompts Set whether import prompts should be allowed.
   */
  constructor(
    {
      adventureName = '',
      moduleName = '',
      creaturePacks = [],
      journalPacks = [],
      macroPacks = [],
      playlistPacks = [],
      additionalModulePacks = [],
      welcomeJournal = '',
      additionalJournals = [],
      additionalMacros = [],
      allowImportPrompts = true,
    } = {},
  ) {
    if (!game.user.isGM) {
      return null;
    }

    // Return the existing instance if it has been configured already.
    if (moduleName) {
      let instance = globalScenePacker.instances[moduleName];
      if (instance) {
        return instance;
      }
    }

    this.SetAdventureName(adventureName);
    this.SetModuleName(moduleName);
    if (creaturePacks?.length) {
      this.SetCreaturePacks(creaturePacks);
    }
    if (journalPacks?.length) {
      this.SetJournalPacks(journalPacks);
    }
    if (macroPacks?.length) {
      this.SetMacroPacks(macroPacks);
    }
    if (playlistPacks?.length) {
      this.SetPlaylistPacks(playlistPacks);
    }
    if (additionalModulePacks?.length) {
      this.SetAdditionalModulePacks(additionalModulePacks);
    }
    if (welcomeJournal) {
      this.SetWelcomeJournal(welcomeJournal);
    }
    if (additionalJournals?.length) {
      this.SetAdditionalJournalsToImport(additionalJournals);
    }
    if (additionalMacros?.length) {
      this.SetAdditionalMacrosToImport(additionalMacros);
    }
    this.allowImportPrompts = allowImportPrompts;

    if (typeof window.DEV?.registerPackageDebugFlag === 'function') {
      window.DEV.registerPackageDebugFlag(this.moduleName);
    }

    game.settings.register(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION, {
      scope: 'world',
      config: false,
      type: String,
      default: '0.0.0',
    });

    game.settings.register(this.moduleName, CONSTANTS.SETTING_PROMPTED, {
      scope: 'world',
      config: false,
      type: String,
      default: '0.0.0',
    });

    game.settings.register(this.moduleName, CONSTANTS.SETTING_SHOW_WELCOME_PROMPTS, {
      scope: 'world',
      config: false,
      type: Boolean,
      default: true,
    });

    game.settings.register(this.moduleName, CONSTANTS.SETTING_SYSTEM_MIGRATION_VERSION, {
      scope: 'world',
      config: false,
      type: String,
      default: '0.0.0',
    });

    globalScenePacker.instances[this.moduleName] = this;

    const promptedVersion = game.settings.get(this.moduleName, CONSTANTS.SETTING_PROMPTED) || '0.0.0';
    const module = game.modules.get(this.moduleName);
    const moduleVersion = (module?.version ?? module?.data?.version) || '0.0.0';
    Migration.MigrateCompendiums(moduleName).then(() => {
      if (this.allowImportPrompts && isNewerVersion(moduleVersion, promptedVersion) && game.settings.get(this.moduleName, CONSTANTS.SETTING_SHOW_WELCOME_PROMPTS)) {
        this.showImportPrompt(moduleName, moduleVersion, promptedVersion);
      }
    });
  }

  /**
   * Show the import prompt for the module.
   * @param {string} moduleName - The name of the module
   * @param {string} moduleVersion - The current version of the module
   * @param {string} existingVersion - The version of the module already installed (0.0.0 if it has never been installed)
   */
  showImportPrompt(moduleName, moduleVersion, existingVersion) {
    let usingWelcomeJournalImporter = false;
    if (this.welcomeJournal) {
      for (const packName of this.getSearchPacksForType('JournalEntry')) {
        const pack = game.packs.get(packName);
        const j = pack.index.getName(this.welcomeJournal);
        if (j?._id) {
          usingWelcomeJournalImporter = true;
          pack.getDocument(j._id)
            .then(journal => {
              new WelcomeJournal(journal, {
                  moduleName: this.moduleName,
                  shareable: false,
                  editable: false,
                },
              ).render(true);
            });
          break;
        }
      }
    }

    if (!usingWelcomeJournalImporter) {
      // A newer version of the module is installed from what was last prompted
      let content = game.i18n.format('SCENE-PACKER.welcome.intro', {
        adventure: this.adventureName,
      });

      let yesCallback = async () => {
        game.settings.set(this.moduleName, CONSTANTS.SETTING_PROMPTED, moduleVersion);
        await this.importAllContent();
      };
      if (existingVersion === '0.0.0') {
        content += game.i18n.format('SCENE-PACKER.welcome.brand-new', {
          adventure: this.adventureName,
        });
      } else {
        content += game.i18n.format('SCENE-PACKER.welcome.update-available', {
          existing: existingVersion,
          version: moduleVersion,
        });
        yesCallback = async () => {
          // The yes callback during an upgrade of a module removes all existing entries that came from this module before
          // importing everything in again.
          // Folders are untouched.
          const scenes = game.scenes.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));
          const actors = game.actors.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));
          const items = game.items.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));
          const journals = game.journal.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));
          const rollTables = game.tables.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));
          const playlists = game.playlists.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));
          const macros = game.macros.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));
          const cards = game.cards.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`));

          let listToDelete = '';
          if (scenes.length) {
            listToDelete += `<li>${game.i18n.localize('Scenes')}: ${scenes.length}</li>`;
          }
          if (actors.length) {
            listToDelete += `<li>${game.i18n.localize('Actors')}: ${actors.length}</li>`;
          }
          if (items.length) {
            listToDelete += `<li>${game.i18n.localize('Items')}: ${items.length}</li>`;
          }
          if (journals.length) {
            listToDelete += `<li>${game.i18n.localize('Journals')}: ${journals.length}</li>`;
          }
          if (rollTables.length) {
            listToDelete += `<li>${game.i18n.localize('Roll tables')}: ${rollTables.length}</li>`;
          }
          if (playlists.length) {
            listToDelete += `<li>${game.i18n.localize('Playlists')}: ${playlists.length}</li>`;
          }
          if (macros.length) {
            listToDelete += `<li>${game.i18n.localize('Macros')}: ${macros.length}</li>`;
          }
          if (cards.length) {
            listToDelete += `<li>${game.i18n.localize('Cards')}: ${cards.length}</li>`;
          }
          if (listToDelete) {
            listToDelete = `<p>${game.i18n.localize('SCENE-PACKER.welcome.update-warning-list-to-delete')}</p><ul>${listToDelete}</ul>`;
          }

          const doReplacement = async function () {
            const sceneIDs = game.scenes.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (sceneIDs.length) {
              await Scene.deleteDocuments(sceneIDs);
            }
            const actorIDs = game.actors.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (actorIDs.length) {
              await Actor.deleteDocuments(actorIDs);
            }
            const itemIDs = game.items.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (itemIDs.length) {
              await Item.deleteDocuments(itemIDs);
            }
            const journalIDs = game.journal.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (journalIDs.length) {
              await JournalEntry.deleteDocuments(journalIDs);
            }
            const rollTableIDs = game.tables.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (rollTableIDs.length) {
              await RollTable.deleteDocuments(rollTableIDs);
            }
            const playlistIDs = game.playlists.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (playlistIDs.length) {
              await Playlist.deleteDocuments(playlistIDs);
            }
            const macroIDs = game.macros.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (macroIDs.length) {
              await Macro.deleteDocuments(macroIDs);
            }
            const cardIDs = game.cards.filter(s => s.getFlag('core', 'sourceId')
              ?.startsWith(`Compendium.${this.moduleName}`))
              .map(s => s.id);
            if (cardIDs.length) {
              await Card.deleteDocuments(cardIDs);
            }
            game.settings.set(this.moduleName, CONSTANTS.SETTING_PROMPTED, moduleVersion);
            await this.importAllContent();
          }.bind(this);

          new Dialog({
            title: game.i18n.localize('SCENE-PACKER.welcome.update-warning-title'),
            content: game.i18n.format('SCENE-PACKER.welcome.update-warning-content', {
              module: moduleName,
              world: game.world.id,
              listToDelete: listToDelete,
            }),
            buttons: {
              replace: {
                icon: '<i class="fas fa-trash-restore"></i>',
                label: game.i18n.localize('Replace'),
                callback: doReplacement,
              },
              duplicate: {
                icon: '<i class="fas fa-copy"></i>',
                label: game.i18n.localize('Rename'),
                callback: async () => {
                  game.settings.set(this.moduleName, CONSTANTS.SETTING_PROMPTED, moduleVersion);
                  await this.importAllContent({
                    forceImport: true,
                    renameOriginals: true,
                  });
                },
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize('Cancel'),
                callback: () => this.logWarn(true, game.i18n.format('SCENE-PACKER.welcome.update-cancelled', {
                  from: existingVersion,
                  to: moduleVersion,
                  module: moduleName,
                })),
              },
            },
            default: 'cancel',
          }).render(true);

        };
      }
      const totalCount = game.packs.filter(
        (p) => (p.metadata.packageName || p.metadata.package) === this.moduleName,
      )
        .reduce((
          a,
          currentValue,
        ) => a + (currentValue?.index?.size || currentValue?.index?.length || 0), 0);
      const label = game.i18n.format('SCENE-PACKER.welcome.yes-all', {
        count: new Intl.NumberFormat().format(totalCount),
      });
      let d = new Dialog({
        title: game.i18n.localize('SCENE-PACKER.welcome.title'),
        content: content,
        buttons: {
          yesAll: {
            icon: '<i class="fas fa-check-double"></i>',
            label: label,
            callback: yesCallback,
          },
          choose: {
            icon: '<i class="fas fa-clipboard-check"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.let-me-choose'),
            callback: () => {
              game.packs.filter(
                (p) => (p.metadata.packageName || p.metadata.package) === this.moduleName && (p.documentName || p.entity) === 'Scene',
              )
                .forEach(c => c.render(true));
              game.settings.set(this.moduleName, CONSTANTS.SETTING_PROMPTED, moduleVersion);
            },
            condition: game.packs.filter((p) => (p.metadata.packageName || p.metadata.package) === this.moduleName && (p.documentName || p.entity) === 'Scene').length,
          },
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.close'),
            callback: () => {
              game.settings.set(this.moduleName, CONSTANTS.SETTING_PROMPTED, moduleVersion);
            },
          },
        },
      }, {
        // Set the width to somewhere between 400 and 640 pixels.
        width: Math.max(400, Math.min(640, Math.floor(window.innerWidth / 2))),
        classes: ['dialog', 'welcome-prompt'],
      });
      d.render(true);
    }
  }

  /**
   * Imports all the content for the current adventure module.
   * @param {boolean} forceImport - Optional. Whether to force import all the content in this module. The default false
   *                                option will skip entries which already exist in the world.
   * @param {boolean} renameOriginals - Optional. Whether to rename existing entries within the world to be able to distinguish
   *                                    between the old and new versions. Only valid when "forceImport" is true.
   */
  async importAllContent({forceImport = false, renameOriginals = false} = {}) {
    ui.notifications.info(
      game.i18n.format('SCENE-PACKER.welcome.import-all.wait-title', {
        name: this.adventureName,
      }),
    );
    const di = new Dialog({
      title: game.i18n.localize('SCENE-PACKER.welcome.import-all.title'),
      content: `<p>${game.i18n.localize('SCENE-PACKER.welcome.import-all.title')}</p>`,
      buttons: {
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('Close'),
        },
      },
      default: 'close',
    });
    di.render(true);
    const createdRollTables = [];
    for (let i = 0; i < CONSTANTS.PACK_IMPORT_ORDER.length; i++) {
      const packType = CONSTANTS.PACK_IMPORT_ORDER[i];
      di.data.content = `<p>${game.i18n.format('SCENE-PACKER.welcome.import-all.wait', {
        type: game.i18n.format(CONSTANTS.TYPE_HUMANISE[packType]),
      })}</p>`;
      di.render();
      const packs = game.packs.filter((p) => (p.metadata.packageName || p.metadata.package) === this.moduleName && (p.documentName || p.entity) === packType);
      for (let i = 0; i < packs.length; i++) {
        let createData = [];
        const pack = packs[i];
        try {
          const entityClass = pack.documentClass;
          const collection = game[entityClass.collectionName];
          let packContent = await pack.getDocuments();

          const existingEntriesToUpdate = [];
          const existingEntriesToDelete = [];
          const entriesToCreate = [];

          // Filter down to those that are still missing
          packContent = packContent.filter(e => {
            if (forceImport && !renameOriginals) {
              return true;
            }
            let sourceId = e.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
            let coreSourceId = e.getFlag('core', 'sourceId');
            const hasExistingEntryWithID = collection.get(e.id);
            if (hasExistingEntryWithID || sourceId || coreSourceId) {
              const existingEntries = collection.filter(f => f.id === e.id || (sourceId && f.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sourceId) || (coreSourceId && f.getFlag('core', 'sourceId') === coreSourceId));
              if (existingEntries.length && forceImport && renameOriginals) {
                // Update the existing entry names
                const newFlags = {};
                newFlags[CONSTANTS.MODULE_NAME] = {deprecated: true};
                for (const existingEntry of existingEntries) {
                  if (collection.get(existingEntry.id)) {
                    // Entry already exists in the world and would fail the Unique constraint.
                    existingEntriesToDelete.push(existingEntry.id);
                    entriesToCreate.push(existingEntry.clone({
                      name: `${existingEntry.name} (old)`,
                      flags: newFlags,
                    }).toObject());
                  } else {
                    existingEntriesToUpdate.push({
                      _id: existingEntry.id,
                      name: `${existingEntry.name} (old)`,
                      flags: newFlags,
                    });
                  }
                }
              }
              // Import the entry if we are forcing, or it doesn't already exist in the world.
              return forceImport || !existingEntries.length;
            }
            return true;
          });
          if (existingEntriesToDelete.length) {
            await entityClass.deleteDocuments(existingEntriesToDelete);
          }
          if (entriesToCreate.length) {
            await entityClass.createDocuments(entriesToCreate);
          }
          if (existingEntriesToUpdate.length) {
            await entityClass.updateDocuments(existingEntriesToUpdate);
          }
          if (!packContent.length) {
            continue;
          }

          // Create missing folders belonging to core data (support added in v11)
          if (pack.folders) {
            // Create a parent folder for this pack if it has more than one child
            const requiresParentFolder = pack.folders.reduce((acc, f) => {
              const data = f.toObject();
              return acc + (data.folder ? 0 : 1);
            }, 0) > 1;

            let parentFolder;
            if (requiresParentFolder) {
              parentFolder = game.folders.find(f => f.name === this.adventureName && f.type === packType);
              if (!parentFolder) {
                parentFolder = await Folder.create({
                  name: this.adventureName,
                  type: packType,
                  parent: null
                });
              }
            }
            const folderCreateData = pack.folders.map(f => {
              if ( game.folders.has(f.id) ) return null;
              const data = f.toObject();

              // If this folder has no parent folder, assign it to the new folder
              if (!data.folder && parentFolder?.id) data.folder = parentFolder.id;
              return data;
            }).filter(f => f);
            await Folder.createDocuments(folderCreateData, {keepId: true});
          }

          const folderData = await this.buildFolderStructureForPackContent(packContent, packType, this.adventureName);

          // Append the entities found in this pack to the growing list to import
          createData = createData.concat(
            packContent.map(c => {
              let cData = collection.fromCompendium(c, {clearSort: false, keepId: true});
              cData._id = c.id; // Preserve the original ID

              const newFlags = {};
              newFlags['core'] = {sourceId: c.uuid};
              if (!cData.flags) {
                cData.flags = {};
              }
              mergeObject(cData.flags, newFlags);
              if (!cData.flags[CONSTANTS.MODULE_NAME]) {
                cData.flags[CONSTANTS.MODULE_NAME] = {};
              }
              cData.flags[CONSTANTS.MODULE_NAME].hash = Hash.SHA1(cData);

              if (!cData.folder && (CONST.FOLDER_DOCUMENT_TYPES ?? CONST.FOLDER_ENTITY_TYPES).includes(packType)) {
                // Utilise the folder structure as defined by the Compendium Folder if it exists, otherwise
                // fall back to the default folder.
                const cfPath = cData.flags?.cf?.path;
                if (cfPath && folderData.folderMap.has(cfPath)) {
                  cData.folder = folderData.folderMap.get(cfPath)?.id || null;
                } else if (folderData.folderId) {
                  cData.folder = folderData.folderId;
                }
              }

              // Set the sorting value
              if (cData.flags?.cf?.sort) {
                cData.sort = cData.flags.cf.sort;
              }

              if (packType === 'Actor' && !CONSTANTS.IsV10orNewer()) {
                // Patch "Sight angle must be between 1 and 360 degrees." error
                if (cData.token?.sightAngle === 0) {
                  cData.token.sightAngle = 360;
                }
                if (cData.token?.lightAngle === 0) {
                  cData.token.lightAngle = 360;
                }
              }
              return cData;
            }),
          );

          // Exclude Compendium Folder temporary entities
          createData = createData.filter(c => c.name !== CONSTANTS.CF_TEMP_ENTITY_NAME);

          if (createData.length > 0) {
            di.data.content = `<p>${game.i18n.format('SCENE-PACKER.welcome.import-all.creating-data', {
              count: new Intl.NumberFormat().format(createData.length),
              type: game.i18n.format(CONSTANTS.TYPE_HUMANISE[packType]),
              label: pack.metadata.label,
            })}</p>`;
            di.render();
            let createdEntities = await entityClass.create(createData, {keepId: true});
            if (!Array.isArray(createdEntities)) {
              createdEntities = [createdEntities];
            }

            switch (packType) {
              case 'Scene':
                // Unpack scenes
                for (const scene of createdEntities) {
                  await this.ProcessScene(scene, {showLinkedJournal: false, contentPreImported: true, showUI: false});
                }
                break;
              case 'JournalEntry':
                // Display the Welcome Journal once per new module version
                if (this.welcomeJournal) {
                  let importedVersion = game.settings.get(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION) || '0.0.0';
                  const module = game.modules.get(this.moduleName);
                  const moduleVersion = (module?.version ?? module?.data?.version) || '0.0.0';
                  // Note that the imported version gets set during ProcessScene, but JournalEntries are processed before Scenes,
                  // so the current version flag won't have been set yet.
                  if (isNewerVersion(moduleVersion, importedVersion)) {
                    let welcomeJournal = game.journal.find(j => j.name === this.welcomeJournal && j.getFlag('core', 'sourceId')
                      .startsWith(`Compendium.${this.moduleName}.`));
                    if (welcomeJournal) {
                      welcomeJournal.sheet.render(true, {sheetMode: 'text'});
                    }
                  }
                }
                break;
              case 'Actor':
                // Check if the actors had embedded Automated Evocations data
                // @see https://github.com/theripper93/automated-evocations#store-companions-on-actor
                for (let createdEntity of createdEntities) {
                  let documentFlags = (createdEntity.flags ?? createdEntity.data.flags) || {};
                  let automatedEvocationsCompanions = documentFlags['automated-evocations']?.companions || [];
                  let needsUpdate = false;
                  for (let companionData of automatedEvocationsCompanions) {
                    // Look for the new entity and update the reference
                    const newCompanion = ScenePacker.FindEntity(`Actor.${companionData.id}`);
                    if (newCompanion?.id) {
                      companionData.id = newCompanion.id;
                      needsUpdate = true;
                    } else {
                      this.logWarn(true, `Could not find Automated Evocation companion ${companionData.id} for ${createdEntity.name}. Unable to update reference.`);
                    }
                  }
                  if (needsUpdate) {
                    this.log(true, `Updating ${createdEntity.name}'s Automated Evocations companion references.`);
                    await createdEntity.update({
                      'flags.automated-evocations.isLocal': true,
                      'flags.automated-evocations.companions': automatedEvocationsCompanions,
                    });
                  }
                }
                break;
              case 'RollTable':
                createdRollTables.push(...createdEntities);
                break;
            }
          }
        } catch (e) {
          console.error(`Error processing ${pack.title}`, e);
        }
      }
    }

    if (createdRollTables.length > 0) {
      // RollTable results that reference compendiums should be converted to their local instance.
      for (const table of createdRollTables) {
        const updates = [];
        for (const result of ((table.results ?? table.data.results) || [])) {
          if ((result.type ?? result.data.type) !== CONST.TABLE_RESULT_TYPES.COMPENDIUM) {
            continue;
          }

          const packReference = CONSTANTS.IsV10orNewer() ? result.documentCollection : result.data.collection;
          const pack = game.packs.get(packReference);
          if (!pack) {
            continue;
          }

          const referenceExists = game.collections.get((pack.metadata.type || pack.metadata.entity))?.getName((result.text ?? result.data.text));
          if (!referenceExists) {
            continue;
          }

          updates.push({
            _id: result.id,
            collection: pack.metadata.type || pack.metadata.entity,
            type: CONST.TABLE_RESULT_TYPES.DOCUMENT || CONST.TABLE_RESULT_TYPES.ENTITY,
          })
        }

        if (updates.length > 0) {
          await table.updateEmbeddedDocuments('TableResult', updates);
        }
      }
    }

    ui.notifications.info(
      game.i18n.format('SCENE-PACKER.welcome.import-all.complete', {
        name: this.adventureName,
      }),
    );
    this.log(true, game.i18n.format('SCENE-PACKER.welcome.import-all.complete', {
      name: this.adventureName,
    }));

    /**
     * Trigger any hooks for importing all packs in the module. Receives argument: {@link ImportedAllEntities}
     */
    Hooks.callAll(CONSTANTS.HOOKS_IMPORT_ALL_COMPLETE, {moduleName: this.moduleName, adventureName: this.adventureName, instance: this});

    if (di && typeof di.close === 'function') {
      // Wrap in a setTimeout to make sure the application has finished rendering it, otherwise it won't close.
      setTimeout(() => {
        di.close({force: true});
      }, 0);
    }
  }

  /**
   * Loops through the provided entity content and creates folders for them if they are missing.
   * Will utilise Compendium Folders data to create folder structures if possible, falling back to the provided name.
   * @param {Object[]} content - The content needing folders
   * @param {String} entityType - The type of entity
   * @param {String} fallbackFolderName - The name to use for the fallback folder if Compendium Folders is not used
   * @return {Promise<{folderId: null|String, folderMap: Map<String, Object>}>}
   */
  async buildFolderStructureForPackContent(content, entityType, fallbackFolderName) {
    const response = {
      folderId: null,
      folderMap: new Map(),
    };

    if (!content.length) {
      return response;
    }
    if (!(CONST.FOLDER_DOCUMENT_TYPES ?? CONST.FOLDER_ENTITY_TYPES).includes(entityType)) {
      // Entity type does not support folders
      return response;
    }

    const hasCFData = content.some(p => {
      const data = CONSTANTS.IsV10orNewer() ? p : p.data;
      return data.flags?.cf?.path || data.name === CONSTANTS.CF_TEMP_ENTITY_NAME;
    });
    const allHaveCFData = content.every(p => {
      const data = CONSTANTS.IsV10orNewer() ? p : p.data;
      return data.flags?.cf?.path || data.name === CONSTANTS.CF_TEMP_ENTITY_NAME;
    });

    if (!allHaveCFData && fallbackFolderName) {
      // Need the fallback folder to exist
      let folder = game.folders.find(
        (folder) => folder.name === fallbackFolderName && folder.type === entityType && folder.parent === null && !folder.folder,
      );
      if (!folder) {
        folder = await Folder.create({
          name: fallbackFolderName,
          type: entityType,
          parent: null,
        });
      }
      response.folderId = folder.id;

      if (!hasCFData) {
        // Only the fallback folder is needed
        return response;
      }
    }

    // Sort the content so that folders are progressively built by building the shallow paths first and then
    // non-compendium folder last (to make use of folders built by CF).
    content.sort((e1, e2) => {
      const e1Data = CONSTANTS.IsV10orNewer() ? e1 : e1.data;
      const e2Data = CONSTANTS.IsV10orNewer() ? e2 : e2.data;
      let cfPath1 = e1Data?.flags?.cf?.path;
      if (!cfPath1 && e1Data.name === CONSTANTS.CF_TEMP_ENTITY_NAME) {
        cfPath1 = e1Data?.flags?.cf?.name;
      }
      let cfPath2 = e2Data?.flags?.cf?.path;
      if (!cfPath2 && e2Data.name === CONSTANTS.CF_TEMP_ENTITY_NAME) {
        cfPath2 = e2Data?.flags?.cf?.name;
      }
      const e1Name = e1.name;
      const e2Name = e2.name;
      const e1Sort = e1Data.sort ?? 0;
      const e2Sort = e2Data.sort ?? 0;

      if (!cfPath1 && !cfPath2) {
        // Neither have CF data, use the sort order
        return e1Sort - e2Sort;
      }
      if (cfPath1 && !cfPath2) {
        // Sort e1 first as it has CF data
        return -1;
      }
      if (!cfPath1 && cfPath2) {
        // Sort e2 first as it has CF data
        return 1;
      }
      if (e1Name === CONSTANTS.CF_TEMP_ENTITY_NAME && e2Name !== CONSTANTS.CF_TEMP_ENTITY_NAME) {
        // Sort e1 first as it is a CF temp folder entity
        return -1;
      }
      if (e1Name !== CONSTANTS.CF_TEMP_ENTITY_NAME && e2Name === CONSTANTS.CF_TEMP_ENTITY_NAME) {
        // Sort e2 first as it is a CF temp folder entity
        return 1;
      }

      const e1Segments = cfPath1.split(CONSTANTS.CF_SEPARATOR);
      const e2Segments = cfPath2.split(CONSTANTS.CF_SEPARATOR);
      if (e1Segments.length === e2Segments.length) {
        // Both at the same depth, use the sort order
        return e1Sort - e2Sort;
      }
      if (e1Segments.length < e2Segments.length) {
        // Sort e1 first as it has fewer segments
        return -1;
      }
      // Sort e2 first as it has fewer segments
      return 1;
    });

    // Build the Compendium Folder structure paths
    for (let i = 0; i < content.length; i++) {
      const entity = content[i];
      const eData = CONSTANTS.IsV10orNewer() ? entity : entity.data;
      let cfPath = eData?.flags?.cf?.path;
      if (!cfPath && eData.name === CONSTANTS.CF_TEMP_ENTITY_NAME) {
        cfPath = eData?.flags?.cf?.name;
      }
      const cfColor = eData?.flags?.cf?.color;
      if (!cfPath) {
        continue;
      }
      if (response.folderMap.has(cfPath)) {
        continue;
      }
      let cfSorting = eData?.flags?.cf?.sorting;
      const cfSort = eData?.flags?.cf?.sort ?? eData.sort ?? 0;
      if (cfSort && !cfSorting) {
        // This document has a sort value, so it implies manual folder sorting
        cfSorting = 'm';
      }

      const pathParts = cfPath.split(CONSTANTS.CF_SEPARATOR);
      for (let j = 0; j < pathParts.length; j++) {
        const pathPart = pathParts[j];
        if (response.folderMap.has(pathPart)) {
          continue;
        }
        let parent = null;
        if (j > 0) {
          // Not the first folder in the path, find the parent.
          let parentPart = pathParts[j - 1];
          if (parentPart && response.folderMap.has(parentPart)) {
            parent = response.folderMap.get(parentPart);
          }
        }
        // See if a folder already exists
        let folder = game.folders.find((folder) => {
          const data = CONSTANTS.IsV10orNewer() ? folder : folder.data;
          const parentId = data.folder?.id ?? data.parent;
          return folder.name === pathPart && folder.type === entityType && parentId === (parent?.id || null)
        });
        if (folder) {
          response.folderMap.set(pathPart, folder);
          continue;
        }
        // Need to create the folder.
        folder = await Folder.create({
          name: pathPart,
          type: entityType,
          parent: parent?.id || null,
          color: cfColor || null,
          sorting: cfSorting,
          sort: cfSort,
        });
        response.folderMap.set(pathPart, folder);
      }
      let lastFolder = response.folderMap.get(pathParts.pop());
      if (lastFolder) {
        response.folderMap.set(cfPath, lastFolder);
      }
    }

    return response;
  }

  /**
   * Gets the compendium search packs for the requested type.
   * @param {String} type - The type to search for. One of CONST.COMPENDIUM_DOCUMENT_TYPES (['Actor', 'Cards', 'Item', 'JournalEntry', 'Macro', 'Playlist', 'RollTable', 'Scene', 'Adventure'])
   */
  getSearchPacksForType(type) {
    const packs = new Set();
    switch (type) {
      case 'Actor':
        this.packs.creatures.forEach(a => packs.add(a));
        break;
      case 'JournalEntry':
        this.packs.journals.forEach(a => packs.add(a));
        break;
      case 'Macro':
        this.packs.macros.forEach(a => packs.add(a));
        break;
      case 'Playlist':
        this.packs.playlists.forEach(a => packs.add(a));
        break;
    }
    if (this.packs.modules.length) {
      const filteredPacks = game.packs.filter((p) => {
        const isCorrectType = (p.documentName || p.entity) === type;
        const isCorrectModule = this.packs.modules.includes(p.metadata.packageName || p.metadata.package);
        const isCorrectSystem = typeof p.metadata.system === 'undefined' || p.metadata.system === game.system.id;
        return isCorrectType && isCorrectModule && isCorrectSystem;
      });
      for (const pack of filteredPacks) {
        packs.add(pack.collection);
      }
    }

    if (!packs.size) {
      // No packs have explicitly been set, default to those belonging to this module
      const filteredPacks = game.packs.filter(p => (p.metadata.packageName || p.metadata.package) === this.moduleName);
      for (const pack of filteredPacks) {
        packs.add(pack.collection);
      }
    }

    return [...packs];
  }

  /**
   * Returns whether the scene has and Packed Data.
   * @param {Object} scene The scene to check.
   * @param {String} moduleName The name of the module that Packed the data.
   * @param {String} tokenFlag The flag that stores token data.
   * @param {String} journalFlag The flag that stores journal pin data.
   * @param {String} macroFlag The flag that stores linked Macro data.
   * @param {String} tilesFlag The flag that stores active tile data.
   * @param {String} playlistFlag The flag that stores linked Playlist data.
   * @returns {Boolean}
   */
  static HasPackedData(
    scene,
    moduleName,
    tokenFlag = CONSTANTS.FLAGS_TOKENS,
    journalFlag = CONSTANTS.FLAGS_JOURNALS,
    macroFlag = CONSTANTS.FLAGS_MACROS,
    tilesFlag = CONSTANTS.FLAGS_TILES,
    playlistFlag = CONSTANTS.FLAGS_PLAYLIST,
  ) {
    if (!game.user.isGM) {
      return false;
    }

    try {
      if (scene.getFlag(moduleName, tokenFlag)) {
        return true;
      }
    } catch (e) {
      // Happens if the scene has no flag registered
    }
    try {
      if (scene.getFlag(moduleName, journalFlag)) {
        return true;
      }
    } catch (e) {
      // Happens if the scene has no flag registered
    }
    try {
      if (scene.getFlag(moduleName, macroFlag)) {
        return true;
      }
    } catch (e) {
      // Happens if the scene has no flag registered
    }
    try {
      if (scene.getFlag(moduleName, tilesFlag)) {
        return true;
      }
    } catch (e) {
      // Happens if the scene has no flag registered
    }
    try {
      if (scene.getFlag(moduleName, playlistFlag)) {
        return true;
      }
    } catch (e) {
      // Happens if the scene has no flag registered
    }
    return false;
  }

  /**
   * Initialises the Scene Packer on the scene.
   * @param {Object} scene The scene to initialise. Defaults to the currently viewed scene.
   * @param {Boolean} showLinkedJournal Whether to show any Journals linked to the Scene.
   * @param {Boolean} contentPreImported Whether the content for this scene has already been imported.
   * @param {Boolean|null} showUI Whether to show the UI notifications. If null, will default to the opposite of contentPreImported.
   * @returns Promise<ScenePacker> for chaining
   */
  async ProcessScene(
    scene = game.scenes.get(game.user.viewedScene),
    {
      showLinkedJournal: showLinkedJournal = this.allowImportPrompts,
      contentPreImported: contentPreImported = false,
      showUI: showUI = null,
    } = {},
  ) {
    if (!game.user.isGM) {
      return;
    }

    if (showUI === null) {
      showUI = !contentPreImported;
    }

    const packedVersion = await scene.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_PACKED_VERSION);
    const sourceModule = await scene.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_SOURCE_MODULE);
    if (packedVersion && isNewerVersion(CONSTANTS.MINIMUM_SUPPORTED_PACKER_VERSION, packedVersion)) {
      ui.notifications.error(
        game.i18n.format('SCENE-PACKER.errors.version.packed-low', {
          version: packedVersion,
          supportedVersion: CONSTANTS.MINIMUM_SUPPORTED_PACKER_VERSION,
          sourceModule,
          scene: scene.name,
        }),
      );
      throw game.i18n.format('SCENE-PACKER.errors.version.packed-low', {
        version: packedVersion,
        supportedVersion: CONSTANTS.MINIMUM_SUPPORTED_PACKER_VERSION,
        sourceModule,
        scene: scene.name,
      });
    }

    if (!ScenePacker.HasPackedData(scene, this.moduleName)) {
      return this;
    }

    if (showUI) {
      ui.notifications.info(
        game.i18n.localize('SCENE-PACKER.notifications.first-launch'),
      );
    }
    await this.UnpackScene(scene, {showLinkedJournal, contentPreImported, showUI});
    await this.ClearPackedData(scene, showUI);
    if (showUI) {
      ui.notifications.info(
        game.i18n.localize('SCENE-PACKER.notifications.done'),
      );
    }

    let importedVersion = game.settings.get(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION) || '0.0.0';
    const module = game.modules.get(this.moduleName);
    const moduleVersion = (module?.version ?? module?.data?.version) || '0.0.0';
    if (this.welcomeJournal && isNewerVersion(moduleVersion, importedVersion)) {
      // Display the welcome journal once per new module version
      const j = game.journal.find(j => j.name === this.welcomeJournal && j.getFlag('core', 'sourceId')
        ?.startsWith(`Compendium.${this.moduleName}.`));
      if (j) {
        j.sheet.render(true, {sheetMode: 'text'});
      }
    }
    // Set both world and scene imported version flags
    await game.settings.set(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION, moduleVersion || '0.0.0');
    await scene.setFlag(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION, moduleVersion || '0.0.0');

    return this;
  }

  /**
   * Get the instance of ScenePacker
   * @example
   * // If called >= 2.0.0
   * GetInstance(options = {})
   * // If called < 2.0.0
   * GetInstance(adventureName = '', moduleName = '', options = {})
   * @param  {...any} args
   * @returns {ScenePacker} The ScenePacker instance
   */
  static GetInstance(...args) {
    // Maintain backwards compatibility with versions < 2.0.0 where the signature was
    //   GetInstance(adventureName = '', moduleName = '', options = {})
    const options = {};
    if (typeof args[0] === 'string') {
      options.adventureName = args.shift();
    }
    if (typeof args[0] === 'string') {
      options.moduleName = args.shift();
    }
    if (typeof args[0] === 'object') {
      Object.assign(options, args.shift());
    }
    const instance = globalScenePacker.instances[options?.moduleName];
    if (instance) {
      return instance;
    }
    return new ScenePacker(options, ...args);
  }

  /**
   * Initialise a Scene Packer instance with the provided options.
   * @param {Object} options
   * @returns {ScenePacker}
   * @see {@link ScenePacker#constructor} For options format
   */
  static Initialise(options = {}) {
    return new ScenePacker(options);
  }

  /**
   * Log a message to console of the requested type if dev mode is enabled.
   * @param {String} moduleName The name of the module
   * @param {String} type The type of log. One of "error", "warn" or "log"
   * @param {Boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  static logType(moduleName, type, force, ...args) {
    try {
      if (typeof force !== 'boolean') {
        console.warn(
          game.i18n.format('SCENE-PACKER.log.invalidForce', {
            moduleName: moduleName,
            force: force,
          }),
        );
      }

      const isDebugging = game.modules.get('_dev-mode')?.api?.getPackageDebugValue(CONSTANTS.MODULE_NAME);

      if (force || isDebugging) {
        switch (type) {
          case 'error':
            console.error(moduleName, '|', ...args);
            break;
          case 'warn':
            console.warn(moduleName, '|', ...args);
            break;
          default:
            console.log(moduleName, '|', ...args);
        }
      }
    } catch (e) {
    }
  }

  /**
   * Log a message to console if dev mode is enabled.
   * @param {Boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  log(force, ...args) {
    ScenePacker.logType(this.moduleName, 'info', force, ...args);
  }

  /**
   * Log a warning message to console if dev mode is enabled.
   * @param {Boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  logWarn(force, ...args) {
    ScenePacker.logType(this.moduleName, 'warn', force, ...args);
  }

  /**
   * Log an error message to console if dev mode is enabled.
   * @param {Boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  logError(force, ...args) {
    ScenePacker.logType(this.moduleName, 'error', force, ...args);
  }

  /**
   * Set the human-readable name of the adventure. This will populate folder names etc.
   * @param {String} adventureName
   * @returns this to support chaining
   */
  SetAdventureName(adventureName) {
    if (!adventureName) {
      ui.notifications.error(
        game.i18n.localize('SCENE-PACKER.errors.adventureName.ui'),
      );
      throw game.i18n.localize('SCENE-PACKER.errors.adventureName.details');
    }
    this.adventureName = adventureName;
    return this;
  }

  /**
   * Gets the human-readable name of the adventure this Scene Packer was set up with.
   * @returns {String}
   */
  GetAdventureName() {
    return this.adventureName;
  }

  /**
   * Set the module name of the module the ScenePacker is being used in.
   * @param {String} moduleName
   * @returns this to support chaining
   */
  SetModuleName(moduleName) {
    if (!moduleName) {
      ui.notifications.error(
        game.i18n.localize('SCENE-PACKER.errors.moduleName.ui'),
      );
      throw game.i18n.localize('SCENE-PACKER.errors.moduleName.details');
    }
    this.moduleName = moduleName;
    return this;
  }

  /**
   * Gets the module name this Scene Packer was set up with.
   * @returns String
   */
  GetModuleName() {
    return this.moduleName;
  }

  /**
   * Set the name of the journal to be imported and automatically opened after activation.
   * @param {String} journal
   * @returns this to support chaining
   */
  SetWelcomeJournal(journal) {
    if (journal) {
      if (typeof journal !== 'string') {
        ui.notifications.error(
          game.i18n.localize('SCENE-PACKER.errors.welcomeJournal.ui'),
        );
        throw game.i18n.localize('SCENE-PACKER.errors.welcomeJournal.details');
      }
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.welcomeJournal.missing'),
      );
    }

    this.welcomeJournal = journal;
    return this;
  }

  /**
   * Set which journals (by name) should be automatically imported.
   * @param {String[]} journals
   * @returns this to support chaining
   */
  SetAdditionalJournalsToImport(journals) {
    if (journals) {
      journals = journals instanceof Array ? journals : [journals];
      journals.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            game.i18n.localize('SCENE-PACKER.errors.additionalJournals.ui'),
          );
          throw game.i18n.format(
            'SCENE-PACKER.errors.additionalJournals.details',
            {
              journal: j,
            },
          );
        }
      });
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.additionalJournals.missing'),
      );
    }

    this.additionalJournals = journals;
    return this;
  }

  /**
   * Set which macros (by name) should be automatically imported.
   * @param {String[]} macros
   * @returns this to support chaining
   */
  SetAdditionalMacrosToImport(macros) {
    if (macros) {
      macros = macros instanceof Array ? macros : [macros];
      macros.forEach((m) => {
        if (typeof m !== 'string') {
          ui.notifications.error(
            game.i18n.localize('SCENE-PACKER.errors.additionalMacros.ui'),
          );
          throw game.i18n.format(
            'SCENE-PACKER.errors.additionalMacros.details',
            {
              macro: m,
            },
          );
        }
      });
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.additionalMacros.missing'),
      );
    }

    this.additionalMacros = macros;
    return this;
  }

  /**
   * Set which Actor packs should be used when searching for Actors.
   * @param {String[]} packs
   * @returns this to support chaining
   */
  SetCreaturePacks(packs) {
    if (packs) {
      packs = packs instanceof Array ? packs : [packs];
      packs.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            game.i18n.localize('SCENE-PACKER.errors.creaturePacks.ui'),
          );
          throw game.i18n.format('SCENE-PACKER.errors.creaturePacks.details', {
            pack: j,
          });
        }
      });
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.additionalJournals.missing'),
      );
    }

    this.packs.creatures = packs;
    return this;
  }

  /**
   * Set which Journal packs should be used when searching for Journals.
   * @param {String[]} packs
   * @returns this to support chaining
   */
  SetJournalPacks(packs) {
    if (packs) {
      packs = packs instanceof Array ? packs : [packs];
      packs.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            game.i18n.localize('SCENE-PACKER.errors.journalPacks.ui'),
          );
          throw game.i18n.format('SCENE-PACKER.errors.journalPacks.details', {
            pack: j,
          });
        }
      });
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.journalPacks.missing'),
      );
    }

    this.packs.journals = packs;
    return this;
  }

  /**
   * Set which Macro packs should be used when searching for Macros.
   * @param {String[]} packs
   * @returns this to support chaining
   */
  SetMacroPacks(packs) {
    if (packs) {
      packs = packs instanceof Array ? packs : [packs];
      packs.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            game.i18n.localize('SCENE-PACKER.errors.macroPacks.ui'),
          );
          throw game.i18n.format('SCENE-PACKER.errors.macroPacks.details', {
            pack: j,
          });
        }
      });
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.macroPacks.missing'),
      );
    }

    this.packs.macros = packs;
    return this;
  }

  /**
   * Set which Playlist packs should be used when searching for Playlists.
   * @param {String[]} packs
   * @returns this to support chaining
   */
  SetPlaylistPacks(packs) {
    if (packs) {
      packs = packs instanceof Array ? packs : [packs];
      packs.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            game.i18n.localize('SCENE-PACKER.errors.playlistPacks.ui'),
          );
          throw game.i18n.format('SCENE-PACKER.errors.playlistPacks.details', {
            pack: j,
          });
        }
      });
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.playlistPacks.missing'),
      );
    }

    this.packs.playlists = packs;
    return this;
  }

  /**
   * Set which additional module's packs should be used when searching for entities.
   * @param {String[]} packs
   * @returns this to support chaining
   */
  SetAdditionalModulePacks(packs) {
    if (packs) {
      packs = packs instanceof Array ? packs : [packs];
      packs.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            game.i18n.localize('SCENE-PACKER.errors.modulePacks.ui'),
          );
          throw game.i18n.format('SCENE-PACKER.errors.modulePacks.details', {
            pack: j,
          });
        }
      });
    } else {
      this.log(
        false,
        game.i18n.localize('SCENE-PACKER.errors.modulePacks.missing'),
      );
    }

    this.packs.modules = packs;
    return this;
  }

  /**
   * Renders a dialog showing which Scenes in the world contain data that would benefit from being Packed.
   */
  static ShowScenesWorthPacking() {
    if (!game.user.isGM) {
      return;
    }

    const sceneInfo = new Map();
    const scenes = game.scenes.contents;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneData = {
        id: scene.id,
        name: scene.name,
        sources: [],
      };

      if (scene.journal) {
        sceneData.sources.push('journal');
      }

      if (scene.playlist) {
        sceneData.sources.push('playlist');
      }

      const notes = CONSTANTS.IsV10orNewer() ? scene.notes : scene.data?.notes;
      if (notes?.size || notes?.length) {
        sceneData.sources.push('notes');
      }

      const tokens = CONSTANTS.IsV10orNewer() ? scene.tokens : scene.data?.tokens;
      if (tokens?.size || tokens?.length) {
        sceneData.sources.push('tokens');
      }

      const tiles = CONSTANTS.IsV10orNewer() ? scene.tiles : scene.data?.tiles;
      if (ScenePacker.GetActiveTilesData(tiles).length) {
        sceneData.sources.push('monks-active-tiles');
      }

      if (sceneData.sources.length) {
        sceneInfo.set(scene.id, sceneData);
      }
    }

    let content = `<p>${game.i18n.format('SCENE-PACKER.worth-packing.intro', {
      count: new Intl.NumberFormat().format(sceneInfo.size),
      total: new Intl.NumberFormat().format(scenes.length),
    })}</p>`;
    if (sceneInfo.size) {
      content += '<ul>';
      for (const scene of sceneInfo.values()) {
        content += `<li>${scene.name} (${scene.sources.join(', ')})</li>`;
      }
      content += '</ul>';
    } else {
      content = `<p>${game.i18n.localize('SCENE-PACKER.worth-packing.none')}</p>`;
    }
    let activeModules = Object.keys(globalScenePacker.instances);

    const displaySummary = (moduleName, missing) => {
      let content = `<p>${game.i18n.format('SCENE-PACKER.worth-packing.verify-missing', {
        module: moduleName,
        count: new Intl.NumberFormat().format(missing.size),
        total: new Intl.NumberFormat().format(sceneInfo.size),
      })}</p>`;
      if (missing.size) {
        content += '<ul>';
        for (const scene of missing.values()) {
          content += `<li>${scene.name} (${scene.reason})</li>`;
        }
        content += '</ul>';
      } else {
        content = `<p>${game.i18n.format('SCENE-PACKER.worth-packing.verify-ok', {module: moduleName})}</p>`;
      }
      Dialog.prompt({
        title: game.i18n.localize('SCENE-PACKER.worth-packing.verify'),
        content,
        label: game.i18n.localize('Close'),
        callback: () => {
        },
      });
    };

    new Dialog({
      title: game.i18n.localize('SCENE-PACKER.worth-packing.title'),
      content: content,
      buttons: {
        verify: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('Verify'),
          condition: () => activeModules.length && sceneInfo.size,
          callback: () => {
            let internalContent = game.i18n.localize('SCENE-PACKER.worth-packing.verify-intro');
            internalContent += `<p>${game.i18n.localize('SCENE-PACKER.worth-packing.verify-select')}</p>`;
            internalContent += '<select id="module-name">';
            activeModules.forEach(m => {
              internalContent += `<option value="${m}">${m}</option>`;
            });
            internalContent += '</select>';
            internalContent += `<p>${game.i18n.localize('SCENE-PACKER.worth-packing.verify-slow')}</p>`;
            internalContent += '<p><hr></p>';
            new Dialog({
              title: game.i18n.localize('SCENE-PACKER.worth-packing.verify'),
              content: internalContent,
              buttons: {
                verify: {
                  icon: '<i class="fas fa-check"></i>',
                  label: game.i18n.localize('Verify'),
                  callback: async (html) => {
                    let moduleName = html.find('#module-name')[0].value;
                    let missing = new Map(sceneInfo);
                    if (!moduleName) {
                      return displaySummary('undefined', missing);
                    }
                    const instance = globalScenePacker.instances[moduleName];
                    if (!instance) {
                      return displaySummary(moduleName, missing);
                    }
                    const packs = game.packs.filter(p => (p.metadata.packageName || p.metadata.package) === moduleName && (p.documentName || p.entity) === 'Scene');
                    if (!packs.length) {
                      return displaySummary(moduleName, missing);
                    }

                    const di = new Dialog({
                      title: game.i18n.localize('Verify'),
                      content: `<p>${game.i18n.localize('SCENE-PACKER.worth-packing.verify-wait')}</p>`,
                      buttons: {
                        close: {
                          icon: '<i class="fas fa-check"></i>',
                          label: game.i18n.localize('Close'),
                          callback: () => {
                          },
                        },
                      },
                      default: 'close',
                    });
                    di.render(true);

                    for (const pack of packs) {
                      const packData = await pack.getDocuments();
                      for (const scene of packData) {
                        const sourceId = scene.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
                        if (!sourceId) {
                          continue;
                        }
                        const localScene = ScenePacker.FindEntity(sourceId);
                        if (!localScene?.id) {
                          continue;
                        }
                        const missingData = missing.get(localScene.id)
                        if (!missingData) {
                          continue;
                        }
                        if (ScenePacker.HasPackedData(scene, moduleName)) {
                          missing.delete(localScene.id);
                          continue;
                        }

                        missingData.reason = game.i18n.localize('SCENE-PACKER.worth-packing.verify-not-packed');
                        missing.set(localScene.id, missingData);
                      }
                    }

                    missing.forEach((value, key) => {
                      if (!value.reason) {
                        value.reason = game.i18n.localize('SCENE-PACKER.worth-packing.verify-not-found');
                        missing.set(key, value);
                      }
                    });

                    if (di && typeof di.close === 'function') {
                      // Wrap in a setTimeout to make sure the application has finished rendering it, otherwise it won't close.
                      setTimeout(() => {
                        di.close({force: true});
                      }, 0)
                    }

                    return displaySummary(moduleName, missing);
                  },
                },
                cancel: {
                  icon: '<i class="fas fa-times"></i>',
                  label: game.i18n.localize('Cancel'),
                },
              },
            }).render(true);
          },
        },
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('Close'),
          callback: () => {
          },
        },
      },
    }).render(true);
  }

  /**
   * PackScene() will write the following information to the Scene data for later retrieval:
   *   Journal Note Pins
   *   Actor Tokens
   *   Linked JournalID
   *   Source Module that packed the Scene
   * @returns Promise
   */
  async PackScene(scene = game.scenes.get(game.user.viewedScene)) {
    if (!game.user.isGM) {
      return;
    }

    // Remove the flag that tracks what version of the module imported the Scene, as it doesn't make sense to ship that out in the module.
    await scene.unsetFlag(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION);

    // Store details about which module and version packed the Scene
    await scene.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_SOURCE_MODULE, this.moduleName);
    const module = game.modules.get(CONSTANTS.MODULE_NAME);
    const moduleVersion = (module?.version ?? module?.data?.version) || '0.0.0';
    await scene.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_PACKED_VERSION, moduleVersion);


    const sceneJournalInfo = {};
    if (scene.journal) {
      sceneJournalInfo.journalName = scene.journal.name;
      sceneJournalInfo.sourceId = scene.journal.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') || scene.journal.getFlag('core', 'sourceId') || scene.journal.uuid;
      const compendiumJournal = await this.FindJournalInCompendiums(scene.journal, this.getSearchPacksForType('JournalEntry'));
      if (compendiumJournal?.uuid) {
        sceneJournalInfo.compendiumSourceId = compendiumJournal.uuid;
      }
    }
    await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_JOURNAL, sceneJournalInfo);

    const initialSceneLocation = CONSTANTS.IsV10orNewer() ? scene.initial : scene.data?.initial;
    if (initialSceneLocation) {
      await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_POSITION, initialSceneLocation);
    }

    if (scene.playlist) {
      const compendiumPlaylist = await this.FindPlaylistInCompendiums(scene.playlist, this.getSearchPacksForType('Playlist'));
      if (compendiumPlaylist) {
        await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_PLAYLIST, compendiumPlaylist.uuid);
      }
    }

    const sceneNotes = CONSTANTS.IsV10orNewer() ? scene.notes : scene.data.notes;
    /**
     * journalInfo is the data that gets passed to findMissingJournals
     */
    const journalInfoResults = await Promise.allSettled(sceneNotes.map(async note => {
      note = note.toObject();
      if (note.texture?.src) {
        note.icon = note.texture.src
      }
      const journalData = game.journal.get(note.entryId);
      const compendiumJournal = await this.FindJournalInCompendiums(journalData, this.getSearchPacksForType('JournalEntry'));

      // Take a copy of the original note adding in the sourceId, journal name and folder name it belongs to
      const folderId = CONSTANTS.IsV10orNewer() ? journalData?.folder : journalData?.data?.folder;
      const folder = game.folders.get(folderId);
      const folderName = CONSTANTS.IsV10orNewer() ? folder?.name : folder?.data?.name;
      return mergeObject(
        note,
        {
          sourceId: journalData?.uuid,
          compendiumSourceId: compendiumJournal?.uuid,
          journalName: journalData?.name,
          folderName: folderName,
        },
        {inplace: false},
      );
    }));
    const journalInfo = journalInfoResults.filter(result => result.status === 'fulfilled').map(result => result.value);

    if (journalInfo.length > 0) {
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.notifications.pack-scene.writing-journals',
          {
            number: journalInfo.length,
            name: scene.name,
          },
        ),
      );
      this.log(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.pack-scene.writing-journals',
          {
            number: journalInfo.length,
            name: scene.name,
          },
        ),
      );
      await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS, journalInfo);
    } else {
      ui.notifications.info(
        game.i18n.localize(
          'SCENE-PACKER.notifications.pack-scene.no-journal-pins',
        ),
      );
    }

    const sceneTiles = CONSTANTS.IsV10orNewer() ? scene.tiles : scene.data?.tiles;
    /**
     * tileInfo is the data referenced by Monk's Active Tile Triggers that needs packing.
     */
    const tileInfo = await this.packActiveTiles(sceneTiles);

    if (tileInfo.length > 0) {
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.notifications.pack-scene.writing-tile-actions',
          {
            countTiles: tileInfo.length,
            countActions: tileInfo.reduce((prev, cur) => prev + cur.actions?.length || 0, 0),
            name: scene.name,
          },
        ),
      );
      this.log(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.pack-scene.writing-tile-actions',
          {
            countTiles: tileInfo.length,
            countActions: tileInfo.reduce((prev, cur) => prev + cur.actions?.length || 0, 0),
            name: scene.name,
          },
        ),
      );
      await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_TILES, tileInfo);
    }

    const sceneTokens = CONSTANTS.IsV10orNewer() ? scene.tokens : scene.data.tokens;
    /**
     * tokenInfo is the data that gets passed to findMissingTokens
     */
    const tokenInfoResults = await Promise.allSettled(sceneTokens.filter(a => a?.actorId || a?.data?.actorId)
      .map(async token => {
        // Pull the sourceId of the actor, preferring the Actor entry in the module's compendium.
        let sourceId = '';
        let compendiumSourceId = '';
        let actorName = token?.name;
        if (typeof token.getFlag === 'function') {
          sourceId = token.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
        }
        const actorId = token?.actorId || token?.data?.actorId;
        if (actorId) {
          const actor = game.actors.get(actorId);
          if (actor) {
            if (!sourceId) {
              sourceId = actor.uuid;
            }
            if (CONSTANTS.IsV10orNewer() && actor.name) {
              actorName = actor.name;
            } else if (actor.data?.name) {
              actorName = actor.data.name;
            }
            compendiumSourceId = actor.getFlag('core', 'sourceId');
            if (!compendiumSourceId || !compendiumSourceId.startsWith(`Compendium.${this.moduleName}.`)) {
              // The actor source isn't the module's compendium, see if we have a direct match in a different compendium
              const compendiumActor = await this.FindActorInCompendiums(actor, this.getSearchPacksForType('Actor'));
              if (compendiumActor?.uuid) {
                compendiumSourceId = compendiumActor.uuid;
              }
            }
          }
        }

        return {
          sourceId: sourceId,
          compendiumSourceId: compendiumSourceId,
          tokenName: token?.name,
          actorName: actorName,
          x: token?.x ?? token?.data?.x,
          y: token?.y ?? token?.data?.y,
        };
      }));
    const tokenInfo = tokenInfoResults.filter(result => result.status === 'fulfilled').map(result => result.value);

    if (tokenInfo.length > 0) {
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.notifications.pack-scene.writing-tokens',
          {
            number: tokenInfo.length,
            name: scene.name,
          },
        ),
      );
      this.log(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.pack-scene.writing-tokens',
          {
            number: tokenInfo.length,
            name: scene.name,
          },
        ),
      );
      return scene.setFlag(this.moduleName, CONSTANTS.FLAGS_TOKENS, tokenInfo);
    } else {
      ui.notifications.info(
        game.i18n.localize('SCENE-PACKER.notifications.pack-scene.no-tokens'),
      );
    }

    return Promise.resolve();
  }

  /**
   * Find a journal in the listed search packs compendiums.
   * Searches either by name (if there is only a single match), or by journal contents if there are multiple matches.
   * @param {Object} journal The journal entry to find. This is likely to be a local world journal.
   * @param {String[]} searchPacks The compendium pack names to search within
   * @returns {Object|null} The journal in the compendium.
   */
  async FindJournalInCompendiums(journal, searchPacks) {
    if (!journal) {
      return null;
    }

    if (!searchPacks.length) {
      ui.notifications.error(
        game.i18n.localize('SCENE-PACKER.notifications.find-journal-compendium.no-packs'),
      );
      const packs = game.packs.filter(p => (p.metadata.packageName || p.metadata.package) === this.moduleName && (p.documentName || p.entity) === 'JournalEntry');
      const packOptions = packs.length ?
                          `"${packs.map(p => p.collection).join('", "')}"` :
                          game.i18n.localize('SCENE-PACKER.notifications.find-journal-compendium.no-packs-in-module');
      this.logError(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-journal-compendium.no-packs-details',
          {
            packOptions,
          },
        ),
      );
    }

    const sourceId = journal.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
    const coreSourceId = journal.getFlag('core', 'sourceId');

    let compendiumJournal = null;
    let possibleMatches = [];

    for (let packName of searchPacks) {
      const pack = game.packs.get(packName);
      if (!pack) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.find-journal-compendium.missing-pack',
            {
              packName: packName,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.find-journal-compendium.missing-pack-details',
            {
              packName: packName,
            },
          ),
        );
        continue;
      }

      const matchingIndexes = pack.index.filter(p => p.name === journal.name);
      for (let i = 0; i < matchingIndexes.length; i++) {
        let id = matchingIndexes[i]?._id;
        const entity = await pack.getDocument(id);
        if (entity) {
          possibleMatches.push(entity);

          if (entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === journal.uuid) {
            // Entity in the pack originated in this world and is the exact journal
            return entity;
          }

          if (sourceId && entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sourceId) {
            return entity;
          }

          if (sourceId && entity.getFlag('core', 'sourceId') === sourceId) {
            return entity;
          }

          if (coreSourceId && entity.getFlag('core', 'sourceId') === coreSourceId) {
            return entity;
          }
        }
      }
    }

    if (possibleMatches.length === 1) {
      // Only one Journal matches by name
      return possibleMatches.pop();
    }

    if (possibleMatches.length) {
      // See if there is a single entry in a compendium that belongs to this module
      let filteredOptions = possibleMatches.filter(a => a.uuid.startsWith(`Compendium.${this.moduleName}.`));

      if (filteredOptions.length === 1) {
        // Only one Journal matches by name in a compendium belonging to this module
        return filteredOptions.pop();
      }
    }

    const compendiumSourceId = journal.getFlag('core', 'sourceId');
    if (compendiumSourceId && searchPacks.some(p => compendiumSourceId.startsWith(`Compendium.${p}.`))) {
      const match = fromUuid(compendiumSourceId);
      if (match) {
        return match;
      }
    }

    if (!possibleMatches.length) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-journal-compendium.no-match',
          {
            journal: journal.name,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-journal-compendium.no-match',
          {
            journal: journal.name,
          },
        ),
      );

      return compendiumJournal;
    }

    // There is more than one possible match, check the Journal contents for an exact match.
    for (let i = 0; i < possibleMatches.length; i++) {
      const entity = possibleMatches[i];
      const journalContent = CONSTANTS.IsV10orNewer() ? journal.content : journal.data.content;
      const entityContent = CONSTANTS.IsV10orNewer() ? entity.content : entity.data.content;
      if (journalContent === entityContent) {
        compendiumJournal = entity;
        break;
      }
    }

    if (!compendiumJournal) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-journal-compendium.no-match',
          {
            journal: journal.name,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-journal-compendium.no-match',
          {
            journal: journal.name,
          },
        ),
      );
    }

    return compendiumJournal;
  }

  /**
   * Find an actor in the listed search packs compendiums.
   * Searches either by name (if there is only a single match), or by actor contents if there are multiple matches (via JSON stringify).
   * @param {Object} actor The actor entity to find. This is likely to be a local world actor.
   * @param {String[]} searchPacks The compendium pack names to search within
   * @returns {Object|null} The actor in the compendium.
   */
  async FindActorInCompendiums(actor, searchPacks) {
    if (!actor) {
      return null;
    }

    if (!searchPacks.length) {
      ui.notifications.error(
        game.i18n.localize('SCENE-PACKER.notifications.actor-journal-compendium.no-packs'),
      );
      const packs = game.packs.filter(p => (p.metadata.packageName || p.metadata.package) === this.moduleName && (p.documentName || p.entity) === 'Actor');
      const packOptions = packs.length ?
                          `"${packs.map(p => p.collection).join('", "')}"` :
                          game.i18n.localize('SCENE-PACKER.notifications.find-actor-compendium.no-packs-in-module');
      this.logError(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-actor-compendium.no-packs-details',
          {
            packOptions,
          },
        ),
      );
    }

    const sourceId = actor.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');

    let compendiumActor = null;
    let possibleMatches = [];

    for (let packName of searchPacks) {
      const pack = game.packs.get(packName);
      if (!pack) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.find-actor-compendium.missing-pack',
            {
              packName: packName,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.find-actor-compendium.missing-pack-details',
            {
              packName: packName,
            },
          ),
        );
        continue;
      }

      const matchingIndexes = pack.index.filter(p => p.name === actor.name);
      for (let i = 0; i < matchingIndexes.length; i++) {
        let id = matchingIndexes[i]?._id;
        const entity = await pack.getDocument(id);
        if (entity) {
          possibleMatches.push(entity);

          if (entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === actor.uuid) {
            // Entity in the pack originated in this world and is the exact actor
            return entity;
          }

          if (sourceId && entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sourceId) {
            return entity;
          }
        }
      }
    }

    if (possibleMatches.length === 1) {
      // Only one Actor matches by name
      return possibleMatches.pop();
    }

    if (possibleMatches.length) {
      // See if there is a single entry in a compendium that belongs to this module
      let filteredOptions = possibleMatches.filter(a => a.uuid.startsWith(`Compendium.${this.moduleName}.`));

      if (filteredOptions.length === 1) {
        // Only one Actor matches by name in a compendium belonging to this module
        return filteredOptions.pop();
      }

      // See if there is a single entry in a compendium that has the same image
      filteredOptions = possibleMatches.filter(a => a.img === actor.img);

      if (filteredOptions.length === 1) {
        // Only one Actor matches by name and has the same image
        return filteredOptions.pop();
      }
    }

    const compendiumSourceId = actor.getFlag('core', 'sourceId');
    if (compendiumSourceId && searchPacks.some(p => compendiumSourceId.startsWith(`Compendium.${p}.`))) {
      const match = fromUuid(compendiumSourceId);
      if (match) {
        return match;
      }
    }

    if (!possibleMatches.length) {
      ui.notifications.warn(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-actor-compendium.no-match',
          {
            actor: actor.name,
          },
        ),
      );
      this.logWarn(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-actor-compendium.no-match',
          {
            actor: actor.name,
          },
        ),
      );

      return compendiumActor;
    }

    // There is more than one possible match, check the Actor contents for an exact match.
    const requestedActorData = JSON.stringify(actor);
    for (let i = 0; i < possibleMatches.length; i++) {
      const entity = possibleMatches[i];
      if (requestedActorData === JSON.stringify(entity)) {
        compendiumActor = entity;
        break;
      }
    }

    if (!compendiumActor) {
      ui.notifications.warn(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-actor-compendium.no-match',
          {
            actor: actor.name,
          },
        ),
      );
      this.logWarn(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-actor-compendium.no-match',
          {
            actor: actor.name,
          },
        ),
      );
    }

    return compendiumActor;
  }

  /**
   * Find a playlist in the listed search packs compendiums.
   * @param {Object} playlist The entry to find.
   * @param {String[]} searchPacks The compendium pack names to search within
   * @returns {Object|null} The playlist in the compendium.
   */
  async FindPlaylistInCompendiums(playlist, searchPacks) {
    if (!playlist) {
      return null;
    }

    let compendiumPlaylist = null;
    let possibleMatches = [];

    for (let packName of searchPacks) {
      const pack = game.packs.get(packName);
      if (!pack) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.find-playlist-compendium.missing-pack',
            {
              packName: packName,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.find-playlist-compendium.missing-pack-details',
            {
              packName: packName,
            },
          ),
        );
        continue;
      }

      const matchingIndexes = pack.index.filter(p => p.name === playlist.name);
      for (let i = 0; i < matchingIndexes.length; i++) {
        let id = matchingIndexes[i]?._id;
        const entity = await pack.getDocument(id);
        if (entity) {
          if (entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === `Playlist.${playlist.id}`) {
            // Exact match
            return entity;
          }
          possibleMatches.push(entity);
        }
      }
    }

    if (!possibleMatches.length) {
      ui.notifications.warn(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-playlist-compendium.no-match',
          {
            playlist: playlist.name,
          },
        ),
      );
      this.logWarn(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-playlist-compendium.no-match',
          {
            playlist: playlist.name,
          },
        ),
      );

      return compendiumPlaylist;
    }

    if (possibleMatches.length === 1) {
      // Only one Playlist matches by name
      return possibleMatches.pop();
    }

    // There is more than one possible match, check the Playlist contents for an exact match.
    for (let i = 0; i < possibleMatches.length; i++) {
      const entity = possibleMatches[i];
      const playlistSounds = CONSTANTS.IsV10orNewer() ? playlist.sounds : playlist.data.sounds;
      const entitySounds = CONSTANTS.IsV10orNewer() ? entity.sounds : entity.data.sounds;
      if (Array.from(playlistSounds.keys()) === Array.from(entitySounds.keys())) {
        compendiumPlaylist = entity;
        break;
      }
    }

    if (!compendiumPlaylist) {
      ui.notifications.warn(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-playlist-compendium.no-match',
          {
            playlist: playlist.name,
          },
        ),
      );
      this.logWarn(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-playlist-compendium.no-match',
          {
            playlist: playlist.name,
          },
        ),
      );
    }

    return compendiumPlaylist;
  }

  /**
   * Find a macro in the listed search packs compendiums.
   * @param {Object} macro The entry to find.
   * @param {String[]} searchPacks The compendium pack names to search within
   * @returns {Object|null} The macro in the compendium.
   */
  async FindMacroInCompendiums(macro, searchPacks) {
    if (!macro) {
      return null;
    }

    let possibleMatches = [];

    for (let packName of searchPacks) {
      const pack = game.packs.get(packName);
      if (!pack) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.find-macro-compendium.missing-pack',
            {
              packName: packName,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.find-macro-compendium.missing-pack-details',
            {
              packName: packName,
            },
          ),
        );
        continue;
      }

      const matchingIndexes = pack.index.filter(p => p.name === macro.name);
      for (let i = 0; i < matchingIndexes.length; i++) {
        let id = matchingIndexes[i]?._id;
        const entity = await pack.getDocument(id);
        if (entity) {
          if (entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === `Macro.${macro.id}`) {
            // Exact match
            return entity;
          }
          possibleMatches.push(entity);
        }
      }
    }

    if (!possibleMatches.length) {
      ui.notifications.warn(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-macro-compendium.no-match',
          {
            macro: macro.name,
          },
        ),
      );
      this.logWarn(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-macro-compendium.no-match',
          {
            macro: macro.name,
          },
        ),
      );

      return null;
    }

    if (possibleMatches.length === 1) {
      // Only one Macro matches
      return possibleMatches.pop();
    }

    if (possibleMatches.length) {
      // See if there is a single entry in a compendium that belongs to this module
      let filteredOptions = possibleMatches.filter(a => a.uuid.startsWith(`Compendium.${this.moduleName}.`));

      if (filteredOptions.length === 1) {
        // Only one Macro matches in a compendium belonging to this module
        return filteredOptions.pop();
      }
    }

    const compendiumSourceId = macro.getFlag('core', 'sourceId');
    if (compendiumSourceId && searchPacks.some(p => compendiumSourceId.startsWith(`Compendium.${p}.`))) {
      const match = fromUuid(compendiumSourceId);
      if (match) {
        return match;
      }
    }

    ui.notifications.warn(
      game.i18n.format(
        'SCENE-PACKER.notifications.find-macro-compendium.no-match',
        {
          macro: macro.name,
        },
      ),
    );
    this.logWarn(
      true,
      game.i18n.format(
        'SCENE-PACKER.notifications.find-macro-compendium.no-match',
        {
          macro: macro.name,
        },
      ),
    );

    return null;
  }

  /**
   * Import entities by their Uuid, falling back to name based import
   * @param {String[]} searchPacks The compendium pack names to search within
   * @param {Object[]} entities The entities to import
   * @param {String} type The type of entity being imported. Used for notification purposes only.
   * @param {Boolean} showUI Whether to show the UI confirming the action. Defaults to true.
   * @returns {Promise<Object[]>} The entities created. May be fewer than requested if some already exist.
   */
  async ImportEntities(searchPacks, entities, type, showUI = true) {
    let createdEntities = [];

    if (!game.user.isGM || entities.length === 0) {
      return createdEntities;
    }

    let entityNames = entities.map(e => e.name || e.journalName || e.tokenName || e.actorName || e.text);

    if (!type) {
      type = 'entities';
    }

    if (searchPacks.length === 0) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
          {
            type: type,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.localize(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.short',
        ),
      );
      throw game.i18n.format(
        'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
        {
          type: type,
        },
      );
    }

    const packRemap = new Map();
    for (let i = 0; i < searchPacks.length; i++) {
      const searchPack = searchPacks[i];
      let pack = game.packs.get(searchPack);
      if (!pack) {
        // Try a world prefixed pack. Some content creators utilise [Token Attacher](https://github.com/KayelGee/token-attacher)
        // functionality (importFromJSON) to convert Actor compendiums between systems.
        // Any fullstops in the existing pack name will be replaced with dashes.
        let remappedPackName = `world.${searchPack.slugify({strict: true})}`;
        pack = game.packs.get(remappedPackName);
        if (pack) {
          // Replace the searchPack with the world prefixed pack
          searchPacks[i] = remappedPackName;
          packRemap.set(searchPack, remappedPackName);
          continue;
        }

        ui.notifications.warn(
          game.i18n.format(
            'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
            {
              type: type,
            },
          ),
        );
        this.logWarn(
          true,
          game.i18n.localize(
            'SCENE-PACKER.notifications.import-entities.invalid-packs.reference',
          ),
          {searchPack, entityNames, entities, type},
        );
      }
    }

    for (let i = 0; i < entities.length; i++) {
      try {
        const entity = entities[i];
        if (entity.compendiumSourceId) {
          // Check to see if this compendium source was remapped
          if (entity.compendiumSourceId.startsWith('Compendium.')) {
            let compendiumSourceIdParts = entity.compendiumSourceId.split('.');
            if (compendiumSourceIdParts.length >= 3) {
              let remappedPack = packRemap.get(`${compendiumSourceIdParts[1]}.${compendiumSourceIdParts[2]}`);
              if (remappedPack) {
                compendiumSourceIdParts.splice(1, 2, remappedPack);
                entity.compendiumSourceId = compendiumSourceIdParts.join('.');
              }
            }
          }
          const createdEntity = await this.ImportByUuid(entity.compendiumSourceId);
          if (createdEntity) {
            createdEntities.push(createdEntity);
            continue;
          }
        }
        if (entity.uuid) {
          const createdEntity = await this.ImportByUuid(entity.uuid);
          if (createdEntity) {
            createdEntities.push(createdEntity);
          }
        }
      } catch (e) {
        this.logError(
          true,
          game.i18n.localize(
            'SCENE-PACKER.notifications.import-entities.could-not-import',
          ),
          {entity: entities[i], type},
        );
      }
    }
    if (createdEntities.length && showUI) {
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-entities.creating-data',
          {
            count: new Intl.NumberFormat().format(createdEntities.length),
            type,
          },
        ),
      );
    }
    if (createdEntities.length === entities.length) {
      // All imported by direct reference
      return createdEntities;
    }

    let createData = [];

    const exampleEntity = game.packs.get(searchPacks.find(searchPack => game.packs.get(searchPack)?.documentName))?.documentName;
    if (!exampleEntity) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
          {
            type: type,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.localize(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.details',
        ),
        {searchPacks, entityNames, type},
      );
      throw game.i18n.format(
        'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
        {
          type: type,
        },
      );
    }
    const entityClass = CONFIG[exampleEntity]?.documentClass;
    if (!entityClass) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
          {
            type: type,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.localize(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.reference',
        ),
        {searchPacks, entityNames, entities, type},
      );
      throw game.i18n.format(
        'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
        {
          type: type,
        },
      );
    }

    /** search the packs in priority order */
    for (let packName of searchPacks) {
      if (entities.length === 0) {
        // No more entities missing
        continue;
      }

      const pack = game.packs.get(packName);
      if (!pack) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.import-entities.invalid-packs.missing-pack',
            {
              packName,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.import-entities.invalid-packs.missing-pack-details',
            {
              packName,
            },
          ),
        );
        continue;
      }
      const entityType = pack.documentName;
      const packContent = await pack.getDocuments();
      const collection = game[entityClass.collectionName];
      if (!collection) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
            {
              type: type,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.localize(
            'SCENE-PACKER.notifications.import-entities.invalid-packs.reference',
          ),
          {packName, entity: entityType, type},
        );
        throw game.i18n.format(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
          {
            type: type,
          },
        );
      }

      // Filter down to those that are still missing
      entities = entities.filter(e => !collection.find(f => f.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === e.sourceId));
      entityNames = entities.map(e => e.name || e.journalName || e.tokenName || e.actorName || e.text);

      // Filter to just the needed entities
      const content = packContent.filter((entity) =>
        entityNames.includes(entity.name),
      );

      // Remove the entries that we found in this pack
      entities = entities.filter(
        (e) =>
          content.find((entity) => entity.name === (e.name || e.journalName || e.tokenName || e.actorName || e.text)) == null,
      );

      if (content.length > 0) {
        let folderData = await this.buildFolderStructureForPackContent(content, entityType, this.adventureName);

        // Append the entities found in this pack to the growing list to import
        createData = createData.concat(
          content.map((c) => {
            const cData = collection.fromCompendium(c, {clearSort: false, keepId: true});
            // Utilise the folder structure as defined by the Compendium Folder if it exists, otherwise
            // fall back to the default folder.
            const cfPath = cData.flags?.cf?.path;
            if (cfPath && folderData.folderMap.has(cfPath)) {
              cData.folder = folderData.folderMap.get(cfPath)?.id || null;
            } else if (folderData.folderId) {
              cData.folder = folderData.folderId;
            }
            cData['flags.core.sourceId'] = c.uuid;

            // Set the sorting value
            if (cData.flags?.cf?.sort) {
              cData.sort = cData.flags.cf.sort;
            }

            if (!CONSTANTS.IsV10orNewer()) {
              // Patch "Sight angle must be between 1 and 360 degrees." error
              if (cData.token?.sightAngle === 0) {
                cData.token.sightAngle = 360;
              }
              if (cData.token?.lightAngle === 0) {
                cData.token.lightAngle = 360;
              }
            }
            return cData;
          }),
        );
      }
    }

    if (createData.length > 0) {
      if (showUI) {
        ui.notifications.info(
          game.i18n.format(
            'SCENE-PACKER.notifications.import-entities.creating-data',
            {
              count: new Intl.NumberFormat().format(createData.length),
              type,
            },
          ),
        );
      }
      let createdEntity = await entityClass.create(createData, {keepId: true});
      if (!Array.isArray(createdEntity)) {
        createdEntity = [createdEntity];
      }
      return createdEntities.concat(createdEntity);
    }

    return createdEntities;
  }

  /**
   * Find actors bound to the scene that do not exist in the world.
   * @param {Object[]} tokenInfo data written during PackScene()
   * @see PackScene
   * @private
   * @returns Object[] The unique set of Actors needing to be imported.
   */
  findMissingActors(tokenInfo) {
    if (!tokenInfo?.length) {
      return [];
    }

    const exact_matches = [];
    const missing_actors = new Set();
    // Check for exact matches first
    for (let i = 0; i < tokenInfo.length; i++) {
      const token = tokenInfo[i];
      if (!token?.sourceId) {
        continue;
      }
      const matches = game.actors.contents.filter(a => {
        return (
          a.uuid === token.sourceId || a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === token.sourceId || a.getFlag('core', 'sourceId') === token.sourceId
        ) && !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated');
      });
      if (matches.length) {
        exact_matches.push(token);
      } else {
        missing_actors.add(token);
      }
    }

    if (tokenInfo.length === exact_matches.length) {
      // All tokens exist with a direct match, no missing Actors
      return [];
    }

    return Array.from(missing_actors);
  }

  /**
   * Find journal entries that do not exist in the world.
   * @param {Object[]} journalInfo data written during PackScene()
   * @see PackScene
   * @private
   * @returns Object[] The unique set of Journals needing to be imported.
   */
  findMissingJournals(journalInfo) {
    if (!journalInfo?.length) {
      return [];
    }

    const exact_matches = [];
    const missing_name_matches = new Set();
    // Check for exact matches first
    for (let i = 0; i < journalInfo.length; i++) {
      const journal = journalInfo[i];
      if (!journal?.sourceId) {
        missing_name_matches.add(journal);
        continue;
      }
      const matches = game.journal.contents.filter(a => {
        return (
          a.uuid === journal.sourceId || a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === journal.sourceId || a.getFlag('core', 'sourceId') === journal.sourceId || a.getFlag('core', 'sourceId') === journal.compendiumSourceId
        ) && !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated');
      });
      if (matches.length) {
        exact_matches.push(journal);
      } else {
        missing_name_matches.add(journal);
      }
    }

    if (journalInfo.length === exact_matches.length) {
      // All journals exist with a direct match, no missing Journals
      return [];
    }

    let missing = [];

    if (missing_name_matches.size) {
      // Support multiple folder names by compendium names
      const folderNames = [this.adventureName];
      this.getSearchPacksForType('JournalEntry').forEach(j => {
        const pack = game.packs.get(j);
        if (pack?.metadata?.label) {
          folderNames.push(pack.metadata.label);
        }
      });
      const folderIDs = game.folders.filter((f) => {
        const data = CONSTANTS.IsV10orNewer() ? f : f.data;
        return data.type === 'JournalEntry' && folderNames.includes(data.name)
      }).map((f) => f.id);
      missing = Array.from(missing_name_matches)
        .filter((info) => {
          // Filter for only the entries that are missing, or are in a different folder.
          const j = game.journal.getName(info?.journalName);
          if (!j) {
            return true;
          }
          const jData = CONSTANTS.IsV10orNewer() ? j : j.data;
          return folderIDs.length && !folderIDs.includes(jData.folder);
        });
    }

    return missing;
  }

  /**
   * Find macros that do not exist in the world.
   * @param {Object[]} macroInfo data written during PackScene()
   * @see PackScene
   * @private
   * @returns Object[] The unique set of Macros needing to be imported.
   */
  findMissingMacros(macroInfo) {
    if (!macroInfo?.length) {
      return [];
    }

    const exact_matches = [];
    const missing_name_matches = new Set();
    // Check for exact matches first
    for (let i = 0; i < macroInfo.length; i++) {
      const macro = macroInfo[i];
      if (!macro?.sourceId) {
        missing_name_matches.add(macro);
        continue;
      }
      const matches = game.macros.contents.filter(a => (a.uuid === macro.sourceId || a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === macro.sourceId) && !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated'));
      if (matches.length) {
        exact_matches.push(macro);
      } else {
        missing_name_matches.add(macro);
      }
    }

    if (macroInfo.length === exact_matches.length) {
      // All macros exist with a direct match, no missing Macros
      return [];
    }

    let missing = [];

    if (missing_name_matches.size) {
      // Support multiple folder names by compendium names
      const folderNames = [this.adventureName];
      this.getSearchPacksForType('Macro').forEach(j => {
        const pack = game.packs.get(j);
        if (pack?.metadata?.label) {
          folderNames.push(pack.metadata.label);
        }
      });
      const folderIDs = game.folders.filter((f) => {
        const data = CONSTANTS.IsV10orNewer() ? f : f.data;
        return data.type === 'Macro' && folderNames.includes(data.name)
      }).map((f) => f.id);
      missing = Array.from(missing_name_matches)
        .filter((info) => {
          // Filter for only the entries that are missing, or are in a different folder.
          const m = game.macros.getName(info?.name);
          if (!m) {
            return true;
          }
          const mData = CONSTANTS.IsV10orNewer() ? m : m.data;
          return folderIDs.length && !folderIDs.includes(mData.folder);
        });
    }

    return missing;
  }

  /**
   * Search for an actor with the requested token name, prioritising the requested folder if possible.
   * @param {String} tokenName the name of the token being searched for
   * @param {Object} folder the game.folders entity to prioritise the search to
   * @private
   * @returns {Object|null}
   */
  findActorForTokenName(tokenName, folder) {
    let actor = null;
    if (!tokenName) {
      this.logWarn(
        false,
        game.i18n.localize(
          'SCENE-PACKER.notifications.import-entities.missing-name',
        ),
      );
      return actor;
    }

    if (folder?.id) {
      actor = game.actors.contents.find((a) => {
        const data = CONSTANTS.IsV10orNewer() ? a : a.data;
        return data.name === tokenName && data.folder === folder.id && !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated')
      });
      if (actor) {
        // Found a direct Token <-> Actor name match in the Adventure folder
        return actor;
      }
    }

    actor = game.actors.contents.find((a) => a.name === tokenName && !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated'));
    if (actor) {
      // Found a direct Token <-> Actor name match in world
      return actor;
    }

    // No direct name match found in this world
    return actor;
  }

  /**
   * Search for an actor for the requested token. Prioritises:
   *   - actor sourceId reference (direct match)
   *   - direct name match in a folder named after the Adventure
   *   - direct name match in any folder
   *   - look up the original actor name from the token and do the same name based search
   *     (this handles look-ups for tokens that have a different name to the Actor they represent)
   * @param {Object} token the token on the scene
   * @param {Object} tokenWorldData the data embedded in the scene during PackScene()
   * @param {Object} folder the game.folders entity to prioritise the search to
   * @returns {Object|null}
   */
  findActorForToken(token, tokenWorldData, folder) {
    // Check if we have a direct match within the token world data and game actors
    const actorId = token?.actorId || token?.data?.actorId;
    if (actorId) {
      const tData = tokenWorldData.find(t => t.sourceId === `Actor.${actorId}` && t.compendiumSourceId);
      if (tData) {
        const actor = game.actors.contents.find(a => (a.getFlag('core', 'sourceId') === tData.compendiumSourceId || a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === tData.sourceId) && !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated'));
        if (actor) {
          return actor;
        }
      }
    }

    if (!token?.name) {
      ui.notifications.warn(
        game.i18n.localize('SCENE-PACKER.notifications.find-actor.missing-name'),
      );
      this.logWarn(
        true,
        game.i18n.localize(
          'SCENE-PACKER.notifications.find-actor.missing-name-details',
        ),
        token,
      );
      return null;
    }

    let actor = this.findActorForTokenName(token.name, folder);
    if (actor) {
      // Found a direct Token <-> Actor name match in world
      return actor;
    }

    // No direct name lookup found, get the Actor name from the token world data at the same
    // coordinates with the same Token name
    let actorRef = tokenWorldData.find((a) => {
      let tokenX = token?.x ?? token?.data?.x;
      let tokenY = token?.y ?? token?.data?.y;
      return a.x === tokenX && a.y === tokenY && a.tokenName === token?.name;
    });
    if (actorRef) {
      actor = this.findActorForTokenName(actorRef.actorName, folder);
      if (actor) {
        // Found an indirect Token <-> TokenLookup <-> Actor name match in world
        return actor;
      }
    }

    return actor;
  }

  /**
   * Find missing entities in the world that match the provided reference
   * @param {Object[]} entities - The entities to check
   * @param {String} entities.entityReference - The reference to the entity. For example "Scene.WUrQ30AHjLwcBrmZ"
   * @param {String} entities.entityName - The name the entity.
   * @returns {Object[]} The entities needing to be imported.
   */
  findMissingEntities(entities) {
    const response = [];
    for (const entity of entities) {
      const existingEntity = ScenePacker.FindEntity(entity.sourceId);
      if (!existingEntity) {
        response.push(entity);
      }
    }
    return response;
  }

  /**
   * Find the entity in the world that matches the provided reference
   * @param {String} entityReference - The reference to the entity. For example "Scene.WUrQ30AHjLwcBrmZ"
   * @returns {Object}
   */
  static FindEntity(entityReference) {
    if (!entityReference) {
      return undefined;
    }

    const entityParts = entityReference.split('.');
    if (entityParts.length < 2 || !entityParts[0] || !entityParts[1]) {
      // Missing definition of the entity type and entity id, unable to match.
      return undefined;
    }
    const entityType = entityParts[0];
    const entityId = entityParts[1];
    let collection = game[CONFIG[entityType]?.documentClass?.collectionName] || null;
    if (!collection) {
      switch (entityType) {
        case 'Actor':
          collection = game.actors;
          break;
        case 'Cards':
          collection = game.cards;
          break;
        case 'JournalEntry':
          collection = game.journal;
          break;
        case 'RollTable':
          collection = game.tables;
          break;
        case 'Item':
          collection = game.items;
          break;
        case 'Scene':
          collection = game.scenes;
          break;
        case 'Macro':
          collection = game.macros;
          break;
        case 'Playlist':
          collection = game.playlists;
          break;
      }
    }
    if (!collection) {
      // This reference did not refer to an entity collection, unable to match.
      return undefined;
    }
    const existingEntity = collection.get(entityId);
    if (existingEntity) {
      // Already exists with the exact reference.
      return existingEntity;
    }
    const ref = `${entityType}.${entityId}`;
    return collection.contents.find((a) => {
      return (
        (a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === ref ||
          a.getFlag('core', 'sourceId') === ref) &&
        !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated')
      );
    });
  }

  /**
   * Find the entity in the world that matches the provided reference
   * @param {String} entityReference - The reference to the entity. For example "Scene.WUrQ30AHjLwcBrmZ"
   * @param {String} entityName - The name of the entity.
   * @param {String} entityType - The type of the entity. For example "Scene"
   * @param {String[]} searchPacks - The compendium pack names to search within
   * @returns {Object|null} The entity in the compendium
   */
  async findCompendiumEntity(entityReference, entityName, entityType, searchPacks) {
    if (!entityReference || !entityType || !entityName) {
      return null
    }

    let compendiumEntity = null;
    let possibleMatches = [];

    for (let packName of searchPacks) {
      const pack = game.packs.get(packName);
      if (!pack) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.find-entity-compendium.missing-pack',
            {
              packName: packName,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.find-entity-compendium.missing-pack-details',
            {
              packName: packName,
            },
          ),
        );
        continue;
      }

      const matchingIndexes = pack.index.filter(p => p.name === entityName);
      for (let i = 0; i < matchingIndexes.length; i++) {
        let id = matchingIndexes[i]?._id;
        const entity = await pack.getDocument(id);
        if (entity) {
          if (entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === entityReference) {
            // Exact match
            return entity;
          }
          possibleMatches.push(entity);
        }
      }
    }

    if (!possibleMatches.length) {
      ui.notifications.warn(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-entity-compendium.no-match',
          {
            name: entityName,
            type: entityType,
          },
        ),
      );
      this.logWarn(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.find-entity-compendium.no-match',
          {
            name: entityName,
            type: entityType,
          },
        ),
      );

      return compendiumEntity;
    }

    if (possibleMatches.length === 1) {
      // Only one entity matches
      return possibleMatches.pop();
    }

    if (possibleMatches.length) {
      // See if there is a single entry in a compendium that belongs to this module
      let filteredOptions = possibleMatches.filter(a => a.uuid.startsWith(`Compendium.${this.moduleName}.`));

      if (filteredOptions.length === 1) {
        // Only one entity matches in a compendium belonging to this module
        return filteredOptions.pop();
      }
    }

    const existingEntity = ScenePacker.FindEntity(entityReference);
    if (existingEntity) {
      const compendiumSourceId = existingEntity.getFlag('core', 'sourceId');
      if (compendiumSourceId && searchPacks.some(p => compendiumSourceId.startsWith(`Compendium.${p}.`))) {
        const match = fromUuid(compendiumSourceId);
        if (match) {
          return match;
        }
      }
    }

    ui.notifications.warn(
      game.i18n.format(
        'SCENE-PACKER.notifications.find-entity-compendium.no-match',
        {
          name: entityName,
          type: entityType,
        },
      ),
    );
    this.logWarn(
      true,
      game.i18n.format(
        'SCENE-PACKER.notifications.find-entity-compendium.no-match',
        {
          name: entityName,
          type: entityType,
        },
      ),
    );

    return compendiumEntity;
  }

  /**
   * Re-links tokens with the actors they represent.
   * @param {Object[]} tokenInfo data written during PackScene()
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @param {Boolean} showUI Whether to show the UI confirming the action. Defaults to true.
   * @see PackScene
   */
  async relinkTokens(scene, tokenInfo, showUI = true) {
    if (!tokenInfo?.length) {
      // Nothing to relink.
      return Promise.resolve();
    }

    const folder = game.folders.find((f) => {
      const data = CONSTANTS.IsV10orNewer() ? f : f.data;
      return data.type === 'Actor' && data.name === this.adventureName;
    });
    let updates = [];
    let missing = [];

    const sceneData = CONSTANTS.IsV10orNewer() ? scene : scene.data;
    sceneData.tokens.forEach((t) => {
      let actor = this.findActorForToken(t, tokenInfo, folder);
      if (actor) {
        updates.push({
          _id: t.id,
          actorId: actor.id,
        });
      } else {
        missing.push(t);
      }
    });

    if (missing.length > 0) {
      this.logWarn(
        true,
        game.i18n.format('SCENE-PACKER.notifications.link-tokens.missing-details', {
          count: new Intl.NumberFormat().format(missing.length),
          adventureName: this.adventureName,
          scene: scene.name,
        }),
        missing,
      );
    }

    if (updates.length > 0) {
      if (showUI) {
        ui.notifications.info(
          game.i18n.format('SCENE-PACKER.notifications.link-tokens.linking', {
            count: new Intl.NumberFormat().format(updates.length),
            adventureName: this.adventureName,
          }),
        );
      }
      return scene.updateEmbeddedDocuments('Token', updates);
    }

    return Promise.resolve();
  }

  /**
   * Spawns Journal Note Pins with the requested details.
   * @param {Object[]} journalInfo data written during PackScene()
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @param {Boolean} showUI Whether to show the UI confirming the action. Defaults to true.
   * @see PackScene
   */
  async spawnNotes(scene, journalInfo, showUI = true) {
    if (!game.user.isGM) {
      return;
    }

    if (!journalInfo?.length) {
      // Nothing to spawn.
      return Promise.resolve();
    }

    let updates = [];

    function findJournalIDForNote(note) {
      const hasUuid = !!note.compendiumSourceId;
      const hasSourceId = !!note.sourceId;
      const existingEntities = game.journal.filter(p => {
        return (hasUuid && p.getFlag('core', 'sourceId') === note.compendiumSourceId) ||
          (hasSourceId && p.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === note.sourceId);
      });
      if (existingEntities.length) {
        if (existingEntities.length === 1) {
          return existingEntities[0].id;
        }
        // Multiple matches exist, prefer a local source
        const existingEntity = game.journal.find(p => p.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === note.sourceId && !p.getFlag(CONSTANTS.MODULE_NAME, 'deprecated'));
        if (existingEntity) {
          return existingEntity.id;
        }
        // Use the first as it's still a match
        return existingEntities[0].id;
      }

      return game.journal.getName(note.journalName)?.id;
    }

    function getIconForNote(note) {
      // Replace icon with a Book if the image doesn't exist.
      let icon = note.texture?.src ?? note.icon;
      if (!icon) {
        return 'icons/svg/book.svg';
      }
      // Test the icon exists and replace it if it doesn't
      $.get(icon).fail(() => icon = 'icons/svg/book.svg');
      return icon;
    }

    journalInfo.forEach((note) => {
      const update = {
        entryId: findJournalIDForNote(note),
        name: note.journalName || note.name || note.text,
        '-=journalName': null,
        '-=folderName': null,
      };
      const icon = getIconForNote(note);
      if (CONSTANTS.IsV10orNewer()) {
        update['texture.src'] = icon;
      } else {
        update.icon = icon;
      }
      updates.push(mergeObject(
        note,
        update,
        {inplace: false},
      ));
    });

    const missing = updates.filter((info) => !info.entryId);
    if (missing.length > 0) {
      this.logWarn(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.spawn-notes.missing-details',
          {
            count: new Intl.NumberFormat().format(missing.length),
            scene: scene.name,
          },
        ),
        missing,
      );
    }

    updates = updates.filter((info) => !!info.entryId);
    if (updates.length > 0) {
      if (showUI) {
        ui.notifications.info(
          game.i18n.format('SCENE-PACKER.notifications.spawn-notes.spawning', {
            count: new Intl.NumberFormat().format(updates.length),
          }),
        );
      }
      return await scene.updateEmbeddedDocuments('Note', updates);
    }
    return Promise.resolve();
  }

  /**
   * Imports the requested entity by uuid if it doesn't already exist.
   * @param {String} uuid The uuid of the entity being imported.
   */
  async ImportByUuid(uuid) {
    if (!game.user.isGM) {
      return;
    }

    if (!uuid) {
      return;
    }

    const entity = await fromUuid(uuid);
    if (!entity) {
      return;
    }

    const type = entity.documentName;
    const collection = game[entity.collectionName];

    if (!collection) {
      return;
    }

    const existing = collection.get(entity.id);
    if (existing) {
      return existing;
    }

    const hasUuid = !!entity.uuid;
    const entityCoreSourceId = entity.getFlag('core', 'sourceId');
    const entitySourceId = entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
    const hasSourceId = !!entitySourceId;

    const existingEntities = collection.filter(p => {
      const coreSourceId = p.getFlag('core', 'sourceId');
      const sourceId = p.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');

      if (entity.name !== p.name) {
        return false;
      }

      if (hasUuid && coreSourceId === entity.uuid) {
        return true;
      }

      if (hasSourceId && sourceId === entitySourceId) {
        return true;
      }

      if (coreSourceId === `${type}.${entity.id}`) {
        return true;
      }

      if (sourceId === `${type}.${entity.id}`) {
        return true;
      }

      if (coreSourceId && coreSourceId === entityCoreSourceId) {
        return true;
      }

      if (entityCoreSourceId && entityCoreSourceId === p.uuid) {
        return true;
      }

      if (entitySourceId && entitySourceId === p.uuid) {
        return true;
      }

      return false;
    });
    if (existingEntities.length) {
      if (existingEntities.length === 1) {
        return existingEntities[0];
      }
      // Multiple matches exist, prefer a local source
      const existingEntity = collection.find(p => hasSourceId && p.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === entitySourceId);
      if (existingEntity) {
        return existingEntity;
      }
      // Use the first as it's still a match
      return existingEntities[0];
    }

    const update = {};

    let folderData = await this.buildFolderStructureForPackContent([entity], type, this.adventureName);

    // Check for Compendium Folder structure data
    const entityData = CONSTANTS.IsV10orNewer() ? entity : entity.data;
    const cfPath = entityData?.flags?.cf?.path;
    if (cfPath && folderData.folderMap.has(cfPath)) {
      update.folder = folderData.folderMap.get(cfPath)?.id || null;
    } else if (folderData.folderId) {
      update.folder = folderData.folderId;
    }

    // Set the sorting value
    if (entityData?.flags?.cf?.sort) {
      update.sort = entityData.flags.cf.sort;
    }

    return await collection.importFromCompendium(game.packs.get(entity.compendium.collection), entity.id, update, {clearSort: false, keepId: true});
  }

  /**
   * Unpack the scene data and reconstruct the appropriate links.
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @param {Boolean} showLinkedJournal Whether to show any Journals linked to the Scene.
   * @param {Boolean} contentPreImported Whether the content for this scene has already been imported.
   * @param {Boolean} showUI Whether to show the UI notifications.
   */
  async UnpackScene(
    scene = game.scenes.get(game.user.viewedScene),
    {showLinkedJournal = true, contentPreImported = false, showUI = true} = {},
  ) {
    const tokenInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_TOKENS);
    const journalInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS);
    const tilesInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_TILES);
    const sceneJournalInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_JOURNAL);
    const sceneInitialPosition = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_POSITION);
    const scenePlaylist = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_PLAYLIST);
    if (sceneInitialPosition && Object.keys(sceneInitialPosition).length) {
      await scene.update({initial: sceneInitialPosition});
    }

    const sceneData = CONSTANTS.IsV10orNewer() ? scene : scene.data;
    if (scenePlaylist) {
      const playlist = await this.ImportByUuid(scenePlaylist);
      if (playlist && playlist?.id !== sceneData.playlist) {
        await scene.update({playlist: playlist.id});
      }
    }

    if (tokenInfo?.length) {
      // Import tokens that don't yet exist in the world
      try {
        await this.ImportEntities(
          this.getSearchPacksForType('Actor'),
          this.findMissingActors(tokenInfo),
          'actors',
          showUI,
        );
      } catch (err) {
        console.error(err);
      }
    }

    if (journalInfo?.length) {
      let journals;
      if (!contentPreImported) {
        // Import Journal Pins
        journals = await this.ImportEntities(
          this.getSearchPacksForType('JournalEntry'),
          this.findMissingJournals(journalInfo),
          'journals',
          showUI,
        );
      } else {
        // List all the journals belonging to this module's packs
        journals = game.journal.filter(j => this.getSearchPacksForType('JournalEntry').some(p => j.getFlag('core', 'sourceId')
          ?.startsWith(`Compendium.${p}.`)));
      }
      if (journals?.length) {
        await this.unpackQuickEncounters(scene, journals, this.moduleName);
      }
    }

    if (tilesInfo?.length) {
      // Ensure that tiles that require entities have been imported
      const entities = {};
      tilesInfo.forEach(m => {
        for (const action of m.actions) {
          if (!action.entityType || !action.sourceId) {
            continue;
          }
          if (typeof entities[action.entityType] === 'undefined') {
            entities[action.entityType] = [];
          }
          entities[action.entityType].push(action);
        }
      });
      for (const [entityType, actions] of Object.entries(entities)) {
        await this.ImportEntities(
          this.getSearchPacksForType(entityType),
          this.findMissingEntities(actions),
          CONSTANTS.TYPE_HUMANISE[entityType],
          showUI,
        )
      }
      const activeTileResponse = await this.unpackActiveTiles(ScenePacker.GetActiveTilesData(sceneData.tiles), tilesInfo);
      if (activeTileResponse?.tilesCount && activeTileResponse?.actionsCount && activeTileResponse?.updates?.length) {
        await scene.updateEmbeddedDocuments('Tile', activeTileResponse.updates);
        this.log(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.import-entities.active-tiles-unpacked',
            {
              scene: scene.name,
              tiles: activeTileResponse.tilesCount,
              actions: activeTileResponse.actionsCount,
            }
          )
        );
      }
    }

    if (this.welcomeJournal && !contentPreImported) {
      // Import the "Welcome Journal"
      await this.ImportEntities(
        this.getSearchPacksForType('JournalEntry'),
        this.findMissingJournals([this.welcomeJournal].map(d => {
          return {journalName: d};
        })),
        'journals',
        showUI,
      );
    }
    if (this.additionalJournals.length > 0 && !contentPreImported) {
      // Import any additional Journals
      await this.ImportEntities(
        this.getSearchPacksForType('JournalEntry'),
        this.findMissingJournals(this.additionalJournals.map(d => {
          return {journalName: d};
        })),
        'journals',
        showUI,
      );
    }
    if (this.additionalMacros.length > 0 && !contentPreImported) {
      // Import any additional Macros
      await this.ImportEntities(
        this.getSearchPacksForType('Macro'),
        this.findMissingMacros(this.additionalMacros.map(d => {
          return {name: d};
        })),
        'macros',
        showUI,
      );
    }

    if (sceneJournalInfo && Object.keys(sceneJournalInfo).length) {
      if (!contentPreImported) {
        // Ensure the scene journal is imported
        await this.ImportEntities(
          this.getSearchPacksForType('JournalEntry'),
          this.findMissingJournals([sceneJournalInfo]),
          'journals',
          showUI,
        );
      }
      if (!scene.journal) {
        // Relink the journal to the correct entry
        let newSceneJournal = game.journal.find(j => j.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sceneJournalInfo.sourceId || j.getFlag('core', 'sourceId') === sceneJournalInfo.sourceId || j.getFlag('core', 'sourceId') === sceneJournalInfo.compendiumSourceId);
        if (newSceneJournal?.id) {
          await scene.update({journal: newSceneJournal.id});
        } else if (sceneJournalInfo.compendiumSourceId?.startsWith('Compendium.')) {
          newSceneJournal = await this.ImportByUuid(sceneJournalInfo.compendiumSourceId)
          if (newSceneJournal?.id) {
            await scene.update({journal: newSceneJournal.id});
          }
        }
      }
    }

    // Relink the tokens and spawn the pins
    if (tokenInfo?.length) {
      try {
        await this.relinkTokens(scene, tokenInfo, showUI);
      } catch (e) {
        console.error(e);
      }
    }
    if (journalInfo?.length) {
      await this.spawnNotes(scene, journalInfo, showUI);
    }

    // Display the Scene's journal note if it has one
    if (showLinkedJournal && scene.journal) {
      scene.journal.show();
    }

    if (showUI) {
      ui.sidebar.activateTab('scenes');
    }

    /**
     * Trigger any hooks for unpacking a scene. Receives argument: {@link UnpackedScene}
     */
    Hooks.callAll(CONSTANTS.HOOKS_SCENE_UNPACKED, {scene: scene, moduleName: this.moduleName, adventureName: this.adventureName, instance: this});

    return Promise.resolve();
  }

  /**
   * Returns whether the provided actor contains Monk's Active Tiles that could be packed.
   * @param {Object} actor - The Actor which might have Monk's Active Tiles data inside Token Attacher data
   * @return {boolean}
   */
  static ActorHasActiveTilesData(actor) {
    const data = CONSTANTS.IsV10orNewer() ? actor : actor?.data;
    if (!data) {
      return false;
    }

    let tokenAttacherData = getProperty(data, 'token.flags.token-attacher.prototypeAttached');
    if (!tokenAttacherData?.Tile?.length) {
      return false;
    }

    return ScenePacker.GetActiveTilesData(tokenAttacherData.Tile).length > 0;
  }

  /**
   * Gets the tiles that have actions that need processing
   * @param {Object[]|EmbeddedCollection} tiles - The tiles which might contain Monk's Active Tiles actions
   * @return {Object[]} - The tiles that have actions that need processing
   */
  static GetActiveTilesData(tiles) {
    if (!tiles?.length && !tiles?.size) {
      return [];
    }

    return tiles.filter(
      (tile) => {
        const tileData = CONSTANTS.IsV10orNewer() ? tile : tile?.data || tile;
        const actions = getProperty(tileData, 'flags.monks-active-tiles.actions') || [];
        return actions.filter(
          (a) =>
            a?.data?.macroid ||
            a?.data?.entity?.id ||
            a?.data?.item?.id ||
            a?.data?.location?.id ||
            a?.data?.location?.sceneId ||
            a?.data?.rolltableid,
        ).length;
      });
  }

  /**
   * Returns packed active tile data for the provided tiles
   * @param {Object[]|EmbeddedCollection} tiles - The tiles which might contain Monk's Active Tile Trigger data
   * @return {Promise<Object[]>}
   */
  async packActiveTiles(tiles) {
    if (!tiles?.length && !tiles?.size) {
      return [];
    }

    const tileInfoResults = await Promise.allSettled(
      ScenePacker.GetActiveTilesData(tiles).map(async (tile) => {
        const tileData = CONSTANTS.IsV10orNewer() ? tile : tile?.data || tile;
        const actions = await Promise.allSettled(
          (getProperty(tileData, 'flags.monks-active-tiles.actions') || [])
            .filter(
              (a) =>
                a?.data?.macroid ||
                a?.data?.entity?.id ||
                a?.data?.item?.id ||
                a?.data?.location?.id ||
                a?.data?.location?.sceneId ||
                a?.data?.location?.scene ||
                a?.data?.rolltableid,
            )
            .map(async (d) => {
              const response = {
                action: d,
                actionID: d.id,
                name: undefined,
                sourceId: undefined,
                compendiumSourceId: undefined,
                entityType: undefined,
              };
              let ref;
              const data = d.data;
              if (data?.macroid) {
                ref = data.macroid.startsWith('Macro.') ? data.macroid : `Macro.${data.macroid}`;
              } else if (data?.location?.sceneId) {
                ref = data.location.sceneId.startsWith('Scene.') ? data.location.sceneId : `Scene.${data.location.sceneId}`;
              } else if (data?.location?.scene) {
                ref = data.location.scene.startsWith('Scene.') ? data.location.scene : `Scene.${data.location.scene}`;
              } else if (data?.location?.id) {
                ref = data.location.id;
              } else if (data?.rolltableid) {
                ref = data.rolltableid.startsWith('RollTable.') ? data.rolltableid : `RollTable.${data.rolltableid}`;
              } else if (data?.item?.id) {
                ref = data.item.id;
              } else if (data?.entity?.id) {
                ref = data.entity.id;
              }
              const entityParts = ref.split('.');
              if (entityParts.length < 2 ||
                !entityParts[0] ||
                !entityParts[1]) {
                // Missing definition of the entity type and entity id, unable to match.
                return response;
              }
              const entityType = entityParts[0];
              const entity = ScenePacker.FindEntity(ref);
              const compendiumEntity = await this.findCompendiumEntity(
                ref,
                entity?.name,
                entityType,
                this.getSearchPacksForType(entityType)
              );

              response.name = entity?.name;
              response.sourceId = entity?.uuid;
              response.compendiumSourceId = compendiumEntity?.uuid;
              response.entityType = entityType;

              return response;
            })
        );
        return {
          tileID: tile.id || tile._id,
          actions: actions.filter(result => result.status === 'fulfilled').map(result => result.value),
        };
      })
    );

    return tileInfoResults.filter(result => result.status === 'fulfilled').map(result => result.value);
  }

  /**
   * Unpacks the macros associated with Monk's Active Tiles
   * @param {Object[]|EmbeddedCollection} tiles - The tiles which might contain Monk's Active Tiles actions
   * @param {Object[]} tilesInfo - The tiles which contain Monk's Active Tiles data
   * @return {Promise<{tilesCount: Number, actionsCount: Number, updates: Object[]}>}
   */
  async unpackActiveTiles(tiles, tilesInfo) {
    let tilesCount = 0;
    let actionsCount = 0;

    const extractEntityID = (value) => {
      const entityParts = value.split('.');
      if (entityParts.length < 2 || !entityParts[0] || !entityParts[1]) {
        // Missing definition of the entity type and entity id, unable to match.
        return undefined;
      }
      return entityParts[1];
    }

    const findNewEntityValue = async (value, action, tile, compendiumSourceId) => {
      let newEntity;
      newEntity = ScenePacker.FindEntity(value);
      if (!newEntity) {
        // Try to find the entity by compendium reference
        if (compendiumSourceId) {
          newEntity = await fromUuid(compendiumSourceId);
        }
      }

      if (!newEntity) {
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.import-entities.active-tiles-entity-reference-missing',
            {
              tile: tile.id || tile._id,
              ref: value,
            }
          ),
          {
            type: 'Tile',
            id: tile.id || tile._id,
            action: action,
            ref: tile,
          }
        );
        return undefined;
      }
      return newEntity;
    }

    const updates = [];
    for (const tile of tiles) {
      const tileInfo = tilesInfo?.find(t => t.tileID === (tile.id || tile._id));
      if (!tileInfo) {
        continue;
      }
      let changed = false;
      const tileData = CONSTANTS.IsV10orNewer() ? tile : tile?.data || tile;
      const actions = getProperty(tileData, 'flags.monks-active-tiles.actions') || [];
      // Unpack entity references
      for (const action of actions) {
        const compendiumSourceId = tileInfo.actions?.find(a => a.actionID === action.id)?.compendiumSourceId;
        let originalValue;
        let newEntity;
        let newValue;
        const actionData = action.data;
        if (actionData?.entity?.id) {
          originalValue = actionData.entity.id;
          if (extractEntityID(originalValue)) {
            newEntity = await findNewEntityValue(originalValue, action, tile, compendiumSourceId);
            if (newEntity) {
              newValue = originalValue.replace(
                extractEntityID(originalValue),
                newEntity.id
              );
              if (newValue !== originalValue) {
                actionData.entity.id = newValue;
                changed = true;
                actionsCount++;
              }
            }
          }
        }
        if (actionData?.item?.id) {
          originalValue = actionData.item.id;
          if (extractEntityID(originalValue)) {
            newEntity = await findNewEntityValue(originalValue, action, tile, compendiumSourceId);
            if (newEntity) {
              newValue = originalValue.replace(
                extractEntityID(originalValue),
                newEntity.id
              );
              if (newValue !== originalValue) {
                actionData.item.id = newValue;
                changed = true;
                actionsCount++;
              }
            }
          }
        }
        if (actionData?.location?.id) {
          originalValue = actionData.location.id;
          if (extractEntityID(originalValue)) {
            newEntity = await findNewEntityValue(originalValue, action, tile, compendiumSourceId);
            if (newEntity) {
              newValue = actionData.location.id.replace(
                extractEntityID(originalValue),
                newEntity.id
              );
              if (newValue !== actionData.location.id) {
                actionData.location.id = newValue;
                changed = true;
                actionsCount++;
              }
            }
          }
        }
        if (actionData?.location?.sceneId) {
          originalValue = actionData.location.sceneId.startsWith('Scene.') ? actionData.location.sceneId : `Scene.${actionData.location.sceneId}`;
          if (extractEntityID(originalValue)) {
            newEntity = await findNewEntityValue(originalValue, action, tile, compendiumSourceId);
            if (newEntity) {
              newValue = actionData.location.sceneId.replace(
                extractEntityID(originalValue),
                newEntity.id
              );
              if (newValue !== actionData.location.sceneId) {
                actionData.location.sceneId = newValue;
                changed = true;
                actionsCount++;
              }
            }
          }
        }
        if (actionData?.location?.scene) {
          originalValue = actionData.location.scene.startsWith('Scene.') ? actionData.location.scene : `Scene.${actionData.location.scene}`;
          if (extractEntityID(originalValue)) {
            newEntity = await findNewEntityValue(originalValue, action, tile, compendiumSourceId);
            if (newEntity) {
              newValue = actionData.location.scene.replace(
                extractEntityID(originalValue),
                newEntity.id
              );
              if (newValue !== actionData.location.scene) {
                actionData.location.scene = newValue;
                changed = true;
                actionsCount++;
              }
            }
          }
        }
        if (actionData?.macroid) {
          originalValue = actionData.macroid.startsWith('Macro.') ? actionData.macroid : `Macro.${actionData.macroid}`;
          if (extractEntityID(originalValue)) {
            newEntity = await findNewEntityValue(originalValue, action, tile, compendiumSourceId);
            if (newEntity) {
              newValue = actionData.macroid.replace(
                extractEntityID(originalValue),
                newEntity.id
              );
              if (newValue !== actionData.macroid) {
                actionData.macroid = newValue;
                changed = true;
                actionsCount++;
              }
            }
          }
        }
        if (actionData?.rolltableid) {
          originalValue = actionData.rolltableid.startsWith('RollTable.') ? actionData.rolltableid : `RollTable.${actionData.rolltableid}`;
          if (extractEntityID(originalValue)) {
          newEntity = await findNewEntityValue(originalValue, action, tile, compendiumSourceId);
          if (newEntity) {
            newValue = actionData.rolltableid.replace(
              extractEntityID(originalValue),
              newEntity.id
            );
            if (newValue !== actionData.rolltableid) {
              actionData.rolltableid = newValue;
              changed = true;
              actionsCount++;
            }
          }
        }
        }
      }

      if (changed) {
        tilesCount++;
        const update = {
          _id: tile.id || tile._id,
        };
        setProperty(update, 'flags.monks-active-tiles.actions', actions);
        updates.push(update);
      }
    }

    return {
      tilesCount,
      actionsCount,
      updates,
    }
  }

  /**
   * Unpacks and relinks Monk's Enhanced Journal data.
   * @param {JournalEntry} journal - The journal entry to process.
   */
  static async UnpackEnhancedJournalData(journal) {
    if (!game.user.isGM) {
      return;
    }

    const journalData = CONSTANTS.IsV10orNewer() ? journal : journal?.data;
    if (!journalData) {
      return;
    }

    if (!getProperty(journalData, 'flags.scene-packer')) {
      return;
    }

    await ScenePacker.UnpackEnhancedJournalRelationshipData(journal);
    await ScenePacker.UnpackEnhancedJournalActorData(journal);
    await ScenePacker.UnpackEnhancedJournalEncounterData(journal);
  }

  /**
   * Unpacks and relinks Monk's Enhanced Journal Actor data.
   * @param {JournalEntry} journal - The journal entry to process.
   */
  static async UnpackEnhancedJournalActorData(journal) {
    if (!game.user.isGM) {
      return;
    }

    const journalData = CONSTANTS.IsV10orNewer() ? journal : journal?.data;
    if (!journalData) {
      return;
    }

    const enhancedJournal = getProperty(journalData, 'flags.monks-enhanced-journal');
    let enhancedActor = enhancedJournal?.actor;
    if (!enhancedActor) {
      return;
    }

    if (typeof enhancedActor === 'string') {
      const actor = ScenePacker.FindEntity(`Actor.${enhancedActor}`);
      if (!actor || enhancedActor === actor.id) {
        return;
      }

      enhancedActor = actor.id;
    } else if (enhancedActor.uuid) {
      const actor = ScenePacker.FindEntity(enhancedActor.uuid);
      if (!actor || enhancedActor.id === actor.id) {
        return;
      }

      enhancedActor.id = actor.id;
      enhancedActor.uuid = actor.uuid;
    }

    ScenePacker.logType(
      CONSTANTS.MODULE_NAME,
      'info',
      false,
      game.i18n.format(
        'SCENE-PACKER.world-conversion.compendiums.monks-enhanced-journal-actor.updating-references-console',
        {
          journal: journal.name,
          oldRef: enhancedJournal.actor.uuid || `Actor.${enhancedJournal.actor}`,
          newRef: enhancedActor.uuid || `Actor.${enhancedActor}`,
        },
      ),
    );

    await journal.update({'flags.monks-enhanced-journal.actor': enhancedActor});
  }

  /**
   * Unpacks and relinks Monk's Enhanced Journal Relationship data.
   * @param {JournalEntry} journal - The journal entry to process.
   */
  static async UnpackEnhancedJournalRelationshipData(journal) {
    if (!game.user.isGM) {
      return;
    }

    const journalData = CONSTANTS.IsV10orNewer() ? journal : journal?.data;
    if (!journalData) {
      return;
    }

    const enhancedJournal = getProperty(journalData, 'flags.monks-enhanced-journal');
    if (!enhancedJournal?.relationships?.length) {
      return;
    }

    const journalSourceID = (getProperty(journalData, 'flags.scene-packer.sourceId') || `JournalEntry.${journal.id}`).split('.').pop();
    let hasChanges = false;
    const relationships = enhancedJournal.relationships;
    for (const relationship of relationships) {
      if (!relationship.id) {
        continue;
      }

      // Check if the related document exists in the world.
      const relatedJournal = ScenePacker.FindEntity(`JournalEntry.${relationship.id}`);
      if (relatedJournal) {
        // Check to see if the forward reference needs updating
        if (relationship.id !== relatedJournal.id) {
          ScenePacker.logType(
            CONSTANTS.MODULE_NAME,
            'info',
            false,
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.monks-enhanced-journal-relationship.updating-references-console',
              {
                journal: journal.name,
                newRelation: relatedJournal.name,
              },
            ),
          );
          relationship.id = relatedJournal.id;
          hasChanges = true;
        }

        const relatedJournalData = CONSTANTS.IsV10orNewer() ? relatedJournal : relatedJournal?.data;

        // See if there's a backreference that needs adding or updating
        let backreferenceNeedsSaving = false;
        let relationships = getProperty(relatedJournalData, 'flags.monks-enhanced-journal.relationships') || [];
        const existingReference = relationships.find(r => r.id === journal.id || r.id === journalSourceID);
        if (existingReference) {
          if (existingReference.id !== journal.id) {
            // Update the reference
            existingReference.id = journal.id;
            backreferenceNeedsSaving = true;
          }
        } else {
          // Add a new reference
          relationships.push({ id: journal.id, hidden: relationship.hidden });
          backreferenceNeedsSaving = true;
        }

        if (backreferenceNeedsSaving) {
          ScenePacker.logType(
            CONSTANTS.MODULE_NAME,
            'info',
            false,
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.monks-enhanced-journal-relationship.updating-references-console',
              {
                journal: relatedJournal.name,
                newRelation: journal.name,
              },
            ),
          );
          await relatedJournal.update({'flags.monks-enhanced-journal.relationships': relationships});
        }
      }
    }

    if (hasChanges) {
      await journal.update({'flags.monks-enhanced-journal.relationships': relationships});
    }
  }

  /**
   * Unpacks and relinks Monk's Enhanced Journal Encounter data.
   * @param {JournalEntry} journal - The journal entry to process.
   */
  static async UnpackEnhancedJournalEncounterData(journal) {
    if (!game.user.isGM) {
      return;
    }

    const journalData = CONSTANTS.IsV10orNewer() ? journal : journal?.data;
    if (!journalData) {
      return;
    }

    const enhancedJournal = getProperty(journalData, 'flags.monks-enhanced-journal');
    if (!enhancedJournal?.actors?.length) {
      return;
    }

    let hasChanges = false;
    const actors = enhancedJournal.actors;
    for (const actor of actors) {
      const newRef = ScenePacker.FindEntity(actor.uuid);
      if (!newRef || newRef.uuid === actor.uuid) {
        continue;
      }

      ScenePacker.logType(
        CONSTANTS.MODULE_NAME,
        'info',
        false,
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.monks-enhanced-journal-encounter.updating-references-console',
          {
            journal: journal.name,
            oldRef: actor.uuid,
            newRef: newRef.uuid,
          },
        ),
      );
      actor.uuid = newRef.uuid;

      hasChanges = true;
    }

    if (hasChanges) {
      await journal.update({'flags.monks-enhanced-journal.actors': actors});
    }
  }

  /**
   * Unpacks the journals to fix up any Quick Encounter data references if they exist.
   * @param {Object} scene The scene being unpacked
   * @param {Object[]} journals The journals which may contain Quick Encounter data
   * @param {String} moduleName The name of the module that owns the compendiums to be updated
   */
  async unpackQuickEncounters(scene, journals, moduleName) {
    if (!game.user.isGM) {
      return;
    }

    if (!journals?.length) {
      return;
    }
    const instance = new ScenePacker({moduleName});
    if (!instance) {
      return;
    }

    const journalInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS);

    for (let i = 0; i < journals.length; i++) {
      const journal = journals[i];
      let quickEncounter = {};
      const journalData = CONSTANTS.IsV10orNewer() ? journal : journal.data;
      const quickEncounterData = getProperty(journalData, 'flags.quick-encounters.quickEncounter');
      if (!quickEncounterData) {
        continue;
      }
      try {
        if (typeof quickEncounterData === 'string') {
          quickEncounter = JSON.parse(quickEncounterData);
        } else if (typeof quickEncounterData === 'object') {
          quickEncounter = quickEncounterData;
        }
        if (!quickEncounter) {
          continue;
        }
        let hasDataToChange = false;
        if (quickEncounter.journalEntryId && quickEncounter.journalEntryId.startsWith('Compendium.')) {
          hasDataToChange = true;
        }
        if (quickEncounter.savedTilesData && quickEncounter.savedTilesData.length && ScenePacker.GetActiveTilesData(quickEncounter.savedTilesData).length) {
          hasDataToChange = true;
        }

        if (!hasDataToChange) {
          continue;
        }
      } catch (e) {
        ScenePacker.logType(
          moduleName,
          'info',
          false,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.quick-encounters.could-not-parse',
            {
              journal: journal.name,
              error: e,
            },
          ),
        );

        return;
      }

      const originalData = duplicate(quickEncounter);
      const updates = [];

      // Update the journal reference
      if (quickEncounter.journalEntryId && quickEncounter.journalEntryId !== journal.id) {
        // Update the scene pin
        const update = {entryId: journal.id};
        const possiblePins = journalInfo.filter(n => n.x === originalData.coords.x && n.y === originalData.coords.y && n.compendiumSourceId === originalData.journalEntryId);
        if (possiblePins.length) {
          update._id = possiblePins[0]._id;
          await scene.updateEmbeddedDocuments('Note', [update]);
        }

        quickEncounter.journalEntryId = journal.id;
        if (quickEncounter?.originalNoteData?.entryId) {
          quickEncounter.originalNoteData.entryId = journal.id;
          if (update._id) {
            quickEncounter.originalNoteData._id = update._id;
          }
        }
        if (quickEncounter?.sourceNoteData?.entryId) {
          quickEncounter.sourceNoteData.entryId = journal.id;
          if (update._id) {
            quickEncounter.originalNoteData._id = update._id;
          }
        }
        updates.push({
          type: 'Journal',
          name: journal.name,
          oldRef: originalData.journalEntryId,
          newRef: quickEncounter.journalEntryId,
        });
      }

      // Update the actor references
      if (quickEncounter.extractedActors) {
        for (let i = 0; i < quickEncounter.extractedActors.length; i++) {
          const actor = quickEncounter.extractedActors[i];
          if (!actor.actorID.startsWith('Compendium.')) {
            // Only support unpacking Compendium references
            continue;
          }
          const match = game.actors.contents.find(a => a.getFlag('core', 'sourceId') === actor.actorID);
          if (match) {
            updates.push({
              type: 'Actor',
              name: actor.name,
              oldRef: actor.actorID,
              newRef: match.id,
            });
            quickEncounter.extractedActors[i].actorID = match.id;
            if (quickEncounter.extractedActors[i].savedTokensData?.length) {
              for (let j = 0; j < quickEncounter.extractedActors[i].savedTokensData.length; j++) {
                quickEncounter.extractedActors[i].savedTokensData[j].actorId = match.id;
              }
            }
            continue;
          }
          const worldActor = await this.ImportByUuid(actor.actorID);
          if (worldActor) {
            updates.push({
              type: 'Actor',
              name: actor.name,
              oldRef: actor.actorID,
              newRef: worldActor.id,
            });
            quickEncounter.extractedActors[i].actorID = worldActor.id;
            if (quickEncounter.extractedActors[i].savedTokensData?.length) {
              for (let j = 0; j < quickEncounter.extractedActors[i].savedTokensData.length; j++) {
                quickEncounter.extractedActors[i].savedTokensData[j].actorId = worldActor.id;
              }
            }
          }
        }
      }

      if (quickEncounter.savedTilesData && quickEncounter.savedTilesData.length) {
        let updatedTiles = 0;
        for (const savedTile of quickEncounter.savedTilesData) {
          const SPTileData = getProperty(savedTile, 'flags.scene-packer.SPTileData');
          if (!SPTileData) {
            continue;
          }

          const activeTileResponse = await this.unpackActiveTiles([savedTile], SPTileData);
          if (activeTileResponse?.updates?.length) {
            for (const update of activeTileResponse.updates) {
              if (savedTile._id !== update._id) {
                continue;
              }

              mergeObject(savedTile, update);
              updatedTiles++;
            }
          }
        }

        if (updatedTiles) {
          updates.push({
            type: 'Tile',
            name: "Monk's Active Tile Triggers",
            oldRef: 'N/A',
            newRef: 'N/A',
          });
        }
      }

      if (updates.length) {
        ScenePacker.logType(
          moduleName,
          'info',
          false,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.quick-encounters.updating-references',
            {
              count: new Intl.NumberFormat().format(updates.length),
              journal: journal.name,
            },
          ),
        );
        updates.forEach(update => {
          ScenePacker.logType(
            moduleName,
            'info',
            false,
            game.i18n.format('SCENE-PACKER.world-conversion.compendiums.quick-encounters.updating-references-console', update),
          );
        });

        let newFlags = {};
        setProperty(newFlags, 'flags.quick-encounters.quickEncounter', JSON.stringify(quickEncounter));
        await journal.update(newFlags);
      }
    }
  }

  /**
   * ClearPackedData removes the data embedded in the Scene to prevent importing multiple times.
   * @see PackScene
   * @param {Object} scene The scene to clear the packed data from. Defaults to the currently viewed scene.
   * @param {Boolean} showUI Whether to show the UI confirming the action. Defaults to true.
   */
  async ClearPackedData(scene = game.scenes.get(game.user.viewedScene), showUI = true) {
    if (!game.user.isGM) {
      return;
    }

    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_TOKENS);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_TILES);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_JOURNAL);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_POSITION);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_PLAYLIST);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_MACROS);

    // Old format cleanup
    await scene.unsetFlag(this.moduleName, 'aiJournals');
    await scene.unsetFlag(this.moduleName, 'aiTokens');

    if (showUI) {
      ui.notifications.info(
        game.i18n.localize('SCENE-PACKER.notifications.clear-data.done'),
      );
    }
    return Promise.resolve();
  }

  /**
   * Bulk set the compendium lock state for compendiums owned by the initialised module
   * @param {Boolean} locked true to lock, false to unlock
   * @param {String} moduleName The name of the module that owns the compendiums to be updated
   */
  static async SetModuleCompendiumLockState(locked, moduleName) {
    if (!game.user.isGM) {
      return;
    }

    locked = !!locked;
    const compendiums = game.packs.filter(p => (p.metadata.packageName || p.metadata.package) === moduleName);
    const settings = {};
    compendiums.forEach((p) => {
      settings[`${(p.metadata.packageName || p.metadata.package)}.${p.metadata.name}`] = {locked};
    });
    if (Object.keys(settings).length) {
      let key = locked ?
                'SCENE-PACKER.world-conversion.compendiums.lock' :
                'SCENE-PACKER.world-conversion.compendiums.unlock';
      ui.notifications.info(
        game.i18n.format(key, {
          list: Object.keys(settings).join(', '),
          locked: locked,
        }),
      );
      let configSetting = Compendium?.CONFIG_SETTING || CompendiumCollection?.CONFIG_SETTING || 'compendiumConfiguration';
      await game.settings.set('core', configSetting, settings);
    }
  }

  /**
   * Updates the default permission of an entity to the value stored by Scene Packer during export.
   * @param {Object} entity
   * @return {Promise<void>}
   */
  static async updateEntityDefaultPermission(entity) {
    // Ensure that there's a default permission set
    if (CONSTANTS.IsV10orNewer()) {
      if (entity.ownership && typeof entity.ownership.default === 'undefined') {
        await entity.updateSource({ownership: {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE}});
      }
    } else {
      if (entity.data?.permission && typeof entity.data.permission.default === 'undefined') {
        const permissionOptions = CONST.DOCUMENT_PERMISSION_LEVELS ?? CONST.ENTITY_PERMISSIONS;
        await entity.update({permission: {default: permissionOptions.NONE}});
      }
    }

    const sourceId = entity.getFlag('core', 'sourceId');
    if (!sourceId) {
      return;
    }
    const scenePackerInstances = Object.keys(globalScenePacker.instances);
    if (!scenePackerInstances?.length) {
      return;
    }
    if (sourceId.startsWith('Compendium.scene-packer') || scenePackerInstances.some(p => sourceId.startsWith(`Compendium.${p}.`))) {
      // Import was from an active Scene Packer compendium, update the default permission if possible
      const defaultPermission = entity.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_DEFAULT_PERMISSION);
      const currentPermission = entity.ownership?.default ?? entity.data?.permission?.default;
      if (defaultPermission && currentPermission !== defaultPermission) {
        if (CONSTANTS.IsV10orNewer()) {
          await entity.updateSource({ownership: {default: defaultPermission}});
        } else {
          await entity.update({permission: {default: defaultPermission}});
        }
      }
    }
  }

  /**
   * Updates compendium journals to link to the compendium entries rather than the world references.
   * This method looks up references by sourceId, followed by Name and will warn you if it doesn't find a match, or finds more than one.
   * Supports relinking:
   *   Actors
   *   JournalEntries
   *   RollTables
   *   Items
   *   Scenes
   *   Macros
   *   Playlists
   * @param {String} moduleName The name of the module that owns the compendiums to be updated
   * @param {Boolean} dryRun Whether to do a dry-run (no changes committed, just calculations and logs)
   */
  static async RelinkJournalEntries(moduleName, {dryRun = false} = {}) {
    if (!game.user.isGM) {
      return;
    }

    // Get all the compendium packs that belong to the requested module
    const allPacks = game.packs.filter(p => (p.metadata.packageName || p.metadata.package) === moduleName);
    const instance = new ScenePacker({moduleName});
    /**
     * @type {{ActorPacks: *[], ItemPacks: *[], ScenePacks: *[], JournalEntryPacks: *[], MacroPacks: *[], RollTablePacks: *[], PlaylistPacks: *[]}}
     */
    const packs = {};
    const compendiumTypes = CONST.COMPENDIUM_DOCUMENT_TYPES || CONST.COMPENDIUM_ENTITY_TYPES;
    for (let i = 0; i < compendiumTypes.length; i++) {
      const type = compendiumTypes[i];
      const uniquePacks = new Set(allPacks.filter((p) => p.documentName === type));

      if (instance.packs.modules.length) {
        const packs = game.packs.filter(p => {
          const isCorrectType = (p.documentName || p.entity) === type;
          const isCorrectModule = instance.packs.modules.includes((p.metadata.packageName || p.metadata.package));
          const isCorrectSystem = typeof p.metadata.system === 'undefined' || p.metadata.system === game.system.id;
          return isCorrectType && isCorrectModule && isCorrectSystem;
        });
        for (const pack of packs) {
          uniquePacks.add(pack);
        }
      }

      // Load additional search packs which may not belong to the module owning this scene
      switch (type) {
        case 'Actor':
          for (let j = 0; j < instance.packs.creatures.length; j++) {
            const pack = game.packs.get(instance.packs.creatures[j]);
            if (pack) {
              uniquePacks.add(pack);
            }
          }
          break;
        case 'JournalEntry':
          for (let j = 0; j < instance.packs.journals.length; j++) {
            const pack = game.packs.get(instance.packs.journals[j]);
            if (pack) {
              uniquePacks.add(pack);
            }
          }
          break;
        case 'Macro':
          for (let j = 0; j < instance.packs.macros.length; j++) {
            const pack = game.packs.get(instance.packs.macros[j]);
            if (pack) {
              uniquePacks.add(pack);
            }
          }
          break;
      }
      packs[`${type}Packs`] = Array.from(uniquePacks);
    }

    // Unlock the module compendiums for editing
    if (!dryRun) {
      await ScenePacker.SetModuleCompendiumLockState(false, moduleName);
    }

    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.world-conversion.compendiums.wait'),
      {
        permanent: true,
      },
    );
    await instance.RelinkEntries(moduleName, 'JournalEntryPacks', {dryRun, packs});
    await instance.RelinkEntries(moduleName, 'ItemPacks', {dryRun, packs});
    await instance.RelinkEntries(moduleName, 'RollTablePacks', {dryRun, packs});

    // Lock the module compendiums again
    if (!dryRun) {
      Dialog.confirm({
        title: game.i18n.localize('SCENE-PACKER.world-conversion.compendiums.lock-prompt-title'),
        content: game.i18n.format('SCENE-PACKER.world-conversion.compendiums.lock-prompt', {moduleName}),
        label: game.i18n.localize('SCENE-PACKER.world-conversion.compendiums.lock-prompt-button'),
        yes: async () => {
          await ScenePacker.SetModuleCompendiumLockState(true, moduleName);
        }
      });
    }

    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.world-conversion.compendiums.completed'),
      {
        permanent: true,
      },
    );
  }

  /**
   * Updates compendium journals to link to the compendium entries rather than the world references.
   * This method looks up references by sourceId, followed by Name and will warn you if it doesn't find a match, or finds more than one.
   * Supports relinking:
   *   Actors
   *   JournalEntries
   *   RollTables
   *   Items
   *   Scenes
   *   Macros
   *   Playlists
   * @param {String} moduleName - The name of the module that owns the compendiums to be updated
   * @param {String} type - The type of entries to search though. Currently, "JournalEntryPacks", "ItemPacks" and "RollTablePacks"
   * @param {Boolean} dryRun - Whether to do a dry-run (no changes committed, just calculations and logs)
   * @param {{ActorPacks: *[], ItemPacks: *[], ScenePacks: *[], JournalEntryPacks: *[], MacroPacks: *[], RollTablePacks: *[], PlaylistPacks: *[]}} packs - The packs to search within
   * @param {RegExp} rex - The regular expression to search for. Default matches things like: @Actor[obe2mDyYDXYmxHJb]{Something or other}
   * @param {DOMParser} domParser - A DOM Parser.
   */
  async RelinkEntries(
    moduleName,
    type,
    {dryRun = false, packs = {}, rex = CONSTANTS.LINK_REGEX, domParser = CONSTANTS.DOM_PARSER} = {},
  ) {
    // Check each of the compendium packs in the requested module
    const entryPacks = packs[type];
    let typeName;
    switch (type) {
      case 'JournalEntryPacks':
        typeName = 'journal';
        break;
      case 'ItemPacks':
        typeName = 'item';
        break;
      case 'RollTablePacks':
        typeName = 'table';
        break;
    }
    for (const pack of entryPacks.filter(p => (p.metadata.packageName || p.metadata.package) === moduleName)) {
      ScenePacker.logType(
        moduleName,
        'info',
        true,
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.checking-and-updating',
          {
            count: new Intl.NumberFormat().format(pack.index.length || pack.index.size),
          },
        ),
      );
      // Check each of the entries in the pack
      const packValues = pack.index.values();
      for (const entry of packValues) {
        const document = await pack.getDocument(entry._id);
        let content;
        switch (type) {
          case 'JournalEntryPacks':
            if (CONSTANTS.IsV10orNewer()) {
              const pages = document.pages?.filter(p => p.type === 'text' && p.text?.content) || [];
              if (pages.length) {
                const pageUpdates = [];
                for (const page of pages) {
                  let {
                    newContent,
                    references,
                    hyperlinksChanged,
                  } = await this.relinkContent(page.text.content, entry, page, {domParser, rex, moduleName, packs, pack, typeName});

                  if (newContent !== page.text.content) {
                    ScenePacker.logType(
                      moduleName,
                      'info',
                      true,
                      game.i18n.format(
                        'SCENE-PACKER.world-conversion.compendiums.updating-reference',
                        {
                          count: new Intl.NumberFormat().format(references.size + hyperlinksChanged),
                          name: page.name,
                        },
                      ),
                    );
                    pageUpdates.push({
                      _id: page._id,
                      'text.content': newContent,
                    })
                  }
                }
                if (!dryRun && pageUpdates.length) {
                  await document.updateEmbeddedDocuments('JournalEntryPage', pageUpdates);
                }
              }
              content = document?.content;
            } else {
              content = document?.data?.content;
            }
            break;
          case 'ItemPacks':
            if (CONSTANTS.IsV10orNewer()) {
              content = document?.system?.description?.value;
              if (document.advancement) {
                // D&D5e items have an advancement property that may contain links to other items
                for (const item of Object.values(document.advancement.byId || {})) {
                  let itemGrantsChanged = false;
                  let itemGrants = foundry.utils.deepClone(item.configuration?.items || []);
                  for (let i = 0; i < itemGrants.length; i++) {
                    const itemGrant = itemGrants[i];
                    if (itemGrant.startsWith('Compendium.')) {
                      continue;
                    }
                    const itemToGrant = ScenePacker.FindEntity(itemGrant);
                    if (!itemToGrant) {
                      ScenePacker.logType(
                        moduleName,
                        'error',
                        true,
                        document.name,
                        item.title,
                        game.i18n.format(
                          'SCENE-PACKER.world-conversion.compendiums.invalid-no-matching-name',
                          {
                            name: itemGrant,
                            type: `${item.type}Advancement`,
                          }
                        ),
                      );
                      continue;
                    }

                    const compendiumEntity = await this.findCompendiumEntity(
                      itemGrant,
                      itemToGrant.name,
                      itemToGrant.type,
                      this.getSearchPacksForType(itemToGrant.type)
                    );
                    if (!compendiumEntity) {
                      ScenePacker.logType(
                        moduleName,
                        'warning',
                        true,
                        game.i18n.localize(
                          'SCENE-PACKER.world-conversion.compendiums.invalid-not-found-console',
                        ),
                        document.name,
                        item.title,
                        `${item.type}Advancement`,
                        itemToGrant,
                      );
                      continue;
                    }
                    ScenePacker.logType(
                      moduleName,
                      'info',
                      true,
                      game.i18n.format(
                        'SCENE-PACKER.world-conversion.compendiums.updating-reference-console',
                        {
                          pack: pack.collection,
                          journalEntryId: entry._id,
                          type: `${item.type}Advancement`,
                          oldRef: itemGrant,
                          newRefPack: compendiumEntity.pack,
                          newRef: compendiumEntity.uuid,
                        },
                      ),
                    );

                    // Replace the reference
                    itemGrants[i] = compendiumEntity.uuid;
                    itemGrantsChanged = true;
                  }

                  if (itemGrantsChanged && !dryRun) {
                    await document.updateAdvancement(item.id, {
                      "configuration.items": itemGrants,
                    });
                  }
                }
              }
            } else {
              content = document?.data?.data?.description?.value;
            }
            break;
          case 'RollTablePacks':
            // Rolltables don't have content like normal but instead have references to other results
            const results = CONSTANTS.IsV10orNewer() ? document?.results : document?.data?.results;
            for (const result of results || []) {
              const resultId = CONSTANTS.IsV10orNewer() ? result?.documentId : result?.data?.resultId;
              const collection = CONSTANTS.IsV10orNewer() ? result?.documentCollection : result?.data?.collection;
              if (!resultId || !collection) {
                // This result is not a reference to another entity
                continue;
              }
              if ((collection || '').includes('.')) {
                // This result is already a reference to a compendium
                continue;
              }
              let existingName = CONSTANTS.IsV10orNewer() ? result?.text : result?.data?.text;
              let existingEntry = game.collections.get(collection)?.get(resultId);
              if (!existingEntry && existingName) {
                existingEntry = game.collections.get(collection)?.getName(existingName);
              }
              if (existingEntry?.name) {
                existingName = existingEntry.name;
              }
              let newRef = await this.findNewReferences(collection, existingEntry?.id, existingName, existingEntry, document.name, moduleName, packs);
              if (newRef.length !== 1) {
                // Skip any reference update that isn't a one to one replacement
                continue;
              }
              ScenePacker.logType(
                moduleName,
                'info',
                true,
                game.i18n.format(
                  'SCENE-PACKER.world-conversion.compendiums.updating-reference-console',
                  {
                    pack: pack.collection,
                    journalEntryId: entry._id,
                    type: collection,
                    oldRef: resultId,
                    newRefPack: newRef[0].pack,
                    newRef: newRef[0].ref,
                  },
                ),
              );

              if (!dryRun) {
                await result.update({
                  collection: newRef[0].pack,
                  resultId: newRef[0].ref,
                  type: CONST.TABLE_RESULT_TYPES.COMPENDIUM || 2,
                })
              }
            }
            break;
        }
        if (!content) {
          continue;
        }
        const originalContent = content;
        ScenePacker.logType(
          moduleName,
          'info',
          true,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.checking-contents',
            {
              name: document.name,
              entryId: entry._id,
              type: typeName,
            },
          ),
        );

        let {
          newContent,
          references,
          hyperlinksChanged,
        } = await this.relinkContent(content, entry, document, {domParser, rex, moduleName, packs, pack, typeName});

        if (type === 'JournalEntryPacks') {
          await ScenePacker.RelinkQuickEncounterData(document, moduleName, dryRun);
        }

        if (newContent !== originalContent) {
          ScenePacker.logType(
            moduleName,
            'info',
            true,
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.updating-reference',
              {
                count: new Intl.NumberFormat().format(references.size + hyperlinksChanged),
                name: document.name,
              },
            ),
          );

          // Update the document entry with the fully replaced content
          if (!dryRun) {
            switch (type) {
              case 'JournalEntryPacks':
                await document.update({content: newContent}, {pack: pack.collection});
                break;
              case 'ItemPacks':
                const update = {description: {value: newContent}};
                if (CONSTANTS.IsV10orNewer()) {
                  await document.update({system: update}, {pack: pack.collection});
                } else {
                  await document.update({data: update}, {pack: pack.collection});
                }
                break;
            }
          }
        }
        ScenePacker.logType(
          moduleName,
          'info',
          true,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.completed-checks',
            {
              name: document.name,
              entryId: entry._id,
              type: typeName,
            },
          ),
        );
      }
    }
  }

  async relinkContent(content, entry, document, options) {
    const {domParser, rex, moduleName, packs, pack, typeName} = options;
    const references = new Set();
    let newContent = content;

    // Replace hyperlink style links first
    let hyperlinksChanged = 0;
    const doc = domParser.parseFromString(newContent, 'text/html');
    for (const link of doc.getElementsByTagName('a')) {
      if (!link.classList.contains('entity-link') || !link.dataset.entity || !link.dataset.id) {
        continue;
      }

      // Build the links to the new references that exist within the compendium/s
      let newRef = await this.findNewReferences(link.dataset.entity, link.dataset.id, link.text, document, document.name, moduleName, packs);

      if (newRef.length !== 1) {
        // Skip any reference update that isn't a one to one replacement
        continue;
      }
      ScenePacker.logType(
        moduleName,
        'info',
        true,
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.updating-reference-console',
          {
            pack: pack.collection,
            journalEntryId: entry._id,
            type: link.dataset.entity,
            oldRef: link.dataset.id,
            newRefPack: newRef[0].pack,
            newRef: newRef[0].ref,
          },
        ),
      );

      link.setAttribute('data-pack', newRef[0].pack);
      link.setAttribute('data-id', newRef[0].ref);
      hyperlinksChanged++;
    }

    newContent = doc.body.innerHTML;

    const links = [...newContent.matchAll(rex)];
    for (let k = 0; k < links.length; k++) {
      const link = links[k];
      const type = link[1];
      const oldRef = link[2];
      const anchor = link[3];
      const oldName = link[4];

      // Build the links to the new references that exist within the compendium/s
      let newRef = await this.findNewReferences(type, oldRef, oldName, document, document.name, moduleName, packs);

      if (!newRef.length) {
        continue;
      }

      references.add({
        type: type,
        oldRef: oldRef,
        newRef: newRef,
        pack: pack.collection,
        journalEntryId: entry._id,
        journalAnchorLink: anchor ? anchor : '',
      });
    }

    if (references.size || newContent !== content) {
      ScenePacker.logType(
        moduleName,
        'info',
        true,
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.updating-references',
          {
            count: new Intl.NumberFormat().format(references.size + hyperlinksChanged),
            name: document.name,
            type: typeName,
          },
        ),
      );

      // Build the new document content, progressively replacing each reference
      for (const change of references) {
        if (change.newRef.length !== 1) {
          // Skip any reference update that isn't a one to one replacement
          continue;
        }
        const prefix = CONSTANTS.IsV10orNewer() ? '@UUID[' : '@Compendium[';
        const newReference = change.newRef[0];
        if (!newReference.uuid) {
          newReference.uuid = `${newReference.pack}.${newReference.ref}${change.journalAnchorLink}`;
        }
        if (!CONSTANTS.IsV10orNewer() && newReference.uuid.startsWith('Compendium.')) {
          newReference.uuid = newReference.uuid.replace('Compendium.', '');
        }
        ScenePacker.logType(
          moduleName,
          'info',
          true,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.updating-reference-console',
            {
              pack: change.pack,
              journalEntryId: change.journalEntryId,
              type: change.type,
              oldRef: change.oldRef + change.journalAnchorLink,
              newRefPack: newReference.pack,
              newRef: newReference.uuid,
            },
          ),
        );
        let regex = new RegExp(
          `@${change.type}\\[${change.oldRef}${change.journalAnchorLink}\\]\\{`,
          'g',
        );
        newContent = newContent.replace(
          regex,
          `${prefix}${newReference.uuid}]{`,
        );
      }

    } else {
      ScenePacker.logType(
        moduleName,
        'info',
        true,
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.no-references',
          {
            name: document.name,
            entryId: entry._id,
            type: typeName,
          },
        ),
      );
    }
    return {
      newContent,
      references,
      hyperlinksChanged,
    };
  }

  /**
   * This method looks up references by sourceId, followed by Name and will warn you if it doesn't find a match, or finds more than one.
   * Supports relinking:
   *   Actors
   *   JournalEntries
   *   RollTables
   *   Items
   *   Scenes
   *   Macros
   *   Playlists
   * @param {string} type - One of the game collection types (e.g. JournalEntry or Item)
   * @param {string} oldRef - The original reference to the entry
   * @param {string} oldName - The original name of the entry
   * @param {object} entry - The entry itself
   * @param {string} containerName - The name of the entry that contains the link (e.g. journal name)
   * @param {String} moduleName - The name of the module that owns the compendiums to be updated
   * @param {{ActorPacks: *[], ItemPacks: *[], ScenePacks: *[], JournalEntryPacks: *[], MacroPacks: *[], RollTablePacks: *[], PlaylistPacks: *[]}} packs - The packs to search within
   * @return {Promise<[{ref, pack}]>}
   */
  async findNewReferences(type, oldRef, oldName, entry, containerName, moduleName, packs) {
    if (type === 'UUID') {
      // UUID style references store their full reference within the oldRef
      if (oldRef.startsWith('.') && entry.uuid) {
        // UUID style references may be in a "relative" format though, so adjust to a full reference
        oldRef = entry.uuid;
      }
      const splitRef = oldRef.split('.');
      type = splitRef.shift();
      oldRef = splitRef.join('.');
    }
    if (type === 'Compendium') {
      // Compendium references are already "correct" and don't need a new reference found.
      return [];
    }

    // Need to look up the in world reference to find the new compendium reference by name
    const collection = game.collections.get(type);
    if (!collection) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.invalid-ref-type',
          {
            type: type,
          },
        ),
      );
      ScenePacker.logType(
        moduleName,
        'error',
        true,
        containerName,
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.invalid-ref-type',
          {
            type: type,
          },
        ),
        entry,
        oldRef,
      );
      return [];
    }

    let entity;
    let pageName;
    let embeddedType;
    let embeddedName;
    if (CONSTANTS.IsV10orNewer() && type === 'JournalEntry' && oldRef.includes('.')) {
      let pageType;
      let pageId;
      // Refers to a Journal Page, so we need to find the Journal Entry first
      let journalId;
      [journalId, pageType, pageId] = oldRef.split('.');
      entity = collection.get(journalId);
      if (entity && pageId) {
        let page = entity.getEmbeddedDocument(pageType, pageId);
        if (page?.name) {
          pageName = page.name;
        } else {
          // Try looking up by name
          page = entity.pages?.find(p => p.name === entry.name);
          if (page?.name) {
            pageName = page.name;
          }
        }
      }
    } else if (CONSTANTS.IsV10orNewer() && oldRef.includes('.')) {
      // Refers to an embedded document
      let embeddedId;
      let parentId;
      [parentId, embeddedType, embeddedId] = oldRef.split('.');
      entity = collection.get(parentId);
      if (entity && embeddedId) {
        let embedded = entity.getEmbeddedDocument(embeddedType, embeddedId);
        if (embedded?.name) {
          embeddedName = embedded.name;
        } else {
          // Try looking up by name
          embedded = entity.getEmbeddedCollection(embeddedType)?.find(e => e.name === entry.name);
          if (embedded?.name) {
            embeddedName = embedded.name;
          }
        }
      }
    } else {
      entity = collection.get(oldRef);
    }

    if (!entity) {
      // Try looking up by name
      entity = collection.getName(oldName);
      if (!entity) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.invalid-no-matching-name',
            {
              type,
              name: oldName,
            },
          ),
        );
        ScenePacker.logType(
          moduleName,
          'error',
          true,
          containerName,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.invalid-no-matching-name',
            {
              type,
              name: oldName,
            },
          ),
          entry,
          oldRef,
        );
        return [];
      }
    }
    let name = entity.name;
    let sourceId = entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') || entity.uuid;
    let matches = [];

    for (let l = 0; l < packs[`${type}Packs`].length; l++) {
      const p = packs[`${type}Packs`][l];
      let possibleMatches = p.index.filter((e) => e.name === name);
      if (possibleMatches.length) {
        for (let m = 0; m < possibleMatches.length; m++) {
          const possibleMatch = possibleMatches[m];
          const entity = await p.getDocument(possibleMatch._id);
          let uuid = entity.uuid || undefined;
          if (entity) {
            if (CONSTANTS.IsV10orNewer() && pageName) {
              // Original reference was to a page, so we need to find the page in the compendium entry
              let page = entity.pages?.find(p => p.name === pageName);
              if (page?.uuid) {
                uuid = page.uuid;
              }
            }
            if (CONSTANTS.IsV10orNewer() && embeddedType && embeddedName) {
              // Original reference was to an embedded document, so we need to find the embedded document in the compendium entry
              let embedded = entity.getEmbeddedCollection(embeddedType)?.find(e => e.name === embeddedName);
              if (embedded?.uuid) {
                uuid = embedded.uuid;
              }
            }
            if (sourceId && entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sourceId) {
              // Direct match
              return [{pack: p.collection, ref: possibleMatch._id, uuid}];
            }
          }
          const item = {pack: p.collection, ref: possibleMatch._id};
          if (uuid) {
            item.uuid = uuid;
          }
          matches.push(item);
        }
      }
    }

    if (!matches.length) {
      ui.notifications.error(
        game.i18n.localize(
          'SCENE-PACKER.world-conversion.compendiums.invalid-not-found',
        ),
      );
      ScenePacker.logType(
        moduleName,
        'error',
        true,
        containerName,
        game.i18n.localize(
          'SCENE-PACKER.world-conversion.compendiums.invalid-not-found-console',
        ),
        type,
        name,
        entry,
        oldRef,
      );
      return [];
    } else if (matches.length > 1) {
      // More than one reference, see if only one matches this module
      const thisModuleNewRef = matches.filter(r => r.pack.startsWith(moduleName));
      if (thisModuleNewRef.length === 1) {
        matches = thisModuleNewRef;
      } else {
        ui.notifications.error(
          game.i18n.localize(
            'SCENE-PACKER.world-conversion.compendiums.invalid-too-many',
          ),
        );
        ScenePacker.logType(
          moduleName,
          'error',
          true,
          containerName,
          game.i18n.localize(
            'SCENE-PACKER.world-conversion.compendiums.invalid-too-many-console',
          ),
          type,
          name,
          entry,
          oldRef,
          matches,
        );
      }
    }
    return matches;
  }

  /**
   * Updates the given compendium journal entry, fixing Quick Encounter link data references.
   * @param {Object} journal The Journal which may contain Quick Encounter data
   * @param {String} moduleName The name of the module that owns the compendiums to be updated
   * @param {Boolean} dryRun Whether to do a dry-run (no changes committed, just calculations and logs)
   */
  static async RelinkQuickEncounterData(journal, moduleName, dryRun) {
    if (!game.user.isGM) {
      return;
    }

    if (!journal) {
      return;
    }

    const instance = new ScenePacker({moduleName});
    if (!instance) {
      return;
    }

    let quickEncounter = {};
    const journalData = CONSTANTS.IsV10orNewer() ? journal : journal.data;
    const quickEncounterData = getProperty(journalData, 'flags.quick-encounters.quickEncounter');
    if (quickEncounterData) {
      try {
        quickEncounter = JSON.parse(quickEncounterData);
      } catch (e) {
        ScenePacker.logType(
          moduleName,
          'info',
          dryRun, // Force a log if operating in dry-run mode
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.quick-encounters.could-not-parse',
            {
              journal: journal.name,
              error: e,
            },
          ),
        );

        return;
      }
    }
    if (!quickEncounter || !Object.keys(quickEncounter).length) {
      // Not a Quick Encounter journal
      return;
    }

    const originalData = duplicate(quickEncounter);
    const updates = [];

    // Update the journal reference
    if (quickEncounter.journalEntryId && quickEncounter.journalEntryId !== journal.uuid) {
      let worldJournal = game.journal.get(quickEncounter.journalEntryId);
      if (!worldJournal) {
        // See if we have a single named journal that we can use instead
        const worldJournals = game.journal.filter(a => a.name === journal.name);
        if (worldJournals.length === 1) {
          worldJournal = worldJournals[0];
        } else {
          ScenePacker.logType(
            moduleName,
            'warn',
            true,
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.quick-encounters.missing-journal-reference',
              {
                journal: journal.name,
              },
            ),
          );
        }
      }
      if (worldJournal) {
        // Add a back reference
        if (!dryRun) {
          await worldJournal.setFlag(CONSTANTS.MODULE_NAME, 'quickEncounter', journal.uuid);
        }
      }
      quickEncounter.journalEntryId = journal.uuid;
      if (quickEncounter?.originalNoteData?.entryId) {
        quickEncounter.originalNoteData.entryId = journal.id;
      }
      if (quickEncounter?.sourceNoteData?.entryId) {
        quickEncounter.sourceNoteData.entryId = journal.id;
      }
      updates.push({
        type: 'Journal',
        name: journal.name,
        oldRef: worldJournal?.uuid || originalData.journalEntryId,
        newRef: quickEncounter.journalEntryId,
      });
    }

    // Update the actor references
    if (quickEncounter.extractedActors) {
      for (let i = 0; i < quickEncounter.extractedActors.length; i++) {
        const actor = quickEncounter.extractedActors[i];
        let worldActor = game.actors.get(actor.actorID);
        if (!worldActor) {
          // See if we have a single named actor that we can use instead
          const worldActors = game.actors.filter(a => a.name === actor.name);
          if (worldActors.length === 1) {
            worldActor = worldActors[0];
          } else {
            ScenePacker.logType(
              moduleName,
              'warn',
              true,
              game.i18n.format(
                'SCENE-PACKER.world-conversion.compendiums.quick-encounters.missing-actor-reference',
                {
                  journal: journal.name,
                  actor: actor.name,
                },
              ),
            );
          }
        }
        if (worldActor) {
          const compendiumActor = await instance.FindActorInCompendiums(worldActor, instance.getSearchPacksForType('Actor'));
          if (compendiumActor?.uuid) {
            quickEncounter.extractedActors[i].actorID = compendiumActor.uuid;
            updates.push({
              type: 'Actor',
              name: actor.name,
              oldRef: worldActor.uuid,
              newRef: compendiumActor.uuid,
            });
          }
        }
      }
    }

    // Update the active tile references
    if (quickEncounter.savedTilesData) {
      const SPTileData = await instance.packActiveTiles(quickEncounter.savedTilesData);
      for (const spTile of SPTileData) {
        for (const savedTileData of quickEncounter.savedTilesData) {
          if (savedTileData._id !== spTile.tileID) {
            continue;
          }

          setProperty(savedTileData, 'flags.scene-packer.SPTileData', [spTile]);
          setProperty(savedTileData, 'flags.scene-packer.source-module', instance.GetModuleName());
        }
      }
      updates.push({
        type: 'Tile',
        name: "Monk's Active Tile Triggers",
        oldRef: 'N/A',
        newRef: 'N/A',
      });
    }

    if (updates.length) {
      ScenePacker.logType(
        moduleName,
        'info',
        true,
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.quick-encounters.updating-references',
          {
            count: new Intl.NumberFormat().format(updates.length),
            journal: journal.name,
          },
        ),
      );
      updates.forEach(update => {
        ScenePacker.logType(
          moduleName,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.world-conversion.compendiums.quick-encounters.updating-references-console', update),
        );
      });

      if (!dryRun) {
        let newFlags = {};
        setProperty(newFlags, 'flags.quick-encounters.quickEncounter', JSON.stringify(quickEncounter));
        await journal.update(newFlags);
      }
    }
  }

  /**
   * Shows a dialog window to choose which module to relink journal entries for.
   * @see RelinkJournalEntries
   */
  static async PromptRelinkJournalEntries() {
    if (!game.user.isGM) {
      return;
    }

    let activeModules = Object.keys(globalScenePacker.instances);
    if (!activeModules.length) {
      ui.notifications.info(
        game.i18n.localize('SCENE-PACKER.relink-prompt.none'),
      );
      return;
    }
    let content = `<p>${game.i18n.localize('SCENE-PACKER.relink-prompt.intro')}</p>`;
    content += '<select id="module-name">';
    activeModules.forEach(m => {
      content += `<option value="${m}">${m}</option>`;
    });
    content += '</select>';
    content += `<p><label>${game.i18n.localize('SCENE-PACKER.relink-prompt.make-changes')} <input type="checkbox" id="make-changes"></label></p>`;
    content += `<p>${game.i18n.localize('SCENE-PACKER.relink-prompt.make-changes-info')}</p>`;
    content += '<p><hr></p>';
    let d = new Dialog({
      title: game.i18n.localize('SCENE-PACKER.relink-prompt.title'),
      content: content,
      buttons: {
        relink: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize('SCENE-PACKER.relink-prompt.relink'),
          callback: async (html) => {
            await ScenePacker.RelinkJournalEntries(html.find('#module-name')[0].value, {dryRun: !html.find('#make-changes')[0].checked});
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('SCENE-PACKER.relink-prompt.cancel'),
        },
      },
    });
    d.render(true);
  }

  /**
   * Prompts to select the instance of Scene Packer to use.
   * Will return without a prompt if there are no registered instances.
   * Will return without a prompt if there is only a single registered instance.
   * @returns {Promise<null|ScenePacker>}
   */
  static PromptForInstance() {
    if (!game.user.isGM) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const modulesRegistered = Object.keys(globalScenePacker.instances);
      if (!modulesRegistered.length) {
        ui.notifications.warn(
          game.i18n.localize('SCENE-PACKER.instance-prompt.none-found'),
        );
        ScenePacker.logType(
          CONSTANTS.MODULE_NAME,
          'warn',
          true,
          game.i18n.localize('SCENE-PACKER.instance-prompt.none-found'),
        );
        return resolve(null);
      }

      if (modulesRegistered.length === 1) {
        return resolve(globalScenePacker.instances[modulesRegistered[0]]);
      }

      let content = `<p>${game.i18n.localize('SCENE-PACKER.instance-prompt.intro')}</p>`;
      content += '<select id="module-name">';
      modulesRegistered.forEach(m => {
        content += `<option value="${m}">${m}</option>`;
      });
      content += '</select>';
      content += '<p><hr></p>';
      let d = new Dialog({
        title: game.i18n.localize('SCENE-PACKER.instance-prompt.title'),
        content: content,
        buttons: {
          relink: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('SCENE-PACKER.instance-prompt.select'),
            callback: (html) => {
              let moduleName = html.find('#module-name')[0].value;
              return resolve(globalScenePacker.instances[moduleName]);
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('SCENE-PACKER.instance-prompt.cancel'),
            callback: () => resolve(null),
          },
        },
      });
      d.render(true);
    });

  }

  /**
   * Gets the instance of Scene Packer that packed the given Scene
   * @param {Object} scene The Scene that was packed.
   * @returns {null|ScenePacker}
   */
  static GetInstanceForScene(scene) {
    return ScenePacker.GetInstanceForDocument(scene);
  }

  /**
   * Gets the instance of Scene Packer that packed the given document
   * @param {Object} doc The document that was packed.
   * @returns {null|ScenePacker}
   */
  static GetInstanceForDocument(doc) {
    if (!game.user.isGM) {
      return null;
    }

    if (!doc) {
      return null;
    }
    const moduleName = doc.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_SOURCE_MODULE);
    if (!moduleName) {
      // No packed data defined.
      return null;
    }
    const instance = globalScenePacker.instances[moduleName];
    if (!instance) {
      // No instance for the requested module
      return null;
    }
    return instance;
  }

  /**
   * Disables import prompts from appearing when opening compendiums.
   * @deprecated See constructor for how to call now.
   */
  DisableImportPrompts() {
    this.logWarn(true,
      game.i18n.format('SCENE-PACKER.notifications.deprecated', {
        method: 'DisableImportPrompts()',
      }),
    );
    this.allowImportPrompts = false;
  }

  /**
   * Enables import prompts to appear when opening compendiums.
   * @deprecated See constructor for how to call now.
   */
  EnableImportPrompts() {
    this.logWarn(true,
      game.i18n.format('SCENE-PACKER.notifications.deprecated', {
        method: 'EnableImportPrompts()',
      }),
    );
    this.allowImportPrompts = true;
  }
}

Hooks.once('devModeReady', ({registerPackageDebugFlag}) => {
  registerPackageDebugFlag(CONSTANTS.MODULE_NAME);
});

Hooks.once('setup', () => {
  Hooks.on('getSceneDirectoryEntryContext', function (app, html, data) {
    if (game.user.isGM) {
      html.push(
        {
          name: game.i18n.localize('SCENE-PACKER.scene-context.pack.title'),
          icon: '<i class="fas fa-scroll"></i>',
          condition: (li) => {
            let documentId = li.data('documentId') || li.data('entityId');
            let scene = game.scenes.get(documentId);
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              return !ScenePacker.HasPackedData(scene, instance.GetModuleName()) &&
                game.user.isGM &&
                game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
            }
            return game.user.isGM && game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
          },
          callback: (li) => {
            let documentId = li.data('documentId') || li.data('entityId');
            let scene = game.scenes.get(documentId);
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              return instance.PackScene(scene);
            }

            // No existing instance bound to the Scene, ask which should be used to pack against.
            ScenePacker.PromptForInstance().then(instance => {
              if (!instance) {
                return;
              }
              instance.PackScene(scene);
            });
          },
        },
        {
          name: game.i18n.localize('SCENE-PACKER.scene-context.unpack.title'),
          icon: '<i class="fas fa-scroll"></i>',
          condition: (li) => {
            let documentId = li.data('documentId') || li.data('entityId');
            let scene = game.scenes.get(documentId);
            let instance = ScenePacker.GetInstanceForScene(scene);
            return instance &&
              ScenePacker.HasPackedData(scene, instance.GetModuleName()) &&
              game.user.isGM &&
              game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
          },
          callback: (li) => {
            let documentId = li.data('documentId') || li.data('entityId');
            let scene = game.scenes.get(documentId);
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              instance.ProcessScene(scene);
            }
          },
        },
        {
          name: game.i18n.localize(
            'SCENE-PACKER.scene-context.clear.title',
          ),
          icon: '<i class="fas fa-scroll"></i>',
          condition: (li) => {
            let documentId = li.data('documentId') || li.data('entityId');
            let scene = game.scenes.get(documentId);
            let instance = ScenePacker.GetInstanceForScene(scene);
            return instance &&
              ScenePacker.HasPackedData(scene, instance.GetModuleName()) &&
              game.user.isGM &&
              game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
          },
          callback: (li) => {
            let documentId = li.data('documentId') || li.data('entityId');
            let scene = game.scenes.get(documentId);
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              instance.ClearPackedData(scene);
              // Manual clearing of packed data should also de-reference the instance
              scene.unsetFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_SOURCE_MODULE);
            }
          },
        },
        {
          name: game.i18n.localize(
            'SCENE-PACKER.asset-report.run',
          ),
          icon: '<i class="fas fa-search"></i>',
          condition: (li) => {
            return game.user.isGM &&
              game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
          },
          callback: (li) => {
            let documentId = li.data('documentId') || li.data('entityId');
            let scene = game.scenes.get(documentId);
            new globalScenePacker.AssetReport({scene});
          },
        },
      );
    }
  });

  Hooks.on('canvasReady', async (readyCanvas) => {
    if (!game.user.isGM) {
      return;
    }

    const instance = ScenePacker.GetInstanceForScene(readyCanvas.scene);
    if (!instance) {
      // No instance for the requested module
      return;
    }
    await instance.ProcessScene(readyCanvas.scene);
  });

  game.settings.register(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU, {
    name: game.i18n.localize('SCENE-PACKER.settings.context-menu.name'),
    hint: game.i18n.localize('SCENE-PACKER.settings.context-menu.hint'),
    scope: 'client',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.registerMenu(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE, {
    name: game.i18n.localize('SCENE-PACKER.exporter.name'),
    label: game.i18n.localize('SCENE-PACKER.exporter.label'),
    hint: game.i18n.localize('SCENE-PACKER.exporter.hint'),
    icon: "fas fa-cloud-upload-alt",
    type: Exporter,
    restricted: true,
  })

  game.settings.registerMenu(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_IMPORT_FROM_ZIP, {
    name: game.i18n.localize('SCENE-PACKER.zip-importer.name'),
    label: game.i18n.localize('SCENE-PACKER.zip-importer.label'),
    hint: game.i18n.localize('SCENE-PACKER.zip-importer.hint'),
    icon: "fas fa-cloud-download-alt",
    type: ZipImporter,
    restricted: true,
  })

  if (CONSTANTS.IsV10orNewer()) {
    game.settings.registerMenu(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_CONVERT_TO_ADVENTURE_DOCUMENT, {
      name: game.i18n.localize('SCENE-PACKER.adventure-converter.name'),
      label: game.i18n.localize('SCENE-PACKER.adventure-converter.sitting-label'),
      hint: game.i18n.localize('SCENE-PACKER.adventure-converter.setting-hint'),
      icon: "fas fa-arrow-right-from-bracket",
      type: AdventureConverter,
      restricted: true,
    })
  }

  game.settings.register(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ASSET_TIMEOUT, {
    name: game.i18n.localize('SCENE-PACKER.exporter.timeout'),
    hint: game.i18n.localize('SCENE-PACKER.exporter.timeout-help'),
    scope: 'client',
    config: true,
    type: Number,
    default: 0,
  });

  game.settings.register(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_AUTHOR, {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_DISCORD, {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_EMAIL, {
    scope: 'client',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_TAGS, {
    scope: 'client',
    config: false,
    type: Array,
    default: [],
  });

  game.settings.register(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_THEMES, {
    scope: 'client',
    config: false,
    type: Array,
    default: [],
  });
});

/**
 * Expose Scene Packer to other modules.
 * @type {{relinkJournalEntries: (function(String, {dryRun?: Boolean}=): Promise<void>), showPerformanceReport: Report.RenderReport, getInstance: (function(...[*]): ScenePacker), promptRelinkJournalEntries: (function(): Promise<void>), hasPackedData: (function(Object, String, String, String): Boolean)}}
 * @deprecated Use the ScenePacker instance that is available globally (ScenePacker.PromptRelinkJournalEntries() etc.). This method will be removed in a future version.
 */
window[CONSTANTS.MODULE_NAME] = {
  getInstance: ScenePacker.GetInstance,
  relinkJournalEntries: ScenePacker.RelinkJournalEntries,
  hasPackedData: ScenePacker.HasPackedData,
  promptRelinkJournalEntries: ScenePacker.PromptRelinkJournalEntries,
  showPerformanceReport: Report.RenderReport,
};

/**
 * Expose the static ScenePacker methods onto the global scope.
 */
Object.getOwnPropertyNames(ScenePacker).filter(prop => typeof ScenePacker[prop] === 'function').forEach(method => {
  globalScenePacker[method] = ScenePacker[method];
});

/**
 * Proxy access to globalScenePacker allowing access to the static methods, and also quick access to instances
 * by registered module name.
 *
 * Get the Scene Packer instance for the requested moduleName
 * @example
 * // returns ScenePacker instance for 'your-module-name'
 * ScenePacker['your-module-name']
 * @returns {ScenePacker}
 */
globalThis.ScenePacker = new Proxy(globalScenePacker, {
  get: function (target, prop) {
    if (target.hasOwnProperty(prop)) {
      return target[prop];
    }

    // Backwards compatibility. Remove once support for window[MODULE_NAME] is removed.
    switch (prop) {
      case 'getInstance':
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.GetInstance;
      case 'relinkJournalEntries':
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.RelinkJournalEntries;
      case 'hasPackedData':
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.HasPackedData;
      case 'promptRelinkJournalEntries':
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.PromptRelinkJournalEntries;
      case 'showPerformanceReport':
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return Report.RenderReport;
    }

    if (prop in target.instances) {
      return target.instances[prop];
    }

    ui.notifications.error(
      game.i18n.localize('SCENE-PACKER.errors.instance.ui'),
    );
    throw game.i18n.localize('SCENE-PACKER.errors.instance.details');
  },
});

/**
 * Trigger scenePackerReady once the game is ready to give consuming modules time to bind any dependencies they need.
 */
Hooks.on('ready', () => {
  if (!game.user.isGM) {
    return;
  }

  Hooks.callAll(CONSTANTS.HOOKS_SCENE_PACKER_READY, globalThis.ScenePacker);
});

/**
 * Hook into the create methods to set default permission levels for entities coming from Scene Packer
 * enabled modules.
 */
Hooks.on('createActor', async function (a) {
  await ScenePacker.updateEntityDefaultPermission(a);
});
Hooks.on('createItem', async function (i) {
  await ScenePacker.updateEntityDefaultPermission(i);
});
Hooks.on('createJournalEntry', async function (j) {
  await ScenePacker.updateEntityDefaultPermission(j);
});
Hooks.on('createMacro', async function (m) {
  await ScenePacker.updateEntityDefaultPermission(m);
});
Hooks.on('createPlaylist', async function (p) {
  await ScenePacker.updateEntityDefaultPermission(p);
});
Hooks.on('createRollTable', async function (r) {
  await ScenePacker.updateEntityDefaultPermission(r);
});
Hooks.on('createScene', async function (s) {
  await ScenePacker.updateEntityDefaultPermission(s);
});

/**
 * Hook into journal creation to unpack Monk's Enhanced Journal data if needed.
 */
Hooks.on('createJournalEntry', async function (j) {
  await ScenePacker.UnpackEnhancedJournalData(j);
});

/**
 * Hook into tile creation to find Monk's Active Tiles data and update the references if needed.
 */
Hooks.on('preCreateTile', async function (document) {
  const data = CONSTANTS.IsV10orNewer() ? document : document.data;
  const moduleName = getProperty(data, 'flags.scene-packer.source-module');
  if (!moduleName) {
    return;
  }
  const activeTileActions = getProperty(data, 'flags.monks-active-tiles.actions') || [];
  if (!activeTileActions.length) {
    return;
  }
  const spTileData = getProperty(data, 'flags.scene-packer.SPTileData') || [];
  if (!spTileData.length) {
    return;
  }
  const instance = new ScenePacker({moduleName});
  if (!instance) {
    return;
  }
  await instance.unpackActiveTiles([document], spTileData);
});

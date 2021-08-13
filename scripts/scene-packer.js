import { CONSTANTS } from './constants.js';
import Report from './report.js';
import AssetReport from './asset-report.js';
import Hash from './hash.js';

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
  /** @type {{creatures: String[], journals: String[], macros: String[], playlists: String[]}} */
  packs = {
    creatures: [],
    journals: [],
    macros: [],
    playlists: [],
  };
  allowImportPrompts = true;

  /**
   * @param {String} adventureName The human readable name of the adventure.
   * @param {String} moduleName The name of the module this is part of.
   * @param {String[]} creaturePacks Set which Actor packs should be used when searching for Actors.
   * @param {String[]} journalPacks Set which Journal packs should be used when searching for Journals.
   * @param {String[]} macroPacks Set which Macro packs should be used when searching for Macros.
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

    let promptedVersion = game.settings.get(this.moduleName, CONSTANTS.SETTING_PROMPTED) || '0.0.0';
    let moduleVersion = game.modules.get(this.moduleName)?.data?.version || '0.0.0';
    if (this.allowImportPrompts && isNewerVersion(moduleVersion, promptedVersion) && game.settings.get(this.moduleName, CONSTANTS.SETTING_SHOW_WELCOME_PROMPTS)) {
      // A newer version of the module is installed from what was last prompted
      let content = game.i18n.format('SCENE-PACKER.welcome.intro', {
        adventure: this.adventureName,
      });

      if (promptedVersion === '0.0.0') {
        content += game.i18n.format('SCENE-PACKER.welcome.brand-new', {
          adventure: this.adventureName,
        });
      } else {
        content += game.i18n.format('SCENE-PACKER.welcome.update-available', {
          existing: promptedVersion,
          version: moduleVersion,
        });
      }
      let label = game.i18n.localize('SCENE-PACKER.welcome.yes-all-fallback');
      if (!isNewerVersion('0.8.0', game.data.version)) {
        let totalCount = game.packs.filter(
          (p) => p.metadata.package === this.moduleName,
        ).reduce((a, currentValue) => a + (currentValue?.index?.size || currentValue?.index?.length || 0), 0);
        label = game.i18n.format('SCENE-PACKER.welcome.yes-all', {
          count: new Intl.NumberFormat().format(totalCount),
        });
      }
      let d = new Dialog({
        title: game.i18n.localize('SCENE-PACKER.welcome.title'),
        content: content,
        buttons: {
          yesAll: {
            icon: '<i class="fas fa-check-double"></i>',
            label: label,
            callback: async () => {
              await this.importAllContent();
            },
          },
          choose: {
            icon: '<i class="fas fa-clipboard-check"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.let-me-choose'),
            callback: () => {
              game.packs.filter(
                (p) => p.metadata.package === this.moduleName && (p.documentName || p.entity) === 'Scene',
              ).forEach(c => c.render(true));
            },
            condition: game.packs.filter((p) => p.metadata.package === this.moduleName && (p.documentName || p.entity) === 'Scene').length,
          },
          close: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.close'),
          },
        },
      }, {
        // Set the width to somewhere between 400 and 640 pixels.
        width: Math.max(400, Math.min(640, Math.floor(window.innerWidth / 2))),
        classes: ['dialog', 'welcome-prompt'],
      });
      d.render(true);
    }
    game.settings.set(this.moduleName, CONSTANTS.SETTING_PROMPTED, moduleVersion);

    globalScenePacker.instances[this.moduleName] = this;
  }

  /**
   * Imports all of the content for the current adventure module. Skipping items which already exist in the world.
   */
  async importAllContent() {
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
    for (let i = 0; i < CONSTANTS.PACK_IMPORT_ORDER.length; i++) {
      let createData = [];
      const packType = CONSTANTS.PACK_IMPORT_ORDER[i];
      di.data.content = `<p>${game.i18n.format('SCENE-PACKER.welcome.import-all.wait', {
        type: game.i18n.format(CONSTANTS.TYPE_HUMANISE[packType]),
      })}</p>`;
      di.render();
      const packs = game.packs.filter((p) => {
          let type;
          if (!isNewerVersion('0.8.0', game.data.version)) {
            type = p.documentClass?.documentName;
          } else {
            type = p.entity;
          }
          return p.metadata.package === this.moduleName && type === packType;
        },
      );
      for (let i = 0; i < packs.length; i++) {
        const pack = packs[i];
        try {
          let entityClass;
          let packContent;
          let collection;

          if (!isNewerVersion('0.8.0', game.data.version)) {
            entityClass = pack.documentClass;
            packContent = await pack.getDocuments();
            collection = game[entityClass.collectionName];
          } else {
            entityClass = CONFIG[pack.entity].entityClass;
            packContent = await pack.getContent();
            switch (packType) {
              case 'Actor':
                collection = game.actors;
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

          // Filter down to those that are still missing
          packContent = packContent.filter(e => {
            if (e.name === CONSTANTS.CF_TEMP_ENTITY_NAME) {
              // Exclude Compendium Folder temporary entities
              return false;
            }
            let sourceId = e.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
            let coreSourceId = e.getFlag('core', 'sourceId');
            if (sourceId || coreSourceId) {
              return !collection.find(f => f.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sourceId || f.getFlag('core', 'sourceId') === sourceId);
            }
            return true;
          });
          if (!packContent.length) {
            continue;
          }

          let folderData = await this.buildFolderStructureForPackContent(packContent, packType, this.adventureName);

          // Append the entities found in this pack to the growing list to import
          createData = createData.concat(
            packContent.map(c => {
              let cData = c.data;
              const newFlags = {};
              newFlags['core'] = {sourceId: c.uuid};
              if (!isNewerVersion('0.8.0', game.data.version)) {
                cData = collection.fromCompendium(c);
              }
              if (!cData.flags) {
                cData.flags = {};
              }
              mergeObject(cData.flags, newFlags);
              if (!cData.flags[ScenePacker.MODULE_NAME]) {
                cData.flags[ScenePacker.MODULE_NAME] = {};
              }
              cData.flags[ScenePacker.MODULE_NAME].hash = Hash.SHA1(cData);

              if (CONST.FOLDER_ENTITY_TYPES.includes(packType)) {
                // Utilise the folder structure as defined by the Compendium Folder if it exists, otherwise
                // fall back to the default folder.
                const cfPath = cData.flags?.cf?.path;
                if (cfPath && folderData.folderMap.has(cfPath)) {
                  cData.folder = folderData.folderMap.get(cfPath)?.id || null;
                } else if (folderData.folderId) {
                  cData.folder = folderData.folderId;
                }
              }

              // Patch "Sight angle must be between 1 and 360 degrees." error
              if (packType === 'Actor') {
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

          if (createData.length > 0) {
            di.data.content = `<p>${game.i18n.format('SCENE-PACKER.welcome.import-all.creating-data', {
              count: new Intl.NumberFormat().format(createData.length),
              type: game.i18n.format(CONSTANTS.TYPE_HUMANISE[packType]),
              label: pack.metadata.label,
            })}</p>`;
            di.render();
            let createdEntities = await entityClass.create(createData);
            if (!Array.isArray(createdEntities)) {
              createdEntities = [createdEntities];
            }

            switch (packType) {
              case 'Scene':
                // Unpack scenes
                for (let j = 0; j < createdEntities.length; j++) {
                  const scene = createdEntities[j];
                  if (isNewerVersion('0.8.0', game.data.version)) {
                    // v0.7.x of Core had a bug where thumbnails would all be a single image incorrectly.
                    const t = await scene.createThumbnail({img: scene.data.img || undefined});
                    if (t?.thumb) {
                      await scene.update({thumb: t.thumb});
                    }
                  }
                  await this.ProcessScene(scene, {showLinkedJournal: false, contentPreImported: true});
                }
                break;
              case 'JournalEntry':
                // Display the Welcome Journal once per new module version
                if (this.welcomeJournal) {
                  let importedVersion = game.settings.get(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION) || '0.0.0';
                  let moduleVersion = game.modules.get(this.moduleName)?.data?.version || '0.0.0';
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
            }
          }
        } catch (e) {
          console.error(`Error processing ${pack.title}`, e);
        }
      }
    }
    if (!di.rendered) {
      ui.notifications.info(
        game.i18n.format('SCENE-PACKER.welcome.import-all.complete', {
          name: this.adventureName,
        }),
      );
    }
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
    if (!CONST.FOLDER_ENTITY_TYPES.includes(entityType)) {
      // Entity type does not support folders
      return response;
    }

    const hasCFData = content.some(p => p.data?.flags?.cf?.path);
    const allHaveCFData = content.every(p => p.data?.flags?.cf?.path);

    if (!allHaveCFData && fallbackFolderName) {
      // Need the fallback folder to exist
      let folder = game.folders.find(
        (folder) => folder.name === fallbackFolderName && folder.type === entityType && folder.parent === null,
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

    // Build the Compendium Folder structure paths
    for (let i = 0; i < content.length; i++) {
      const entity = content[i];
      const cfPath = entity.data?.flags?.cf?.path;
      if (!cfPath) {
        continue;
      }
      if (response.folderMap.has(cfPath)) {
        continue;
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
        let folder = game.folders.find(
          (folder) => folder.name === pathPart && folder.type === entityType && folder.data.parent === (parent?.id || null),
        );
        if (folder) {
          response.folderMap.set(pathPart, folder);
          continue;
        }
        // Need to create the folder.
        folder = await Folder.create({
          name: pathPart,
          type: entityType,
          parent: parent?.id || null,
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
   * Returns whether the scene has and Packed Data.
   * @param {Object} scene The scene to check.
   * @param {String} moduleName The name of the module that Packed the data.
   * @param {String} tokenFlag The flag that stores token data.
   * @param {String} journalFlag The flag that stores journal pin data.
   * @param {String} macroFlag The flag that stores linked Macro data.
   * @param {String} playlistFlag The flag that stores linked Playlist data.
   * @returns {Boolean}
   */
  static HasPackedData(
    scene,
    moduleName,
    tokenFlag = CONSTANTS.FLAGS_TOKENS,
    journalFlag = CONSTANTS.FLAGS_JOURNALS,
    macroFlag = CONSTANTS.FLAGS_MACROS,
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
   * @returns ScenePacker for chaining
   */
  async ProcessScene(
    scene = game.scenes.get(game.user.viewedScene),
    {
      showLinkedJournal: showLinkedJournal = this.allowImportPrompts,
      contentPreImported: contentPreImported = false,
    } = {},
  ) {
    if (!game.user.isGM) {
      return;
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

    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.notifications.first-launch'),
    );
    await this.UnpackScene(scene, {showLinkedJournal, contentPreImported});
    await this.ClearPackedData(scene);
    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.notifications.done'),
    );

    let importedVersion = game.settings.get(this.moduleName, CONSTANTS.SETTING_IMPORTED_VERSION) || '0.0.0';
    let moduleVersion = game.modules.get(this.moduleName)?.data?.version || '0.0.0';
    if (this.welcomeJournal && isNewerVersion(moduleVersion, importedVersion)) {
      // Display the welcome journal once per new module version
      const j = game.journal.find(j => j.name === this.welcomeJournal && j.getFlag('core', 'sourceId')
        .startsWith(`Compendium.${this.moduleName}.`));
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
   * Set the human readable name of the adventure. This will populate folder names etc.
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
   * Gets the human readable name of the adventure this Scene Packer was set up with.
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
   * Renders a dialog showing which Scenes in the world contain data that would benefit from being Packed.
   */
  static ShowScenesWorthPacking() {
    if (!game.user.isGM) {
      return;
    }

    const sceneInfo = new Map();
    const scenes = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      scenes.push(...game.scenes.contents);
    } else {
      scenes.push(...game.scenes.entities);
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneData = {
        id: scene.id,
        name: scene.name,
      };

      if (scene.journal || scene.playlist) {
        sceneInfo.set(scene.id, sceneData);
        continue;
      }

      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (scene.data?.notes?.size || scene.data?.tokens?.size) {
          sceneInfo.set(scene.id, sceneData);
        }
      } else {
        if (scene.data?.notes?.length || scene.data?.tokens?.length) {
          sceneInfo.set(scene.id, sceneData);
        }
      }
    }

    let content = `<p>${game.i18n.format('SCENE-PACKER.worth-packing.intro', {
      count: new Intl.NumberFormat().format(sceneInfo.size),
      total: new Intl.NumberFormat().format(scenes.length),
    })}</p>`;
    if (sceneInfo.size) {
      content += '<ul>';
      for (const scene of sceneInfo.values()) {
        content += `<li>${scene.name}</li>`;
      }
      content += '</ul>';
    } else {
      content = `<p>${game.i18n.localize('SCENE-PACKER.worth-packing.none')}</p>`;
    }
    Dialog.prompt({
      title: game.i18n.localize('SCENE-PACKER.worth-packing.title'),
      content: content,
      label: game.i18n.localize('Close'),
      callback: () => {
      },
    });
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
    await scene.setFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_PACKED_VERSION, game.modules.get(CONSTANTS.MODULE_NAME).data.version);


    const sceneJournalInfo = {};
    if (scene.journal) {
      sceneJournalInfo.journalName = scene.journal.name;
      sceneJournalInfo.sourceId = scene.journal.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') || scene.journal.getFlag('core', 'sourceId') || scene.journal.uuid;
      const compendiumJournal = await this.FindJournalInCompendiums(scene.journal, this.packs.journals);
      if (compendiumJournal?.uuid) {
        sceneJournalInfo.compendiumSourceId = compendiumJournal.uuid;
      }
    }
    await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_JOURNAL, sceneJournalInfo);
    await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_POSITION, scene.data?.initial);
    if (scene.playlist) {
      const compendiumPlaylist = await this.FindPlaylistInCompendiums(scene.playlist, this.packs.playlists);
      if (compendiumPlaylist) {
        await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_PLAYLIST, compendiumPlaylist?.uuid);
      }
    }

    /**
     * journalInfo is the data that gets passed to findMissingJournals
     */
    const journalInfoResults = await Promise.allSettled(scene.data.notes.map(async note => {
      if (!isNewerVersion('0.8.0', game.data.version)) {
        // v0.8.0+ notes are documents now and stored in data
        note = note.data.toObject();
      }
      const journalData = game.journal.get(note.entryId);
      const compendiumJournal = await this.FindJournalInCompendiums(journalData, this.packs.journals);

      // Take a copy of the original note adding in the sourceId, journal name and folder name it belongs to
      return mergeObject(
        note,
        {
          sourceId: journalData?.uuid,
          compendiumSourceId: compendiumJournal?.uuid,
          journalName: journalData?.name,
          folderName: game.folders.get(journalData?.data?.folder)?.data?.name,
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
      await scene.setFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS, journalInfo);
    } else {
      ui.notifications.info(
        game.i18n.localize(
          'SCENE-PACKER.notifications.pack-scene.no-journal-pins',
        ),
      );
    }

    /**
     * tokenInfo is the data that gets passed to findMissingTokens
     */
    const tokenInfoResults = await Promise.allSettled(scene.data.tokens.filter(a => a?.actorId || a?.data?.actorId)
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
            if (actor.data?.name) {
              actorName = actor.data.name;
            }
            compendiumSourceId = actor.getFlag('core', 'sourceId');
            if (!compendiumSourceId || !compendiumSourceId.startsWith(`Compendium.${this.moduleName}.`)) {
              // The actor source isn't the module's compendium, see if we have a direct match in a different compendium
              const compendiumActor = await this.FindActorInCompendiums(actor, this.packs.creatures);
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
          x: token?.x || token?.data?.x,
          y: token?.y || token?.data?.y,
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

    const sourceId = journal.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');

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
        let entity;
        if (!isNewerVersion('0.8.0', game.data.version)) {
          entity = await pack.getDocument(id);
        } else {
          entity = await pack.getEntity(id);
        }
        if (entity) {
          possibleMatches.push(entity);

          if (entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === journal.uuid) {
            // Entity in the pack originated in this world and is the exact journal
            return entity;
          }

          if (sourceId && entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sourceId) {
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
      if (journal.data.content === entity.data.content) {
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
        let entity;
        if (!isNewerVersion('0.8.0', game.data.version)) {
          entity = await pack.getDocument(id);
        } else {
          entity = await pack.getEntity(id);
        }
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
        let entity;
        if (!isNewerVersion('0.8.0', game.data.version)) {
          entity = await pack.getDocument(id);
        } else {
          entity = await pack.getEntity(id);
        }
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
      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (Array.from(playlist.data.sounds.keys()) === Array.from(entity.data.sounds.keys())) {
          compendiumPlaylist = entity;
          break;
        }
      } else {
        if (Object.keys(playlist.audio) === Object.keys(entity.audio)) {
          compendiumPlaylist = entity;
          break;
        }
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
   * Import entities by their Uuid, falling back to name based import
   * @param {String[]} searchPacks The compendium pack names to search within
   * @param {Object[]} entities The entities to import
   * @param {String} type The type of entity being imported. Used for notification purposes only.
   * @returns {Object[]} The entities created. May be fewer than requested if some already exist.
   */
  async ImportEntities(searchPacks, entities, type) {
    if (!game.user.isGM) {
      return;
    }

    let createdEntities = [];

    if (entities.length === 0) {
      // No missing entities
      return createdEntities;
    }
    let entityNames = entities.map(e => e.name || e.journalName || e.tokenName || e.actorName);

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
    searchPacks.forEach(searchPack => {
      const pack = game.packs.get(searchPack);
      if (!pack) {
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
          {searchPack, entityNames, entities, type},
        );
        throw game.i18n.format(
          'SCENE-PACKER.notifications.import-entities.invalid-packs.error',
          {
            type: type,
          },
        );
      }
    });

    for (let i = 0; i < entities.length; i++) {
      try {
        const entity = entities[i];
        if (entity.compendiumSourceId) {
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
    if (createdEntities.length) {
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

    let exampleEntity = '';
    if (!isNewerVersion('0.8.0', game.data.version)) {
      exampleEntity = game.packs.get(searchPacks[0])?.documentClass?.documentName;
    } else {
      exampleEntity = game.packs.get(searchPacks[0])?.entity;
    }
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
    let entityClass;
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entityClass = CONFIG[exampleEntity]?.documentClass;
    } else {
      entityClass = CONFIG[exampleEntity]?.entityClass;
    }
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
      let entityType;
      let packContent;
      let collection;
      if (!isNewerVersion('0.8.0', game.data.version)) {
        entityType = pack.documentClass.documentName;
        packContent = await pack.getDocuments();
        collection = game[entityClass.collectionName];
      } else {
        entityType = pack.entity;
        packContent = await pack.getContent();
        switch (entityType) {
          case 'Actor':
            collection = game.actors;
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

      // Filter to just the needed entities
      const content = packContent.filter((entity) =>
        entityNames.includes(entity.name),
      );

      // Remove the entries that we found in this pack
      entities = entities.filter(
        (e) =>
          content.find((entity) => entity.name === (e.name || e.journalName || e.tokenName || e.actorName)) == null,
      );

      if (content.length > 0) {
        let folderData = await this.buildFolderStructureForPackContent(content, entityType, this.adventureName);

        // Append the entities found in this pack to the growing list to import
        createData = createData.concat(
          content.map((c) => {
            let cData = c.data;
            if (!isNewerVersion('0.8.0', game.data.version)) {
              cData = collection.fromCompendium(c);
            }
            // Utilise the folder structure as defined by the Compendium Folder if it exists, otherwise
            // fall back to the default folder.
            const cfPath = cData.flags?.cf?.path;
            if (cfPath && folderData.folderMap.has(cfPath)) {
              cData.folder = folderData.folderMap.get(cfPath)?.id || null;
            } else if (folderData.folderId) {
              cData.folder = folderData.folderId;
            }
            cData['flags.core.sourceId'] = c.uuid;

            // Patch "Sight angle must be between 1 and 360 degrees." error
            if (cData.token?.sightAngle === 0) {
              cData.token.sightAngle = 360;
            }
            if (cData.token?.lightAngle === 0) {
              cData.token.lightAngle = 360;
            }
            return cData;
          }),
        );
      }
    }

    if (createData.length > 0) {
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-entities.creating-data',
          {
            count: new Intl.NumberFormat().format(createData.length),
            type,
          },
        ),
      );
      let createdEntity = await entityClass.create(createData);
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
      let matches = [];
      if (!isNewerVersion('0.8.0', game.data.version)) {
        matches = game.actors.contents.filter(a => a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === token.sourceId || a.getFlag('core', 'sourceId') === token.sourceId);
      } else {
        matches = game.actors.entities.filter(a => a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === token.sourceId || a.getFlag('core', 'sourceId') === token.sourceId);
      }
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
    const missing_journals = new Set();
    const missing_name_matches = new Set();
    // Check for exact matches first
    for (let i = 0; i < journalInfo.length; i++) {
      const journal = journalInfo[i];
      if (!journal?.sourceId) {
        missing_name_matches.add(journal);
        continue;
      }
      let matches = [];
      if (!isNewerVersion('0.8.0', game.data.version)) {
        matches = game.journal.contents.filter(a => a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === journal.sourceId || a.getFlag('core', 'sourceId') === journal.compendiumSourceId);
      } else {
        matches = game.journal.entities.filter(a => a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === journal.sourceId || a.getFlag('core', 'sourceId') === journal.compendiumSourceId);
      }
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
      this.packs.journals.forEach(j => {
        const pack = game.packs.get(j);
        if (pack?.metadata?.label) {
          folderNames.push(pack.metadata.label);
        }
      });
      const folderIDs = game.folders.filter(
        (j) => j.data.type === 'JournalEntry' && folderNames.includes(j.data.name),
      ).map((f) => f.id);
      missing = Array.from(missing_name_matches)
        .filter((info) => {
          // Filter for only the entries that are missing, or are in a different folder.
          const j = game.journal.getName(info?.journalName);
          return j == null || (folderIDs.length && !folderIDs.includes(j.data.folder));
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
    const missing_macros = new Set();
    const missing_name_matches = new Set();
    // Check for exact matches first
    for (let i = 0; i < macroInfo.length; i++) {
      const macro = macroInfo[i];
      if (!macro?.sourceId) {
        missing_name_matches.add(macro);
        continue;
      }
      let matches = [];
      if (!isNewerVersion('0.8.0', game.data.version)) {
        matches = game.macros.contents.filter(a => a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === macro.sourceId);
      } else {
        matches = game.macros.entities.filter(a => a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === macro.sourceId);
      }
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
      this.packs.macros.forEach(j => {
        const pack = game.packs.get(j);
        if (pack?.metadata?.label) {
          folderNames.push(pack.metadata.label);
        }
      });
      const folderIDs = game.folders.filter(
        (j) => j.data.type === 'Macro' && folderNames.includes(j.data.name),
      ).map((f) => f.id);
      missing = Array.from(missing_name_matches)
        .filter((info) => {
          // Filter for only the entries that are missing, or are in a different folder.
          const j = game.macros.getName(info?.name);
          return j == null || (folderIDs.length && !folderIDs.includes(j.data.folder));
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
      if (!isNewerVersion('0.8.0', game.data.version)) {
        actor = game.actors.contents.find(
          (a) => a.data.name === tokenName && a.data.folder === folder.id,
        );
      } else {
        actor = game.actors.entities.find(
          (a) => a.data.name === tokenName && a.data.folder === folder.id,
        );
      }
      if (actor) {
        // Found a direct Token <-> Actor name match in the Adventure folder
        return actor;
      }
    }

    if (!isNewerVersion('0.8.0', game.data.version)) {
      actor = game.actors.contents.find((a) => a.data.name === tokenName);
    } else {
      actor = game.actors.entities.find((a) => a.data.name === tokenName);
    }
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
   *     (this handles look ups for tokens that have a different name to the Actor they represent)
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
        let actor;
        if (!isNewerVersion('0.8.0', game.data.version)) {
          actor = game.actors.contents.find(a => a.getFlag('core', 'sourceId') === tData.compendiumSourceId);
        } else {
          actor = game.actors.entities.find(a => a.getFlag('core', 'sourceId') === tData.compendiumSourceId);
        }
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
      let tokenX = token?.x || token?.data?.x;
      let tokenY = token?.y || token?.data?.y;
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
   * Relinks tokens with the actors they represent.
   * @param {Object[]} tokenInfo data written during PackScene()
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @see PackScene
   */
  async relinkTokens(scene, tokenInfo) {
    if (!tokenInfo?.length) {
      // Nothing to relink.
      return Promise.resolve();
    }

    const folder = game.folders.find(
      (j) => j.data.type === 'Actor' && j.data.name === this.adventureName,
    );
    let updates = [];
    let missing = [];

    scene.data.tokens.forEach((t) => {
      let actor = this.findActorForToken(t, tokenInfo, folder);
      if (actor) {
        if (!isNewerVersion('0.8.0', game.data.version)) {
          updates.push({
            _id: t.id,
            actorId: actor.id,
          });
        } else {
          updates.push({
            _id: t._id,
            actorId: actor.id,
          });
        }
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
      ui.notifications.info(
        game.i18n.format('SCENE-PACKER.notifications.link-tokens.linking', {
          count: new Intl.NumberFormat().format(updates.length),
          adventureName: this.adventureName,
        }),
      );
      if (!isNewerVersion('0.8.0', game.data.version)) {
        return scene.updateEmbeddedDocuments('Token', updates);
      } else {
        return scene.updateEmbeddedEntity('Token', updates);
      }
    }

    return Promise.resolve();
  }

  /**
   * Spawns Journal Note Pins with the requested details.
   * @param {Object[]} journalInfo data written during PackScene()
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @see PackScene
   */
  async spawnNotes(scene, journalInfo) {
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
        const existingEntity = game.journal.find(p => p.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === note.sourceId);
        if (existingEntity) {
          return existingEntity.id;
        }
        // Use the first as it's still a match
        return existingEntities[0].id;
      }

      return game.journal.getName(note.journalName)?.id;
    }

    function getIconForNote(note) {
      // Replace icon with a Book if Automatic Journal Icon Numbers isn't installed or the image doesn't exist yet.
      let icon = note.icon;
      if (
        (icon.startsWith('modules/journal-icon-numbers/') || note?.flags?.autoIconFlags) &&
        !game.modules.get('journal-icon-numbers')?.active
      ) {
        icon = 'icons/svg/book.svg';
      } else {
        // Test the icon exists and replace it if it doesn't
        $.get(icon).fail(() => icon = 'icons/svg/book.svg');
      }
      return icon;
    }

    if (isNewerVersion(scene.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_PACKED_VERSION), '2.1.99')) {
      // Packed with a version >= 2.2.0 that supports updating the notes
      journalInfo.forEach((note) => {
        updates.push({
          _id: note._id,
          icon: getIconForNote(note),
          entryId: findJournalIDForNote(note),
        });
      });
    } else {
      // Packed with a version that needs deleting and re-creating
      journalInfo.forEach((note) => {
        updates.push(mergeObject(
          note,
          {
            icon: getIconForNote(note),
            entryId: findJournalIDForNote(note),
            '-=journalName': null,
            '-=folderName': null,
          },
          {inplace: false},
        ));
      });
    }

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
      ui.notifications.info(
        game.i18n.format('SCENE-PACKER.notifications.spawn-notes.spawning', {
          count: new Intl.NumberFormat().format(updates.length),
        }),
      );
      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (isNewerVersion(scene.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_PACKED_VERSION), '2.1.99')) {
          // Packed with a version >= 2.2.0 that supports updating the notes
          return scene.updateEmbeddedDocuments('Note', updates);
        } else {
          await scene.deleteEmbeddedDocuments(
            'Note',
            scene.data.notes.map((n) => n.id),
          );
          return scene.createEmbeddedDocuments('Note', updates);
        }
      } else {
        if (isNewerVersion(scene.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_PACKED_VERSION), '2.1.99')) {
          // Packed with a version >= 2.2.0 that supports updating the notes
          return scene.updateEmbeddedEntity('Note', updates);
        } else {
          await scene.deleteEmbeddedEntity(
            'Note',
            scene.data.notes.map((n) => n._id),
          );
          return scene.createEmbeddedEntity('Note', updates);
        }
      }
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

    let type = '';
    let collection;
    if (!isNewerVersion('0.8.0', game.data.version)) {
      type = entity.documentName;
      collection = game[entity.collectionName];
    } else {
      type = entity.entity;
      switch (type) {
        case 'Actor':
          collection = game.actors;
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

    const hasUuid = !!entity.uuid;
    const hasSourceId = !!entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
    const existingEntities = collection.filter(p => {
      return (hasUuid && p.getFlag('core', 'sourceId') === entity.uuid) ||
        (hasSourceId && p.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId'));
    });
    if (existingEntities.length) {
      if (existingEntities.length === 1) {
        return existingEntities[0];
      }
      // Multiple matches exist, prefer a local source
      const existingEntity = collection.find(p => p.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId'));
      if (existingEntity) {
        return existingEntity;
      }
      // Use the first as it's still a match
      return existingEntities[0];
    }

    const update = {};

    let folderData = await this.buildFolderStructureForPackContent([entity], type, this.adventureName);

    // Check for Compendium Folder structure data
    const cfPath = entity.data?.flags?.cf?.path;
    if (cfPath && folderData.folderMap.has(cfPath)) {
      update.folder = folderData.folderMap.get(cfPath)?.id || null;
    } else if (folderData.folderId) {
      update.folder = folderData.folderId;
    }

    if (!isNewerVersion('0.8.0', game.data.version)) {
      return collection.importFromCompendium(game.packs.get(entity.compendium.collection), entity.id, update);
    }

    // Patch "Sight angle must be between 1 and 360 degrees." error
    if (entity.data.token?.sightAngle === 0) {
      if (!update.token) {
        update.token = {};
      }
      update.token.sightAngle = 360;
    }
    if (entity.data.token?.lightAngle === 0) {
      if (!update.token) {
        update.token = {};
      }
      update.token.lightAngle = 360;
    }

    return collection.importFromCollection(entity.compendium.collection, entity.id, update);
  }

  /**
   * Unpack the scene data and reconstruct the appropriate links.
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @param {Boolean} showLinkedJournal Whether to show any Journals linked to the Scene.
   */
  async UnpackScene(
    scene = game.scenes.get(game.user.viewedScene),
    {showLinkedJournal = true, contentPreImported = false} = {},
  ) {
    const tokenInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_TOKENS);
    const journalInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS);
    const sceneJournalInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_JOURNAL);
    const sceneInitialPosition = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_POSITION);
    const scenePlaylist = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_PLAYLIST);
    if (sceneInitialPosition && Object.keys(sceneInitialPosition).length) {
      await scene.update({initial: sceneInitialPosition});
    }

    if (scenePlaylist) {
      const playlist = await this.ImportByUuid(scenePlaylist);
      if (playlist?.id !== scene.data.playlist) {
        await scene.update({playlist: playlist.id});
      }
    }

    if (tokenInfo?.length && !contentPreImported) {
      // Import tokens that don't yet exist in the world
      await this.ImportEntities(
        this.packs.creatures,
        this.findMissingActors(tokenInfo),
        'actors',
      );
    }

    if (journalInfo?.length) {
      let journals = [];
      if (!contentPreImported) {
        // Import Journal Pins
        journals = await this.ImportEntities(
          this.packs.journals,
          this.findMissingJournals(journalInfo),
          'journals',
        );
      } else {
        // List all of the journals belonging to this module's packs
        journals = game.journal.filter(j => this.packs.journals.some(p => j.getFlag('core', 'sourceId')
          ?.startsWith(`Compendium.${p}.`)));
      }
      if (journals?.length) {
        await this.unpackQuickEncounters(scene, journals, this.moduleName);
      }
    }

    if (this.welcomeJournal && !contentPreImported) {
      // Import the "Welcome Journal"
      await this.ImportEntities(
        this.packs.journals,
        this.findMissingJournals([this.welcomeJournal].map(d => {
          return {journalName: d};
        })),
        'journals',
      );
    }
    if (this.additionalJournals.length > 0 && !contentPreImported) {
      // Import any additional Journals
      await this.ImportEntities(
        this.packs.journals,
        this.findMissingJournals(this.additionalJournals.map(d => {
          return {journalName: d};
        })),
        'journals',
      );
    }
    if (this.additionalMacros.length > 0 && !contentPreImported) {
      // Import any additional Macros
      await this.ImportEntities(
        this.packs.macros,
        this.findMissingMacros(this.additionalMacros.map(d => {
          return {name: d};
        })),
        'macros',
      );
    }

    if (sceneJournalInfo && Object.keys(sceneJournalInfo).length) {
      if (!contentPreImported) {
        // Ensure the scene journal is imported
        await this.ImportEntities(
          this.packs.journals,
          this.findMissingJournals([sceneJournalInfo]),
          'journals',
        );
      }
      if (!scene.journal) {
        // Relink the journal to the correct entry
        const newSceneJournal = game.journal.find(j => j.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sceneJournalInfo.sourceId);
        if (newSceneJournal?.id) {
          await scene.update({journal: newSceneJournal.id});
        }
      }
    }

    // Relink the tokens and spawn the pins
    if (tokenInfo?.length) {
      await this.relinkTokens(scene, tokenInfo);
    }
    if (journalInfo?.length) {
      await this.spawnNotes(scene, journalInfo);
    }

    // Display the Scene's journal note if it has one
    if (showLinkedJournal && scene.journal) {
      scene.journal.show();
    }

    ui.sidebar.activateTab('scenes');

    return Promise.resolve();
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

    // Check if the quick encounters module exists at all and bail if it isn't.
    let scopes = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      scopes = game.getPackageScopes();
    } else {
      scopes = SetupConfiguration.getPackageScopes();
    }
    if (!scopes.length || !scopes.includes('quick-encounters')) {
      return;
    }

    const journalInfo = scene.getFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS);

    for (let i = 0; i < journals.length; i++) {
      const journal = journals[i];
      let quickEncounter = {};
      const quickEncounterData = journal.getFlag('quick-encounters', 'quickEncounter');
      if (quickEncounterData) {
        try {
          if (typeof quickEncounterData === 'string') {
            quickEncounter = JSON.parse(quickEncounterData);
          } else if (typeof quickEncounterData === 'object') {
            quickEncounter = quickEncounterData;
          }
          if (!quickEncounter) {
            continue;
          }
          if (!quickEncounter.journalEntryId || !quickEncounter.journalEntryId.startsWith('Compendium.')) {
            // Only support unpacking compendium references
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
      } else {
        continue;
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
          if (!isNewerVersion('0.8.0', game.data.version)) {
            await scene.updateEmbeddedDocuments('Note', [update]);
          } else {
            await scene.updateEmbeddedEntity('Note', update);
          }
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
          let match;
          if (!isNewerVersion('0.8.0', game.data.version)) {
            match = game.actors.contents.find(a => a.getFlag('core', 'sourceId') === actor.actorID);
          } else {
            match = game.actors.entities.find(a => a.getFlag('core', 'sourceId') === actor.actorID);
          }
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

        await journal.setFlag('quick-encounters', 'quickEncounter', JSON.stringify(quickEncounter));
      }
    }
  }

  /**
   * ClearPackedData removes the data embedded in the Scene to prevent importing multiple times.
   * @see PackScene
   * @param {Object} scene The scene to clear the packed data from. Defaults to the currently viewed scene.
   */
  async ClearPackedData(scene = game.scenes.get(game.user.viewedScene)) {
    if (!game.user.isGM) {
      return;
    }

    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_TOKENS);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_JOURNALS);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_JOURNAL);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_SCENE_POSITION);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_PLAYLIST);
    await scene.unsetFlag(this.moduleName, CONSTANTS.FLAGS_MACROS);

    // Old format cleanup
    await scene.unsetFlag(this.moduleName, 'aiJournals');
    await scene.unsetFlag(this.moduleName, 'aiTokens');

    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.notifications.clear-data.done'),
    );
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
    const compendiums = game.packs.filter(
      (p) => p.metadata.package === moduleName,
    );
    const settings = {};
    compendiums.forEach((p) => {
      settings[`${p.metadata.package}.${p.metadata.name}`] = {locked};
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
      let configsetting = Compendium?.CONFIG_SETTING || CompendiumCollection?.CONFIG_SETTING || 'compendiumConfiguration';
      await game.settings.set('core', configsetting, settings);
    }
  }

  /**
   * Updates the default permission of an entity to the value stored by Scene Packer during export.
   * @param {Object} entity
   * @return {Promise<void>}
   */
  static async updateEntityDefaultPermission(entity) {
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
      if (defaultPermission && typeof entity.data?.permission?.default !== 'undefined' && entity.data?.permission?.default !== defaultPermission) {
        entity.update({permission: {default: defaultPermission}});
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

    // Get all of the compendium packs that belong to the requested module
    const allPacks = game.packs.filter(
      (p) => p.metadata.package === moduleName,
    );
    const instance = new ScenePacker({moduleName});
    /**
     * @type {{ActorPacks: *[], ItemPacks: *[], ScenePacks: *[], JournalEntryPacks: *[], MacroPacks: *[], RollTablePacks: *[], PlaylistPacks: *[]}}
     */
    const packs = {};
    for (let i = 0; i < CONST.COMPENDIUM_ENTITY_TYPES.length; i++) {
      const type = CONST.COMPENDIUM_ENTITY_TYPES[i];
      const uniquePacks = new Set(allPacks.filter((p) => {
        if (!isNewerVersion('0.8.0', game.data.version)) {
          return p.documentClass.documentName === type;
        }
        return p.entity === type;
      }));

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

    // Matches things like: @Actor[obe2mDyYDXYmxHJb]{Something or other}
    const rex = /@(\w+)\[(\w+)\]\{([^}]+)\}/g;
    const domParser = new DOMParser();

    async function findNewReferences(type, oldRef, oldName, entry, journal) {
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
        return [];
      }
      let entity = collection.get(oldRef);
      if (!entity) {
        // Try looking up by name
        entity = collection.getName(oldRef);
        if (!entity) {
          ui.notifications.error(
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.invalid-no-matching-name',
              {
                type,
                name: oldName,
              }
            ),
          );
          ScenePacker.logType(
            moduleName,
            'error',
            true,
            journal.name,
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.invalid-no-matching-name',
              {
                type,
                name: oldName,
              }
            ),
            entry,
            oldRef,
          );
          return [];
        }
      }
      let name = entity.name;
      let sourceId = entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId');
      let matches = [];

      for (let l = 0; l < packs[`${type}Packs`].length; l++) {
        const p = packs[`${type}Packs`][l];
        let possibleMatches = p.index.filter((e) => e.name === name);
        if (possibleMatches.length) {
          for (let m = 0; m < possibleMatches.length; m++) {
            const possibleMatch = possibleMatches[m];
            let entity;
            if (!isNewerVersion('0.8.0', game.data.version)) {
              entity = await p.getDocument(possibleMatch._id);
            } else {
              entity = await p.getEntity(possibleMatch._id);
            }
            if (entity) {
              if (sourceId && entity.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === sourceId) {
                // Direct match
                return [{pack: p.collection, ref: possibleMatch._id}];
              }
            }
            matches.push({pack: p.collection, ref: possibleMatch._id});
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
          journal.name,
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
            journal.name,
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

    // Check each of the JournalEntry compendium packs in the requested module
    for (let i = 0; i < packs.JournalEntryPacks.length; i++) {
      const pack = packs.JournalEntryPacks[i];
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.checking-and-updating',
          {
            count: new Intl.NumberFormat().format(pack.index.length || pack.index.size),
          },
        ),
      );
      // Check each of the Journals in the pack
      let packValues;
      if (!isNewerVersion('0.8.0', game.data.version)) {
        packValues = pack.index.values();
      } else {
        packValues = pack.index;
      }
      for (const entry of packValues) {
        const references = new Set();
        let journal;
        if (!isNewerVersion('0.8.0', game.data.version)) {
          journal = await pack.getDocument(entry._id);
        } else {
          journal = await pack.getEntity(entry._id);
        }
        if (!journal?.data?.content) {
          continue;
        }
        ScenePacker.logType(
          moduleName,
          'info',
          true,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.checking-journal',
            {
              journal: journal.name,
              entryId: entry._id,
            },
          ),
        );

        // Replace hyperlink style links first
        const doc = domParser.parseFromString(journal.data.content, 'text/html');
        for (const link of doc.getElementsByTagName('a')) {
          if (!link.classList.contains('entity-link') || !link.dataset.entity || !link.dataset.id) {
            continue
          }

          // Build the links to the new references that exist within the compendium/s
          let newRef = await findNewReferences(link.dataset.entity, link.dataset.id, link.text, entry, journal);

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

          if (!dryRun) {
            link.setAttribute('data-pack', newRef[0].pack);
            link.setAttribute('data-id', newRef[0].ref);
          }
        }
        if (!dryRun) {
          journal.data.content = doc.body.innerHTML;
        }

        const links = [...journal.data.content.matchAll(rex)];
        for (let k = 0; k < links.length; k++) {
          const link = links[k];
          const type = link[1];
          const oldRef = link[2];
          const oldName = link[3];

          // Build the links to the new references that exist within the compendium/s
          let newRef = await findNewReferences(type, oldRef, oldName, entry, journal);

          if (!newRef.length) {
            continue;
          }

          references.add({
            type: type,
            oldRef: oldRef,
            newRef: newRef,
            pack: pack.collection,
            journalEntryId: entry._id,
          });
        }

        await ScenePacker.RelinkQuickEncounterData(journal, moduleName, dryRun);

        if (references.size) {
          ScenePacker.logType(
            moduleName,
            'info',
            true,
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.updating-journal-references',
              {
                count: new Intl.NumberFormat().format(references.size),
                journal: journal.name,
              },
            ),
          );

          // Build the new journal content, progressively replacing each reference
          let newContent = journal.data.content;
          for (const change of references) {
            if (change.newRef.length !== 1) {
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
                  pack: change.pack,
                  journalEntryId: change.journalEntryId,
                  type: change.type,
                  oldRef: change.oldRef,
                  newRefPack: change.newRef[0].pack,
                  newRef: change.newRef[0].ref,
                },
              ),
            );
            let regex = new RegExp(
              `@${change.type}\\[${change.oldRef}\\]\\{`,
              'g',
            );
            newContent = newContent.replace(
              regex,
              `@Compendium[${change.newRef[0].pack}.${change.newRef[0].ref}]{`,
            );
          }
          ui.notifications.info(
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.updating-reference',
              {
                count: new Intl.NumberFormat().format(references.size),
                journal: journal.name,
              },
            ),
          );

          // Update the journal entry with the fully replaced content
          if (!dryRun) {
            if (!isNewerVersion('0.8.0', game.data.version)) {
              const document = await pack.getDocument(entry._id);
              await document.update({content: newContent}, {pack: pack.collection});
            } else {
              await pack.updateEntity({_id: entry._id, content: newContent});
            }
          }
        } else {
          ScenePacker.logType(
            moduleName,
            'info',
            true,
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.no-references',
              {
                journal: journal.name,
                entryId: entry._id,
              },
            ),
          );
        }
        ScenePacker.logType(
          moduleName,
          'info',
          true,
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.completed-journal',
            {
              journal: journal.name,
              entryId: entry._id,
            },
          ),
        );
      }
    }

    // Lock the module compendiums again
    if (!dryRun) {
      await ScenePacker.SetModuleCompendiumLockState(true, moduleName);
    }

    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.world-conversion.compendiums.completed'),
    );
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

    // Check if the quick encounters module exists at all and bail if it isn't.
    let scopes = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      scopes = game.getPackageScopes();
    } else {
      scopes = SetupConfiguration.getPackageScopes();
    }
    if (!scopes.length || !scopes.includes('quick-encounters')) {
      return;
    }

    let quickEncounter = {};
    const quickEncounterData = journal.getFlag('quick-encounters', 'quickEncounter');
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
      const worldJournal = game.journal.get(quickEncounter.journalEntryId);
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
      const instance = new ScenePacker({moduleName});
      if (!instance) {
        return;
      }

      for (let i = 0; i < quickEncounter.extractedActors.length; i++) {
        const actor = quickEncounter.extractedActors[i];
        const worldActor = game.actors.get(actor.actorID);
        if (worldActor) {
          const compendiumActor = await instance.FindActorInCompendiums(worldActor, instance.packs.creatures);
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
        await journal.setFlag('quick-encounters', 'quickEncounter', JSON.stringify(quickEncounter));
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
    if (!game.user.isGM) {
      return null;
    }

    if (!scene) {
      return null;
    }
    const moduleName = scene.getFlag(CONSTANTS.MODULE_NAME, CONSTANTS.FLAGS_SOURCE_MODULE);
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

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
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
            let scene = game.scenes.get(li.data('entityId'));
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              return !ScenePacker.HasPackedData(scene, instance.GetModuleName()) &&
                game.user.isGM &&
                game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
            }
            return game.user.isGM && game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
          },
          callback: (li) => {
            let scene = game.scenes.get(li.data('entityId'));
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
            let scene = game.scenes.get(li.data('entityId'));
            let instance = ScenePacker.GetInstanceForScene(scene);
            return instance &&
              ScenePacker.HasPackedData(scene, instance.GetModuleName()) &&
              game.user.isGM &&
              game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
          },
          callback: (li) => {
            let scene = game.scenes.get(li.data('entityId'));
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
            let scene = game.scenes.get(li.data('entityId'));
            let instance = ScenePacker.GetInstanceForScene(scene);
            return instance &&
              ScenePacker.HasPackedData(scene, instance.GetModuleName()) &&
              game.user.isGM &&
              game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_ENABLE_CONTEXT_MENU);
          },
          callback: (li) => {
            let scene = game.scenes.get(li.data('entityId'));
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              instance.ClearPackedData(scene);
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
            let scene = game.scenes.get(li.data('entityId'));
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

  Hooks.callAll('scenePackerReady', globalThis.ScenePacker);
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

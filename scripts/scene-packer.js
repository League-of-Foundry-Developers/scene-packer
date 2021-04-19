import Report from './report.js';

const MINIMUM_SUPPORTED_PACKER_VERSION = '2.0.0';
const MODULE_NAME = 'scene-packer';
const FLAGS_JOURNALS = 'journals';
const FLAGS_TOKENS = 'tokens';
const FLAGS_MACROS = 'macros';
const FLAGS_SCENE_JOURNAL = 'scene-journal';
const FLAGS_SCENE_POSITION = 'scene-position';
const FLAGS_SOURCE_MODULE = 'source-module';
const FLAGS_PACKED_VERSION = 'packed-with-version';
const FLAGS_IMPORTED_VERSION = 'imported';

/**
 * Tracks the initialised instances of Scene Packer and also exposes some methods to globalThis.
 * Static methods of ScenePacker are automatically added to this object at a later stage.
 */
const globalScenePacker = {
  instances: {},
  ShowPerformanceReport: Report.RenderReport,
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
  /** @type {{creatures: String[], journals: String[], macros: String[]}} */
  packs = {
    creatures: [],
    journals: [],
    macros: [],
  };
  allowImportPrompts = true;

  /**
   * @param {String} adventureName The human readable name of the adventure.
   * @param {String} moduleName The name of the module this is part of.
   * @param {String[]} creaturePacks Set which Actor packs should be used when searching for Actors.
   * @param {String[]} journalPacks Set which Journal packs should be used when searching for Journals.
   * @param {String[]} macroPacks Set which Macro packs should be used when searching for Macros.
   * @param {String} welcomeJournal Set the name of the journal to be imported and automatically opened after activation.
   * @param {String[]} additionalJournals Set which journals (by name) should be automatically imported.
   * @param {Boolean} allowImportPrompts Set whether import prompts should be allowed.
   */
  constructor(
    {
      adventureName = '',
      moduleName = '',
      creaturePacks = [],
      journalPacks = [],
      macroPacks = [],
      welcomeJournal = '',
      additionalJournals = [],
      allowImportPrompts = true,
    } = {},
  ) {
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
    if (welcomeJournal) {
      this.SetWelcomeJournal(welcomeJournal);
    }
    if (additionalJournals?.length) {
      this.SetAdditionalJournalsToImport(additionalJournals);
    }
    this.allowImportPrompts = allowImportPrompts;

    if (typeof window.DEV?.registerPackageDebugFlag === 'function') {
      window.DEV.registerPackageDebugFlag(this.moduleName);
    }

    game.settings.register(this.moduleName, 'imported', {
      scope: 'world',
      config: false,
      type: String,
      default: '0.0.0',
    });

    game.settings.register(this.moduleName, 'prompted', {
      scope: 'world',
      config: false,
      type: String,
      default: '0.0.0',
    });

    game.settings.register(this.moduleName, 'showWelcomePrompts', {
      scope: 'world',
      config: false,
      type: Boolean,
      default: true,
    });

    let promptedVersion = game.settings.get(this.moduleName, 'prompted') || '0.0.0';
    let moduleVersion = game.modules.get(this.moduleName)?.data?.version || '0.0.0';
    if (this.allowImportPrompts && isNewerVersion(moduleVersion, promptedVersion) && game.settings.get(this.moduleName, 'showWelcomePrompts')) {
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
      let d = new Dialog({
        title: game.i18n.format('SCENE-PACKER.welcome.title', {
          title: this.adventureName,
        }),
        content: content,
        buttons: {
          yesAll: {
            icon: '<i class="fas fa-check-double"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.yes-all'),
            callback: async () => {
              const packs = game.packs.filter(
                (p) => p.metadata.package === this.moduleName && p.entity === 'Scene',
              );
              for (let i = 0; i < packs.length; i++) {
                const c = packs[i];
                let folderId = game.folders.find(
                  (folder) => folder.name === this.adventureName && folder.type === 'Scene',
                )?._id;
                if (!folderId) {
                  const folder = await Folder.create({
                    name: this.adventureName,
                    type: 'Scene',
                    parent: null,
                  });
                  folderId = folder._id;
                }
                const scenes = await c.importAll({folderId: folderId, folderName: this.adventureName});
                if (!scenes) {
                  continue;
                }
                if (Array.isArray(scenes) && scenes.length) {
                  for (let j = 0; j < scenes.length; j++) {
                    await this.ProcessScene(scenes[j], {showLinkedJournal: false});
                  }
                } else {
                  await this.ProcessScene(scenes, {showLinkedJournal: false});
                }
              }
            },
          },
          choose: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.let-me-choose'),
            callback: () => {
              game.packs.filter(
                (p) => p.metadata.package === this.moduleName && p.entity === 'Scene',
              ).forEach(c => c.render(true));
            },
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.no'),
          },
          dontAsk: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('SCENE-PACKER.welcome.dont-ask'),
            callback: () =>
              game.settings.set(
                this.moduleName,
                'showWelcomePrompts',
                false,
              ),
          },
        },
      }, {
        // Set the width to somewhere between 400 and 620 pixels.
        width: Math.max(400, Math.min(640, Math.floor(window.innerWidth / 2))),
      });
      d.render(true);
    }
    game.settings.set(this.moduleName, 'prompted', moduleVersion);

    globalScenePacker.instances[this.moduleName] = this;
  }

  /**
   * Returns whether the scene has and Packed Data.
   * @param {Object} scene The scene to check.
   * @param {String} moduleName The name of the module that Packed the data.
   * @param {String} tokenFlag The flag that stores token data.
   * @param {String} journalFlag The flag that stores journal pin data.
   * @param {String} macroFlag The flag that stores linkes Macro data.
   * @returns {Boolean}
   */
  static HasPackedData(
    scene,
    moduleName,
    tokenFlag = FLAGS_TOKENS,
    journalFlag = FLAGS_JOURNALS,
    macroFlag = FLAGS_MACROS,
  ) {
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
    {showLinkedJournal: showLinkedJournal = this.allowImportPrompts} = {},
  ) {
    const packedVersion = await scene.getFlag(MODULE_NAME, FLAGS_PACKED_VERSION);
    const sourceModule = await scene.getFlag(MODULE_NAME, FLAGS_SOURCE_MODULE);
    if (packedVersion && isNewerVersion(MINIMUM_SUPPORTED_PACKER_VERSION, packedVersion)) {
      ui.notifications.error(
        game.i18n.format('SCENE-PACKER.errors.version.packed-low', {
          version: packedVersion,
          supportedVersion: MINIMUM_SUPPORTED_PACKER_VERSION,
          sourceModule,
          scene: scene.name,
        }),
      );
      throw game.i18n.format('SCENE-PACKER.errors.version.packed-low', {
        version: packedVersion,
        supportedVersion: MINIMUM_SUPPORTED_PACKER_VERSION,
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
    await this.UnpackScene(scene, {showLinkedJournal});
    await this.ClearPackedData(scene);
    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.notifications.done'),
    );

    let importedVersion = game.settings.get(this.moduleName, 'imported') || '0.0.0';
    let moduleVersion = game.modules.get(this.moduleName)?.data?.version || '0.0.0';
    if (this.welcomeJournal) {
      // Display the welcome journal once per new module version
      const folder = game.folders.find(
        (j) => j.data.type === 'JournalEntry' && j.data.name === this.adventureName,
      );
      const j =
        folder &&
        game.journal.filter(
          (j) => j.data.name === this.welcomeJournal && j.data.folder === folder.id,
        );
      if (j?.length) {
        if (isNewerVersion(moduleVersion, importedVersion)) {
          j[0].sheet.render(true, {sheetMode: 'text'});
        } else {
          this.log(false,
            game.i18n.format('SCENE-PACKER.notifications.already-shown-welcome', {
              journal: j[0]?.name,
              version: moduleVersion,
            }),
          );
        }
      }
    }
    // Set both world and scene imported version flags
    game.settings.set(this.moduleName, 'imported', game.modules.get('scene-packer')?.data?.version || '0.0.0');
    scene.setFlag(this.moduleName, FLAGS_IMPORTED_VERSION, moduleVersion || '0.0.0');

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

      const isDebugging = window.DEV?.getPackageDebugValue(moduleName);

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
   * Ensure that each of the packs are loaded
   * @returns {Promise<void>}
   */
  async loadPacks() {
    for (let packName of [...this.packs.journals, ...this.packs.creatures, ...this.packs.macros]) {
      const pack = game.packs.get(packName);
      if (pack) {
        await pack.getIndex();
      }
    }
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
    await this.loadPacks();

    // Remove the flag that tracks what version of the module imported the Scene, as it doesn't make sense to ship that out in the module.
    await scene.unsetFlag(this.moduleName, FLAGS_IMPORTED_VERSION);

    // Store details about which module and version packed the Scene
    await scene.setFlag(MODULE_NAME, FLAGS_SOURCE_MODULE, this.moduleName);
    await scene.setFlag(MODULE_NAME, FLAGS_PACKED_VERSION, game.modules.get(MODULE_NAME).data.version);


    const sceneJournalInfo = {};
    if (scene.journal) {
      sceneJournalInfo.journalName = scene.journal.name;
      sceneJournalInfo.sourceId = scene.journal.getFlag('core', 'sourceId') || scene.journal.uuid;
      const compendiumJournal = await this.FindJournalInCompendiums(scene.journal, this.packs.journals);
      if (compendiumJournal?.uuid) {
        sceneJournalInfo.compendiumSourceId = compendiumJournal.uuid;
      }
    }
    await scene.setFlag(this.moduleName, FLAGS_SCENE_JOURNAL, sceneJournalInfo);
    await scene.setFlag(this.moduleName, FLAGS_SCENE_POSITION, scene.data?.initial);

    let invalid = false;

    /**
     * journalInfo is the data that gets passed to findMissingJournals
     */

    const journalInfo = await Promise.all(scene.data.notes.map(async note => {
      const journalData = game.journal.get(note.entryId);
      if (!journalData?.name) {
        ui.notifications.warn(
          game.i18n.format(
            'SCENE-PACKER.notifications.pack-scene.no-journal-link-warning',
            {pin: note.text},
          ),
        );
        this.logWarn(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.pack-scene.no-journal-link-log',
            {pin: note.text},
          ),
          note,
        );
        invalid = true;
      }

      const compendiumJournal = await this.FindJournalInCompendiums(journalData, this.packs.journals);

      // Take a copy of the original note without the ids, adding in the sourceId, journal name and folder name it belongs to
      return mergeObject(
        note,
        {
          sourceId: journalData?.getFlag('core', 'sourceId'),
          compendiumSourceId: compendiumJournal?.uuid,
          journalName: journalData?.name,
          folderName: game.folders.get(journalData?.data?.folder)?.data?.name,
          '-=entryId': null,
          '-=_id': null,
        },
        {inplace: false},
      );
    }));

    if (invalid) {
      return Promise.resolve();
    }

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
      await scene.setFlag(this.moduleName, FLAGS_JOURNALS, journalInfo);
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
    const tokenInfo = await Promise.all(scene.data.tokens.map(async token => {
      if (!token.name) {
        ui.notifications.warn(
          game.i18n.localize(
            'SCENE-PACKER.notifications.pack-scene.no-token-name-warning',
          ),
        );
        this.logWarn(
          true,
          game.i18n.localize(
            'SCENE-PACKER.notifications.pack-scene.no-token-name-log',
          ),
          token,
        );
        invalid = true;
      }

      // Pull the sourceId of the actor, preferring the Actor entry in the module's compendium.
      let sourceId = '';
      let compendiumSourceId = '';
      let actorName = token?.name;
      if (typeof token.getFlag === 'function') {
        sourceId = token.getFlag('core', 'sourceId');
      }
      if (token?.actorId) {
        const actor = game.actors.get(token.actorId);
        if (actor) {
          if (!sourceId) {
            sourceId = actor.uuid;
          }
          if (actor.data?.name) {
            actorName = actor.data.name;
          }
          compendiumSourceId = actor.getFlag('core', 'sourceId');
          if (!compendiumSourceId || !compendiumSourceId.startsWith(`Compendium.${this.moduleName}.`)) {
            // The actor source isn't the module's compendium, see if we have a direct match in the module compendium
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
        x: token.x,
        y: token.y,
      };
    }));

    if (invalid) {
      return Promise.resolve();
    }

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
      return scene.setFlag(this.moduleName, FLAGS_TOKENS, tokenInfo);
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

    const sourceId = journal.getFlag('core', 'sourceId');
    if (sourceId && sourceId.startsWith(`Compendium.${this.moduleName}`)) {
      const match = fromUuid(sourceId);
      if (match) {
        return match;
      }
    }

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

      await pack.getIndex();

      const matchingIndexes = pack.index.filter(p => p.name === journal.name);
      for (let i = 0; i < matchingIndexes.length; i++) {
        let id = matchingIndexes[i]?._id;
        const entity = await pack.getEntity(id);
        if (entity) {
          possibleMatches.push(entity);
        }
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

    if (possibleMatches.length === 1) {
      // Only one Journal matches by name
      return possibleMatches.pop();
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

    const sourceId = actor.getFlag('core', 'sourceId');
    if (sourceId && sourceId.startsWith(`Compendium.${this.moduleName}`)) {
      const match = fromUuid(sourceId);
      if (match) {
        return match;
      }
    }

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

      await pack.getIndex();

      const matchingIndexes = pack.index.filter(p => p.name === actor.name);
      for (let i = 0; i < matchingIndexes.length; i++) {
        let id = matchingIndexes[i]?._id;
        const entity = await pack.getEntity(id);
        if (entity) {
          possibleMatches.push(entity);
        }
      }
    }

    if (!possibleMatches.length) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-actor-compendium.no-match',
          {
            actor: actor.name,
          },
        ),
      );
      this.logError(
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

    if (possibleMatches.length === 1) {
      // Only one Actor matches by name
      return possibleMatches.pop();
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
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.find-actor-compendium.no-match',
          {
            actor: actor.name,
          },
        ),
      );
      this.logError(
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
   * Macro that will create a Folder with same name of Compendium,
   * then import entire compendium into created folder
   *
   * Thanks to Atropos for optimizing import
   * modified to filter by provided entity names and if the folder already exists
   * @author Forien#2130
   * @url https://patreon.com/forien
   * @author Atropos
   * @licence MIT
   * @param {String[]} searchPacks The compendium pack names to search within
   * @param {String[]} entityNames The names of the entities to import
   * @param {String} type The type of entity being imported. Used for notification purposes only.
   */
  async ImportByName(searchPacks, entityNames, type) {
    if (entityNames.length === 0) {
      // No missing entities
      return;
    }

    if (!type) {
      type = 'entities';
    }

    if (searchPacks.length === 0) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-by-name.invalid-packs.error',
          {
            type: type,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.localize(
          'SCENE-PACKER.notifications.import-by-name.invalid-packs.short',
        ),
      );
      throw game.i18n.format(
        'SCENE-PACKER.notifications.import-by-name.invalid-packs.error',
        {
          type: type,
        },
      );
    }

    let createData = [];

    const exampleEntity = game.packs.get(searchPacks[0])?.entity;
    if (!exampleEntity) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-by-name.invalid-packs.error',
          {
            type: type,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.localize(
          'SCENE-PACKER.notifications.import-by-name.invalid-packs.details',
        ),
        {searchPacks, entityNames, type},
      );
      throw game.i18n.format(
        'SCENE-PACKER.notifications.import-by-name.invalid-packs.error',
        {
          type: type,
        },
      );
    }
    const entityClass = CONFIG[exampleEntity]?.entityClass;
    if (!entityClass) {
      ui.notifications.error(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-by-name.invalid-packs.error',
          {
            type: type,
          },
        ),
      );
      this.logError(
        true,
        game.i18n.localize(
          'SCENE-PACKER.notifications.import-by-name.invalid-packs.reference',
        ),
        {searchPacks, entityNames, type},
      );
      throw game.i18n.format(
        'SCENE-PACKER.notifications.import-by-name.invalid-packs.error',
        {
          type: type,
        },
      );
    }

    /** search the packs in priority order */
    for (let packName of searchPacks) {
      if (entityNames.length === 0) {
        // No more entities missing
        continue;
      }

      const pack = game.packs.get(packName);
      if (!pack) {
        ui.notifications.error(
          game.i18n.format(
            'SCENE-PACKER.notifications.import-by-name.invalid-packs.missing-pack',
            {
              packName: packName,
            },
          ),
        );
        this.logError(
          true,
          game.i18n.format(
            'SCENE-PACKER.notifications.import-by-name.invalid-packs.missing-pack-details',
            {
              packName: packName,
            },
          ),
        );
        continue;
      }
      const entity = pack.entity;

      const packContent = await pack.getContent();

      // Filter to just the needed actors
      const content = packContent.filter((entity) =>
        entityNames.includes(entity.name),
      );

      // Remove the entries that we found in this pack
      entityNames = entityNames.filter(
        (requestedName) =>
          content.find((entity) => entity.name === requestedName) == null,
      );

      if (content.length > 0) {
        // Check if a folder for our adventure and entity type already exists, otherwise create it
        let folderId = game.folders.find(
          (folder) => folder.name === this.adventureName && folder.type === entity,
        )?._id;
        if (!folderId) {
          const folder = await Folder.create({
            name: this.adventureName,
            type: entity,
            parent: null,
          });
          folderId = folder._id;
        }

        // Append the entities found in this pack to the growing list to import
        createData = createData.concat(
          content.map((c) => {
            c.data['flags.core.sourceId'] = c.uuid;
            c.data.folder = folderId;
            return c.data;
          }),
        );
      }
    }

    if (createData.length > 0) {
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.notifications.import-by-name.creating-data',
          {
            count: createData.length,
            type: type,
          },
        ),
      );
      return entityClass.create(createData);
    }
  }

  /**
   * Find actors bound to the scene that do not exist by name in the world. Does not care what folder they are in.
   * @param {Object[]} tokenInfo data written during PackScene()
   * @see PackScene
   * @private
   * @returns Object[] The unique set of Actors needing to be imported.
   */
  findMissingActors(tokenInfo) {
    if (!tokenInfo?.length) {
      return [];
    }

    // Check for exact matches first
    const exact_matches = [];
    for (let i = 0; i < tokenInfo.length; i++) {
      const token = tokenInfo[i];
      if (!token?.compendiumSourceId) {
        continue;
      }
      const matches = game.actors.entities.filter(a => a.getFlag('core', 'sourceId') === token.compendiumSourceId);
      if (matches.length) {
        exact_matches.push(token);
      }
    }

    if (tokenInfo.length === exact_matches.length) {
      // All tokens exist with a direct match, no missing Actors
      return [];
    }

    // Find the actors that aren't in the exact_matches array and also aren't in the game already by name.
    const missing_actors = tokenInfo.filter(
      (info) => !exact_matches.includes(info) && game.actors.getName(info.actorName) == null,
    );
    const actor_names = missing_actors.map((info) => info.actorName);
    const unique_names = new Set(actor_names);
    return Array.from(unique_names);
  }

  /**
   * Find journal entries bound to the scene that do not exist by name in a Folder with the same name as the adventureName.
   * @param {Object[]} journalInfo data written during PackScene()
   * @see PackScene
   * @private
   * @returns Object[] The list of Journals needing to be imported.
   */
  findMissingJournals(journalInfo) {
    if (!journalInfo?.length) {
      return [];
    }

    // Check for exact matches first
    const exact_matches = [];
    for (let i = 0; i < journalInfo.length; i++) {
      const journal = journalInfo[i];
      if (!journal?.compendiumSourceId) {
        continue;
      }
      const matches = game.journal.entities.filter(a => a.getFlag('core', 'sourceId') === journal.compendiumSourceId);
      if (matches.length) {
        exact_matches.push(journal);
      }
    }

    // Support multiple folder names by compendium names
    const folderNames = [this.adventureName];
    this.packs.journals.forEach(j => {
      const pack = game.packs.get(j);
      if (pack?.metadata?.label) {
        folderNames.push(pack.metadata.label);
      }
    });
    const folder = game.folders.find(
      (j) => j.data.type === 'JournalEntry' && folderNames.includes(j.data.name),
    );
    return journalInfo
      .filter((info) => {
        // Exclude exact matches
        if (exact_matches.includes(info)) {
          return false;
        }
        // Filter for only the entries that are missing, or are in a different folder.
        const j = game.journal.getName(info?.journalName);
        return j == null || (folder && j.data.folder !== folder.id);
      })
      .map((info) => info.journalName);
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
          'SCENE-PACKER.notifications.import-by-name.missing-name',
        ),
      );
      return actor;
    }

    if (folder?.id) {
      actor = game.actors.entities.find(
        (a) => a.data.name === tokenName && a.data.folder === folder.id,
      );
      if (actor) {
        // Found a direct Token <-> Actor name match in the Adventure folder
        return actor;
      }
    }

    actor = game.actors.entities.find((a) => a.data.name === tokenName);
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
    // Check if we have a direct match within the token world data
    if (token?.actorId) {
      const actors = tokenWorldData.filter(t => t.sourceId === `Actor.${token.actorId}`);
      if (actors.length === 1) {
        return actors[0];
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
    let actorRef = tokenWorldData.find(
      (a) => a.x === token.x && a.y === token.y && a.tokenName === token.name,
    );
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
        updates.push({
          _id: t._id,
          actorId: actor.id,
        });
      } else {
        missing.push(t);
      }
    });

    if (missing.length > 0) {
      ui.notifications.error(
        game.i18n.format('SCENE-PACKER.notifications.link-tokens.missing', {
          count: missing.length,
        }),
      );
      this.logError(
        true,
        game.i18n.format('SCENE-PACKER.notifications.link-tokens.missing', {
          count: missing.length,
          adventureName: this.adventureName,
        }),
        missing,
      );
    }

    if (updates.length > 0) {
      ui.notifications.info(
        game.i18n.format('SCENE-PACKER.notifications.link-tokens.linking', {
          count: updates.length,
          adventureName: this.adventureName,
        }),
      );
      return scene.updateEmbeddedEntity('Token', updates);
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
    if (!journalInfo?.length) {
      // Nothing to spawn.
      return Promise.resolve();
    }

    let spawnInfo = journalInfo.map((note) => {
      // Replace icon with a Book if Automatic Journal Icon Numbers isn't installed.
      let icon = note.icon;
      if (
        icon.startsWith('modules/journal-icon-numbers/') &&
        !game.modules.get('journal-icon-numbers')
      ) {
        icon = 'icons/svg/book.svg';
      }

      // Take a copy of the saved note without the meta-data specific to the scene packer
      return mergeObject(
        note,
        {
          icon: icon,
          entryId: game.journal.getName(note.journalName)?.id,
          '-=journalName': null,
          '-=folderName': null,
        },
        {inplace: false},
      );
    });

    const missing = spawnInfo.filter((info) => !info.entryId);
    if (missing.length > 0) {
      ui.notifications.error(
        game.i18n.format('SCENE-PACKER.notifications.spawn-notes.missing', {
          count: missing.length,
        }),
      );
      this.logError(
        true,
        game.i18n.format(
          'SCENE-PACKER.notifications.spawn-notes.missing-details',
          {
            count: missing.length,
          },
        ),
        missing,
      );
    }

    spawnInfo = spawnInfo.filter((info) => !!info.entryId);
    if (spawnInfo.length > 0) {
      ui.notifications.info(
        game.i18n.format('SCENE-PACKER.notifications.spawn-notes.spawning', {
          count: spawnInfo.length,
        }),
      );
      // Cleanup the notes already embedded in the scene to prevent "duplicates".
      await scene.deleteEmbeddedEntity(
        'Note',
        scene.data.notes.map((n) => n._id),
      );
      return scene.createEmbeddedEntity('Note', spawnInfo);
    }
    return Promise.resolve();
  }

  /**
   * Unpack the scene data and reconstruct the appropriate links.
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @param {Boolean} showLinkedJournal Whether to show any Journals linked to the Scene.
   */
  async UnpackScene(scene = game.scenes.get(game.user.viewedScene), {showLinkedJournal = true} = {}) {
    await this.loadPacks();

    const tokenInfo = scene.getFlag(this.moduleName, FLAGS_TOKENS);
    const journalInfo = scene.getFlag(this.moduleName, FLAGS_JOURNALS);
    const sceneJournalInfo = scene.getFlag(this.moduleName, FLAGS_SCENE_JOURNAL);
    const sceneInitialPosition = scene.getFlag(this.moduleName, FLAGS_SCENE_POSITION);
    if (sceneInitialPosition) {
      await scene.update({initial: sceneInitialPosition});
    }

    // Import tokens that don't yet exist in the world
    await this.ImportByName(
      this.packs.creatures,
      this.findMissingActors(tokenInfo),
      'actors',
    );

    // Import Journal Pins
    await this.ImportByName(
      this.packs.journals,
      this.findMissingJournals(journalInfo),
      'journals',
    );

    if (this.welcomeJournal) {
      // Import the "Welcome Journal"
      await this.ImportByName(
        this.packs.journals,
        this.findMissingJournals([this.welcomeJournal].map(d => {
          return {journalName: d};
        })),
        'journals',
      );
    }
    if (this.additionalJournals.length > 0) {
      // Import any additional Journals
      await this.ImportByName(
        this.packs.journals,
        this.findMissingJournals(this.additionalJournals.map(d => {
          return {journalName: d};
        })),
        'journals',
      );
    }

    if (sceneJournalInfo) {
      // Ensure the scene journal is imported
      await this.ImportByName(
        this.packs.journals,
        this.findMissingJournals(sceneJournalInfo),
        'journals',
      );
      if (sceneJournalInfo.sourceId === `JournalEntry.${scene.data.journal}`) {
        // Relink the journal to the correct entry
        const newSceneJournal = game.journal.find(j => j.getFlag('core', 'sourceId') === sceneJournalInfo.compendiumSourceId);
        if (newSceneJournal?.id) {
          await scene.update({journal: newSceneJournal.id});
        }
      }
    }

    // Relink the tokens and spawn the pins
    await this.relinkTokens(scene, tokenInfo);
    await this.spawnNotes(scene, journalInfo);

    // Display the Scene's journal note if it has one
    if (showLinkedJournal && scene.journal) {
      scene.journal.show();
    }

    return Promise.resolve();
  }

  /**
   * ClearPackedData removes the data embedded in the Scene to prevent importing multiple times.
   * @see PackScene
   * @param {Object} scene The scene to clear the packed data from. Defaults to the currently viewed scene.
   */
  async ClearPackedData(scene = game.scenes.get(game.user.viewedScene)) {
    await scene.unsetFlag(this.moduleName, FLAGS_TOKENS);
    await scene.unsetFlag(this.moduleName, FLAGS_JOURNALS);
    await scene.unsetFlag(this.moduleName, FLAGS_SCENE_JOURNAL);
    await scene.unsetFlag(this.moduleName, FLAGS_SCENE_POSITION);
    await scene.unsetFlag(this.moduleName, FLAGS_MACROS);

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
      await game.settings.set('core', Compendium.CONFIG_SETTING, settings);
    }
  }

  /**
   * Updates compendium journals to link to the compendium entries rather than the world references.
   * This method looks up references by Name and will warn you if it doesn't find a match, or finds more than one.
   * Supports relinking:
   *   Actors
   *   JournalEntries
   *   RollTables
   *   Items
   *   Scenes
   *   Macros
   * @param {String} moduleName The name of the module that owns the compendiums to be updated
   * @param {Boolean} dryRun Whether to do a dry-run (no changes committed, just calculations and logs)
   */
  static async RelinkJournalEntries(moduleName, {dryRun = false} = {}) {
    // Get all of the compendium packs that belong to the requested module
    const allPacks = game.packs.filter(
      (p) => p.metadata.package === moduleName,
    );
    for (let i = 0; i < allPacks.length; i++) {
      // Ensure that all of the packs' indexes are loaded
      await allPacks[i].getIndex();
    }
    const packs = {};
    CONST.ENTITY_LINK_TYPES.forEach((type) => {
      packs[`${type}Packs`] = allPacks.filter((p) => p.entity === type);
    });

    // Unlock the module compendiums for editing
    if (!dryRun) {
      await ScenePacker.SetModuleCompendiumLockState(false, moduleName);
    }

    // Matches things like: @Actor[obe2mDyYDXYmxHJb]{
    const rex = /@(\w+)\[(\w+)\]\{/g;

    // Check each of the JournalEntry compendium packs in the requested module
    for (let i = 0; i < packs.JournalEntryPacks.length; i++) {
      const pack = packs.JournalEntryPacks[i];
      ui.notifications.info(
        game.i18n.format(
          'SCENE-PACKER.world-conversion.compendiums.checking-and-updating',
          {
            count: pack.index.length,
          },
        ),
      );
      // Check each of the Journals in the pack
      for (let j = 0; j < pack.index.length; j++) {
        const references = new Set();
        const entry = pack.index[j];
        const journal = await pack.getEntity(entry._id);
        if (!journal?.data?.content) {
          continue;
        }
        ScenePacker.logType(
          moduleName,
          'info',
          dryRun, // Force a log if operating in dry-run mode
          game.i18n.format(
            'SCENE-PACKER.world-conversion.compendiums.checking-journal',
            {
              journal: journal.name,
              entryId: entry._id,
            },
          ),
        );
        const links = [...journal.data.content.matchAll(rex)];
        for (let k = 0; k < links.length; k++) {
          const link = links[k];
          const type = link[1];
          const oldRef = link[2];
          let newRef = [];
          // Need to look up the in world reference to find the new compendium reference by name
          let name = null;
          switch (type) {
            case 'Actor':
              name = game.actors.get(oldRef)?.name;
              break;
            case 'JournalEntry':
              name = game.journal.get(oldRef)?.name;
              break;
            case 'RollTable':
              name = game.tables.get(oldRef)?.name;
              break;
            case 'Item':
              name = game.items.get(oldRef)?.name;
              break;
            case 'Scene':
              name = game.scenes.get(oldRef)?.name;
              break;
            case 'Macro':
              name = game.macros.get(oldRef)?.name;
              break;
            default:
              ui.notifications.error(
                game.i18n.format(
                  'SCENE-PACKER.world-conversion.compendiums.invalid-ref-type',
                  {
                    type: type,
                  },
                ),
              );
              continue;
          }
          if (!name) {
            ui.notifications.error(
              game.i18n.localize(
                'SCENE-PACKER.world-conversion.compendiums.invalid-no-matching-name',
              ),
            );
            ScenePacker.logType(
              moduleName,
              'error',
              true,
              journal.name,
              game.i18n.localize(
                'SCENE-PACKER.world-conversion.compendiums.invalid-no-matching-name',
              ),
              type,
              entry,
              oldRef,
            );
            continue;
          }
          // Build the links to the new references that exist within the compendium/s
          packs[`${type}Packs`].forEach((p) => {
            let found = p.index.find((e) => e.name === name);
            if (found) {
              newRef.push({pack: p.collection, ref: found._id});
            }
          });

          if (!newRef.length) {
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
          } else if (newRef.length > 1) {
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
              newRef,
            );
          }

          references.add({
            type: type,
            oldRef: oldRef,
            newRef: newRef,
            pack: pack.collection,
            journalEntryId: entry._id,
          });
        }

        if (references.size) {
          ScenePacker.logType(
            moduleName,
            'info',
            dryRun, // Force a log if operating in dry-run mode
            game.i18n.format(
              'SCENE-PACKER.world-conversion.compendiums.updating-journal-references',
              {
                count: references.size,
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
              dryRun, // Force a log if operating in dry-run mode
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
                count: references.size,
                journal: journal.name,
              },
            ),
          );

          // Update the journal entry with the fully replaced content
          if (!dryRun) {
            await pack.updateEntity({_id: entry._id, content: newContent});
          }
        } else {
          ScenePacker.logType(
            moduleName,
            'info',
            dryRun, // Force a log if operating in dry-run mode
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
          dryRun, // Force a log if operating in dry-run mode
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
   * Shows a dialog window to choose which module to relink journal entries for.
   * @see RelinkJournalEntries
   */
  static async PromptRelinkJournalEntries() {
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
    return new Promise((resolve, reject) => {
      const modulesRegistered = Object.keys(globalScenePacker.instances);
      if (!modulesRegistered.length) {
        ScenePacker.logType(
          MODULE_NAME,
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
    if (!scene) {
      return null;
    }
    const moduleName = scene.getFlag(MODULE_NAME, FLAGS_SOURCE_MODULE);
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

Hooks.once('setup', () => {
  if (typeof window.DEV?.registerPackageDebugFlag === 'function') {
    window.DEV.registerPackageDebugFlag(MODULE_NAME);
  }

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
                game.settings.get(MODULE_NAME, 'enableContextMenu');
            }
            return true;
          },
          callback: (li) => {
            let scene = game.scenes.get(li.data('entityId'));
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              return instance.PackScene(scene);
            }

            // No existing instance bound to the Scene, ask which should be used to pack against.
            ScenePacker.PromptForInstance().then(instance => instance.PackScene(scene));
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
              game.settings.get(MODULE_NAME, 'enableContextMenu');
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
              game.settings.get(MODULE_NAME, 'enableContextMenu');
          },
          callback: (li) => {
            let scene = game.scenes.get(li.data('entityId'));
            let instance = ScenePacker.GetInstanceForScene(scene);
            if (instance) {
              instance.ClearPackedData(scene);
            }
          },
        },
      );
    }
  });

  Hooks.on('canvasReady', async (readyCanvas) => {
    const instance = ScenePacker.GetInstanceForScene(readyCanvas.scene);
    if (!instance) {
      // No instance for the requested module
      return;
    }
    await instance.ProcessScene(readyCanvas.scene);
  });

  game.settings.register(MODULE_NAME, 'enableContextMenu', {
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
window[MODULE_NAME] = {
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
        ScenePacker.logType(MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.GetInstance;
      case 'relinkJournalEntries':
        ScenePacker.logType(MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.RelinkJournalEntries;
      case 'hasPackedData':
        ScenePacker.logType(MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.HasPackedData;
      case 'promptRelinkJournalEntries':
        ScenePacker.logType(MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
        return ScenePacker.PromptRelinkJournalEntries;
      case 'showPerformanceReport':
        ScenePacker.logType(MODULE_NAME, 'warn', true, game.i18n.format('SCENE-PACKER.deprecated.method', {method: prop}));
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
  Hooks.callAll('scenePackerReady', globalThis.ScenePacker);
});

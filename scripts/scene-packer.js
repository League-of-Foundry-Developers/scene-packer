/**
 * You can use this ScenePacker to "fix" Actors and Journal Pins on a Scene. You should only need to
 * change these first few constants in this file.
 *
 * This code supports relinking Actor Tokens, even if their token name doesn't match the Actor.
 *
 * To use:
 *
 * Create your module as normal, linking Journals/Actors/Items to their Compendium versions.
 * Create the Scene as normal, placing Actors and Journal Pins.
 * Run the following command in your browser console: await ScenePacker.PackScene();
 *   This will write data for Journal Note Pins and Actor Tokens to the scene.
 * Add the Scene to your Compendium.
 * Run the following command in your browser console: await ScenePacker.ClearPackedData();
 *   If you forget to do this, the next time you activate your Scene, you will create Journal Pins and
 *   Actor Tokens on top of your existing ones, effectively duplicating them. You'll have to clean up manually.
 */
export default class ScenePacker {
  adventureName = null;
  moduleName = null;
  compendiumSceneName = null;
  welcomeJournal = null;
  additionalJournals = [];
  packs = {
    creatures: [],
    journals: [],
  };
  journalFlag = 'aiJournals';
  tokenFlag = 'aiTokens';

  /**
   * @param {string} adventureName The human readable name of the adventure.
   * @param {string} moduleName The name of the module this is part of.
   */
  constructor(adventureName, moduleName) {
    const instance = this.constructor.instance;
    if (instance) {
      return instance;
    }

    this.constructor.instance = this;
    this.SetAdventureName(adventureName);
    this.SetModuleName(moduleName);

    if (moduleName) {
      Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
        registerPackageDebugFlag(this.moduleName);
      });

      Hooks.on('init', () => {
        game.settings.register(this.moduleName, 'imported', {
          scope: 'world',
          config: false,
          type: Boolean,
          default: false,
        });

        game.settings.register(this.moduleName, 'enableContextMenu', {
          name: 'Enable Scene Packer context menu',
          hint:
            'Adds context menu items to assist with packing a Scene. You should only need to enable this while actively developing and packing a module with scenes.',
          scope: 'client',
          config: true,
          type: Boolean,
          default: false,
        });

        game.settings.register(this.moduleName, 'showCompendiumInfo', {
          name: 'Show the dialog information when opening a compendium',
          scope: 'client',
          type: Boolean,
          default: true,
        });
      });

      Hooks.on('canvasReady', async (readyCanvas) => {
        if (readyCanvas.scene.getFlag(this.moduleName, this.tokenFlag)) {
          ui.notifications.info(
            'First launch of this adventure! Unpacking scene...'
          );
          await this.UnpackScene(readyCanvas.scene);
          await this.ClearPackedData(readyCanvas.scene);
          ui.notifications.info('All done!');
          game.settings.set(this.moduleName, 'imported', true);

          if (this.welcomeJournal) {
            // Display the welcome journal
            const folder = game.folders.find(
              (j) =>
                j.data.type === 'JournalEntry' &&
                j.data.name === this.adventureName
            );
            const j =
              folder &&
              game.journal.filter(
                (j) =>
                  j.data.name === this.welcomeJournal &&
                  j.data.folder === folder.id
              );
            if (j.length > 0) {
              j[0].sheet.render(true, { sheetMode: 'text' });
            }
          }
        }
      });

      Hooks.on('renderCompendium', (app, html, data) => {
        if (
          data.collection.startsWith(`${this.moduleName}.`) &&
          !game.settings.get(this.moduleName, 'imported') &&
          game.settings.get(this.moduleName, 'showCompendiumInfo')
        ) {
          let content = `<p><strong>${this.adventureName}</strong></p>`;

          if (
            this.compendiumSceneName &&
            data.collection.endsWith(`.${this.compendiumSceneName}`)
          ) {
            content +=
              '<p>Please <strong>view each scene</strong> after importing to allow the module to correctly relink Journal Pins and Actors.</p>';
          } else {
            content +=
              '<p>To import this adventure correctly, please <strong>import just the scenes</strong> first and then view each one. This will allow the module to correctly relink Journal Pins and Actors.</p>';
          }

          let d = new Dialog({
            title: `${this.adventureName} Importer`,
            content: content,
            buttons: {
              ok: {
                icon: '<i class="fas fa-check"></i>',
                label: 'Ok',
              },
              noShow: {
                icon: '<i class="fas fa-times"></i>',
                label: "Don't show me again",
                callback: () =>
                  game.settings.set(
                    this.moduleName,
                    'showCompendiumInfo',
                    false
                  ),
              },
            },
          });
          d.render(true);
        }
      });

      Hooks.on('getSceneDirectoryEntryContext', function (app, html, data) {
        if (game.user.isGM) {
          html.push(
            {
              name: 'Pack Scene Data',
              icon: '<i class="fas fa-scroll"></i>',
              condition: () =>
                game.user.isGM &&
                game.settings.get(
                  ScenePacker.GetInstance().GetModuleName(),
                  'enableContextMenu'
                ),
              callback: (li) => {
                let scene = game.scenes.get(li.data('entityId'));
                ScenePacker.GetInstance().PackScene(scene);
              },
            },
            {
              name: 'Clear Packed Scene Data',
              icon: '<i class="fas fa-scroll"></i>',
              condition: () =>
                game.user.isGM &&
                game.settings.get(
                  ScenePacker.GetInstance().GetModuleName(),
                  'enableContextMenu'
                ),
              callback: (li) => {
                let scene = game.scenes.get(li.data('entityId'));
                ScenePacker.GetInstance().ClearPackedData(scene);
              },
            }
          );
        }
      });
    }
  }

  /**
   * Get the singleton instance of Scenepacker
   * @param  {...any} args
   * @returns The singleton instance
   */
  static GetInstance(...args) {
    return new ScenePacker(...args);
  }

  /**
   * Log a message to console of the requested type if dev mode is enabled.
   * @param {boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  logType(type, force, ...args) {
    try {
      if (typeof force !== 'boolean') {
        console.warn(
          `${this.moduleName} | Invalid log usage. Expected "log(force, ...args)" as boolean but got`,
          force
        );
      }

      const isDebugging = window.DEV?.getPackageDebugValue(this.moduleName);

      if (force || isDebugging) {
        switch (type) {
          case 'error':
            console.error(this.moduleName, '|', ...args);
            break;
          case 'warn':
            console.warn(this.moduleName, '|', ...args);
            break;
          default:
            console.log(this.moduleName, '|', ...args);
        }
      }
    } catch (e) {}
  }

  /**
   * Log a message to console if dev mode is enabled.
   * @param {boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  log(force, ...args) {
    this.logType('info', force, ...args);
  }

  /**
   * Log a warning message to console if dev mode is enabled.
   * @param {boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  logWarn(force, ...args) {
    this.logType('warn', force, ...args);
  }

  /**
   * Log an error message to console if dev mode is enabled.
   * @param {boolean} force if true, always log regardless of dev mode settings
   * @param  {...any} args the arguments to log
   */
  logError(force, ...args) {
    this.logType('error', force, ...args);
  }

  /**
   * Set the human readable name of the adventure. This will populate folder names etc.
   * @param {string} adventureName
   * @returns this to support chaining
   */
  SetAdventureName(adventureName) {
    if (!adventureName) {
      ui.notifications.error(
        'Invalid call to SetAdventureName(). See console for details.'
      );
      throw 'Invalid module name passed to "SetAdventureName()". This must be the name of the adventure as defined in module.json under the "title" field.';
    }
    this.adventureName = adventureName;
    return this;
  }

  /**
   * Set the module name of the module the ScenePacker is being used in.
   * @param {string} moduleName
   * @returns this to support chaining
   */
  SetModuleName(moduleName) {
    if (!moduleName) {
      ui.notifications.error(
        'Invalid call to SetModuleName(). See console for details.'
      );
      throw 'Invalid module name passed to "SetModuleName()". This must be the name of the module as defined in module.json under the "name" field.';
    }
    this.moduleName = moduleName;
    return this;
  }

  /**
   * Gets the module name this Scene Packer was set up with.
   * @returns string
   */
  GetModuleName() {
    return this.moduleName;
  }

  /**
   * Set the compendium name holding the scenes in this module.
   * @param {string} compendiumSceneName
   * @returns this to support chaining
   */
  SetCompendiumSceneName(compendiumSceneName) {
    this.compendiumSceneName = compendiumSceneName;
    return this;
  }

  /**
   * Set the name of the journal to be imported and automatically opened after activation.
   * @param {string} journal
   * @returns this to support chaining
   */
  SetWelcomeJournal(journal) {
    if (journal) {
      if (typeof journal !== 'string') {
        ui.notifications.error(
          'Invalid call to SetWelcomeJournal(). See console for details.'
        );
        throw 'Invalid journal name passed to "SetWelcomeJournal()". This must be the name of a journal in the module compendium.';
      }
    } else {
      this.logWarn(
        false,
        'SetWelcomeJournal() called with no value. This disables importing a welcome journal. No journal will automatically be opened.'
      );
    }

    this.welcomeJournal = journal;
    return this;
  }

  /**
   * Set which journals (by name) should be automatically imported.
   * @param {Array<string>} journals
   * @returns this to support chaining
   */
  SetAdditionalJournalsToImport(journals) {
    if (journals) {
      journals = journals instanceof Array ? journals : [journals];
      journals.forEach((j) => {
        if (typeof j !== 'string') {
          throw `You must pass an array of strings to SetAdditionalJournalsToImport(). They must be the names of journals. Received: ${j}`;
        }
      });
    } else {
      this.logWarn(
        false,
        'SetAdditionalJournalsToImport() called with no value. This disables importing of additional journals. Only those journals linked to the scene by a map pin will be imported.'
      );
    }

    this.additionalJournals = journals;
    return this;
  }

  /**
   * Set which Actor packs should be used when searching for Actors.
   * @param {Array<string>} packs
   * @returns this to support chaining
   */
  SetCreaturePacks(packs) {
    if (packs) {
      packs = packs instanceof Array ? packs : [packs];
      packs.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            'Invalid call to SetCreaturePacks(). See console for details.'
          );
          throw `You must pass an array of strings to SetCreaturePacks(). They must be the names of Actor packs. Received: ${j}`;
        }
      });
    } else {
      this.logWarn(
        false,
        'SetCreatePacks() called with no value. This disables importing of Actors.'
      );
    }

    this.packs.creatures = packs;
    return this;
  }

  /**
   * Set which Journal packs should be used when searching for Journals.
   * @param {Array<string>} packs
   * @returns this to support chaining
   */
  SetJournalPacks(packs) {
    if (packs) {
      packs = packs instanceof Array ? packs : [packs];
      packs.forEach((j) => {
        if (typeof j !== 'string') {
          ui.notifications.error(
            'Invalid call to SetJournalPacks(). See console for details.'
          );
          throw `You must pass an array of strings to SetJournalPacks(). They must be the names of Journal packs. Received: ${j}`;
        }
      });
    } else {
      this.logWarn(
        false,
        'SetJournalPacks() called with no value. This disables importing of Journals.'
      );
    }

    this.packs.journals = packs;
    return this;
  }

  /**
   * PackScene() will write the following information to the Scene data for later retrieval:
   *   Journal Note Pins
   *   Actor Tokens
   * @returns Promise
   */
  async PackScene(scene = game.scenes.get(game.user.viewedScene)) {
    ui.notifications.warn(
      "Don't forget to run ScenePacker.ClearPackedData() after exporting to prevent future duplicates."
    );

    /**
     * journalInfo is the data that gets passed to findMissingJournals
     */
    const journalInfo = scene.data.notes.map((note) => {
      const journalData = game.journal.get(note.entryId);
      // Take a copy of the original note without the ids, adding in the journal name and folder name it belongs to
      return mergeObject(
        note,
        {
          journalName: journalData.data.name,
          folderName: game.folders.get(journalData.data.folder)?.data?.name,
          '-=entryId': null,
          '-=_id': null,
        },
        { inplace: false }
      );
    });

    if (journalInfo.length > 0) {
      ui.notifications.info(
        `Writing ${journalInfo.length} journals to scene: ${scene.name}`
      );
      await scene.setFlag(this.moduleName, this.journalFlag, journalInfo);
    } else {
      ui.notifications.info('No journal pins detected on the scene.');
    }

    /**
     * tokenInfo is the data that gets passed to findMissingTokens
     */
    const tokenInfo = scene.data.tokens.map((token) => {
      if (!token.name) {
        ui.notifications.warn(
          'Cannot pack a token that has no name. Check console for details.'
        );
        this.logWarn(
          true,
          'Trying to pack a token that has no name is not going to end well. Please ensure the Token and Actor have a name.',
          token
        );
      }
      let actorName = token.name;
      if (token.actorId) {
        const actor = game.actors.get(token.actorId);
        if (actor?.data?.name) {
          actorName = actor.data.name;
        }
      }
      return {
        tokenName: token.name,
        actorName: actorName,
        x: token.x,
        y: token.y,
      };
    });

    if (tokenInfo.length > 0) {
      ui.notifications.info(
        `Writing ${tokenInfo.length} tokens to scene: ${scene.name}`
      );
      return scene.setFlag(this.moduleName, this.tokenFlag, tokenInfo);
    } else {
      ui.notifications.info('No tokens detected on the scene.');
    }

    return Promise.resolve();
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
   * @param {Array<string>} searchPacks The compendium pack names to search within
   * @param {Array<string>} entityNames The names of the entities to import
   * @param {string} type The type of entity being imported. Used for notification purposes only.
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
        `Invalid pack configuration. Cannot import ${type}. Check console for more details.`
      );
      this.logError(
        true,
        `ImportByName was called with no searchPacks defined`
      );
      throw `Invalid pack configuration. Cannot import ${type}.`;
    }

    let createData = [];

    const exampleEntity = game.packs.get(searchPacks[0])?.entity;
    if (!exampleEntity) {
      ui.notifications.error(
        `Invalid pack configuration. Cannot import ${type}. Check console for more details.`
      );
      this.logError(
        true,
        `ImportByName was called with no valid searchPacks defined. Received the following call details:`,
        { searchPacks, entityNames, type }
      );
      throw `Invalid pack configuration. Cannot import ${type}.`;
    }
    const entityClass = CONFIG[exampleEntity]?.entityClass;
    if (!entityClass) {
      ui.notifications.error(
        `Invalid pack configuration. Cannot import ${type}. Check console for more details.`
      );
      this.logError(
        true,
        `ImportByName was called with a reference that is not registered with Foundry. Received the following call details:`,
        { searchPacks, entityNames, type }
      );
      throw `Invalid pack configuration. Cannot import ${type}.`;
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
          `Invalid pack configuration. Cannot find compendium ${packName}. Check console for more details.`
        );
        this.logError(
          true,
          `ImportByName was called to search for pack "${packName}" which is not found. Check for typos in your module setup.`
        );
        continue;
      }
      const entity = pack.entity;

      const packContent = await pack.getContent();

      // Filter to just the needed actors
      const content = packContent.filter((entity) =>
        entityNames.includes(entity.name)
      );

      // Remove the entries that we found in this pack
      entityNames = entityNames.filter(
        (requestedName) =>
          content.find((entity) => entity.name === requestedName) == null
      );

      if (content.length > 0) {
        // Check if a folder for our adventure and entity type already exists, otherwise create it
        let folderId = game.folders.find(
          (folder) => folder.name == this.adventureName && folder.type == entity
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
            c.data.folder = folderId;
            return c.data;
          })
        );
      }
    }

    if (createData.length > 0) {
      ui.notifications.info(`Importing ${createData.length} new ${type}.`);
      return entityClass.create(createData);
    }

    return;
  }

  /**
   * Find actors bound to the scene that do not exist by name in the world. Does not care what folder they are in.
   * @param {Array<Object>} tokenInfo data written during PackScene()
   * @see PackScene
   * @private
   * @returns Array<Object> The unique set of Actors needing to be imported.
   */
  findMissingActors(tokenInfo) {
    const missing_actors = tokenInfo.filter(
      (info) => game.actors.getName(info.actorName) == null
    );
    const actor_names = missing_actors.map((info) => info.actorName);
    const unique_names = new Set(actor_names);
    const actors_to_import = Array.from(unique_names);
    return actors_to_import;
  }

  /**
   * Find journal entries bound to the scene that do not exist by name in a Folder with the same name as the adventureName.
   * @param {Array<Object>} journalInfo data written during PackScene()
   * @see PackScene
   * @private
   * @returns Array<Object> The list of Journals needing to be imported.
   */
  findMissingJournals(journalInfo) {
    const folder = game.folders.find(
      (j) =>
        j.data.type === 'JournalEntry' && j.data.name === this.adventureName
    );
    const missing_journals = journalInfo
      .filter((info) => {
        // Filter for only the entries that are missing, or are in a different folder.
        const j = game.journal.getName(info.journalName);
        return j == null || j.data.folder !== folder.id;
      })
      .map((info) => info.journalName);
    return missing_journals;
  }

  /**
   * Search for an actor with the requested token name, prioritising the requested folder if possible.
   * @param {string} tokenName the name of the token being searched for
   * @param {Object} folder the game.folders entity to prioritise the search to
   * @private
   * @returns {Object|null}
   */
  findActorForTokenName(tokenName, folder) {
    let actor = null;
    if (!tokenName) {
      this.logWarn(false, 'Tried to find an actor for a token with no name');
      return actor;
    }

    if (folder && folder.id) {
      actor = game.actors.entities.find(
        (a) => a.data.name === tokenName && a.data.folder === folder.id
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
    if (!token?.name) {
      ui.notifications.warn(
        'Cannot find a token that has no name. Check console for details.'
      );
      this.logWarn(
        true,
        'Trying to find a token that has no name is not going to end well. Please ensure the Token and Actor have a name prior to packing.',
        token
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
      (a) => a.x == token.x && a.y == token.y && a.tokenName == token.name
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
   * @param {Array<Object>} journalInfo data written during PackScene()
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @see PackScene
   */
  async relinkTokens(scene, tokenInfo) {
    if (tokenInfo.length === 0) {
      // Nothing to relink.
      return Promise.resolve();
    }

    const folder = game.folders.find(
      (j) => j.data.type === 'Actor' && j.data.name === this.adventureName
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
        `Could not find ${missing.length} actors to link, they will remain unlinked. Check console for details.`
      );
      this.logError(
        true,
        `${this.moduleName} | Could not find ${missing.length} actors to link. The following actor tokens were not found in the "${this.adventureName}" folder.`,
        missing
      );
    }

    if (updates.length > 0) {
      ui.notifications.info(
        `Relinking ${updates.length} Tokens linked to actors.`
      );
      return scene.updateEmbeddedEntity('Token', updates);
    }

    return Promise.resolve();
  }

  /**
   * Spawns Journal Note Pins with the requested details.
   * @param {Array<Object>} journalInfo data written during PackScene()
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   * @see PackScene
   */
  async spawnNotes(scene, journalInfo) {
    if (journalInfo.length === 0) {
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
          entryId: game.journal.getName(note.journalName)?.id,
          '-=journalName': null,
          '-=folderName': null,
        },
        { inplace: false }
      );
    });

    const missing = spawnInfo.filter((info) => !info.entryId);
    if (missing.length > 0) {
      ui.notifications.error(
        `Could not find ${missing.length} journals to link. Check console for details.`
      );
      this.logError(
        true,
        `${this.moduleName} | Could not find ${missing.length} notes to spawn. The following journals were not found.`,
        missing
      );
    }

    spawnInfo = spawnInfo.filter((info) => !!info.entryId);
    if (spawnInfo.length > 0) {
      ui.notifications.info(`Spawning ${spawnInfo.length} journal notes.`);
      // Cleanup the notes already embedded in the scene to prevent "duplicates".
      await scene.deleteEmbeddedEntity(
        'Note',
        scene.data.notes.map((n) => n._id)
      );
      return scene.createEmbeddedEntity('Note', spawnInfo);
    }
    return Promise.resolve();
  }

  /**
   * Unpack the scene data and reconstruct the appropriate links.
   * @param {Object} scene The scene to unpack. Defaults to the currently viewed scene.
   */
  async UnpackScene(scene = game.scenes.get(game.user.viewedScene)) {
    const tokenInfo = scene.getFlag(this.moduleName, this.tokenFlag);
    const journalInfo = scene.getFlag(this.moduleName, this.journalFlag);
    if (!tokenInfo && !journalInfo) {
      ui.notifications.info('No items to configure. All done!');
      return;
    }

    // Import tokens that don't yet exist in the world
    await this.ImportByName(
      this.packs.creatures,
      this.findMissingActors(tokenInfo),
      'actors'
    );

    // Import Journal Pins
    await this.ImportByName(
      this.packs.journals,
      this.findMissingJournals(journalInfo),
      'journals'
    );

    if (this.welcomeJournal) {
      // Import the "Welcome Journal"
      await this.ImportByName(
        this.packs.journals,
        [this.welcomeJournal],
        'journals'
      );
    }
    if (this.additionalJournals.length > 0) {
      // Import any additional Journals
      await this.ImportByName(
        this.packs.journals,
        this.additionalJournals,
        'journals'
      );
    }

    // Relink the tokens and spawn the pins
    await this.relinkTokens(scene, tokenInfo);
    return this.spawnNotes(scene, journalInfo);
  }

  /**
   * ClearPackedData removes the data embedded in the Scene to prevent importing multiple times.
   * @see PackScene
   * @param {Object} scene The scene to clear the packed data from. Defaults to the currently viewed scene.
   */
  async ClearPackedData(scene = game.scenes.get(game.user.viewedScene)) {
    await scene.unsetFlag(this.moduleName, this.tokenFlag);
    await scene.unsetFlag(this.moduleName, this.journalFlag);
    ui.notifications.info('Finished clearing Packed Data.');
    return Promise.resolve();
  }
}

window['scene-packer'] = {
  getInstance: ScenePacker.GetInstance,
};

Hooks.callAll('scenePackerReady', window['scene-packer']);

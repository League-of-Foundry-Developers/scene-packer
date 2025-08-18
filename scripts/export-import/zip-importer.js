import mime from '../lib/mime/dist/src/index.js';
import * as fflate from '../lib/fflate/fflate.js';
import { CONSTANTS } from '../constants.js';
import MoulinetteImporter from './moulinette-importer.js';
import { ReplaceCompendiumReferences } from './converter.js';
import { UnrelatedData } from './related/unrelated-data.js';
import { GetBaseURL, UploadFile } from '../assets/file.js';

export default class ZipImporter extends FormApplication {
  constructor(object, options) {
    super(object, options);

    /**
     * The decompressed Zip file.
     * @type {Object}
     */
    this.decompressed = {};

    /**
     * Summary data for the package.
     * @type {ExporterData|Object|null}
     */
    this.scenePackerInfo = null;
    this.isCorrectSystem = true;
    /**
     * Placeholder actor used for importing scenes into the wrong type of system.
     * @type {Actor|null}
     */
    this.placeholderActor = null;
    this.folderData = {};

    this.filename = '';
    this.processing = false;
    this.processingMessage = '';
    this.progressPercent = 0;
    this.showProgress = false;
  }

  /**
   * Reference to the progress bar displayed in the UI.
   * @type Notification
   */
  static #progressBar;

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.zip-importer.name'),
      id: 'scene-packer-zip-importer',
      template: 'modules/scene-packer/templates/export-import/zip-importer.hbs',
      width: 700,
      height: 'auto',
      closeOnSubmit: false,
      classes: ['scene-packer'],
    });
  }

  /**
   * @returns {Object|Promise<Object>}
   */
  getData(options = {}) {
    return {
      filename: this.filename,
      processing: this.processing,
      processingMessage: this.processingMessage,
      progressPercent: this.progressPercent,
      showProgress: this.showProgress,
    };
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if (!formData['zip-file']) {
      return false;
    }

    const filesData = $(event.currentTarget)
      .find('input#zip-file')
      .prop('files');
    if (!filesData?.length) {
      return false;
    }

    const file = filesData[0];
    this.filename = file.name;
    ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Loading ${this.filename} (${Math.ceil((file.size / 1024 / 1024) * 100) / 100}MB)`);

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.processing')}</p>`,
      processing: true,
    });

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.be-patient')}</p>`,
      processing: true,
    });

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.process-fetch-data')}</p>`,
    });

    let didError = false;
    const fileReads = [];
    this.decompressed = {};
    let totalFiles = 0;
    let processedFiles = 0;
    const unzipper = new fflate.Unzip();
    unzipper.register(fflate.AsyncUnzipInflate);
    unzipper.onfile = file => {
      totalFiles++;
      let onComplete;
      let onErr;
      let fileData = [];
      file.ondata = async (err, dat, final) => {
        if (err) {
          ScenePacker.logType(
            CONSTANTS.MODULE_NAME,
            'error',
            true,
            game.i18n.format('SCENE-PACKER.zip-importer.error-unzip', { name: file.name }),
            err,
          );
          ui.notifications.error(
            game.i18n.format('SCENE-PACKER.zip-importer.error-unzip', { name: file.name }),
            { permanent: true },
          );
          this.updateProcessStatus({
            message: `<p class="error">${game.i18n.format('SCENE-PACKER.zip-importer.error-unzip', { name: file.name })}</p>`,
          });
          didError = true;
          onErr(err);

          return;
        }
        fileData.push(dat);
        if (final) {
          const completeData = new Uint8Array(fileData.reduce((
            acc,
            chunk
          ) => acc + chunk.length, 0));
          let offset = 0;
          fileData.forEach(chunk => {
            completeData.set(chunk, offset);
            offset += chunk.length;
          });
          this.decompressed[file.name] = completeData;
          onComplete();

          processedFiles++;
        }
      }
      // Track each file to be unzipped as a separate promise, to allow us to
      // fully process the zip file.
      fileReads.push(new Promise((resolve, reject) => { onComplete = resolve; onErr = reject; }));
      file.start();
    }

    try {
      const fileStream = file.stream();
      const reader = fileStream.getReader();
      while (true) {
        const {
          value,
          done
        } = await reader.read();
        if (done) {
          // The full zip file has been read and pushed to the unzipper
          unzipper.push(new Uint8Array(0), true);
          break;
        }
        unzipper.push(value);
      }
    } catch (err) {
      ScenePacker.logType(
        CONSTANTS.MODULE_NAME,
        'error',
        true,
        game.i18n.format('SCENE-PACKER.zip-importer.error-read', { name: file.name }),
        err,
      );
      ui.notifications.error(
        game.i18n.format('SCENE-PACKER.zip-importer.error-read', { name: file.name }),
        { permanent: true },
      );
      this.updateProcessStatus({
        message: `<p class="error">${game.i18n.format('SCENE-PACKER.zip-importer.error-read', { name: file.name })}</p>`,
      });
    }

    // Wait for all the files to finish unzipping
    await Promise.all(fileReads);
    console.log('decompressed', this.decompressed);
    if (!this.decompressed || didError) {
      return false;
    }

    this.scenePackerInfo = this.getDataFromZip(Object.keys(this.decompressed)
      .filter(f => !f.startsWith('data') && f.endsWith('.json'))[0]);
    console.log('scenePackerInfo', this.scenePackerInfo); // TODO Delete this line
    this.isCorrectSystem = this.scenePackerInfo?.system === game.system.id;
    const unrelatedData = this.getDataFromZip('data/unrelated-data.json');
    const assetData = this.getDataFromZip('data/assets.json');
    this.folderData = this.getDataFromZip('data/folders.json');
    /**
     * Track which assets have been imported
     * @type {Map<string, boolean>}
     */
    const assetMap = new Map();

    if (!this.isCorrectSystem) {
      let proceed;
      if (foundry?.applications?.api?.DialogV2?.confirm) {
        proceed = await foundry.applications.api.DialogV2.confirm({
          content: game.i18n.format(
            'SCENE-PACKER.importer.incorrect-system',
            {
              currentSystem: game.system.id,
              packSystem: this.scenePackerInfo?.system || 'unknown',
            }
          ),
          window: {
            title: game.i18n.localize('SCENE-PACKER.importer.name'),
          },
          rejectClose: true,
          modal: true,
          yes: {
            default: true,
          }
        });
      } else {
        proceed = await Dialog.confirm({
          title: game.i18n.localize('SCENE-PACKER.importer.name'),
          content: game.i18n.localize('SCENE-PACKER.importer.incorrect-system'),
        });
      }

      if (!proceed) {
        return false;
      }
    }

    const sceneData = this.missingDataOnly(this.getDataFromZip('data/Scene.json'), game.scenes);
    const actorData = this.missingDataOnly(this.getDataFromZip('data/Actor.json'), game.actors);
    const journalData = this.missingDataOnly(this.getDataFromZip('data/JournalEntry.json'), game.journal);
    const itemData = this.missingDataOnly(this.getDataFromZip('data/Item.json'), game.items);
    const macroData = this.missingDataOnly(this.getDataFromZip('data/Macro.json'), game.macros);
    const playlistData = this.missingDataOnly(this.getDataFromZip('data/Playlist.json'), game.playlists);
    const rollTableData = this.missingDataOnly(this.getDataFromZip('data/RollTable.json'), game.tables);
    const cardData = this.missingDataOnly(this.getDataFromZip('data/Cards.json') || [], game.cards);

    const availableDocuments = {
      actors: actorData,
      journals: journalData,
      scenes: sceneData,
      items: itemData,
      macros: macroData,
      playlists: playlistData,
      rollTables: rollTableData,
      cards: cardData,
    };

    await this.updateProcessStatus({
      message: `<hr>`,
    });

    if (sceneData.length) {
      ScenePacker.logType(
        CONSTANTS.MODULE_NAME,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: sceneData.length,
          type: Scene.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: Scene.collectionName,
          count: sceneData.length,
        })}</p>`,
      });
      const documents = await this.ensureAssets(sceneData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      if (CONSTANTS.IsV10orNewer()) {
        // Loop through the scenes to fix up note icons from v9 to v10 (the paths changed)
        for (const document of documents) {
          for (const note of document.notes) {
            const hasNonDefaultIcon = note.icon && note.icon !== 'icons/svg/book.svg';
            const hasDefaultTexture = note.texture?.src && note.texture.src === 'icons/svg/book.svg';
            if (hasDefaultTexture && hasNonDefaultIcon) {
              note.texture = { src: note.icon };
            }
          }
        }
      }
      if (!this.isCorrectSystem) {
        // If the system is not correct, we need to replace the actor data from the tokens on scenes
        if (documents.some(d => d.tokens?.length)) {
          // Create a placeholder actor to use for the tokens
          if (!this.placeholderActor) {
            this.placeholderActor = await CONFIG.Actor.documentClass.create({
              name: 'Placeholder Actor',
              type: Object.keys(CONFIG.Actor.dataModels)
                .shift(),
            });
          }
          for (const document of documents) {
            for (const token of document.tokens) {
              token.actorLink = false;
              token.actorId = this.placeholderActor?.id;
              token.delta = {};
            }
          }
        }
      }
      let created = [];
      if (CONSTANTS.IsV12orNewer()) {
        // Run via the .fromImport method as that migrates data from old game versions since v12.
        created = await Scene.createDocuments(await Promise.all(documents.map(async d => Scene.fromImport({...d, active: false}))), { keepId: true });
      } else {
        // Run via the .fromSource method as that operates in a non-strict validation format, allowing
        // for older formats to still be parsed in most cases.
        created = await Scene.createDocuments(documents.map(d => Scene.fromSource({...d, active: false}).toObject()), { keepId: true });
      }

      // Check for compendium references within the scenes and update them to local world references
      console.groupCollapsed(game.i18n.format('SCENE-PACKER.importer.converting-references', {
        count: created.length,
        type: Scene.collectionName,
      }));
      const sceneUpdates = ReplaceCompendiumReferences(Scene, created, availableDocuments, this.scenePackerInfo.name);

      for (const scene of created) {
        const thumb = await scene.createThumbnail();
        const update = sceneUpdates.find(s => s._id === scene.id);
        if (update) {
          update.thumb = thumb.thumb;
          continue;
        }
        sceneUpdates.push({ _id: scene.id, thumb: thumb.thumb });
      }

      if (sceneUpdates.length) {
        await Scene.updateDocuments(sceneUpdates);
      }
      console.groupEnd();
    }

    if (actorData.length && this.isCorrectSystem) {
      ScenePacker.logType(
        CONSTANTS.MODULE_NAME,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: actorData.length,
          type: Actor.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: Actor.collectionName,
          count: actorData.length,
        })}</p>`,
      });
      const documents = await this.ensureAssets(actorData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      let created = [];
      if (CONSTANTS.IsV12orNewer()) {
        // Run via the .fromImport method as that migrates data from old game versions since v12.
        created = await Actor.createDocuments(await Promise.all(documents.map(async d => Actor.fromImport(d))), { keepId: true });
      } else {
        // Run via the .fromSource method as that operates in a non-strict validation format, allowing
        // for older formats to still be parsed in most cases.
        created = await Actor.createDocuments(documents.map(d => Actor.fromSource(d).toObject()), { keepId: true });
      }

      // Check for compendium references within the actors and update them to local world references
      console.groupCollapsed(game.i18n.format('SCENE-PACKER.importer.converting-references', {
        count: created.length,
        type: Actor.collectionName,
      }));
      const actorUpdates = ReplaceCompendiumReferences(Actor, created, availableDocuments, this.scenePackerInfo.name);
      if (actorUpdates.length) {
        const basicUpdates = actorUpdates.filter(d => !d.embeddedId);
        const embeddedUpdates = actorUpdates.filter(d => d.embeddedId);
        if (basicUpdates.length) {
          await Actor.updateDocuments(actorUpdates);
        }
        for (const embeddedUpdate of embeddedUpdates) {
          const actor = game.actors.get(embeddedUpdate._id);
          if (!actor) {
            continue;
          }

          if (embeddedUpdate.items) {
            await actor.updateEmbeddedDocuments('Item', {
              _id: embeddedUpdate.embeddedId,
              [embeddedUpdate.embeddedPath]: embeddedUpdate.items,
            });
          }
        }
      }
      console.groupEnd();
    }

    // Track whether this import created the welcome journal.
    let didCreateWelcomeJournal = false;

    if (journalData.length) {
      if (this.scenePackerInfo?.welcome_journal && !journalData.some(j => j._id === this.scenePackerInfo.welcome_journal) && !game.journal.get(this.scenePackerInfo.welcome_journal)) {
        // Ensure that the welcome journal exists in the world.
        let welcomeJournal = journalData.find(j => j._id === this.scenePackerInfo.welcome_journal);
        if (welcomeJournal) {
          journalData.push(welcomeJournal);
        }
      }
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: journalData.length,
          type: JournalEntry.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: JournalEntry.collectionName,
          count: journalData.length,
        })}</p>`,
      });
      const documents = await this.ensureAssets(journalData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      let created = [];
      if (CONSTANTS.IsV12orNewer()) {
        // Run via the .fromImport method as that migrates data from old game versions since v12.
        created = await JournalEntry.createDocuments(await Promise.all(documents.map(async d => JournalEntry.fromImport(d))), { keepId: true });
      } else {
        // Run via the .fromSource method as that operates in a non-strict validation format, allowing
        // for older formats to still be parsed in most cases.
        created = await JournalEntry.createDocuments(documents.map(d => JournalEntry.fromSource(d).toObject()), { keepId: true });
      }
      if (this.scenePackerInfo?.welcome_journal) {
        if (created.find(j => j.id === this.scenePackerInfo.welcome_journal)) {
          didCreateWelcomeJournal = true;
        }
      }

      // Check for compendium references within the journals and update them to local world references
      console.groupCollapsed(game.i18n.format('SCENE-PACKER.importer.converting-references', {
        count: created.length,
        type: JournalEntry.collectionName,
      }));
      const journalUpdates = ReplaceCompendiumReferences(JournalEntry, created, availableDocuments, this.scenePackerInfo.name);
      if (journalUpdates.length) {
        await JournalEntry.updateDocuments(journalUpdates);
      }
      console.groupEnd();
    }

    if (itemData.length && this.isCorrectSystem) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: itemData.length,
          type: Item.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: Item.collectionName,
          count: itemData.length,
        })}</p>`,
      });
      const documents = await this.ensureAssets(itemData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      let created = [];
      if (CONSTANTS.IsV12orNewer()) {
        // Run via the .fromImport method as that migrates data from old game versions since v12.
        created = await Item.createDocuments(await Promise.all(documents.map(async d => Item.fromImport(d))), { keepId: true });
      } else {
        // Run via the .fromSource method as that operates in a non-strict validation format, allowing
        // for older formats to still be parsed in most cases.
        created = await Item.createDocuments(documents.map(d => Item.fromSource(d).toObject()), { keepId: true });
      }

      // Check for compendium references within the items and update them to local world references
      console.groupCollapsed(game.i18n.format('SCENE-PACKER.importer.converting-references', {
        count: created.length,
        type: Item.collectionName,
      }));
      const itemUpdates = ReplaceCompendiumReferences(Item, created, availableDocuments, this.scenePackerInfo.name);
      if (itemUpdates.length) {
        await Item.updateDocuments(itemUpdates);
      }
      console.groupEnd();
    }

    if (macroData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: macroData.length,
          type: Macro.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: Macro.collectionName,
          count: macroData.length,
        })}</p>`,
      });
      const documents = await this.ensureAssets(macroData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      if (CONSTANTS.IsV12orNewer()) {
        // Run via the .fromImport method as that migrates data from old game versions since v12.
        await Macro.createDocuments(await Promise.all(documents.map(async d => Macro.fromImport(d))), { keepId: true });
      } else {
        // Run via the .fromSource method as that operates in a non-strict validation format, allowing
        // for older formats to still be parsed in most cases.
        await Macro.createDocuments(documents.map(d => Macro.fromSource(d).toObject()), { keepId: true });
      }
    }

    if (playlistData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: playlistData.length,
          type: Playlist.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: Playlist.collectionName,
          count: playlistData.length,
        })}</p>`,
      });
      let documents = await this.ensureAssets(playlistData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      // Playlists might need to have individual sounds merged
      const existingDocuments = documents.filter(d => game[Playlist.collectionName].has(d._id));
      for (const d of existingDocuments) {
        const existingPlaylist = game[Playlist.collectionName].get(d._id);
        if (!existingPlaylist) {
          continue;
        }
        const playlistData = existingPlaylist.toJSON();
        const sounds = playlistData.sounds || [];
        const newPlaylistData = Playlist.fromSource(d).toObject();
        const newSounds = [];
        let hasUpdates = false;
        for (const sound of (newPlaylistData.sounds || [])) {
          const i = sounds.findIndex(s => s._id === sound._id);
          if (i !== -1) {
            sounds[i] = sound;
            hasUpdates = true;
            continue;
          }
          newSounds.push(sound);
        }

        if (hasUpdates) {
          await existingPlaylist.updateEmbeddedDocuments('PlaylistSound', sounds);
        }
        if (newSounds.length) {
          await existingPlaylist.createEmbeddedDocuments('PlaylistSound', newSounds);
        }
      }

      documents = documents.filter(d => !existingDocuments.some(e => e._id === d._id));
      if (documents.length) {
        if (CONSTANTS.IsV12orNewer()) {
          // Run via the .fromImport method as that migrates data from old game versions.
          await Playlist.createDocuments(await Promise.all(documents.map(async d => Playlist.fromImport(d))), { keepId: true });
        } else {
          // Run via the .fromSource method as that operates in a non-strict validation format, allowing
          // for older formats to still be parsed in most cases.
          await Playlist.createDocuments(documents.map(d => Playlist.fromSource(d).toObject()), { keepId: true });
        }
      }
    }

    if (cardData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: cardData.length,
          type: Cards.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: Cards.collectionName,
          count: cardData.length,
        })}</p>`,
      });
      const documents = await this.ensureAssets(cardData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      if (CONSTANTS.IsV12orNewer()) {
        // Run via the .fromImport method as that migrates data from old game versions.
        await Cards.createDocuments(await Promise.all(documents.map(async d => Cards.fromImport(d))), { keepId: true });
      } else {
        // Run via the .fromSource method as that operates in a non-strict validation format, allowing
        // for older formats to still be parsed in most cases.
        await Cards.createDocuments(documents.map(d => Cards.fromSource(d).toObject()), { keepId: true });
      }
    }

    if (rollTableData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.creating-documents', {
          count: rollTableData.length,
          type: RollTable.collectionName,
        }),
      );
      await this.updateProcessStatus({
        message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
          type: RollTable.collectionName,
          count: rollTableData.length,
        })}</p>`,
      });
      const documents = await this.ensureAssets(rollTableData, assetMap, assetData);
      const folderIDs = documents.map(d => d.folder);
      if (folderIDs.length) {
        await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
      }
      let created = [];
      if (CONSTANTS.IsV12orNewer()) {
        // Run via the .fromImport method as that migrates data from old game versions.
        created = await RollTable.createDocuments(await Promise.all(documents.map(async d => RollTable.fromImport(d))), { keepId: true });
      } else {
        // Run via the .fromSource method as that operates in a non-strict validation format, allowing
        // for older formats to still be parsed in most cases.
        created = await RollTable.createDocuments(documents.map(d => RollTable.fromSource(d).toObject()), { keepId: true });
      }

      // Check for compendium references within the roll tables and update them to local world references
      console.groupCollapsed(game.i18n.format('SCENE-PACKER.importer.converting-references', {
        count: created.length,
        type: RollTable.collectionName,
      }));
      const tableUpdates = ReplaceCompendiumReferences(RollTable, created, availableDocuments, this.scenePackerInfo.name);
      if (tableUpdates.length) {
        for (const tableUpdate of tableUpdates) {
          const table = game.tables.get(tableUpdate._id);
          if (!table) {
            continue;
          }

          if (CONSTANTS.IsV10orNewer()) {
            await table.updateEmbeddedDocuments('TableResult', {
              _id: tableUpdate.embeddedId,
              documentCollection: tableUpdate.collection,
              documentId: tableUpdate.resultId,
            });
          } else {
            await table.updateEmbeddedDocuments('TableResult', {
              _id: tableUpdate.embeddedId,
              collection: tableUpdate.collection,
              resultId: tableUpdate.resultId,
            });
          }
        }
      }
      console.groupEnd();
    }

    if (unrelatedData) {
      const unrelatedDataSheet = new UnrelatedData(unrelatedData);

      for (const [type, references] of Object.entries(unrelatedData)) {
        const dataToImport = [];
        for (let i = references.length - 1; i >= 0; i--) {
          const reference = references[i];
          const [type, id] = reference.uuid.split('.');
          const collection = CONFIG[type]?.collection?.instance;
          const entity = collection?.get(id);
          if (entity) {
            unrelatedDataSheet.RemoveDocument(entity);
            continue;
          }
          switch (type) {
            case 'Actor':
              const actor = actorData.find(a => a._id === id);
              if (actor && this.isCorrectSystem) {
                dataToImport.push(actor);
              }
              break;
            case 'Cards':
              const cards = cardData.find(c => c._id === id);
              if (cards) {
                dataToImport.push(cards);
              }
              break;
            case 'Item':
              const item = itemData.find(i => i._id === id);
              if (item && this.isCorrectSystem) {
                dataToImport.push(item);
              }
              break;
            case 'JournalEntry':
              const journalEntry = journalData.find(j => j._id === id);
              if (journalEntry) {
                dataToImport.push(journalEntry);
              }
              break;
            case 'Macro':
              const macro = macroData.find(m => m._id === id);
              if (macro) {
                dataToImport.push(macro);
              }
              break;
            case 'Playlist':
              const playlist = playlistData.find(p => p._id === id);
              if (playlist) {
                dataToImport.push(playlist);
              }
              break;
            case 'RollTable':
              const rollTable = rollTableData.find(r => r._id === id);
              if (rollTable) {
                dataToImport.push(rollTable);
              }
              break;
          }
        }

        if (dataToImport.length) {
          const documents = await this.ensureAssets(dataToImport, assetMap, assetData);
          const folderIDs = documents.map(d => d.folder);
          if (folderIDs.length) {
            await MoulinetteImporter.CreateFolders(folderIDs, this.folderData);
          }
          if (CONSTANTS.IsV12orNewer()) {
            // Run via the .fromImport method as that migrates data from old game versions.
            await CONFIG[type].documentClass.createDocuments(await Promise.all(documents.map(async d => CONFIG[type].documentClass.fromImport(d))), { keepId: true });
          } else {
            // Run via the .fromSource method as that operates in a non-strict validation format, allowing
            // for older formats to still be parsed in most cases.
            await CONFIG[type].documentClass.createDocuments(documents.map(d => CONFIG[type].documentClass.fromSource(d).toObject()), { keepId: true });
          }
        }
      }

      if (unrelatedDataSheet.HasUnrelatedData()) {
        unrelatedDataSheet.render(true, {});
      }
    }

    if (this.scenePackerInfo?.welcome_journal) {
      // Render the welcome journal for an "Import All", or if this is the first import for the pack.
      if (didCreateWelcomeJournal) {
        const welcomeJournal = await game.journal.get(this.scenePackerInfo.welcome_journal);
        if (welcomeJournal?.sheet) {
          welcomeJournal.sheet.render(true, {});
        }
      }
    }

    // TODO Support running macros at the end of the import process

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.complete')}</p>`,
    });

    Dialog.prompt({
      title: game.i18n.localize('SCENE-PACKER.importer.name'),
      content: game.i18n.localize('SCENE-PACKER.importer.complete-content'),
      callback: () => {
        window.location.reload();
      }
    });
  }

  /** @inheritdoc */
  activateListeners(html) {
    return super.activateListeners(html);
  }

  /**
   * Ensure that all the assets for the provided entities exist in the appropriate place.
   * @param {Object[]} entities - The entities to ensure assets for
   * @param {Map<string, boolean>} assetMap - A map of assets that have already been processed or exist
   * @param {Object} assetData - The asset data
   * @return {Promise<Object[]>} The entity data with its assets updated
   */
  async ensureAssets(entities, assetMap, assetData) {
    if (!entities.length) {
      return entities;
    }

    const baseURL = await GetBaseURL() || '';
    const adventureFolder = `${this.scenePackerInfo.author}-${this.scenePackerInfo.name}`.slugify({ strict: true }) || 'scene-packer-fallback';
    const returnEntities = [];
    console.groupCollapsed(
      this.scenePackerInfo.name,
      '|',
      game.i18n.format('SCENE-PACKER.importer.ensure-assets', {
        count: entities.length,
      }),
    );
    let total = 0;
    for (const entity of entities) {
      let assets = assetData.mapping[entity._id];
      total += assets?.length || 0;
    }
    let idx = 0;
    for (const entity of entities) {
      let stringRepresentation = JSON.stringify(entity);
      const assets = assetData.mapping[entity._id];
      if (!assets?.length) {
        // No assets to process, leave the original data as is.
        returnEntities.push(entity);
        continue;
      }
      for (const originalAsset of assets) {
        const assetDetails = assetData.data[originalAsset];
        const storagePath = assetDetails ? assetDetails[0].storagePath : originalAsset;
        let needsDownloading = true;
        let needsRename = true;

        const asset = decodeURIComponent(storagePath);
        let localAsset = `${CONSTANTS.MOULINETTE_PATH}/${adventureFolder}/${storagePath}`;

        if (asset.startsWith('moulinette/')) {
          needsRename = false;
          localAsset = asset;
        }

        // Treat external URLs as always existing
        if (asset.startsWith('http://') || asset.startsWith('https://')) {
          needsDownloading = false;
          needsRename = false;
        }

        if (assetMap.has(asset)) {
          needsDownloading = false;
        }

        const folder = localAsset.substring(0, localAsset.lastIndexOf('/'));
        const filename = asset.split('/')
          .pop().split('?')[0];
        const newAssetLocation = `${baseURL}${folder}/${encodeURIComponent(filename)}`;

        if (needsDownloading) {
          const assetData = this.getRawDataFromZip('data/assets/' + asset);
          if (!assetData) {
            ScenePacker.logType(this.scenePackerInfo.name, 'warn', true,
              game.i18n.format('SCENE-PACKER.importer.missing-asset', {
                error: asset,
              }),
            );
            continue;
          }
          const file = new File([assetData], filename, {
            type: mime.getType(filename),
            lastModified: Date.now(),
          });
          if (!await UploadFile(file, folder, {
            overwrite: false,
            notify: false,
          })) {
            ScenePacker.logType(this.scenePackerInfo.name, 'error', true,
              game.i18n.format('SCENE-PACKER.zip-importer.ensure-asset-error', {
                error: asset,
              }),
            );
            continue;
          }
        }

        if (needsRename) {
          stringRepresentation = stringRepresentation.replaceAll(`${originalAsset}`, newAssetLocation);
        }
        ScenePacker.logType(this.scenePackerInfo.name, 'info', true, `Importer | ✅️️ ${localAsset}`);
        assetMap.set(asset, true);
        idx++;
        this.displayProgressBar(game.i18n.format('SCENE-PACKER.importer.ensure-assets', {
          count: total,
        }), total, idx);
      }

      // Convert the string representation that includes the updated assets back to an object
      returnEntities.push(JSON.parse(stringRepresentation));
    }
    // Ensure that the progress bar is hidden.
    if (total) {
      this.displayProgressBar(game.i18n.format('SCENE-PACKER.importer.ensure-assets', {
        count: total,
      }), 1, 1);
    }
    console.groupEnd();

    return returnEntities;
  }

  /**
   * Update the processing state of the importer.
   * @param {ProcessState} processState
   */
  async updateProcessStatus(processState) {
    if (typeof processState.processing !== 'undefined') {
      this.processing = processState.processing;
    }
    if (processState.message) {
      this.processingMessage += processState.message;
    }
    return this._render(false, {});
  }

  /**
   * Display a progress bar for the given name.
   * @param {string} name - The name of the bar.
   * @param {number} total - The total number of items.
   * @param {number} current - The current number of items progressed.
   */
  displayProgressBar(name, total, current) {
    const progress = total > 0 ? Math.round((current / total) * 100) : 100;
    if (game.release.generation >= 13) {
      let bar = ZipImporter.#progressBar;
      if ( !bar || bar?.pct === 1 ) {
        bar = ZipImporter.#progressBar = ui.notifications.info(name, {progress: true});
      }
      bar.update({message: name, pct: Math.clamp(progress, 0, 100) / 100});
    } else if (typeof SceneNavigation.displayProgressBar === 'function') {
      SceneNavigation.displayProgressBar({
        label: name,
        pct: progress,
      });
    } else if (typeof SceneNavigation._onLoadProgress === 'function') {
      SceneNavigation._onLoadProgress(name, progress);
    }
  }

  /**
   * Get the raw data from the decompressed Zip file
   * Will automatically try to convert unix paths to windows paths if needed
   * @param path
   * @returns {undefined|any}
   */
  getRawDataFromZip(path) {
    if (!this.decompressed) {
      return undefined;
    }
    if (!this.decompressed[path]) {
      // If the path contains folder paths, the zip might have Windows-style paths
      if (!path.includes('/')) {
        return undefined;
      }

      // Convert unix paths to windows paths and try again
      path = path.replace(/\//g, "\\");
      if (!this.decompressed[path]) {
        return undefined;
      }
    }

    return this.decompressed[path];
  }

  /**
   * Get data from the decompressed Zip file
   * @param {string} path
   * @returns {undefined|any}
   */
  getDataFromZip(path) {
    const data = this.getRawDataFromZip(path);
    if (!data) {
      return undefined;
    }

    const jsonString = new TextDecoder().decode(data);
    return JSON.parse(jsonString);
  }

  /**
   * Filter data to only include data that is missing from the collection
   * @param {Document[]} data
   * @param {DocumentCollection} collection
   * @returns {Document[]}
   */
  missingDataOnly(data, collection) {
     try {
      return data.filter(a => {
        if (!collection.has(a._id)) {
          return true;
        }

        if (collection.documentName === 'Playlist') {
          const playlist = collection.get(a._id);
          const sounds = playlist?.sounds;
          if (sounds?.size) {
            // Include the playlist if any of the sounds aren't in the collection's playlist sounds.
            return a.sounds.map(s => s._id).some(id => !sounds.has(id));
          }
        }

        return false;
      });
    } catch (err) {
      console.error(err);
      // Fallback to returning all data if there is an error
      return data;
    }
  }

  /**
   * Read data from a user provided File object
   * @param {File} file           A File object
   * @return {Promise.<ArrayBuffer>}   A Promise which resolves to the loaded array buffer data
   */
  static readBlobFromFile(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = ev => {
        resolve(reader.result);
      };
      reader.onerror = ev => {
        reader.abort();
        reject();
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

import {Compressor} from './compressor.js';
import {CONSTANTS} from '../constants.js';
import {ReplaceCompendiumReferences} from './converter.js';
import {UnrelatedData} from './related/unrelated-data.js';

export default class MoulinetteImporter extends FormApplication {

  /**
   * @typedef ImportOptions
   * @property {Object.<string, string>} packInfo - The map of filenames to URLs from Moulinette.
   * @property {string} sceneID - Optional. The specific SceneID to import, ignoring other entities unless required for that Scene.
   * @property {string} actorID - Optional. The specific ActorID to import, ignoring other entities unless required for that Actor.
   */

  /**
   * @param {ImportOptions} options - Additional options for processing
   */
  constructor(options) {
    super();

    options = Object.assign({sceneID: '', actorID: '', packInfo: {}}, options);
    const {sceneID, actorID, packInfo} = options;

    if (CONSTANTS.IsV7()) {
      Dialog.prompt({
        title: game.i18n.localize('Unsupported'),
        content: game.i18n.localize('SCENE-PACKER.importer.unsupported'),
        callback: () => {
        },
      });
      return;
    }

    this.packInfo = packInfo;
    this.sceneID = sceneID;
    this.actorID = actorID;
    this.importType = '';
    if (sceneID) {
      this.importType = game.i18n.localize('scene');
    } else if (actorID) {
      this.importType = game.i18n.localize('actor');
    }

    /**
     * Summary data for the package.
     * @type {ExporterData|Object|null}
     */
    this.scenePackerInfo = null;

    this.processing = false;
    this.processingMessage = '';
    this.loading = true;

    if (!this.packInfo || !this.packInfo['mtte.json']) {
      ScenePacker.logType(
        game.i18n.localize('SCENE-PACKER.importer.name'),
        'error',
        true,
        game.i18n.localize('SCENE-PACKER.importer.invalid-pack-data'),
      );

      return;
    }

    this.fetchData(this.packInfo['mtte.json']).then(data => {
      this.scenePackerInfo = data;
      this.loading = false;

      if (!this.scenePackerInfo.allow_complete_import) {
        this.process();
        this.close();

        return;
      }
      this.render();
    });
  }

  /** @inheritdoc */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.importer.name'),
      id: 'scene-packer-importer',
      template:
        'modules/scene-packer/templates/export-import/moulinette-importer.hbs',
      width: 700,
      height: 720,
      classes: ['scene-packer'],
      closeOnSubmit: false,
    });
  }

  /**
   * @return {Object|Promise}
   */
  getData(options = {}) {
    let coverImage = '';
    if (this.scenePackerInfo?.cover_image) {
      const coverImageExtension = this.scenePackerInfo.cover_image.split('.').pop();
      coverImage = this.packInfo[`data/cover/cover.${coverImageExtension}`];
    }

    let previewImage = '';
    if (this.sceneID) {
      previewImage = this.packInfo[`data/scenes/thumbs/${this.sceneID}.png`];
    }

    let totalPackCount = '';
    if (this.scenePackerInfo?.counts) {
      totalPackCount = Object.values(this.scenePackerInfo.counts).reduce((a, b) => a + b, 0).toLocaleString();
    }

    let selectedEntity = '';
    if (this.sceneID && this.scenePackerInfo?.scenes) {
      selectedEntity = this.scenePackerInfo.scenes.find(scene => scene.id === this.sceneID)?.name;
    } else if (this.actorID && this.scenePackerInfo?.actors) {
      selectedEntity = this.scenePackerInfo.actors.find(actor => actor.id === this.actorID)?.name;
    }

    return {
      loading: this.loading,
      pack: this.scenePackerInfo,
      selectedEntity: selectedEntity,
      previewImage: previewImage,
      totalPackCount: totalPackCount,
      processing: this.processing,
      processingMessage: this.processingMessage,
      importType: this.importType,
      coverImage: coverImage,
    };
  }

  async _updateObject(event, formData) {
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="import-all"]').click(() => {
      this.sceneID = '';
      this.actorID = '';
      this.process().then(() => {
        Dialog.prompt({
          title: game.i18n.localize('SCENE-PACKER.importer.name'),
          content: `<p>${game.i18n.localize('SCENE-PACKER.importer.complete')}</p>`,
          label: game.i18n.localize('Close'),
          callback: () => {
            this.close();
          },
        });
      });
    });
    html.find('button[name="import-one"]').click(() => {
      this.process().then(() => {
        Dialog.prompt({
          title: game.i18n.localize('SCENE-PACKER.importer.name'),
          content: `<p>${game.i18n.localize('SCENE-PACKER.importer.complete')}</p>`,
          label: game.i18n.localize('Close'),
          callback: () => {
            this.close();
          },
        });
      });
    });
    html.find('button[name="close"]').click(this.close.bind(this));
  }

  /**
   * Process the import.
   */
  async process() {
    if (!this.packInfo) {
      // Cannot process without the pack information.
      return;
    }

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.processing')}</p>`,
      processing: true,
    });

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.be-patient')}</p>`,
      processing: true,
    });

    // TODO remove debugging
    console.log('sceneID', this.sceneID);
    console.log('actorID', this.actorID);
    console.log('packInfo', this.packInfo);

    const restrictFolderIDS = [];

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.process-fetch-data')}</p>`,
    });
    this.scenePackerInfo = await this.fetchData(this.packInfo['mtte.json']);
    console.log('scenePackerInfo', this.scenePackerInfo); // TODO Delete this line
    const relatedData = await this.fetchData(this.packInfo['data/related-data.json']);
    const unrelatedData = await this.fetchData(this.packInfo['data/unrelated-data.json']);
    const assetData = await this.fetchData(this.packInfo['data/assets.json']);
    /**
     * Track which assets have been imported
     * @type {Map<string, boolean>}
     */
    const assetMap = new Map();

    // TODO Handle entities that already exist but are a different version
    const sceneData = await this.fetchDataIfMissing(this.packInfo['data/Scene.json'],
      game.scenes,
      this.sceneID ? [this.sceneID] : [],
    );
    const actorData = await this.fetchDataIfMissing(
      this.packInfo['data/Actor.json'],
      game.actors,
      this.actorID ? [this.actorID] : [],
    );
    const journalData = await this.fetchDataIfMissing(
      this.packInfo['data/JournalEntry.json'],
      game.journal,
    );
    const itemData = await this.fetchDataIfMissing(
      this.packInfo['data/Item.json'],
      game.items,
    );
    const macroData = await this.fetchDataIfMissing(
      this.packInfo['data/Macro.json'],
      game.macros,
    );
    const playlistData = await this.fetchDataIfMissing(
      this.packInfo['data/Playlist.json'],
      game.playlists,
    );
    const rollTableData = await this.fetchDataIfMissing(
      this.packInfo['data/RollTable.json'],
      game.tables,
    );
    const cardData = await this.fetchDataIfMissing(
      this.packInfo['data/RollTable.json'],
      game.tables,
    ) || [];
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

    let sourceReference;
    if (this.sceneID) {
      sourceReference = `Scene.${this.sceneID}`;
      const scene = sceneData.find((s) => s._id === this.sceneID);
      if (scene?.data?.folder) {
        restrictFolderIDS.push(scene.data.folder);
      }
    }
    if (this.actorID) {
      sourceReference = `Actor.${this.actorID}`;
      const actor = actorData.find((a) => a._id === this.actorID);
      if (actor?.data?.folder) {
        restrictFolderIDS.push(actor.data.folder);
      }
    }

    await this.importFolders(
      this.packInfo['data/folders.json'],
      restrictFolderIDS,
    );

    if (sceneData.length) {
      const filteredData = this.filterData(sceneData, relatedData, 'Scene', sourceReference);
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
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
            count: filteredData.length,
          })}</p>`,
        });
        const created = await Scene.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
        for (const id of created.map(s => s.id)) {
          const scene = game.scenes.get(id);
          if (!scene) {
            continue;
          }
          const thumbData = await scene.createThumbnail();
          await scene.update({thumb: thumbData.thumb}, {diff: false});
        }

        // Check for compendium references within the scenes and update them to local world references
        console.groupCollapsed(game.i18n.format('SCENE-PACKER.importer.converting-references', {
          count: created.length,
          type: Scene.collectionName,
        }));
        const sceneUpdates = ReplaceCompendiumReferences(Scene, created, availableDocuments, this.scenePackerInfo.name);
        if (sceneUpdates.length) {
          await Scene.updateDocuments(sceneUpdates);
        }
        console.groupEnd();
      }
    }
    if (actorData.length) {
      const filteredData = this.filterData(actorData, relatedData, 'Actor', sourceReference);
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.importer.creating-documents', {
            count: filteredData.length,
            type: Actor.collectionName,
          }),
        );
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Actor.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        const created = await Actor.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});

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
    }

    // Track whether this import created the welcome journal.
    let didCreateWelcomeJournal = false;

    if (journalData.length) {
      const filteredData = this.filterData(journalData, relatedData, 'JournalEntry', sourceReference);
      if (this.scenePackerInfo?.welcome_journal && !filteredData.some(j => j._id === this.scenePackerInfo.welcome_journal) && !game.journal.get(this.scenePackerInfo.welcome_journal)) {
        // Ensure that the welcome journal exists in the world.
        let welcomeJournal = journalData.find(j => j._id === this.scenePackerInfo.welcome_journal);
        if (welcomeJournal) {
          filteredData.push(welcomeJournal);
        }
      }
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.importer.creating-documents', {
            count: filteredData.length,
            type: JournalEntry.collectionName,
          }),
        );
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: JournalEntry.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        const created = await JournalEntry.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
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
    }

    if (itemData.length) {
      const filteredData = this.filterData(itemData, relatedData, 'Item', sourceReference);
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.importer.creating-documents', {
            count: filteredData.length,
            type: Item.collectionName,
          }),
        );
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Item.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        const created = await Item.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});

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
    }

    if (macroData.length) {
      const filteredData = this.filterData(macroData, relatedData, 'Macro', sourceReference);
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.importer.creating-documents', {
            count: filteredData.length,
            type: Macro.collectionName,
          }),
        );
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Macro.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await Macro.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (playlistData.length) {
      const filteredData = this.filterData(playlistData, relatedData, 'Playlist', sourceReference);
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.importer.creating-documents', {
            count: filteredData.length,
            type: Playlist.collectionName,
          }),
        );
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Playlist.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await Playlist.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (cardData.length) {
      const filteredData = this.filterData(cardData, relatedData, 'Cards', sourceReference);
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.importer.creating-documents', {
            count: filteredData.length,
            type: Cards.collectionName,
          }),
        );
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Cards.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await Cards.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (rollTableData.length) {
      const filteredData = this.filterData(rollTableData, relatedData, 'RollTable', sourceReference);
      if (filteredData.length) {
        ScenePacker.logType(
          this.scenePackerInfo.name,
          'info',
          true,
          game.i18n.format('SCENE-PACKER.importer.creating-documents', {
            count: filteredData.length,
            type: RollTable.collectionName,
          }),
        );
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: RollTable.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        const created = await RollTable.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});

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

            await table.updateEmbeddedDocuments('TableResult', {
              _id: tableUpdate.embeddedId,
              collection: tableUpdate.collection,
              resultId: tableUpdate.resultId,
            });
          }
        }
        console.groupEnd();
      }
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
              if (actor) {
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
              if (item) {
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
          await CONFIG[type].documentClass.createDocuments(await this.ensureAssets(dataToImport, assetMap, assetData), {keepId: true});
        }
      }

      if (unrelatedDataSheet.HasUnrelatedData()) {
        unrelatedDataSheet.render(true, {});
      }
    }

    if (this.scenePackerInfo?.welcome_journal) {
      // Render the welcome journal for an "Import All", or if this is the first import for the pack.
      if (!this.sceneID || didCreateWelcomeJournal) {
        const welcomeJournal = await game.journal.get(this.scenePackerInfo.welcome_journal);
        if (welcomeJournal?.sheet) {
          welcomeJournal.sheet.render(true, {});
        }
      }
    }

    // TODO Support running macros at the end of the import process

    // TODO Potentially prompt for importing documents that are not related to scenes. These cannot be imported unless the Import All option is used.

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.complete')}</p>`,
    });

    /**
     * Trigger any hooks for importing entities. Receives argument: {@link ImportedMoulinetteEntities}
     */
    Hooks.callAll(CONSTANTS.HOOKS_IMPORTED_MOULINETTE_COMPLETE, {
      sceneID: this.sceneID,
      actorID: this.actorID,
      info: this.scenePackerInfo,
    });
  }

  /**
   * @typedef ProcessState
   * @property {boolean} processing - Whether the pack is currently being processed
   * @property {string} message - The message to display to the user
   */

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

    const adventureFolder = `${this.scenePackerInfo.author}-${this.scenePackerInfo.name}`.slugify({strict: true}) || 'scene-packer-fallback';
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
        const filename = asset.split('/').pop();
        const newAssetLocation = `${folder}/${encodeURIComponent(filename)}`;

        if (needsDownloading) {
          const assetURL = this.packInfo['data/assets/' + asset];
          if (!assetURL) {
            ScenePacker.logType(this.scenePackerInfo.name, 'warn', true,
              game.i18n.format('SCENE-PACKER.importer.missing-asset', {
                error: asset,
              }),
            );
            continue;
          }
          const srcURL = new URL(assetURL);
          if (!await game.moulinette.applications.MoulinetteFileUtil.downloadFile(srcURL, folder, filename)) {
            ScenePacker.logType(this.scenePackerInfo.name, 'error', true,
              game.i18n.format('SCENE-PACKER.exporter.progress.download-error', {
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
   * Fetch data.
   * @param {RequestInfo} url - The URL to the JSON.
   * @return {Promise<Object>}
   */
  async fetchData(url) {
    const response = await Compressor.FetchWithTimeout(url, {timeout: 60000});
    if (!response.ok) {
      throw game.i18n.format('SCENE-PACKER.importer.invalid-url', {
        url,
        err: response.statusText,
      });
    }
    return await response.json();
  }

  /**
   * Filters the provided data to only include the entities that are relevant to the sourceReference.
   *
   * @param {object[]} data - The data to process.
   * @param {Object.<string, Relation[]>} allRelatedData - All of the references to related data that are owned by the sourceReference.
   * @param {string} type - The type of related data to import.
   * @param {string|null} sourceReference - The reference to the source that owns the related data or null to include all.
   * @return {object[]} - The filtered data.
   */
  filterData(data, allRelatedData, type, sourceReference) {
    // TODO Handle the case where the document already exists in the world to support updating/replacing.
    if (!sourceReference || !allRelatedData[sourceReference]) {
      return data;
    }

    if (!data.length) {
      return [];
    }

    const relatedData = new Set();
    for (const relatedDataReference of allRelatedData[sourceReference]) {
      if (relatedDataReference.uuid.startsWith(type)) {
        relatedData.add(relatedDataReference.uuid);
      }
    }

    return data.filter(d => sourceReference === `${type}.${d._id}` || relatedData.has(`${type}.${d._id}`));
  }

  /**
   * Fetch data if it is missing from the given collection.
   * @param {RequestInfo} url - The URL to the JSON
   * @param {Object} collection - The collection that this data belongs to
   * @param {string[]} onlyIDs - Only import the data for the given IDs
   * @return {Promise<Object[]>}
   */
  async fetchDataIfMissing(url, collection, onlyIDs = []) {
    // TODO Look into a nice way to handle updating existing data.
    const response = await Compressor.FetchWithTimeout(url, {timeout: 60000});
    if (!response.ok) {
      throw game.i18n.format('SCENE-PACKER.importer.invalid-url', {
        url,
        err: response.statusText,
      });
    }
    const data = await response.json();
    let createData = data.filter((a) => !collection.has(a._id));
    if (onlyIDs.length) {
      createData = createData.filter((a) => onlyIDs.includes(a._id));
    }
    return createData;
  }

  /**
   * Downloads the JSON data for the given URL and creates the folders within the world.
   * @param {RequestInfo} url - The URL to the folder JSON.
   * @param {string[]} limitToParentsOfIDs - Optional. Only import folders that are parents of the given IDs.
   */
  async importFolders(url, limitToParentsOfIDs = []) {
    const response = await Compressor.FetchWithTimeout(url, {timeout: 60000});
    if (!response.ok) {
      throw game.i18n.format('SCENE-PACKER.importer.invalid-url', {
        url,
        err: response.statusText,
      });
    }
    const folderData = await response.json();
    let toImport = {};

    const addValueAndParents = function (id) {
      const value = folderData[id];
      if (!value) {
        return;
      }
      toImport[id] = value;
      if (value.parent) {
        addValueAndParents(value.parent);
      }
    };

    if (limitToParentsOfIDs.length) {
      for (const limitToParentsOfID of limitToParentsOfIDs) {
        addValueAndParents(limitToParentsOfID);
      }
    } else {
      toImport = folderData;
    }

    /**
     * Buffer of entries keyed by their parent
     * @type {{}}
     */
    const buffer = {};
    const createData = [];

    /**
     * Process any entries in the buffer waiting for the given ID
     * @param {string} id - The ID of the entry that was just added
     */
    const processBuffer = function (id) {
      // See if there are any entries waiting to be added for this entry
      if (buffer[id]) {
        for (const entry of buffer[id]) {
          createData.push(entry);
          processBuffer(entry._id);
        }
        delete buffer[id];
      }
    };

    for (const entry of Object.values(toImport)) {
      if (game.folders.has(entry._id)) {
        // Folder has already been imported
        continue;
      }
      if (!entry.parent || createData.some((e) => e._id === entry.parent)) {
        // Entry has no parent, or the parent is already added
        createData.push(entry);

        processBuffer(entry._id);
      } else {
        // Not ready to be added yet, add to the buffer
        if (!buffer[entry.parent]) {
          buffer[entry.parent] = [];
        }
        buffer[entry.parent].push(entry);
      }
    }

    if (createData.length) {
      await Folder.createDocuments(createData, {keepId: true});
    }
  }

  /**
   * Display a progress bar for the given name.
   * @param {string} name - The name of the bar.
   * @param {number} total - The total number of items.
   * @param {number} current - The current number of items progressed.
   */
  displayProgressBar(name, total, current) {
    const progress = total > 0 ? Math.round((current / total) * 100) : 100;
    if (typeof SceneNavigation.displayProgressBar === 'function') {
      SceneNavigation.displayProgressBar({label: name, pct: progress});
    } else if (typeof SceneNavigation._onLoadProgress === 'function') {
      SceneNavigation._onLoadProgress(name, progress);
    }
  }
}

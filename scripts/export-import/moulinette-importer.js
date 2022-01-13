import {Compressor} from './compressor.js';
import {CONSTANTS} from '../constants.js';
import {ExtractRelatedJournalData} from './related/journals.js';

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
      return null;
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

    this.fetchData(this.packInfo['mtte.json']).then(data => {
      this.scenePackerInfo = data;
      console.log('scenePackerInfo', this.scenePackerInfo);
      this.loading = false;

      if (!this.scenePackerInfo.allow_complete_import) {
        this.process();
        this.close();

        return null;
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

    return {
      loading: this.loading,
      pack: this.scenePackerInfo,
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
    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.processing')}</p>`,
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
    console.log('scenePackerInfo', this.scenePackerInfo);
    const relatedData = await this.fetchData(this.packInfo['data/related-data.json']);
    console.log('relatedData', relatedData);
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

    // TODO Determine if anything like this is needed to import/update references
    // const compendiumRelatedData = this.getRelatedDataToImport('Compendium', null, relatedData);
    // for (const compendiumRelatedDatum of compendiumRelatedData) {
    //   const document = fromUuid(compendiumRelatedDatum);
    //   if (!document || document.collection.has(document.id)) {
    //     // Invalid reference or already imported
    //     continue;
    //   }
    //   await document.collection.importFromCompendium(document.pack, document.id, {}, {keepId: true});
    // }

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
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.name', {
          count: sceneData.length,
          type: game.i18n.localize('scenes'),
        }),
      );
      const filteredData = this.filterData(sceneData, relatedData, 'Scene', sourceReference);
      if (filteredData.length) {
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Scene.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await Scene.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
        for (const id of filteredData.map(s => s._id)) {
          const scene = game.scenes.get(id);
          const thumbData = await scene.createThumbnail();
          await scene.update({thumb: thumbData.thumb}, {diff: false});
        }
      }
    }
    if (actorData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.name', {
          count: actorData.length,
          type: game.i18n.localize('actors'),
        }),
      );
      const filteredData = this.filterData(actorData, relatedData, 'Actor', sourceReference);
      if (filteredData.length) {
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Actor.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await Actor.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (journalData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.name', {
          count: journalData.length,
          type: game.i18n.localize('journals'),
        }),
      );
      const filteredData = this.filterData(journalData, relatedData, 'JournalEntry', sourceReference);
      if (filteredData.length) {
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: JournalEntry.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await JournalEntry.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});

        // Check for compendium references within the journals and update them to local world references
        for (const datum of filteredData) {
          const relatedData = ExtractRelatedJournalData(datum);
          if (!relatedData.data.size) {
            continue;
          }

          // TODO Extract this method out into a separate function
          console.log('relatedData', relatedData);
          for (const relations of relatedData.data.values()) {
            for (const relation of relations) {
              if (!relation.uuid.startsWith('Compendium.')) {
                // Only try to replace compendium references
                continue;
              }
              let sources = [
                Actor.collectionName,
                JournalEntry.collectionName,
                Scene.collectionName,
                Item.collectionName,
                Macro.collectionName,
                Playlist.collectionName,
                RollTable.collectionName,
              ];
              if (typeof Cards !== 'undefined') {
                sources.push(Cards.collectionName);
              }

              let relationParts = relation.uuid.split('.');
              relationParts.pop(); // Remove the id
              const type = relationParts.pop();
              switch (type) {
                case 'actors':
                  sources = [Actor.collectionName];
                  break;
                case 'journals':
                  sources = [JournalEntry.collectionName];
                  break;
                case 'maps':
                  sources = [Scene.collectionName];
                  break;
                case 'items':
                  sources = [Item.collectionName];
                  break;
                case 'macros':
                  sources = [Macro.collectionName];
                  break;
                case 'playlists':
                  sources = [Playlist.collectionName];
                  break;
                case 'rolltables':
                  sources = [RollTable.collectionName];
                  break;
                case 'cards':
                  sources = [Cards.collectionName];
                  break;
              }

              let foundEntity;
              for (const source of sources) {
                foundEntity = game[source].find(e => e.getFlag('core', 'sourceId') === relation.uuid);
                if (foundEntity) {
                  break;
                }
              }
              if (!foundEntity) {
                continue;
              }

              ScenePacker.logType(
                this.scenePackerInfo.name,
                'info',
                true,
                game.i18n.format(
                  'SCENE-PACKER.importer.converting-reference',
                  {
                    oldRef: relation.uuid,
                    newRef: foundEntity.uuid,
                  },
                ),
              );

              console.log('Replacing at location', relation.path);
            }
          }

          // TODO Replace links in Journal data (they might reference compendiums)
          // TODO Extract this method out into a separate function
        }
      }
    }

    if (itemData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.name', {
          count: itemData.length,
          type: game.i18n.localize('items'),
        }),
      );
      const filteredData = this.filterData(itemData, relatedData, 'Item', sourceReference);
      if (filteredData.length) {
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Item.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await Item.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
      // TODO Replace links in Item data (they might reference compendiums)
    }

    if (macroData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.name', {
          count: macroData.length,
          type: game.i18n.localize('macros'),
        }),
      );
      const filteredData = this.filterData(macroData, relatedData, 'Macro', sourceReference);
      if (filteredData.length) {
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
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.name', {
          count: playlistData.length,
          type: game.i18n.localize('playlists'),
        }),
      );
      const filteredData = this.filterData(playlistData, relatedData, 'Playlist', sourceReference);
      if (filteredData.length) {
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: Playlist.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await Playlist.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (rollTableData.length) {
      ScenePacker.logType(
        this.scenePackerInfo.name,
        'info',
        true,
        game.i18n.format('SCENE-PACKER.importer.name', {
          count: rollTableData.length,
          type: game.i18n.localize('rollable tables'),
        }),
      );
      const filteredData = this.filterData(rollTableData, relatedData, 'RollTable', sourceReference);
      if (filteredData.length) {
        await this.updateProcessStatus({
          message: `<p>${game.i18n.format('SCENE-PACKER.importer.process-creating-data', {
            type: RollTable.collectionName,
            count: filteredData.length,
          })}</p>`,
        });
        await RollTable.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    await this.updateProcessStatus({
      message: `<p>${game.i18n.localize('SCENE-PACKER.importer.complete')}</p>`,
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
        const asset = decodeURIComponent(originalAsset);
        const localAsset = `${CONSTANTS.MOULINETTE_PATH}/${asset}`;

        if (assetMap.has(asset)) {
          console.log(`⏩ ${asset}`);
          continue;
        }

        // Treat external URLs as always existing
        if (asset.startsWith('http://') || asset.startsWith('https://')) {
          console.log(`⏩ ${asset}`);
          assetMap.set(asset, true);
          continue;
        }

        const folder = localAsset.substring(0, localAsset.lastIndexOf('/'));
        const filename = asset.split('/').pop();
        const srcURL = new URL(this.packInfo['data/assets/' + asset]);

        if (!await game.moulinette.applications.MoulinetteFileUtil.downloadFile(srcURL, folder, filename)) {
          ScenePacker.logType(this.scenePackerInfo.name, 'error', true,
            game.i18n.format('SCENE-PACKER.exporter.progress.download-error', {
              error: asset,
            }),
          );
          continue;
        }

        stringRepresentation = stringRepresentation.replaceAll(`"${originalAsset}"`, `"${folder}/${encodeURIComponent(filename)}"`);
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
    if (!sourceReference) {
      return data;
    }

    if (!data.length) {
      return [];
    }

    const relatedData = this.getRelatedDataToImport(allRelatedData, type, sourceReference);

    return data.filter(d => sourceReference === `${type}.${d._id}` || relatedData.has(`${type}.${d._id}`));
  }

  /**
   * Gets the related data to only those that are relevant to the provided type.
   *
   * @param {Object.<string, Relation[]>} allRelatedData - All of the references to related data that are owned by the sourceReference.
   * @param {string} type - The type of related data to import.
   * @param {string|null} sourceReference - The reference to the source that owns the related data or null to include all.
   * @return {Set<string>} The list of related data references to import for the given type.
   */
  getRelatedDataToImport(allRelatedData, type, sourceReference) {
    const relatedData = new Set();
    if (sourceReference) {
      for (const relatedDataReference of allRelatedData[sourceReference]) {
        // TODO Convert to just using the relation format once the old format is removed.
        // if (relatedDataReference.uuid.startsWith(type)) {
        if ((relatedDataReference.uuid || relatedDataReference).startsWith(type)) {
          relatedData.add(relatedDataReference);
        }
      }
    } else {
      for (const [, relatedDataReferences] of Object.entries(allRelatedData)) {
        for (const relatedDataReference of relatedDataReferences) {
          // TODO Convert to just using the relation format once the old format is removed.
          // if (relatedDataReference.uuid.startsWith(type)) {
          if ((relatedDataReference.uuid || relatedDataReference).startsWith(type)) {
            relatedData.add(relatedDataReference);
          }
        }
      }
    }

    return relatedData;
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

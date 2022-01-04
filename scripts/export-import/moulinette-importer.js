import { Compressor } from './compressor.js';
import { CONSTANTS } from '../constants.js';

export default class MoulinetteImporter extends FormApplication {
  /**
   * @param {object} packInfo - The ExporterData payload
   */
  constructor({ packInfo = {} } = {}) {
    super();

    if (CONSTANTS.IsV7()) {
      Dialog.prompt({
        title: game.i18n.localize('Unsupported'),
        content: game.i18n.localize('SCENE-PACKER.importer.unsupported'),
        callback: () => {},
      });
      return null;
    }

    /**
     * @type {object} packInfo - The ExporterData payload
     */
    this.packInfo = packInfo;

    /**
     * Summary data for the package.
     * @type {ExporterData|Object|null}
     */
    this.scenePackerInfo = null;
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
      scrollY: ['ol.directory-list'],
      filters: [
        {
          inputSelector: 'input[name="search"]',
          contentSelector: '.directory-list',
        },
      ],
      tabs: [
        {
          navSelector: '.tabs',
          contentSelector: '.content',
          initial: 'scenes',
        },
      ],
    });
  }

  /** @inheritdoc */
  getData() {
    return {};
  }

  async _updateObject(event, formData) {}

  /**
   * @typedef ProcessOptions
   * @property {string} [sceneID] - Optional. The specific SceneID to import, ignoring other entities unless required for that Scene.
   * @property {string} [actorID] - Optional. The specific ActorID to import, ignoring other entities unless required for that Actor.
   */

  /**
   * Process the requested URL.
   * @param {ProcessOptions} options - Additional options for processing
   */
  async process(options) {
    // TODO Show process bar / dialog

    options = Object.assign({ sceneID: '', actorID: '' }, options);
    const { sceneID, actorID } = options;
    // TODO remove debugging
    console.log('options', options);
    console.log('sceneID', sceneID);
    console.log('actorID', actorID);
    console.log('packInfo', this.packInfo);

    const restrictFolderIDS = [];

    this.scenePackerInfo = await this.fetchData(this.packInfo['mtte.json']);
    console.log('scenePackerInfo', this.scenePackerInfo);
    // TODO Utilise relatedData to ensure related entities are imported
    const relatedData = await this.fetchData(this.packInfo['data/related-data.json']);
    console.log('relatedData', relatedData);
    const assetData = await this.fetchData(this.packInfo['data/assets.json']);
    /**
     * Track which assets have been imported
     * @type {Map<string, boolean>}
     */
    const assetMap = new Map();

    const sceneData = await this.fetchDataIfMissing(this.packInfo['data/Scene.json'],
      game.scenes,
      sceneID ? [sceneID] : []
    );
    const actorData = await this.fetchDataIfMissing(
      this.packInfo['data/Actor.json'],
      game.actors,
      actorID ? [actorID] : []
    );
    const journalData = await this.fetchDataIfMissing(
      this.packInfo['data/JournalEntry.json'],
      game.journal
    );
    const itemData = await this.fetchDataIfMissing(
      this.packInfo['data/Item.json'],
      game.items
    );
    const macroData = await this.fetchDataIfMissing(
      this.packInfo['data/Macro.json'],
      game.macros
    );
    const playlistData = await this.fetchDataIfMissing(
      this.packInfo['data/Playlist.json'],
      game.playlists
    );
    const rollTableData = await this.fetchDataIfMissing(
      this.packInfo['data/RollTable.json'],
      game.tables
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
    if (sceneID) {
      sourceReference = `Scene.${sceneID}`;
      const scene = sceneData.find((s) => s._id === sceneID);
      if (scene?.data?.folder) {
        restrictFolderIDS.push(scene.data.folder);
      }
    }
    if (actorID) {
      sourceReference = `Actor.${actorID}`;
      const actor = actorData.find((a) => a._id === actorID);
      if (actor?.data?.folder) {
        restrictFolderIDS.push(actor.data.folder);
      }
    }

    await this.importFolders(
      this.packInfo['data/folders.json'],
      restrictFolderIDS
    );

    if (sceneData.length) {
      ScenePacker.logType(this.scenePackerInfo.name, 'info', true, game.i18n.format('SCENE-PACKER.importer.name', {count: sceneData.length, type: 'scenes'}));
      const filteredData = this.filterData(sceneData, relatedData, 'Scene', sourceReference);
      if (filteredData.length) {
        await Scene.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }
    if (actorData.length) {
      console.log(`Creating ${actorData.length} actors`);
      const filteredData = this.filterData(actorData, relatedData, 'Actor', sourceReference);
      if (filteredData.length) {
        await Actor.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (journalData.length) {
      console.log(`Creating ${journalData.length} journals`);
      const filteredData = this.filterData(journalData, relatedData, 'JournalEntry', sourceReference);
      if (filteredData.length) {
        await JournalEntry.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
      // TODO Replace links in Journal data (they might reference compendiums)
    }

    if (itemData.length) {
      console.log(`Creating ${itemData.length} items`);
      const filteredData = this.filterData(itemData, relatedData, 'Item', sourceReference);
      if (filteredData.length) {
        await Item.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
      // TODO Replace links in Item data (they might reference compendiums)
    }

    if (macroData.length) {
      console.log(`Creating ${macroData.length} macros`);
      const filteredData = this.filterData(macroData, relatedData, 'Macro', sourceReference);
      if (filteredData.length) {
        await Macro.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (playlistData.length) {
      console.log(`Creating ${playlistData.length} playlists`);
      const filteredData = this.filterData(playlistData, relatedData, 'Playlist', sourceReference);
      if (filteredData.length) {
        await Playlist.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    if (rollTableData.length) {
      console.log(`Creating ${rollTableData.length} rolltables`);
      const filteredData = this.filterData(rollTableData, relatedData, 'RollTable', sourceReference);
      if (filteredData.length) {
        await RollTable.createDocuments(await this.ensureAssets(filteredData, assetMap, assetData), {keepId: true});
      }
    }

    console.log('Done');
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
      `Ensuring assets exist for ${entities.length} entities.`
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
          ScenePacker.logType(CONSTANTS.MODULE_NAME, 'error', true,
            game.i18n.format('SCENE-PACKER.exporter.progress.download-error', {
              error: asset,
            }),
          );
          continue;
        }

        stringRepresentation = stringRepresentation.replaceAll(`"${originalAsset}"`, `"${folder}/${encodeURIComponent(filename)}"`);
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Importer | ✅️️ ${localAsset}`);
        assetMap.set(asset, true);
        idx++;
        this.displayProgressBar(`Ensuring assets exist for ${total} entities.`, total, idx);
      }

      // Convert the string representation that includes the updated assets back to an object
      returnEntities.push(JSON.parse(stringRepresentation));
    }
    // Ensure that the progress bar is hidden.
    this.displayProgressBar(`Ensuring assets exist for ${total} entities.`, 1, 1);
    console.groupEnd();

    return returnEntities;
  }

  /**
   * Fetch data.
   * @param {URL} url - The URL to the JSON.
   * @return {Promise<Object>}
   */
  async fetchData(url) {
    const response = await Compressor.FetchWithTimeout(url, { timeout: 60000 });
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
   * @param {Object.<string, string[]>} allRelatedData - All of the references to related data that are owned by the sourceReference.
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
   * @param {Object.<string, string[]>} allRelatedData - All of the references to related data that are owned by the sourceReference.
   * @param {string} type - The type of related data to import.
   * @param {string|null} sourceReference - The reference to the source that owns the related data or null to include all.
   * @return {Set<string>} The list of related data references to import for the given type.
   */
  getRelatedDataToImport(allRelatedData, type, sourceReference) {
    const relatedData = new Set();
    if (sourceReference) {
      for (const relatedDataReference of allRelatedData[sourceReference]) {
        if (relatedDataReference.startsWith(type)) {
          relatedData.add(relatedDataReference);
        }
      }
    } else {
      for (const [, relatedDataReferences] of Object.entries(allRelatedData)) {
        for (const relatedDataReference of relatedDataReferences) {
          if (relatedDataReference.startsWith(type)) {
            relatedData.add(relatedDataReference);
          }
        }
      }
    }

    return relatedData;
  }

  /**
   * Fetch data if it is missing from the given collection.
   * @param {URL} url - The URL to the JSON
   * @param {Object} collection - The collection that this data belongs to
   * @param {string[]} onlyIDs - Only import the data for the given IDs
   * @return {Promise<Object[]>}
   */
  async fetchDataIfMissing(url, collection, onlyIDs = []) {
    const response = await Compressor.FetchWithTimeout(url, { timeout: 60000 });
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
   * @param {URL} url - The URL to the folder JSON.
   * @param {string[]} limitToParentsOfIDs - Optional. Only import folders that are parents of the given IDs.
   */
  async importFolders(url, limitToParentsOfIDs = []) {
    const response = await Compressor.FetchWithTimeout(url, { timeout: 60000 });
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
        // TODO consider updating data
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
      await Folder.createDocuments(createData, { keepId: true });
    }
  }

  /**
   * Display a progress bar for the given name.
   * @param {string} name - The name of the bar.
   * @param {number} total - The total number of items.
   * @param {number} current - The current number of items progressed.
   */
  displayProgressBar(name, total, current) {
    const bar = SceneNavigation.displayProgressBar || SceneNavigation._onLoadProgress;
    const progress = Math.round((current / total) * 100);
    bar(name, progress);
  }
}

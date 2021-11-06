import { Compressor } from './compressor.js';
import { CONSTANTS } from '../constants.js';
import {
  CreateFolderRecursive,
  FileExists,
  UploadFile,
} from '../assets/file.js';
import { ExporterData } from './exporter.js';

export default class MoulinetteImporter extends FormApplication {
  /**
   * @param {string} url - The URL containing the ExporterData payload
   * @param {string} sceneID - Optional. The specific SceneID to import, ignoring other entities unless required for that Scene
   * @param {string} actorID - Optional. The specific ActorID to import, ignoring other entities unless required for that Actor
   */
  constructor({ url = '', sceneID = '', actorID = '' } = {}) {
    super();

    if (CONSTANTS.IsV7()) {
      Dialog.prompt({
        title: game.i18n.localize('Unsupported'),
        content: game.i18n.localize('SCENE-PACKER.importer.unsupported'),
        callback: () => {},
      });
      return;
    }

    if (!url) {
      // TODO Better error checking/handling
      return;
    }
    this.process(url, {sceneID, actorID});
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
   * @param {URL|string} url - The URL to process and import.
   * @param {ProcessOptions} options - Additional options for processing
   */
  async process(url, options) {
    if (!url) {
      return;
    }

    if (typeof url === 'string') {
      this.url = new URL(url, this.url || undefined);
    }

    options = Object.assign({ sceneID: '', actorID: '' }, options);
    const { sceneID, actorID } = options;
    if (!url) {
      throw game.i18n.localize('SCENE-PACKER.importer.invalid-url-empty');
    }
    try {
      url = new URL(url);
    } catch (e) {
      throw game.i18n.format('SCENE-PACKER.importer.invalid-url', {
        url,
        err: e,
      });
    }
    const response = await Compressor.FetchWithTimeout(url, { timeout: 60000 });
    if (!response.ok) {
      throw game.i18n.format('SCENE-PACKER.importer.invalid-url', {
        url,
        err: response.statusText,
      });
    }
    const data = ExporterData.FromJSON(await response.json());
    // TODO remove debugging
    console.log('url', url);
    console.log('options', options);
    console.log('sceneID', sceneID);
    console.log('actorID', actorID);
    console.log('data', data);

    const restrictFolderIDS = [];

    const assetData = await this.fetchAssetData(
      new URL('data/assets.json', url)
    );
    /**
     * Track which assets have been imported
     * @type {Map<string, boolean>}
     */
    const assetMap = new Map();

    const sceneData = await this.fetchData(
      new URL('data/Scene.json', url),
      game.scenes,
      sceneID ? [sceneID] : []
    );
    if (sceneID) {
      // TODO ensure journals and tokens are imported
      // scene.data.notes
      // scene.data.tokens
      const scene = sceneData.find((s) => s._id === sceneID);
      if (scene?.data?.folder) {
        restrictFolderIDS.push(scene.data.folder);
      }
    }
    const actorData = await this.fetchData(
      new URL('data/Actor.json', url),
      game.actors,
      actorID ? [actorID] : []
    );
    if (actorID) {
      const actor = actorData.find((a) => a._id === actorID);
      if (actor?.data?.folder) {
        restrictFolderIDS.push(actor.data.folder);
      }
    }

    await this.importFolders(
      new URL('data/folders.json', url),
      restrictFolderIDS
    );

    if (sceneData.length) {
      console.log(`Creating ${sceneData.length} scenes`);
      await Scene.createDocuments(sceneData, { keepId: true });
      await this.ensureAssets(sceneData, assetMap, assetData);
    }
    if (actorData.length) {
      console.log(`Creating ${actorData.length} actors`);
      await Actor.createDocuments(actorData, { keepId: true });
      await this.ensureAssets(actorData, assetMap, assetData);
    }

    const journalData = await this.fetchData(
      new URL('data/JournalEntry.json', url),
      game.journal
    );
    if (journalData.length) {
      console.log(`Creating ${journalData.length} journals`);
      await JournalEntry.createDocuments(journalData, { keepId: true });
      await this.ensureAssets(journalData, assetMap, assetData);
      // TODO Replace links in Journal data
    }

    const itemData = await this.fetchData(
      new URL('data/Item.json', url),
      game.items
    );
    if (itemData.length) {
      console.log(`Creating ${itemData.length} items`);
      await Item.createDocuments(itemData, { keepId: true });
      await this.ensureAssets(itemData, assetMap, assetData);
      // TODO Replace links in Item data
    }

    const macroData = await this.fetchData(
      new URL('data/Macro.json', url),
      game.macros
    );
    if (macroData.length) {
      console.log(`Creating ${macroData.length} macros`);
      await Macro.createDocuments(macroData, { keepId: true });
      await this.ensureAssets(macroData, assetMap, assetData);
    }

    const playlistData = await this.fetchData(
      new URL('data/Playlist.json', url),
      game.playlists
    );
    if (playlistData.length) {
      console.log(`Creating ${playlistData.length} playlists`);
      await Playlist.createDocuments(playlistData, { keepId: true });
      await this.ensureAssets(playlistData, assetMap, assetData);
    }

    const rollTableData = await this.fetchData(
      new URL('data/RollTable.json', url),
      game.tables
    );
    if (rollTableData.length) {
      console.log(`Creating ${rollTableData.length} rolltables`);
      await RollTable.createDocuments(rollTableData, { keepId: true });
      await this.ensureAssets(rollTableData, assetMap, assetData);
    }

    console.log('Done');
  }

  /**
   * Ensure that all of the assets for the provided entities exist in the appropriate place.
   * @param {Object} entities - The entities to ensure assets for
   * @param {Map<string, boolean>} assetMap - A map of assets that have already been processed or exist
   * @param {Object[]} assetData - The asset data
   */
  async ensureAssets(entities, assetMap, assetData) {
    if (!entities.length) {
      return;
    }

    console.groupCollapsed(
      `Ensuring assets exists for ${entities.length} entities.`
    );
    for (const entity of entities) {
      const assets = assetData.mapping[entity._id];
      if (!assets?.length) {
        continue;
      }
      for (const asset of assets) {
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

        const exists = await FileExists(asset);
        if (exists) {
          console.log(`✅ ${asset}`);
          assetMap.set(asset, true);
          continue;
        }

        const folder = decodeURIComponent(
          asset.substring(0, asset.lastIndexOf('/'))
        );
        const filename = decodeURIComponent(asset.split('/').pop());
        // TODO Verify URL validity
        const srcURL = new URL('data/assets/' + asset, this.url);

        await CreateFolderRecursive(folder);
        // TODO Concurrent download/upload
        // TODO Better logging

        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Importer | ⬇️ ${asset}`);
        let res = await fetch(srcURL).catch(function (e) {
          ScenePacker.logType(CONSTANTS.MODULE_NAME, 'error', true,
            game.i18n.format('SCENE-PACKER.exporter.progress.download-error', {
              error: asset,
            }),
            e
          );
        });
        if (!res?.ok) {
          ui.notifications.error(
            game.i18n.format('SCENE-PACKER.exporter.progress.download-error', {
              error: asset,
            })
          );
          continue;
        }

        const blob = await res.blob();
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Importer | ⬆️️ ${asset}`);
        const response = await UploadFile(
          new File([blob], filename, {
            type: blob.type,
            lastModified: new Date(),
          }),
          folder,
        );
        // TODO handle errors and cleanup this code
        console.log(asset, response);
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Importer | ✅️️ ${asset}`);
        assetMap.set(asset, true);
      }
    }
    console.groupEnd();
  }

  /**
   * Fetch the asset data.
   * @param {URL} url - The URL to the scene JSON.
   * @return {Promise<Object[]>}
   */
  async fetchAssetData(url) {
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
   * Fetch data.
   * @param {URL} url - The URL to the journal JSON
   * @param {Object} collection - The collection that this data belongs to
   * @param {string[]} onlyIDs - Only import the data for the given IDs
   * @return {Promise<Object[]>}
   */
  async fetchData(url, collection, onlyIDs = []) {
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
}

import {AssetMap} from '../assets/data.js';
import {Compressor} from './compressor.js';
import {CONSTANTS} from '../constants.js';
import {Downloader} from './downloader.js';
import {ExtractActorAssets} from '../assets/actor.js';
import {ExtractCardAssets} from '../assets/cards.js';
import {ExtractItemAssets} from '../assets/item.js';
import {ExtractJournalEntryAssets} from '../assets/journal.js';
import {ExtractMacroAssets} from '../assets/macro.js';
import {ExtractPlaylistAssets} from '../assets/playlist.js';
import {ExtractRelatedActorData} from './related/actor.js';
import {ExtractRelatedItemData} from './related/item.js';
import {ExtractRelatedJournalData} from './related/journals.js';
import {ExtractRelatedSceneData} from './related/scene.js';
import {ExtractRollTableAssets} from '../assets/rolltable.js';
import {ExtractSceneAssets} from '../assets/scene.js';
import Hash from '../hash.js';
import {RelatedData} from './related/related-data.js';
import {UnrelatedData} from './related/unrelated-data.js';

export default class ExporterProgress extends FormApplication {
  constructor({
    packageName = '',
    packageDescription = '',
    packageCover = '',
    email = '',
    discordId = '',
    selections = [],
    exporterData = null,
  } = {}) {
    super();

    this.packageName = packageName;
    this.packageDescription = packageDescription;
    this.packageCover = packageCover;
    this.email = email;
    this.discordId = discordId;
    /**
     * @type {ExporterData | null}
     */
    this.exporterData = exporterData;
    this.selected = selections;
    this.status = '';
    this.percent = 0;
    this.domParser = new DOMParser();
    this.assetsMap = new AssetMap();
    this.relatedData = new RelatedData();
    this.unrelatedData = new UnrelatedData();
    this.totalSize = 0;
    this.speed = 0;
  }

  /**
   * Process the exporter data and return the final compressed data zip.
   * @return {Promise<{dataZip: Compressor}>}
   */
  async Process() {
    return new Promise(async (resolve, reject) => {
      let dataZip;

      try {
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Exporter | Processing ${this.selected.length} selections.`);
        this._updateStatus({
          message: `<p>${game.i18n.localize(
            'SCENE-PACKER.exporter.progress.extract-data',
          )}</p>`,
        });
        const folderMap = new Map();

        let filename = this.packageName.slugify({strict: true}) || 'export';
        dataZip = new Compressor(`${filename}-data.zip`);
        // Add an empty info file for Moulinette to detect that this is a Scene Packer module
        dataZip.AddStringToZip('', 'scene-packer.info');

        /**
         * The number of each document type that is exported. Used by the importer to display counts.
         * @type {Object<string, number>}
         */
        const exportedDocumentCount = {
          Actor: 0,
          Cards: 0,
          Item: 0,
          JournalEntry: 0,
          Macro: 0,
          Playlist: 0,
          RollTable: 0,
          Scene: 0,
        };

        const updateTotalSize = (status) => {
          this._updateStatus({
            ...status,
            totalSize: Compressor.CalculateSize([dataZip]).compressed,
          });
        };

        /**
         * Total number of items being counted in the progress bar.
         * @type {number}
         */
        let total = 0;
        /**
         * The number of items processed so far.
         * @type {number}
         */
        let processed = 0;
        /**
         * Total file size downloaded so far. For calculating overall average download speed.
         * @type {number}
         */
        let totalLoaded = 0;
        /**
         * The current speed of downloads. For calculating a smoother download speed.
         * @type {null|number}
         * @see {@link https://stackoverflow.com/a/18637230/191306}
         */
        let speed = null;
        /**
         * A time constant for use with the speed.
         * @type {number}
         */
        const TIME_CONSTANT = 5;

        const downloader = new Downloader({
          onDownloaded: (data) => {
            totalLoaded += data.blob.size || 0;
            const assetDetails = this.assetsMap.data.get(data.url);
            dataZip
              .AddBlobToZip(data.blob, `data/assets/${decodeURIComponent(assetDetails[0].storagePath)}`)
              .then(() => {
                processed++;
                updateTotalSize({
                  percent: Math.floor((processed / total) * 100),
                });
              });
          },
          onProgress: (data) => {
            if (data.complete) {
              return;
            }
            if (speed === null) {
              speed = data.speed;
            } else {
              speed += (data.speed - speed) / TIME_CONSTANT;
            }
            this._updateStatus({
              speed,
            });
          },
        });

        /**
         * Add the requested folderID to the tracking map if it isn't there already
         * walking the folder tree up, adding missing folders as we go.
         * @param {string} folderID
         */
        const addFolderHierarchy = (folderID) => {
          if (!folderMap.has(folderID)) {
            const folder = CONFIG.Folder.collection.instance.get(folderID);
            if (folder) {
              folderMap.set(folderID, folder.toJSON());
              if (CONSTANTS.IsV10orNewer()) {
                if (folder.ancestors?.length) {
                  for (const ancestor of folder.ancestors) {
                    addFolderHierarchy(ancestor.id);
                  }
                }
              } else {
                if (folder.folder) {
                  addFolderHierarchy(folder.folder);
                }
              }
            }
          }
        };

        // 'Playlist', 'Macro', 'Item', 'Actor', 'Cards', 'RollTable', 'JournalEntry', 'Scene'
        for (const type of CONSTANTS.PACK_IMPORT_ORDER) {
          if (!CONFIG[type]) {
            continue;
          }

          const ids = this.selected
            .filter((d) => d.dataset.type === type)
            .map((d) => d.value);
          ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Exporter | Processing ${ids.length} ${CONSTANTS.TYPE_HUMANISE[type]}.`);
          const documents = CONFIG[type].collection.instance.filter((s) =>
            ids.includes(s.id),
          );

          if (type !== 'Scene') {
            // Add all documents by default as unrelated, later on remove those that have relations.
            this.unrelatedData.AddDocuments(documents);
          }

          exportedDocumentCount[type] = documents.length;

          const out = documents.map((d) => (d.toJSON ? d.toJSON() : d)) || [];
          for (const document of out) {
            const hash = Hash.SHA1(document);
            setProperty(document, 'flags.scene-packer.hash', hash);
            setProperty(document, 'flags.scene-packer.moulinette-adventure-name', this.packageName);
            setProperty(document, 'flags.scene-packer.moulinette-adventure-version', this.exporterData?.version || '1.0.0');
          }
          dataZip.AddToZip(out, `data/${type}.json`);
          updateTotalSize({
            message: `<p>${game.i18n.format(
              'SCENE-PACKER.exporter.progress.compressing-data',
              {
                count: out.length,
                type: CONSTANTS.TYPE_HUMANISE[type],
              },
            )}</p>`,
          });
          if (!ids.length) {
            continue;
          }

          for (const document of documents) {
            const folderID = CONSTANTS.IsV10orNewer() ? document.folder?.id : document.data?.folder;
            if (folderID) {
              addFolderHierarchy(folderID);
            }
            let assetData;
            switch (type) {
              case 'Actor':
                assetData = await ExtractActorAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                this.relatedData.AddRelatedData(ExtractRelatedActorData(document));
                break;
              case 'Item':
                assetData = await ExtractItemAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                this.relatedData.AddRelatedData(ExtractRelatedItemData(document));
                break;
              case 'Cards':
                assetData = await ExtractCardAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                break;
              case 'Macro':
                assetData = await ExtractMacroAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                break;
              case 'Playlist':
                assetData = await ExtractPlaylistAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                break;
              case 'JournalEntry':
                assetData = await ExtractJournalEntryAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                this.relatedData.AddRelatedData(ExtractRelatedJournalData(document));
                break;
              case 'Scene':
                assetData = await ExtractSceneAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                const relatedData = ExtractRelatedSceneData(document);
                this.relatedData.AddRelatedData(relatedData);

                // Stop tracking data that is related to the scene.
                this.unrelatedData.RemoveRelations(relatedData.GetRelatedData());

                // Add thumbnails to dataZip
                const docData = CONSTANTS.IsV10orNewer() ? document : document.data;
                if (docData.thumb?.startsWith('data:')) {
                  const _thumbParts = document.thumb.split(';base64,');
                  const mime = _thumbParts[0].substring(5); // Strip off "data:"
                  const blob = new Blob([window.atob(_thumbParts[1])], {
                    type: mime,
                    encoding: 'utf-8',
                  });
                  await dataZip.AddBlobToZip(
                    blob,
                    `data/scenes/thumbs/${document.id}.png`,
                  );
                } else if (docData.thumb) {
                  const url = new URL(
                    docData.thumb,
                    window.location.href,
                  );
                  await dataZip.AddFileURLToZip(
                    url,
                    `data/scenes/thumbs/${document.id}.png`,
                  );
                }
                break;
              case 'RollTable':
                assetData = await ExtractRollTableAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                break;
            }
          }

          if (type === 'Scene') {
            const sceneInfo = documents.map((s) => {
              const sData = CONSTANTS.IsV10orNewer() ? s : s.data;
              return {
                id: s.id,
                name: s.name,
                hasDrawings: !!s.drawings?.size,
                hasLights: !!s.lights?.size,
                hasNotes: !!s.notes?.size,
                hasSounds: !!s.sounds?.size,
                hasTokens: !!s.tokens?.size,
                hasWalls: !!s.walls?.size,
                thumb: sData.thumb ? `scenes/thumbs/${s.id}.png` : null,
              };
            });
            dataZip.AddToZip(sceneInfo, `data/scenes/info.json`);
            updateTotalSize();
          } else if (type === 'Actor') {
            const actorInfo = documents.map((a) => {
              const aData = CONSTANTS.IsV10orNewer() ? a : a.data;
              return {
                id: a.id,
                name: a.name,
                img: a.img,
                hasTokenAttacherData: !!getProperty(aData, 'token.flags.token-attacher.prototypeAttached'),
              };
            });
            dataZip.AddToZip(actorInfo, `data/actors/info.json`);
            updateTotalSize();
          }
        }

        dataZip.AddToZip(
          Object.fromEntries(folderMap.entries()),
          'data/folders.json',
        );

        dataZip.AddToZip(this.assetsMap, 'data/assets.json');
        dataZip.AddToZip(this.relatedData, 'data/related-data.json');
        dataZip.AddToZip(this.unrelatedData, 'data/unrelated-data.json');
        this.exporterData = this.exporterData || {};
        this.exporterData.counts = exportedDocumentCount;
        dataZip.AddToZip(this.exporterData, `${filename}.json`);
        if (this.exporterData.cover_image) {
          await dataZip.AddFileURLToZip(
            this.exporterData.cover_image,
            `data/cover/cover.${new URL(
              this.exporterData.cover_image,
              window.location.href,
            ).pathname
              .split('.')
              .pop()}`,
          );
        }
        updateTotalSize();

        // TODO prompt for which modules images should be extracted from

        downloader.AddURLs(this.assetsMap.data.keys());
        total += downloader.urls.length;
        this._updateStatus({
          message: `<p>${game.i18n.format(
            'SCENE-PACKER.exporter.progress.compressing-assets',
            {count: downloader.urls.length},
          )}</p>`,
        });
        const startTime = new Date().getTime();
        await downloader.Process();
        let duration = (new Date().getTime() - startTime) / 1000; // seconds
        if (duration <= 0) {
          duration = 0.01;
        }
        const bps = Math.floor(totalLoaded / duration * 100) / 100;

        dataZip.Complete();

        updateTotalSize({
          percent: 100,
          speed: bps,
          message: `<h2>${game.i18n.localize(
            'SCENE-PACKER.exporter.progress.complete',
          )}</h2>`,
        });
        this._updateStatus({
          message: `<p>${game.i18n.localize(
            'SCENE-PACKER.exporter.progress.downloading',
          )}</p>`,
        });
        this._updateStatus({
          message: `<p>${game.i18n.format(
            'SCENE-PACKER.exporter.progress.next-step',
            {
              files: [dataZip.filename].join('</li><li>'),
            },
          )}</p>`,
        });

        resolve({dataZip});
      } catch (e) {
        // Clean up the zip memory
        dataZip?.Cancel();

        reject(e);
      }
    });
  }

  /** @inheritdoc */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.exporter.name'),
      id: 'scene-packer-exporter-progress',
      template:
        'modules/scene-packer/templates/export-import/exporter-progress.hbs',
      width: 680,
      height: 680,
      classes: ['scene-packer'],
      scrollY: ['ol.directory-list'],
    });
  }

  /**
   * @return {Object|Promise}
   */
  getData(options = {}) {
    return {
      packageName: this.packageName,
      selected: this.selected,
      status: this.status,
      percent: this.percent,
      complete: this.percent >= 100,
      speed: this.speed,
      totalSize: this.totalSize,
    };
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="close"]').click(this.close.bind(this));
    html.find('button[name="wait"]').click(this._updateStatus.bind(this));
  }

  /**
   * Updates the progress status.
   * @param {number} percent - What percentage to show.
   * @param {string} message - The status message to show. Supports HTML.
   * @param {number} totalSize - The total size of the entities to export.
   * @param {number} speed - The current progress speed.
   * @private
   */
  _updateStatus({
    percent = undefined,
    message = undefined,
    totalSize = undefined,
    speed = undefined,
  } = {}) {
    if (typeof percent === 'undefined' || !percent || percent < 0) {
      percent = 0;
    }
    if (percent > 100) {
      percent = 100;
    }

    if (percent) {
      this.percent = percent;
    }
    if (typeof message !== 'undefined') {
      this.status += message;
    }
    if (typeof speed !== 'undefined') {
      this.speed = speed;
    }
    if (typeof totalSize !== 'undefined') {
      this.totalSize = totalSize;
    }

    setTimeout(() => this.render(), 0);
  }
}

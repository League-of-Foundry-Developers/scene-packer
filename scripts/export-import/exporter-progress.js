import { AssetMap } from '../assets/data.js';
import { Compressor } from './compressor.js';
import { CONSTANTS } from '../constants.js';
import { Downloader } from './downloader.js';
import { ExtractActorAssets } from '../assets/actor.js';
import { ExtractItemAssets } from '../assets/item.js';
import { ExtractMacroAssets } from '../assets/macro.js';
import { ExtractPlaylistAssets } from '../assets/playlist.js';
import { ExtractSceneAssets } from '../assets/scene.js';
import { ExtractRollTableAssets } from '../assets/rolltable.js';

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
    this.totalSize = 0;
    this.speed = 0;
  }

  async Process() {
    return new Promise(async (resolve, reject) => {
      let dataZip;

      try {
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Exporter | Processing ${this.selected.length} selections.`);
        this._updateStatus({
          message: `<p>${game.i18n.localize(
            'SCENE-PACKER.exporter.progress.extract-data'
          )}</p>`,
        });
        const folderMap = new Map();

        let filename = this.packageName.slugify({ strict: true }) || 'export';
        dataZip = new Compressor('data.zip');
        // Add an empty info file for Moulinette to detect that this is a Scene Packer module
        dataZip.AddStringToZip('', 'scene-packer.info');
        if (this.exporterData) {
          dataZip.AddToZip(this.exporterData, `${filename}.json`);
          if (this.exporterData.cover_image) {
            await dataZip.AddFileURLToZip(
              this.exporterData.cover_image,
              `data/cover/cover.${new URL(
                this.exporterData.cover_image
              ).pathname
                .split('.')
                .pop()}`
            );
          }
        }

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
              .AddBlobToZip(data.blob, `data/assets/${decodeURIComponent(assetDetails[0].raw)}`)
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
              if (folder.data.parent) {
                addFolderHierarchy(folder.data.parent);
              }
            }
          }
        };

        // "Scene", "Actor", "Item", "JournalEntry", "RollTable", "Playlist", "Macro"]
        for (const type of CONSTANTS.PACK_IMPORT_ORDER) {
          const ids = this.selected
            .filter((d) => d.dataset.type === type)
            .map((d) => d.value);
          ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Exporter | Processing ${ids.length} ${CONSTANTS.TYPE_HUMANISE[type]}.`);
          const documents = CONFIG[type].collection.instance.filter((s) =>
            ids.includes(s.id)
          );
          const out = documents.map((d) => (d.toJSON ? d.toJSON() : d)) || [];
          dataZip.AddToZip(out, `data/${type}.json`);
          updateTotalSize({
            message: `<p>${game.i18n.format(
              'SCENE-PACKER.exporter.progress.compressing-data',
              {
                count: out.length,
                type: CONSTANTS.TYPE_HUMANISE[type],
              }
            )}</p>`,
          });
          if (!ids.length) {
            continue;
          }

          for (const document of documents) {
            const folderID = document.data?.folder;
            if (folderID) {
              addFolderHierarchy(folderID);
            }
            let assetData;
            switch (type) {
              case 'Actor':
                assetData = await ExtractActorAssets(document);
                this.assetsMap.AddAssets(assetData.assets);
                break;
              case 'Item':
                assetData = await ExtractItemAssets(document);
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
              case 'Scene':
                assetData = await ExtractSceneAssets(document);
                this.assetsMap.AddAssets(assetData.assets);

                // Add thumbnails to dataZip
                if (document.data.thumb?.startsWith('data:')) {
                  const _thumbParts = document.data.thumb.split(';base64,');
                  const mime = _thumbParts[0].substring(5); // Strip off "data:"
                  const blob = new Blob([window.atob(_thumbParts[1])], {
                    type: mime,
                    encoding: 'utf-8',
                  });
                  await dataZip.AddBlobToZip(
                    blob,
                    `data/scenes/thumbs/${document.id}.png`
                  );
                } else if (document.data.thumb) {
                  const url = new URL(
                    document.data.thumb,
                    window.location.href
                  );
                  await dataZip.AddFileURLToZip(
                    url,
                    `data/scenes/thumbs/${document.id}.png`
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
              return {
                id: s.id,
                hasDrawings: !!s.drawings?.size,
                hasLights: !!s.lights?.size,
                hasNotes: !!s.notes?.size,
                hasSounds: !!s.sounds?.size,
                hasTokens: !!s.tokens?.size,
                hasWalls: !!s.walls?.size,
                thumb: s.data.thumb ? `scenes/thumbs/${s.id}.png` : null,
              };
            });
            dataZip.AddToZip(sceneInfo, `data/scenes/info.json`);
            updateTotalSize();
          }
        }

        dataZip.AddToZip(
          Object.fromEntries(folderMap.entries()),
          'data/folders.json'
        );

        dataZip.AddToZip(this.assetsMap, 'data/assets.json');
        updateTotalSize();

        // TODO prompt for which modules images should be extracted from

        downloader.AddURLs(this.assetsMap.data.keys());
        total += downloader.urls.length;
        this._updateStatus({
          message: `<p>${game.i18n.format(
            'SCENE-PACKER.exporter.progress.compressing-assets',
            { count: downloader.urls.length }
          )}</p>`,
        });
        const startTime = new Date().getTime();
        await downloader.Process();
        let duration = (new Date().getTime() - startTime) / 1000; // seconds
        if (duration <= 0) {
          duration = 0.01;
        }
        const bps = totalLoaded / duration;

        dataZip.Complete();

        updateTotalSize({
          percent: 100,
          speed: bps,
          message: `<h2>${game.i18n.localize(
            'SCENE-PACKER.exporter.progress.complete'
          )}</h2>`,
        });
        this._updateStatus({
          message: `<p>${game.i18n.localize(
            'SCENE-PACKER.exporter.progress.downloading'
          )}</p>`,
        });
        this._updateStatus({
          message: `<p>${game.i18n.format(
            'SCENE-PACKER.exporter.progress.next-step',
            {
              files: [dataZip.filename].join('</li><li>'),
            }
          )}</p>`,
        });

        resolve({ dataZip });
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

  /** @inheritdoc */
  getData() {
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
  async _updateObject(event, formData) {}

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

import { AssetMap } from './data.js';
import { CONSTANTS } from '../constants.js';
import { ExtractActorAssets } from './actor.js';
import { ExtractItemAssets } from './item.js';
import { ExtractCardAssets } from './cards.js';
import { ExtractMacroAssets } from './macro.js';
import { ExtractPlaylistAssets } from './playlist.js';
import { ExtractJournalEntryAssets } from './journal.js';
import { ExtractSceneAssets } from './scene.js';
import { ExtractRollTableAssets } from './rolltable.js';
import { FileExists } from './file.js';

Handlebars.registerHelper('lookupDocumentName', function (options) {
  const {
    type = null,
    documentId = null,
  } = options.hash;
  if (!type || !documentId) {
    return '';
  }

  return fromUuidSync(`${type}.${documentId}`)?.name;
});

Handlebars.registerHelper('boldCapitals', function (str) {
  return str.replace(/([A-Z])/g, '<strong>$1</strong>');
});

/**
 * ConvertAssetsToLowercase - Application to convert all assets in a world to lowercase.
 */
export class ConvertAssetsToLowercase extends Application {
  constructor(options = {}) {
    super(options);

    this.totalAssets = 0;
    this.readyToConvert = false;
    this.processing = false;
    this.assetsMap = new AssetMap();
  }

  /** @inheritdoc */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.assets-to-lowercase.title'),
      id: 'scene-packer-assets-to-lowercase',
      template: 'modules/scene-packer/templates/assets-to-lowercase.hbs',
      classes: ['scene-packer'],
      width: Math.min(1000, window.innerWidth * 0.8),
      height: 'auto',
    });
  }

  /** @inheritdoc */
  getData(options = {}) {
    return {
      assetsMap: this.assetsMap,
      readyToConvert: this.readyToConvert,
      processing: this.processing,
      totalAssets: this.totalAssets,
    };
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="close"]')
      .click(this.close.bind(this));
    html.find('button[name="process"]')
      .click(this._process.bind(this));
    html.find('button[name="convert"]')
      .click(this._convert.bind(this));
  }

  /**
   * Process the assets in the world building the list of any that are not all lowercase, or do not exist.
   */
  async _process() {
    this.processing = true;
    this.render();

    // 'Playlist', 'Macro', 'Item', 'Actor', 'Cards', 'RollTable', 'JournalEntry', 'Scene'
    for (const type of CONSTANTS.PACK_IMPORT_ORDER) {
      if (!CONFIG[type]) {
        continue;
      }

      for (const document of CONFIG[type].collection.instance) {
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
            break;
          case 'Scene':
            assetData = await ExtractSceneAssets(document);
            this.assetsMap.AddAssets(assetData.assets);
            break;
          case 'RollTable':
            assetData = await ExtractRollTableAssets(document);
            this.assetsMap.AddAssets(assetData.assets);
            break;
        }
      }
    }

    console.log('All assets checked:', this.assetsMap.data);

    this.totalAssets = this.assetsMap.data.size;

    // Check each of the assets to see if they exist in the world.
    for (const asset of this.assetsMap.data.keys()) {
      if (asset.toLowerCase() === asset && await FileExists(asset)) {
        // File exists correctly, we can remove it from the map.
        this.assetsMap.RemoveAsset(asset);
      }
    }

    this.readyToConvert = true;
    this.render();
  }

  /**
   * Convert the assets in the world to lowercase.
   */
  async _convert() {
    for (const assets of this.assetsMap.data.values()) {
      for (const assetDetails of assets) {
        const document = await fromUuid(`${assetDetails.parentType}.${assetDetails.parentID}`);
        if (!document) {
          ScenePacker.logType(CONSTANTS.MODULE_NAME, 'warning', true, `Could not find ${assetDetails.parentType}.${assetDetails.parentID}`, assetDetails);
          continue;
        }

        const replace = assetDetails.raw.toLowerCase();
        const original = document.toJSON();
        const replacementData = JSON.stringify(original).replaceAll(`"${assetDetails.raw}`, `"${replace}`);
        if (original === replacementData) {
          continue;
        }

        const diff = foundry.utils.diffObject(original, JSON.parse(replacementData));
        if (typeof foundry.utils.isEmpty === 'function' ? foundry.utils.isEmpty(diff) : foundry.utils.isObjectEmpty(diff)) {
          continue;
        }

        console.log(`Updating assets references: ${document.documentName} ${document.id} ${document.name}`, diff);
        await document.update(diff);
      }
    }

    await this.close();
  }
}

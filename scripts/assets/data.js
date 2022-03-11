import AssetReport from '../asset-report.js';
import {IsUsingTheForge} from '../constants.js';
import {ExpandWildcard, IsPublic, IsSystem} from './file.js';

export class AssetMap {
  /**
   * Data keyed by the absolute URL of an asset.
   * @type {Map<string, AssetDetails[]>}
   */
  data = new Map();

  /**
   * Asset URLs keyed by parentID
   * @type {Map<string, Set<string>>}
   */
  mapping = new Map();

  /**
   * Adds asset details to the asset map.
   * @param {AssetDetails} assetDetails
   * @param {boolean} allowCoreAssets
   * @param {boolean} allowSystemAssets
   */
  AddAsset(
    assetDetails,
    { allowCoreAssets = false, allowSystemAssets = false } = {}
  ) {
    if (!allowCoreAssets && assetDetails.isCore) {
      return;
    }
    if (!allowSystemAssets && assetDetails.isSystem) {
      return;
    }

    if (!this.data.has(assetDetails.raw)) {
      this.data.set(assetDetails.raw, [assetDetails]);
    } else {
      this.data.get(assetDetails.raw).push(assetDetails);
    }

    if (!this.mapping.has(assetDetails.parentID)) {
      const assets = new Set();
      assets.add(assetDetails.raw);
      this.mapping.set(assetDetails.parentID, assets);
    } else {
      this.mapping.get(assetDetails.parentID).add(assetDetails.raw);
    }
  }

  /**
   * Adds asset details to the asset map.
   * @param {AssetDetails[]} assets
   * @param {boolean} allowCoreAssets
   * @param {boolean} allowSystemAssets
   */
  AddAssets(
    assets,
    { allowCoreAssets = false, allowSystemAssets = false } = {}
  ) {
    for (const assetDetails of assets) {
      this.AddAsset(assetDetails);
    }
  }

  toJSON() {
    // Convert the mapping set into an array so that it can be JSON encoded.
    const response = new Map();
    for (const [key, val] of this.mapping) {
      response.set(key, [...val]);
    }
    return {
      mapping: Object.fromEntries(response.entries()),
      data: Object.fromEntries(this.data.entries()),
    };
  }
}

/**
 * AssetData represents a single document and the various assets that it has.
 */
export class AssetData {
  /**
   * @param {string} id - The ID of the document entity.
   * @param {string} name - The name of the document entity.
   * @param {string} documentType - The type of the document entity (e.g. Actor, Item, Scene etc).
   */
  constructor({ id = '', name = '', documentType = 'Unknown' } = {}) {
    /**
     * The ID of the document entity.
     * @type {string}
     */
    this.id = id;
    /**
     * The name of the document entity.
     * @type {string}
     */
    this.name = name;
    /**
     * The type of the document entity (e.g. Actor, Item, Scene etc).
     * @type {string}
     */
    this.documentType = documentType;
    /**
     * The assets referenced in this document.
     * @type {AssetDetails[]}
     */
    this.assets = [];
    /**
     * Whether the AssetDetails in this EntityData has dependencies on other worlds/modules etc.
     * @type {boolean}
     */
    this.hasDependencies = false;
  }

  /**
   * Adds an asset reference.
   * @param {string} id - The id of the document containing the asset.
   * @param {string} key - The dot-notation key that details where in the document this asset lives.
   * @param {string} parentID - The id of the parent document containing the asset. May be the same as {@link id}
   * @param {string} parentType - The type of the parent document.
   * @param {string} asset - The asset being checked.
   * @param {string} documentType - The type of the document entity (e.g. Actor, Item, Scene etc).
   * @param {Locations} location - The location this asset exists in the world.
   */
  async AddAsset({
    id,
    key,
    parentID,
    parentType,
    asset,
    documentType = 'Unknown',
    location = AssetReport.Locations.Unknown,
  } = {}) {
    const assets = await ExpandWildcard(asset);
    const searchValue = new RegExp(`^${window.location.origin}/`);
    for (const rawAsset of assets) {
      const url = new URL(rawAsset, window.location.href);
      let asset = rawAsset;
      if (rawAsset.startsWith(`${window.location.origin}/`)) {
        asset = rawAsset.replace(searchValue, '')
      }
      this.assets.push(
        new AssetDetails({
          id,
          key,
          parentID,
          parentType,
          documentType,
          absolute: url.href,
          raw: asset,
          location,
        })
      );
    }
  }

  /**
   * Adds asset data references.
   * @param {AssetData} assetData - The asset data to add.
   */
  AddAssetData(assetData) {
    if (!assetData?.assets?.length) {
      return;
    }

    this.assets.push(...assetData.assets);
  }
}

/**
 * AssetDetails describes an asset and its relation to a document.
 */
export class AssetDetails {
  constructor({
    id = '',
    key = '',
    parentID = '',
    parentType = '',
    documentType = 'Unknown',
    absolute = '',
    raw = '',
    location = AssetReport.Locations.Unknown,
  } = {}) {
    /**
     * The id of the document containing the asset. May be the same as parentID if it is not an embeddedDocument.
     * @type {string}
     */
    this.id = id;
    /**
     * The dot-notation key that details where in the document this asset lives.
     * @type {string}
     */
    this.key = key;
    /**
     * The id of the parent document containing the asset.
     * @type {string}
     */
    this.parentID = parentID;
    /**
     * The type of the parent document.
     * @type {string}
     */
    this.parentType = parentType;
    /**
     * The type of the document entity (e.g. Actor, Item, Scene etc).
     * @type {string}
     */
    this.documentType = documentType;
    /**
     * The absolute URL to the asset.
     * @type {string}
     */
    this.absolute = absolute;
    /**
     * The raw URL to the asset.
     * @type {string}
     */
    this.raw = raw;

    this.storagePath = this.raw;
    // Remove the forge prefix from the storagePath.
    if (IsUsingTheForge() && this.storagePath.startsWith(ForgeVTT.ASSETS_LIBRARY_URL_PREFIX)) {
      this.storagePath = this.storagePath.slice(ForgeVTT.ASSETS_LIBRARY_URL_PREFIX.length);
    }

    // Remove the protocol from the storagePath.
    if (this.storagePath.startsWith('http://') || this.storagePath.startsWith('https://')) {
      const url = new URL(this.storagePath);
      this.storagePath = `${url.hostname}${url.pathname}`;
    }

    /**
     * The location this asset is.
     * @type {Locations}
     */
    this.location = location;
    /**
     * Whether this asset belongs to an embedded document.
     * @type {boolean}
     */
    this.isEmbedded = this.id !== this.parentID;
    /**
     * Whether this asset is part of the Core Foundry VTT system.
     * @type {boolean}
     */
    this.isCore = IsPublic(raw);
    /**
     * Whether this asset is part of a System within Foundry VTT.
     * @type {boolean}
     */
    this.isSystem = IsSystem(raw);
  }

  toJSON() {
    // Hide the absolute url from the returned JSON as it is not needed.
    const { absolute, ...obj } = this;

    return obj;
  }
}

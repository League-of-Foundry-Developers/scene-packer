/**
 * Constants for use within the Scene Packer module.
 * @type {Readonly<{CF_SEPARATOR: string, FLAGS_SOURCE_MODULE: string, MODULE_NAME: string, SETTING_SHOW_WELCOME_PROMPTS: string, FLAGS_PACKED_VERSION: string, SETTING_PROMPTED: string, CF_TEMP_ENTITY_NAME: string, PACK_IMPORT_ORDER: string[], FLAGS_JOURNALS: string, FLAGS_TILES: string, FLAGS_TOKENS: string, FLAGS_SCENE_JOURNAL: string, SETTING_ENABLE_CONTEXT_MENU: string, FLAGS_SCENE_POSITION: string, FLAGS_DEFAULT_PERMISSION: string, FLAGS_MACROS: string, MINIMUM_SUPPORTED_PACKER_VERSION: string, SETTING_IMPORTED_VERSION: string, FLAGS_PLAYLIST: string, TYPE_HUMANISE: {Item: string, Playlist: string, Macro: string, RollTable: string, Actor: string, Scene: string, JournalEntry: string}}>}
 */
export const CONSTANTS = Object.freeze({
  /**
   * The name of entities created by the Compendium Folders module.
   */
  CF_TEMP_ENTITY_NAME: '#[CF_tempEntity]',

  /**
   * The folder separator used by the Compendium Folders module.
   */
  CF_SEPARATOR: '#/CF_SEP/',

  /**
   * DOM Parser provides the ability to parse HTML into a DOM Document.
   * @link https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
   */
  DOM_PARSER: new DOMParser(),

  /**
   * The flag used to store default permissions values.
   */
  FLAGS_DEFAULT_PERMISSION: 'defaultPermission',

  /**
   * The flag used to store journal data.
   */
  FLAGS_JOURNALS: 'journals',

  /**
   * The flag used to store macro data.
   */
  FLAGS_MACROS: 'macros',

  /**
   * The flag that stores the version of Scene Packer that packed the data.
   */
  FLAGS_PACKED_VERSION: 'packed-with-version',

  /**
   * The flag used to store playlist data.
   */
  FLAGS_PLAYLIST: 'playlist',

  /**
   * The flag used to store journal data for a given scene.
   */
  FLAGS_SCENE_JOURNAL: 'scene-journal',

  /**
   * The flag used to store position data for a given scene.
   */
  FLAGS_SCENE_POSITION: 'scene-position',

  /**
   * The flag used to store which module owns the packed data.
   */
  FLAGS_SOURCE_MODULE: 'source-module',

  /**
   * The flag used to store tile data.
   */
  FLAGS_TILES: 'tiles',

  /**
   * The flag used to store token data.
   */
  FLAGS_TOKENS: 'tokens',

  /**
   * The hook to call when importing all entities in the pack is complete.
   * Called with a single argument of type {@link ImportedAllEntities}.
   */
  HOOKS_IMPORT_ALL_COMPLETE: 'ScenePacker.importAllComplete',

  /**
   * The hook to call when importing entities in a pack from Moulinette is complete.
   * Called with a single argument of type {@link ImportedMoulinetteEntities}.
   */
  HOOKS_IMPORTED_MOULINETTE_COMPLETE: 'ScenePacker.importMoulinetteComplete',

  /**
   * The hook to call when the Scene Packer class is available to being called.
   * Called with a single argument of type {@link ScenePacker}.
   */
  HOOKS_SCENE_PACKER_READY: 'scenePackerReady',

  /**
   * The hook to call when a scene is unpacked.
   * Called with a single argument of type {@link UnpackedScene}.
   */
  HOOKS_SCENE_UNPACKED: 'ScenePacker.sceneUnpacked',

  /**
   * Regular expression to match document links within journal entries.
   * Matches references like:
   *   @Actor[obe2mDyYDXYmxHJb]{Something or other}
   *   @Actor[obe2mDyYDXYmxHJb#sub-link]{Something or other}
   *   @Compendium[scene-packer.journals.LSbUJA9hw0vmYeSZ]{Something or other}
   *   @Compendium[scene-packer.journals.LSbUJA9hw0vmYeSZ#sub-link]{Something or other}
   */
  LINK_REGEX: /@(\w+)\[([^#\]]+)(?:#([^\]]+))?](?:{([^}]+)})/g,

  /**
   * The minimum version of packed scenes supported by this version.
   */
  MINIMUM_SUPPORTED_PACKER_VERSION: '2.0.0',

  /**
   * This name of this module
   */
  MODULE_NAME: 'scene-packer',

  /**
   * The location to store assets downloaded from Moulinette during imports by Scene Packer.
   */
  MOULINETTE_PATH: 'moulinette/adventures',

  /**
   * The order of types to import when importing all content from compendiums.
   * @type {string[]}
   */
  PACK_IMPORT_ORDER: ['Playlist', 'Macro', 'Item', 'Actor', 'Cards', 'RollTable', 'JournalEntry', 'Scene'],

  /**
   * The setting key for tracking the timeout value when processing assets.
   */
  SETTING_ASSET_TIMEOUT: 'assetTimeout',

  /**
   * The setting key for triggering the AdventureConverter class.
   */
  SETTING_CONVERT_TO_ADVENTURE_DOCUMENT: 'convertToAdventureDocument',

  /**
   * The setting key for whether to display the context menu on the Scene sidebar.
   */
  SETTING_ENABLE_CONTEXT_MENU: 'enableContextMenu',

  /**
   * The setting key for triggering the Exporter class.
   */
  SETTING_EXPORT_TO_MOULINETTE: 'exportToMoulinette',

  /**
   * The setting key for tracking previously used author in the Moulinette Exporter.
   */
  SETTING_EXPORT_TO_MOULINETTE_AUTHOR: 'exportToMoulinetteAuthor',

  /**
   * The setting key for tracking previously used discord in the Moulinette Exporter.
   */
  SETTING_EXPORT_TO_MOULINETTE_DISCORD: 'exportToMoulinetteDiscord',

  /**
   * The setting key for tracking previously used email in the Moulinette Exporter.
   */
  SETTING_EXPORT_TO_MOULINETTE_EMAIL: 'exportToMoulinetteEmail',

  /**
   * The setting key for tracking previously used tags in the Moulinette Exporter.
   */
  SETTING_EXPORT_TO_MOULINETTE_TAGS: 'exportToMoulinetteTags',

  /**
   * The setting key for tracking previously used themes in the Moulinette Exporter.
   */
  SETTING_EXPORT_TO_MOULINETTE_THEMES: 'exportToMoulinetteThemes',

  /**
   * The setting key for triggering the Importer class.
   */
  SETTING_IMPORT_FROM_ZIP: 'importFromZip',

  /**
   * The setting key for what version has been imported already. Used for tracking which dialogs to display.
   */
  SETTING_IMPORTED_VERSION: 'imported',

  /**
   * The setting key for the version of the system that last had a Scene Packer migration run against it.
   */
  SETTING_SYSTEM_MIGRATION_VERSION: 'migrationSystemVersion',

  /**
   * The setting key for what version has been prompted.
   */
  SETTING_PROMPTED: 'prompted',

  /**
   * The setting key for whether to show welcome prompts.
   */
  SETTING_SHOW_WELCOME_PROMPTS: 'showWelcomePrompts',

  /**
   * Lookup entity types and get their common language strings.
   * @type {{Actor: string, Adventure: string, Card: string, Cards: string, Item: string, JournalEntry: string, Macro: string, Playlist: string, RollTable: string, Scene: string}}
   * @enum {string}
   */
  TYPE_HUMANISE: {
    Actor: 'actors',
    Adventure: 'adventures',
    Card: 'card',
    Cards: 'cards',
    Item: 'items',
    JournalEntry: 'journal entries',
    Macro: 'macros',
    Playlist: 'playlists',
    RollTable: 'roll tables',
    Scene: 'scenes',
  },

  /**
   * Returns the version of the game instance.
   * Handles the storage structure that changed over time.
   * @return {string}
   */
  Version() {
    return game.version || game.data.version;
  },

  /**
   * Returns whether the version is at least V7
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV7orNewer(version = this.Version()) {
    return version === '0.7.0' || isNewerVersion(version, '0.7.0');
  },

  /**
   * Returns whether the version is V7
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV7(version = this.Version()) {
    return this.IsV7orNewer(version) && isNewerVersion('0.8.0', version);
  },

  /**
   * Returns whether the version is at least V8
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV8orNewer(version = this.Version()) {
    return version === '0.8.0' || isNewerVersion(version, '0.8.0');
  },

  /**
   * Returns whether the version is V8
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV8(version = this.Version()) {
    return this.IsV8orNewer(version) && isNewerVersion('9', version);
  },

  /**
   * Returns whether the version is at least V9
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV9orNewer(version = this.Version()) {
    return version === '9.0' || isNewerVersion(version, '9');
  },

  /**
   * Returns whether the version is V9
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV9(version = this.Version()) {
    return this.IsV9orNewer(version) && isNewerVersion('10', version);
  },

  /**
   * Returns whether the version is at least V10
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV10orNewer(version = this.Version()) {
    return version === '10.0' || isNewerVersion(version, '10');
  },

  /**
   * Returns whether the version is V10
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV10(version = this.Version()) {
    return this.IsV10orNewer(version) && isNewerVersion('11', version);
  },

  /**
   * Returns whether the version is at least V11
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV11orNewer(version = this.Version()) {
    return version === '11.0' || isNewerVersion(version, '11');
  },

  /**
   * Returns whether the version is V11
   * @param {string} version - The version to test. Defaults to the current game instance version.
   * @return {boolean}
   */
  IsV11(version = this.Version()) {
    return this.IsV11orNewer(version) && isNewerVersion('11', version);
  },
});

/**
 * Returns whether the instance is running on the forge
 * @return {boolean}
 */
export const IsUsingTheForge = () => {
  return typeof ForgeVTT !== 'undefined' && ForgeVTT.usingTheForge;
};

/**
 * @typedef ImportedAllEntities
 * @property {string} moduleName - The module name.
 * @property {string} adventureName - The name of the adventure.
 * @property {ScenePacker} instance - The instance of Scene Packer that was used to pack the scene.
 */

/**
 * @typedef ImportedMoulinetteEntities
 * @property {string} sceneID - Optional. The specific SceneID that was imported, along with any related data.
 * @property {string} actorID - Optional. The specific ActorID that was imported, along with any related data.
 * @property {ExporterData} info - Information about the pack that was imported.
 */

/**
 * @typedef UnpackedScene
 * @property {Object} scene - The scene that was unpacked.
 * @property {string} moduleName - The module name.
 * @property {string} adventureName - The name of the adventure.
 * @property {ScenePacker} instance - The instance of Scene Packer that was used to pack the scene.
 */

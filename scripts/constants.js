/**
 * Constants for use within the Scene Packer module.
 * @type {Readonly<{CF_SEPARATOR: string, FLAGS_SOURCE_MODULE: string, MODULE_NAME: string, SETTING_SHOW_WELCOME_PROMPTS: string, FLAGS_PACKED_VERSION: string, SETTING_PROMPTED: string, CF_TEMP_ENTITY_NAME: string, PACK_IMPORT_ORDER: string[], FLAGS_JOURNALS: string, FLAGS_TOKENS: string, FLAGS_SCENE_JOURNAL: string, SETTING_ENABLE_CONTEXT_MENU: string, FLAGS_SCENE_POSITION: string, FLAGS_DEFAULT_PERMISSION: string, FLAGS_MACROS: string, MINIMUM_SUPPORTED_PACKER_VERSION: string, SETTING_IMPORTED_VERSION: string, FLAGS_PLAYLIST: string, TYPE_HUMANISE: {Item: string, Playlist: string, Macro: string, RollTable: string, Actor: string, Scene: string, JournalEntry: string}}>}
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
   * The flag used to store token data.
   */
  FLAGS_TOKENS: 'tokens',

  /**
   * The minimum version of packed scenes supported by this version.
   */
  MINIMUM_SUPPORTED_PACKER_VERSION: '2.0.0',

  /**
   * This name of this module
   */
  MODULE_NAME: 'scene-packer',

  /**
   * The order of types to import when importing all content from compendiums.
   * @type {string[]}
   */
  PACK_IMPORT_ORDER: ['Playlist', 'Macro', 'Item', 'Actor', 'RollTable', 'JournalEntry', 'Scene'],

  /**
   * The setting key for whether to display the context menu on the Scene sidebar.
   */
  SETTING_ENABLE_CONTEXT_MENU: 'enableContextMenu',

  /**
   * The setting key for what version has been imported already. Used for tracking which dialogs to display.
   */
  SETTING_IMPORTED_VERSION: 'imported',

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
   * @type {{Item: string, Playlist: string, Macro: string, RollTable: string, Actor: string, Scene: string, JournalEntry: string}}
   */
  TYPE_HUMANISE: {
    Playlist: 'playlists',
    Macro: 'macros',
    Item: 'items',
    Actor: 'actors',
    RollTable: 'roll tables',
    JournalEntry: 'journal entries',
    Scene: 'scenes',
  },
});

/**
 * Fake Entity is used in place of a real entity, for times where operating against a real entity would throw errors.
 * @type {{update: FakeEntity.update}}
 */
export const FakeEntity = {
  update: () => {
  },
};

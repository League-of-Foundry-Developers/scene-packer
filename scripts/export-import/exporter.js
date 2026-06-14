import { CONSTANTS } from '../constants.js';
import ExporterProgress from './exporter-progress.js';
import { ExporterTemplate } from './exporter-template.js';

export default class Exporter extends FormApplication {
  constructor(object, options) {
    super(object, options);

    // TODO Support updating an "existing" export in a nice way

    this.supportsCards = !!CONFIG.Cards;

    this.Scene = this.initialize('Scene');
    this.Actor = this.initialize('Actor');
    this.Item = this.initialize('Item');
    this.JournalEntry = this.initialize('JournalEntry');
    this.RollTable = this.initialize('RollTable');
    this.Cards = this.initialize('Cards');
    this.Playlist = this.initialize('Playlist');
    this.Macro = this.initialize('Macro');
    this.selected = [];
    this.complete = false;

    this.adventureCategoryOptions = [
      {key: 'one-shot', label: 'SCENE-PACKER.exporter.options.adventure-category-one-shot'},
      {key: 'short-campaign', label: 'SCENE-PACKER.exporter.options.adventure-category-short-campaign'},
      {key: 'long-campaign', label: 'SCENE-PACKER.exporter.options.adventure-category-long-campaign'},
      {key: 'prefab', label: 'SCENE-PACKER.exporter.options.adventure-category-prefab'},
      {key: 'supplement', label: 'SCENE-PACKER.exporter.options.adventure-category-supplement'},
    ];

    const adventureThemeSuggestions = [
      {key: 'dungeon', label: 'SCENE-PACKER.exporter.options.adventure-themes.dungeon'},
      {key: 'wilderness', label: 'SCENE-PACKER.exporter.options.adventure-themes.wilderness'},
      {key: 'town', label: 'SCENE-PACKER.exporter.options.adventure-themes.town'},
      {key: 'city', label: 'SCENE-PACKER.exporter.options.adventure-themes.city'},
      {key: 'forest', label: 'SCENE-PACKER.exporter.options.adventure-themes.forest'},
      {key: 'stronghold', label: 'SCENE-PACKER.exporter.options.adventure-themes.stronghold'},
      {key: 'cave', label: 'SCENE-PACKER.exporter.options.adventure-themes.cave'},
      {key: 'mountain', label: 'SCENE-PACKER.exporter.options.adventure-themes.mountain'},
      {key: 'ruins', label: 'SCENE-PACKER.exporter.options.adventure-themes.ruins'},
      {key: 'temple', label: 'SCENE-PACKER.exporter.options.adventure-themes.temple'},
      {key: 'mansion', label: 'SCENE-PACKER.exporter.options.adventure-themes.mansion'},
      {key: 'swamp', label: 'SCENE-PACKER.exporter.options.adventure-themes.swamp'},
      {key: 'ship', label: 'SCENE-PACKER.exporter.options.adventure-themes.ship'},
      {key: 'island', label: 'SCENE-PACKER.exporter.options.adventure-themes.island'},
      {key: 'desert', label: 'SCENE-PACKER.exporter.options.adventure-themes.desert'},
      {key: 'underdark', label: 'SCENE-PACKER.exporter.options.adventure-themes.underdark'},
      {key: 'sewer', label: 'SCENE-PACKER.exporter.options.adventure-themes.sewer'},
      {key: 'feywild', label: 'SCENE-PACKER.exporter.options.adventure-themes.feywild'},
      {key: 'abyss', label: 'SCENE-PACKER.exporter.options.adventure-themes.abyss'},
      {key: 'horror', label: 'SCENE-PACKER.exporter.options.adventure-themes.horror'},
      {key: 'mystery', label: 'SCENE-PACKER.exporter.options.adventure-themes.mystery'},
      {key: 'snow', label: 'SCENE-PACKER.exporter.options.adventure-themes.snow'},
      {key: 'mega-dungeon', label: 'SCENE-PACKER.exporter.options.adventure-themes.mega-dungeon'},
      {key: 'shadowfell', label: 'SCENE-PACKER.exporter.options.adventure-themes.shadowfell'},
      {key: 'air', label: 'SCENE-PACKER.exporter.options.adventure-themes.air'},
      {key: 'heist', label: 'SCENE-PACKER.exporter.options.adventure-themes.heist'},
    ];
    this.adventureThemeSuggestions = new Set();
    const themeSuggestions = game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_THEMES);
    for (const themeSuggestion of themeSuggestions) {
      const theme = themeSuggestion.toLowerCase().trim();
      if (theme && !Array.from(this.adventureThemeSuggestions).find(t => t.key === theme)) {
        this.adventureThemeSuggestions.add({key: theme, label: theme});
      }
    }
    for (const adventureThemeSuggestion of adventureThemeSuggestions) {
      if (!Array.from(this.adventureThemeSuggestions).find(t => t.key === adventureThemeSuggestion.key)) {
        this.adventureThemeSuggestions.add(adventureThemeSuggestion);
      }
    }

    const tagSuggestions = game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_TAGS);
    this.adventureTagSuggestions = tagSuggestions.map(e => e.trim()).filter(e => e).map(e => {
      return {key: e, label: e};
    });

    this.hasSquareGrids = game.scenes.some(s => (s.grid?.type ?? s.data.gridType) === CONST.GRID_TYPES.SQUARE)
    this.hasHexGrids = game.scenes.some(s => [CONST.GRID_TYPES.HEXODDR, CONST.GRID_TYPES.HEXEVENR, CONST.GRID_TYPES.HEXODDQ, CONST.GRID_TYPES.HEXEVENQ].includes(s.grid?.type ?? s.data.gridType))
  }

  initialize(type) {
    const folders = game.folders.filter((f) => f.type === type);
    const documents = game.collections.get(type) || [];
    return {
      folders,
      documents,
      tree: this.constructor.setupFolders(folders, documents),
    };
  }

  /**
   * Populate a single folder with child folders and content
   * This method is called recursively when building the folder tree
   * @param {Folder|null} folder          A parent folder being populated or null for the root node
   * @param {Folder[]} folders            Remaining unassigned folders which may be children of this one
   * @param {ClientDocument[]} documents  Remaining unassigned documents which may be children of this one
   * @param {object} [options={}]         Options which configure population
   * @param {boolean} [options.allowChildren=true]  Allow additional child folders
   * @private
   */
  static _classifyFolderContent(folder, folders, documents, {allowChildren=true}={}) {
    const sort = folder?.sorting === "a" ? this._sortAlphabetical : this._sortStandard;

    // Partition folders into children and unassigned folders
    const [unassignedFolders, subfolders] = folders.partition(f => allowChildren && (f.folder === folder));
    subfolders.sort(sort);

    // Partition documents into folder contents and unassigned documents
    const [unassignedDocuments, contents] = documents.partition(e => e.folder === folder);
    contents.sort(sort);

    // Return the classified content
    return {folders: subfolders, documents: contents, unassignedFolders, unassignedDocuments};
  }

  /**
   * Sort two Documents using their numeric sort fields.
   * @param {Document} a    Some Document
   * @param {Document} b    Some other Document
   * @returns {number}      The sort order between documents a and b
   * @private
   */
  static _sortStandard(a, b) {
    return a.sort - b.sort;
  }

  /**
   * Sort two Documents by name, alphabetically.
   * @param {Document} a    Some Document
   * @param {Document} b    Some other Document
   * @returns {number}      The sort order between documents a and b
   * @private
   */
  static _sortAlphabetical(a, b) {
    return a.name.localeCompare(b.name);
  }

  /**
   * Given a Document type and a list of Document instances, set up the Folder tree
   * @param {Folder[]} folders        The Array of Folder objects to organize
   * @param {ClientDocument[]} documents  The Array of Document objects to organize
   * @returns {object}                A tree structure containing the folders and documents
   */
  static setupFolders(folders, documents) {
    documents = documents.filter(d => d.visible);
    const handled = new Set();
    const createNode = (root, folder, depth) => {
      return {root, folder, depth, visible: false, children: [], documents: []};
    };

    // Create the tree structure
    const tree = createNode(true, null, 0);
    const depths = [[tree]];

    // Iterate by folder depth, populating content
    for ( let depth=1; depth<=CONST.FOLDER_MAX_DEPTH+1; depth++ ) {
      const allowChildren = depth <= CONST.FOLDER_MAX_DEPTH;
      depths[depth] = [];
      const nodes = depths[depth-1];
      if ( !nodes.length ) break;
      for ( const node of nodes ) {
        const folder = node.folder;
        if ( !node.root ) { // Ensure we don't encounter any infinite loop
          if ( handled.has(folder.id) ) continue;
          handled.add(folder.id);
        }

        // Classify content for this folder
        const classified = this._classifyFolderContent(folder, folders, documents, {allowChildren});
        node.documents = classified.documents;
        node.children = classified.folders.map(folder => createNode(false, folder, depth));
        depths[depth].push(...node.children);

        // Update unassigned content
        folders = classified.unassignedFolders;
        documents = classified.unassignedDocuments;
      }
    }

    // Populate left-over folders at the root level of the tree
    for ( const folder of folders ) {
      const node = createNode(false, folder, 1);
      const classified = this._classifyFolderContent(folder, folders, documents, {allowChildren: false});
      node.documents = classified.documents;
      documents = classified.unassignedDocuments;
      depths[1].push(node);
    }

    // Populate left-over documents at the root level of the tree
    if ( documents.length ) {
      tree.documents.push(...documents);
      tree.documents.sort(this._sortStandard);
    }

    // Recursively filter visibility of the tree
    const filterChildren = node => {
      node.children = node.children.filter(child => {
        filterChildren(child);
        return child.visible;
      });
      node.visible = node.root || game.user.isGM || ((node.children.length + node.documents.length) > 0);

      // Populate some attributes of the Folder document
      if ( node.folder ) {
        node.folder.displayed = node.visible;
        node.folder.depth = node.depth;
        node.folder.children = node.children;
      }
    };
    filterChildren(tree);
    return tree;
  }

  /** @inheritdoc */
  static get defaultOptions() {
    const filters = [
      {
        inputSelector: '#scene-packer-exporter-tab-scenes input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-scenes .directory-list',
      },
      {
        inputSelector: '#scene-packer-exporter-tab-actors input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-actors .directory-list',
      },
      {
        inputSelector: '#scene-packer-exporter-tab-items input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-items .directory-list',
      },
      {
        inputSelector: '#scene-packer-exporter-tab-journals input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-journals .directory-list',
      },
      {
        inputSelector: '#scene-packer-exporter-tab-tables input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-tables .directory-list',
      },
      {
        inputSelector: '#scene-packer-exporter-tab-playlists input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-playlists .directory-list',
      },
      {
        inputSelector: '#scene-packer-exporter-tab-macros input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-macros .directory-list',
      },
    ];

    if (CONFIG.Cards) {
      filters.push({
        inputSelector: '#scene-packer-exporter-tab-cards input[name="search"]',
        contentSelector: '#scene-packer-exporter-tab-cards .directory-list',
      });
    }

    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.exporter.name'),
      id: 'scene-packer-exporter',
      template: 'modules/scene-packer/templates/export-import/exporter.hbs',
      width: 700,
      height: 720,
      closeOnSubmit: false,
      classes: ['scene-packer'],
      scrollY: ['ol.directory-list'],
      filters: filters,
      tabs: [
        {
          navSelector: '.tabs',
          contentSelector: '.content',
          initial: 'options',
        },
      ],
      dragDrop: [{ dropSelector: '#SP-export-welcomeJournal' }],
    });
  }

  /**
   * @return {Object|Promise}
   */
  getData(options = {}) {
    const worldData = CONSTANTS.IsV10orNewer() ? game.world : game.world.data;
    return {
      scenes: this.Scene,
      actors: this.Actor,
      items: this.Item,
      journals: this.JournalEntry,
      tables: this.RollTable,
      playlists: this.Playlist,
      supportsCards: this.supportsCards,
      cards: this.Cards,
      macros: this.Macro,
      summary: game.i18n.format('SCENE-PACKER.exporter.selected-count', {count: 0}),
      complete: this.complete,
      packageName: worldData.title,
      packageAuthor: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_AUTHOR) || '',
      packageVersion: worldData.version || '1.0.0',
      packageCover: worldData.background,
      packageDescription: worldData.description,
      packageDiscord: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_DISCORD) || '',
      packageEmail: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_EMAIL) || '',
      packageUrl: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_URL) || '',
      packageWelcomeJournal: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_WELCOME_JOURNAL) || '',
      adventureSystem: game.system.id,
      adventureCategoryOptions: this.adventureCategoryOptions,
      adventureThemeSuggestions: Array.from(this.adventureThemeSuggestions),
      adventureTagSuggestions: this.adventureTagSuggestions,
      hasSquareGrids: this.hasSquareGrids,
      hasHexGrids: this.hasHexGrids,
      isV9: !CONSTANTS.IsV10orNewer(),
    };
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if (event?.type === 'mcesave') {
      // Hitting save on the editor triggers a form submit, which we don't want to process.
      return;
    }

    this._updateCounts();

    const invalid = [];
    for (const field of ['packageName', 'author']) {
      if (!formData[field]) {
        invalid.push(field);
      }
    }
    if (!formData.discordId && !formData.email) {
      invalid.push('email or discordId');
    }
    if (invalid.length) {
      Dialog.prompt({
        title: game.i18n.localize('SCENE-PACKER.exporter.invalid.title'),
        content: game.i18n.format('SCENE-PACKER.exporter.invalid.fields', {
          fields: `<li>${invalid.join('</li><li>')}</li>`,
        }),
        callback: () => {},
      });
      throw new Error(
        `You must specify values for the following fields: ${invalid.join(
          ', '
        )}`
      );
    }

    const packageDescription = this.editors?.packageDescription?.mce?.getContent() || '';

    const themes = Array.from(new Set(formData.themes.split(',').map(e => e.toLowerCase().trim()).filter(e => e)));
    game.settings.set(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_THEMES, themes);

    const tags = Array.from(new Set(formData.tags.split(',').map(e => e.toLowerCase().trim()).filter(e => e)));
    game.settings.set(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_TAGS, tags);

    game.settings.set(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_AUTHOR, formData.author);
    game.settings.set(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_DISCORD, formData.discordId || '');
    game.settings.set(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_EMAIL, formData.email || '');
    game.settings.set(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_URL, formData.externalLink || '');
    game.settings.set(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_WELCOME_JOURNAL, formData.welcomeJournal || '');

    const playerLevels = [];
    if (typeof formData.playerLevelRecommended === 'number') {
      const recommended = parseInt(formData.playerLevelRecommended, 10);
      const min = parseInt(formData.playerLevelMin, 10) || recommended;
      const max = parseInt(formData.playerLevelMax, 10) || recommended;

      if (min && max && recommended) {
        playerLevels.push({min, max, recommended});
      }
    }

    if (formData.playerLevelMin?.length
      && formData.playerLevelMin?.length === formData.playerLevelMax?.length
      && formData.playerLevelMax?.length === formData.playerLevelRecommended?.length) {
      for (let i = 0; i < formData.playerLevelMin.length; i++) {
        const recommended = parseInt(formData.playerLevelRecommended[i], 10);
        const min = parseInt(formData.playerLevelMin[i], 10) || recommended;
        const max = parseInt(formData.playerLevelMax[i], 10) || recommended;

        if (min && max && recommended) {
          playerLevels.push({min, max, recommended});
        }
      }
    }

    const recommendedPlayerCount = parseInt(formData.playersRecommended, 10) || 0;

    const exporter = new ExporterProgress({
      packageName: formData.packageName,
      packageDescription: packageDescription,
      packageCover: formData.packageCover,
      email: formData.email,
      discordId: formData.discordId,
      selections: this.selected.get() || [],
      exporterData: new ExporterData({
        packageName: formData.packageName,
        author: formData.author,
        packageDescription: formData.packageDescription,
        packageCover: formData.packageCover,
        email: formData.email,
        discordId: formData.discordId,
        externalLink: formData.externalLink,
        welcomeJournal: formData.welcomeJournal,
        system: formData.system || '',
        category: formData.adventureCategory || '',
        playHours: parseInt(formData.duration, 10) || 0,
        players: {
          min: parseInt(formData.playersMin, 10) || recommendedPlayerCount,
          max: parseInt(formData.playersMax, 10) || recommendedPlayerCount,
          recommended: recommendedPlayerCount,
        },
        playerLevels: playerLevels,
        themes: themes,
        tokenStyles: formData.tokenStyles,
        pregen: formData.pregen === 'yes',
        grid: formData.grid,
        tags: tags,
        allowCompleteImport: formData.allowCompleteImport === 'yes',
        version: formData.version,
      }),
    }).render(true);
    setTimeout((exporter) => {
      this.close();
      exporter.Process().then(({ dataZip } = response) => {
        dataZip.Download();
        this.complete = true;
        this.render();
      });
    }, 500, exporter);
  }

  /**
   * Collect all form data from the exporter form
   * @returns {Object} Object containing all form metadata and document selections
   * @private
   */
  _collectFormData() {
    const form = this.element.find('form')[0];
    const formData = new FormDataExtended(form).object;

    let welcomeJournalName = '';
    if (formData.welcomeJournal) {
      const collection = CONFIG.JournalEntry?.collection?.instance;
      if (collection) {
        const journal = collection.get(formData.welcomeJournal);
        if (journal) {
          welcomeJournalName = journal.name;
        }
      }
    }

    const players = {};
    const recommendedPlayers = parseInt(formData.playersRecommended, 10);
    const minPlayers = parseInt(formData.playersMin, 10);
    const maxPlayers = parseInt(formData.playersMax, 10);
    if (recommendedPlayers) {
      players.recommended = recommendedPlayers;
    }
    if (minPlayers) {
      players.min = minPlayers;
    }
    if (maxPlayers) {
      players.max = maxPlayers;
    }

    // Collect player levels - handle both single values and arrays
    const playerLevels = [];
    if (typeof formData.playerLevelRecommended === 'number' || typeof formData.playerLevelMin === 'number' || typeof formData.playerLevelMax === 'number') {
      const recommended = parseInt(formData.playerLevelRecommended, 10);
      const min = parseInt(formData.playerLevelMin, 10);
      const max = parseInt(formData.playerLevelMax, 10);
      const playerLever = {};
      if (Number.isFinite(recommended)) {
        playerLever.recommended = recommended;
      }
      if (Number.isFinite(min)) {
        playerLever.min = min;
      }
      if (Number.isFinite(max)) {
        playerLever.max = max;
      }

      if (Object.keys(playerLever).length > 0) {
        playerLevels.push(playerLever);
      }
    }

    if (formData.playerLevelMin?.length || formData.playerLevelMax?.length || formData.playerLevelRecommended?.length) {
      const minArr = Array.isArray(formData.playerLevelMin) ? formData.playerLevelMin : [];
      const maxArr = Array.isArray(formData.playerLevelMax) ? formData.playerLevelMax : [];
      const recArr = Array.isArray(formData.playerLevelRecommended) ?
        formData.playerLevelRecommended :
        [];

      const longestLength = Math.max(minArr.length, maxArr.length, recArr.length);

      for (let i = 0; i < longestLength; i++) {
        const recommended = parseInt(recArr[i], 10);
        const min = parseInt(minArr[i], 10);
        const max = parseInt(maxArr[i], 10);

        const playerLevel = {};
        if (Number.isFinite(recommended)) {
          playerLevel.recommended = recommended;
        }
        if (Number.isFinite(min)) {
          playerLevel.min = min;
        }
        if (Number.isFinite(max)) {
          playerLevel.max = max;
        }

        if (Object.keys(playerLevel).length > 0) {
          playerLevels.push(playerLevel);
        }
      }
    }

    const tokenStyles = [];
    this.element.find('input[name="tokenStyles"]:checked').each((i, el) => {
      tokenStyles.push(el.value);
    });

    const grid = [];
    this.element.find('input[name="grid"]:checked').each((i, el) => {
      grid.push(el.value);
    });

    const pregen = formData.pregen === 'yes';

    const themes = Array.from(new Set(
      (formData.themes || '').split(',')
        .map(e => e.toLowerCase().trim())
        .filter(e => e)
    ));

    const tags = Array.from(new Set(
      (formData.tags || '').split(',')
        .map(e => e.toLowerCase().trim())
        .filter(e => e)
    ));

    const documentTypes = [...CONSTANTS.PACK_IMPORT_ORDER, 'Folder'];
    const selections = {};

    documentTypes.forEach(type => {
      selections[type] = [];
      this.element.find(`input[data-type="${type}"]:checked`).each((i, el) => {
        const id = el.value;
        const collection = CONFIG[type]?.collection?.instance;
        if (collection) {
          const doc = collection.get(id);
          if (doc) {
            selections[type].push({
              id: doc.id,
              name: doc.name,
            });
          }
        }
      });
    });

    // Capture individually-selected playlist sounds. PlaylistSound is an
    // embedded document (no top-level collection), so resolve its name by
    // looking it up inside the playlists. This lets a saved template carry the
    // exact sounds a package uses, so the playlist is trimmed on export.
    selections.PlaylistSound = [];
    this.element.find('input[data-type="PlaylistSound"]:checked').each((i, el) => {
      const id = el.value;
      let name = id;
      for (const playlist of game.playlists) {
        const sound = playlist.sounds.get(id);
        if (sound) {
          name = sound.name;
          break;
        }
      }
      selections.PlaylistSound.push({ id, name });
    });

    return {
      name: formData.packageName,
      author: formData.author,
      version: formData.version,
      description: this.editors?.packageDescription?.mce?.getContent() || '',
      cover_image: formData.packageCover,
      external_link: formData.externalLink,
      email: formData.email,
      discordId: formData.discordId,
      system: formData.system || '',
      category: formData.adventureCategory || '',
      play_hours: parseInt(formData.duration, 10) || 0,
      welcome_journal: formData.welcomeJournal,
      welcome_journal_name: welcomeJournalName,
      allow_complete_import: formData.allowCompleteImport === 'yes',
      players: players,
      player_levels: playerLevels,
      token_styles: tokenStyles,
      grid: grid,
      pregen: pregen,
      themes: themes,
      tags: tags,
      selections: selections,
    };
  }

  /**
   * Handler for Save Template button
   * @param {Event} event
   */
  async _saveTemplate(event) {
    event.preventDefault();

    try {
      const template = new ExporterTemplate(this._collectFormData());
      template.download();

      ui.notifications.info(game.i18n.localize('SCENE-PACKER.exporter.template.save-success'));
    } catch (err) {
      console.error('Error saving template:', err);
      ui.notifications.error(
        game.i18n.format('SCENE-PACKER.exporter.template.load-error', { error: err.message })
      );
    }
  }

  /**
   * Handler for Load Template button
   * @param {Event} event
   */
  async _loadTemplate(event) {
    event.preventDefault();

    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const template = ExporterTemplate.fromJSON(text);
        const missing = template.getMissingItems();

        if (missing.length > 0) {
          const proceed = await this._showMissingItemsDialog(missing);
          if (!proceed) {
            return;
          }
        }

        await this._applyTemplate(template);

        ui.notifications.info(game.i18n.localize('SCENE-PACKER.exporter.template.load-success'));
      } catch (err) {
        console.error('Error loading template:', err);
        ui.notifications.error(
          game.i18n.format('SCENE-PACKER.exporter.template.load-error', { error: err.message })
        );
      }
    };

    input.click();
  }

  /**
   * Show dialog warning about missing items
   * @param {Array} missingItems - Array of missing items
   * @returns {Promise<boolean>} True if user wants to proceed
   */
  async _showMissingItemsDialog(missingItems) {
    const content = await renderTemplate(
      'modules/scene-packer/templates/export-import/template-missing-documents.hbs',
      { missingItems }
    );

    return Dialog.confirm({
      title: game.i18n.localize('SCENE-PACKER.exporter.template.missing-title'),
      content: content,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });
  }

  /**
   * Apply a template to the form
   * @param {ExporterTemplate} template
   */
  async _applyTemplate(template) {
    this.element.find('#SP-export-packageName').val(template.name || '');
    this.element.find('#SP-export-author').val(template.author || '');
    this.element.find('#SP-export-version').val(template.version || '');
    this.element.find('#SP-export-packageCover').val(template.cover_image || '');
    this.element.find('#SP-export-email').val(template.email || '');
    this.element.find('#SP-export-discordId').val(template.discordId || '');
    this.element.find('#SP-export-externalLink').val(template.external_link || '');
    this.element.find('#SP-export-welcomeJournal').val(template.welcome_journal || '');
    this.element.find('#SP-export-system').val(template.system || '');
    this.element.find('#SP-export-adventureCategory').val(template.category || '');
    this.element.find('#SP-export-duration').val(template.play_hours || '');

    if (this.editors?.packageDescription?.mce) {
      this.editors.packageDescription.mce.setContent(template.description || '');
    }

    if (template.players) {
      this.element.find('#SP-export-playersRecommended').val(template.players.recommended || '');
      this.element.find('#SP-export-playersMin').val(template.players.min || '');
      this.element.find('#SP-export-playersMax').val(template.players.max || '');
    }

    const playerLevelsContainer = this.element.find('#SP-export-player-levels-add').parent();
    playerLevelsContainer.find('.form-group').not(':first').remove();

    if (template.player_levels && template.player_levels.length > 0) {
      const firstRow = playerLevelsContainer.find('.form-group').first();
      const firstLevel = template.player_levels[0];
      firstRow.find('input[name="playerLevelRecommended"]').val(firstLevel.recommended || '');
      firstRow.find('input[name="playerLevelMin"]').val(firstLevel.min || '');
      firstRow.find('input[name="playerLevelMax"]').val(firstLevel.max || '');

      for (let i = 1; i < template.player_levels.length; i++) {
        const level = template.player_levels[i];
        const playerLevelContent = `<div class="form-group">
                <input type="number" name="playerLevelRecommended" min="0" value="${level.recommended || ''}" placeholder="${game.i18n.localize('SCENE-PACKER.exporter.options.adventure-player-level-recommended-placeholder')}" autocomplete="off">
                <input type="number" name="playerLevelMin" min="0" value="${level.min || ''}" placeholder="${game.i18n.localize('SCENE-PACKER.exporter.options.adventure-player-level-min-placeholder')}" autocomplete="off">
                <input type="number" name="playerLevelMax" min="0" value="${level.max || ''}" placeholder="${game.i18n.localize('SCENE-PACKER.exporter.options.adventure-player-level-max-placeholder')}" autocomplete="off">
                <span class="spacer"></span>
              </div>`;
        $(playerLevelContent).insertBefore(this.element.find('#SP-export-player-levels-add'));
      }
    }

    this.element.find('input[name="grid"]').prop('checked', false);
    if (template.grid && Array.isArray(template.grid)) {
      template.grid.forEach(gridType => {
        this.element.find(`input[name="grid"][value="${gridType}"]`).prop('checked', true);
      });
    }

    this.element.find('input[name="tokenStyles"]').prop('checked', false);
    if (template.token_styles && Array.isArray(template.token_styles)) {
      template.token_styles.forEach(style => {
        this.element.find(`input[name="tokenStyles"][value="${style}"]`).prop('checked', true);
      });
    }

    if (template.pregen) {
      this.element.find('#SP-export-pregen-yes').prop('checked', true);
      this.element.find('#SP-export-pregen-no').prop('checked', false);
    } else {
      this.element.find('#SP-export-pregen-yes').prop('checked', false);
      this.element.find('#SP-export-pregen-no').prop('checked', true);
    }

    if (template.allow_complete_import) {
      this.element.find('#SP-export-allow-import-yes').prop('checked', true);
      this.element.find('#SP-export-allow-import-no').prop('checked', false);
    } else {
      this.element.find('#SP-export-allow-import-yes').prop('checked', false);
      this.element.find('#SP-export-allow-import-no').prop('checked', true);
    }

    if (template.themes && Array.isArray(template.themes)) {
      this.element.find('#SP-export-theme').val(template.themes.join(', '));
    }

    if (template.tags && Array.isArray(template.tags)) {
      this.element.find('#SP-export-tags').val(template.tags.join(', '));
    }

    this.element.find('div.tab:not([data-tab=options]) input[type="checkbox"]').prop('checked', false);

    if (template.selections) {
      const documentTypes = ['Scene', 'Actor', 'Item', 'JournalEntry', 'RollTable', 'Cards', 'Playlist', 'Macro', 'Folder'];

      documentTypes.forEach(type => {
        if (template.selections[type] && Array.isArray(template.selections[type])) {
          template.selections[type].forEach(item => {
            const collection = CONFIG[type]?.collection?.instance;
            if (collection && collection.get(item.id)) {
              this.element.find(`input[data-type="${type}"][value="${item.id}"]`).prop('checked', true);
            }
          });
        }
      });

      // Restore individually-selected playlist sounds. PlaylistSound is an
      // embedded document with no top-level CONFIG collection, so it is handled
      // separately from the documentTypes loop above: just tick the matching
      // sound checkbox if it exists in the rendered playlist tree.
      if (Array.isArray(template.selections.PlaylistSound)) {
        template.selections.PlaylistSound.forEach(item => {
          this.element.find(`input[data-type="PlaylistSound"][value="${item.id}"]`).prop('checked', true);
        });
      }
    }

    let scenePackerExporter = $('#scene-packer-exporter');
    this.selected = scenePackerExporter.find('div.tab:not([data-tab=options]) input[type="checkbox"]:checked');

    this._updateCounts();
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    const directory = html.find('.directory-list');
    const entries = directory.find('.directory-item');

    html.find('.collapse-all').click(this.collapseAll.bind(this));
    html.find('.toggle-all').click(this.toggleAll.bind(this));
    directory.on('click', '.folder-header', this._toggleFolder.bind(this));
    directory.on(
      'click',
      '.directory-item.entity',
      this._onClickEntityName.bind(this)
    );
    directory.on(
      'click',
      "input[type='checkbox']",
      this._onClickCheckbox.bind(this)
    );

    const themesInput = html.find('#SP-export-theme');
    html.find('#SP-export-theme-suggestions').on('change', (event) => {
      const themes = new Set(themesInput.val().split(',').map(e => e.trim()).filter(e => e));
      const theme = event.target.value;
      if (theme && !themes.has(theme)) {
        themes.add(theme);
        themesInput.val(Array.from(themes).join(', '));
      }
    });

    const tagsInput = html.find('#SP-export-tags');
    html.find('#SP-export-tags-suggestions').on('change', (event) => {
      const tags = new Set(tagsInput.val().split(',').map(e => e.trim()).filter(e => e));
      const tag = event.target.value;
      if (tag && !tags.has(tag)) {
        tags.add(tag);
        tagsInput.val(Array.from(tags).join(', '));
      }
    });

    html.find('#SP-export-player-levels-add').on('click', (event) => {
      const playerLevelContent = `<div class="form-group">
              <input type="number" name="playerLevelRecommended" min="0" value="" placeholder="${game.i18n.localize('SCENE-PACKER.exporter.options.adventure-player-level-recommended-placeholder')}" autocomplete="off">
              <input type="number" name="playerLevelMin" min="0" value="" placeholder="${game.i18n.localize('SCENE-PACKER.exporter.options.adventure-player-level-min-placeholder')}" autocomplete="off">
              <input type="number" name="playerLevelMax" min="0" value="" placeholder="${game.i18n.localize('SCENE-PACKER.exporter.options.adventure-player-level-max-placeholder')}" autocomplete="off">
              <span class="spacer"></span>
            </div>`;
      $(playerLevelContent).insertBefore($(event.target));
    });

    // Intersection Observer
    for (const directoryElement of directory) {
      const observer = new IntersectionObserver(
        this._onLazyLoadImage.bind(this),
        { root: directoryElement }
      );
      entries.each((i, li) => observer.observe(li));
    }

    html.find('button[name="close"]').click(this.close.bind(this));
    html.find('.save-template').click(this._saveTemplate.bind(this));
    html.find('.load-template').click(this._loadTemplate.bind(this));
  }

  /** @inheritdoc */
  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event?.dataTransfer?.getData('text/plain'));
    } catch (err) {
      return;
    }

    if (data?.type !== 'JournalEntry') {
      return;
    }

    if (!data?.id && data?.uuid) {
      data.id = data.uuid.split('.').pop();
    }

    if (!data?.id) {
      return;
    }

    event.target.value = data.id;
  }

  /**
   * Handle clicking on a Checkbox
   * @param {Event} event   The originating click event
   * @protected
   */
  _onClickCheckbox(event) {
    event.stopPropagation();
    const element = event.currentTarget;
    const isBeingTicked = $(element).prop('checked');
    let $input = $(element).closest('li').find('input[type="checkbox"]');
    $input.prop('checked', isBeingTicked);
    if (isBeingTicked) {
      $input.parents('.directory-item.folder').children('header').find('input[type="checkbox"]').prop('checked', isBeingTicked);
    }

    const playlistSounds = $(element).closest('ul.playlist-sounds');
    if (playlistSounds.length) {
      // Allow playlist sounds to be individually selected within a playlist
      const checkboxes = playlistSounds.find('input[type="checkbox"]');
      const numChecked = checkboxes.filter(':checked').length;
      const allChecked = checkboxes.length === numChecked;
      if (numChecked > 0 && !allChecked) {
        // Indeterminate state
        playlistSounds.siblings('label').find('input[type="checkbox"]').prop('checked', false).prop('indeterminate', true);
      } else if (allChecked) {
        // All checked
        playlistSounds.siblings('label').find('input[type="checkbox"]').prop('checked', true).prop('indeterminate', false);
      } else {
        // None checked
        playlistSounds.siblings('label').find('input[type="checkbox"]').prop('checked', false).prop('indeterminate', false);
      }
    }
    this._updateCounts();
  }

  /**
   * Handle clicking on an Entity name
   * @param {Event} event   The originating click event
   * @protected
   */
  _onClickEntityName(event) {
    if (event.target instanceof HTMLAnchorElement) {
      // Clicked a direct link
      return;
    }

    const playlistSounds = $(event.target).closest('ul.playlist-sounds');
    if (playlistSounds.length) {
      // Bubble the event up to the individual checkbox
      return;
    }

    event.preventDefault();
    const element = event.currentTarget;
    const $input = $(element).find('input[type="checkbox"]');
    const isBeingTicked = !$input.prop('checked');
    $input.prop('checked', isBeingTicked);
    if (isBeingTicked) {
      $input.parents('.directory-item.folder').children('header').find('input[type="checkbox"]').prop('checked', isBeingTicked);
    }
    this._updateCounts();
  }

  /**
   * Updates the count of entities selected
   */
  _updateCounts() {
    let scenePackerExporter = $('#scene-packer-exporter');
    this.selected = scenePackerExporter.find('div.tab:not([data-tab=options]) input[type="checkbox"]:checked');
    scenePackerExporter
      .find('footer p.summary')
      .text(
        game.i18n.format('SCENE-PACKER.exporter.selected-count', {
          count: this.selected.length,
        })
      );
  }

  /**
   * Collapse all subfolders
   */
  collapseAll() {
    this.element.find('li.folder').addClass('collapsed').removeClass('expanded');
  }

  /**
   * Toggle all checkboxes on this tab
   * @param {MouseEvent} event    The originating click event
   */
  toggleAll(event) {
    const container = $(event.currentTarget).closest('div.tab');
    const $toggeler = container.find('.toggle-all');
    $toggeler.data('state', !$toggeler.data('state'));
    container
      .find('input[type="checkbox"]')
      .prop('checked', $toggeler.data('state'));
    this._updateCounts();
  }

  /**
   * Handle toggling the collapsed or expanded state of a folder
   * @param {MouseEvent} event    The originating click event
   */
  _toggleFolder(event) {
    let folder = $(event.currentTarget.parentElement);
    let collapsed = folder.hasClass('collapsed');

    // Expand
    if (collapsed) {
      folder.removeClass('collapsed').addClass('expanded');
    } // Collapse
    else {
      folder.addClass('collapsed').removeClass('expanded');
      folder.find('.folder').addClass('collapsed').removeClass('expanded');
    }
  }

  /** @inheritdoc */
  _onSearchFilter(event, query, rgx, html) {
    const isSearch = !!query;
    let entityIds = new Set();
    let folderIds = new Set();

    // Match documents and folders
    if (isSearch && this[html.dataset.entity]) {
      // Match document names
      for (let d of this[html.dataset.entity].documents) {
        if (rgx.test(SearchFilter.cleanQuery(d.name))) {
          entityIds.add(d.id);
          const folderId = CONSTANTS.IsV10orNewer() ? d.folder?.id : d.data.folder;
          if (folderId) {
            folderIds.add(folderId);
          }
        }
      }

      // Match folder tree
      const includeFolders = (fids) => {
        const folders = this[html.dataset.entity].folders.filter((f) =>
          fids.has(f.id)
        );
        const pids = new Set();
        if (CONSTANTS.IsV10orNewer()) {
          const parentIDs = folders.filter((f) => f.ancestors?.length).map((f) => f.ancestors.map((a) => a.id)).flat();
          if (parentIDs.length) {
            pids.add(...parentIDs);
          }
        } else {
          const parentIDs = folders.filter((f) => f.data.parent).map((f) => f.data.parent);
          if (parentIDs.length) {
            pids.add(...parentIDs);
          }
        }
        if (pids.size) {
          pids.forEach((p) => folderIds.add(p));
          includeFolders(pids);
        }
      };
      includeFolders(folderIds);
    }

    // Toggle each directory item
    for (let el of html.querySelectorAll('.directory-item')) {
      // Entities
      if (el.classList.contains('entity')) {
        el.style.display =
          !isSearch || entityIds.has(el.dataset.entityId) ? 'flex' : 'none';
      }

      // Folders
      if (el.classList.contains('folder')) {
        let match = isSearch && folderIds.has(el.dataset.folderId);
        el.style.display = !isSearch || match ? 'flex' : 'none';
        if (isSearch && match) {
          el.classList.remove('collapsed');
          el.classList.add('expanded');
        } else {
          el.classList.toggle(
            'collapsed',
            !game.folders._expanded[el.dataset.folderId]
          );
          el.classList.toggle(
            'expanded',
            game.folders._expanded[el.dataset.folderId]
          );
        }
      }
    }
  }

  /**
   * Handle lazy loading for images to only load them once they become observed
   * @param {HTMLElement[]} entries               The entries which are now observed
   * @param {IntersectionObserver} observer       The intersection observer instance
   */
  _onLazyLoadImage(entries, observer) {
    for (let e of entries) {
      if (!e.isIntersecting) {
        continue;
      }
      const li = e.target;

      // Background Image
      if (li.dataset.backgroundImage) {
        li.style['background-image'] = `url("${li.dataset.backgroundImage}")`;
        delete li.dataset.backgroundImage;
      }

      // Avatar image
      const img = li.querySelector('img');
      if (img && img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }

      // No longer observe the target
      observer.unobserve(e.target);
    }
  }
}

/**
 * Exporter Data represents the data set that gets sent to and from Moulinette.
 */
export class ExporterData {
  constructor({
    packageName = '',
    author = '',
    packageDescription = '',
    packageCover = '',
    email = '',
    discordId = '',
    externalLink = '',
    welcomeJournal = '',
    system = '',
    category = '',
    playHours = 0,
    players = {min: 0, max: 0, recommended: 0},
    playerLevels = [],
    tokenStyles = [],
    pregen = false,
    grid = [],
    themes = [],
    tags = [],
    allowCompleteImport = true,
    version = '1.0.0',
  } = {}) {
    this.name = packageName;
    this.author = author;
    this.version = version;
    this.description = packageDescription;
    this.external_link = externalLink;
    this.cover_image = packageCover;
    this.email = email;
    this.discordId = discordId;
    this.allow_complete_import = allowCompleteImport;
    this.system = system;
    this.category = category;
    this.play_hours = playHours;
    this.players = players;
    this.player_levels = playerLevels;
    this.token_styles = tokenStyles;
    this.pregen = pregen;
    this.grid = grid;
    this.themes = themes;
    this.tags = tags;
    this.welcome_journal = welcomeJournal;
    /**
     * @type {Object<string, number>}
     */
    this.counts = {};
  }

  /**
   * Triggers a download of the exporter data as JSON.
   */
  DownloadJSON() {
    const content = JSON.stringify(this, null, 2);
    const filename = this.name.slugify({ strict: true }) || 'export';

    if (typeof foundry?.utils?.saveDataToFile === 'function') {
      foundry.utils.saveDataToFile(content, 'text/json', `${filename}.json`);
    } else {
      const blob = new Blob([content], {type: 'text/json'});

      // Create an element to trigger the download
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `${filename}.json`;

      // Dispatch a click event to the element
      a.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, view: window}));
      setTimeout(() => window.URL.revokeObjectURL(a.href), 100);
    }
  }

  /**
   * Parse JSON into ExporterData
   * @param {object|string} json - The JSON to assign
   * @return {ExporterData}
   */
  static FromJSON(json) {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }
    return Object.assign(new ExporterData(), json);
  }
}

import { CONSTANTS } from '../constants.js';
import ExporterProgress from './exporter-progress.js';

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

    return mergeObject(super.defaultOptions, {
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
      summary: game.i18n.format('SCENE-PACKER.exporter.selected-count', {
        count:
          this.Scene.documents.size +
          this.Actor.documents.size +
          this.Item.documents.size +
          this.Cards.documents.size +
          this.JournalEntry.documents.size +
          this.RollTable.documents.size +
          this.Playlist.documents.size +
          this.Macro.documents.size,
      }),
      complete: this.complete,
      packageName: worldData.title,
      packageAuthor: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_AUTHOR) || '',
      packageVersion: worldData.version || '1.0.0',
      packageCover: worldData.background,
      packageDescription: worldData.description,
      packageDiscord: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_DISCORD) || '',
      packageEmail: game.settings.get(CONSTANTS.MODULE_NAME, CONSTANTS.SETTING_EXPORT_TO_MOULINETTE_EMAIL) || '',
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
    let $input = $(element).closest('li').find('input[type="checkbox"]');
    $input.prop('checked', $(element).prop('checked'));
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
    event.preventDefault();
    const $input = $(event.currentTarget).find('input[type="checkbox"]');
    $input.prop('checked', !$input.prop('checked'));
    this._updateCounts();
  }

  /**
   * Updates the count of entities selected
   */
  _updateCounts() {
    let scenePackerExporter = $('#scene-packer-exporter');
    this.selected = scenePackerExporter
      .find('input[type="checkbox"]:checked')
      .filter((i, e) => e.dataset.type !== 'Folder');
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
    this.element.find('li.folder').addClass('collapsed');
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
      folder.removeClass('collapsed');
    } // Collapse
    else {
      folder.addClass('collapsed');
      folder.find('.folder').addClass('collapsed');
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
        } else {
          el.classList.toggle(
            'collapsed',
            !game.folders._expanded[el.dataset.folderId]
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
    const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    if (typeof window.navigator.msSaveBlob !== 'undefined') {
      // IE doesn't allow using a blob object directly as link href.
      // Workaround for "HTML7007: One or more blob URLs were
      // revoked by closing the blob for which they were created.
      // These URLs will no longer resolve as the data backing
      // the URL has been freed."
      window.navigator.msSaveBlob(blob, `${filename}.json`);
      return;
    }

    // Create a link pointing to the ObjectURL containing the blob
    const blobURL = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.setAttribute('href', blobURL);
    tempLink.setAttribute('download', `${filename}.json`);
    // Safari thinks _blank anchor are pop ups. We only want to set _blank
    // target if the browser does not support the HTML5 download attribute.
    // This allows you to download files in desktop safari if pop up blocking
    // is enabled.
    if (typeof tempLink.download === 'undefined') {
      tempLink.setAttribute('target', '_blank');
    }
    tempLink.click();

    setTimeout(() => {
      // For Firefox it is necessary to delay revoking the ObjectURL
      URL.revokeObjectURL(blobURL);
    }, 200);
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

import { CONSTANTS } from '../constants.js';
import ExporterProgress from './exporter-progress.js';

export default class Exporter extends FormApplication {
  constructor() {
    super();

    // TODO Support updating an "existing" export in a nice way

    if (CONSTANTS.IsV7()) {
      Dialog.prompt({
        title: game.i18n.localize('Unsupported'),
        content: game.i18n.localize('SCENE-PACKER.exporter.unsupported'),
        callback: () => {},
      });
      return;
    }

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
  }

  initialize(type) {
    const folders = game.folders.filter((f) => f.type === type);
    const documents = game.collections.get(type)?.filter((e) => e.visible) || [];
    return {
      folders,
      documents,
      tree: SidebarDirectory.setupFolders(folders, documents),
    };
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
          this.Scene.documents.length +
          this.Actor.documents.length +
          this.Item.documents.length +
          this.Cards.documents.length +
          this.JournalEntry.documents.length +
          this.RollTable.documents.length +
          this.Playlist.documents.length +
          this.Macro.documents.length,
      }),
      complete: this.complete,
    };
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    this._updateCounts();

    // TODO Implement validation properly
    const invalid = [];
    for (const field of ['packageName', 'packageDescription']) {
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

    const exporter = new ExporterProgress({
      packageName: formData.packageName,
      packageDescription: formData.packageDescription,
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
        allowCompleteImport: formData.allowCompleteImport === 'yes',
        version: formData.version,
      }),
    }).render(true);
    setTimeout((exporter) => {
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

    if (data?.type !== 'JournalEntry' || !data?.id) {
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
          if (d.data.folder) {
            folderIds.add(d.data.folder);
          }
        }
      }

      // Match folder tree
      const includeFolders = (fids) => {
        const folders = this[html.dataset.entity].folders.filter((f) =>
          fids.has(f.id)
        );
        const pids = new Set(
          folders.filter((f) => f.data.parent).map((f) => f.data.parent)
        );
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
    this.welcome_journal = welcomeJournal;
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

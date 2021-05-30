import ModuleSelect from './asset-report/module-select.js';

/**
 * Report on assets
 */
export default class AssetReport extends FormApplication {
  constructor(...args) {
    super(...args);
    this.allowedModules = [];
    this.domParser = new DOMParser();
    this._webExternal = true;

    this.assetMaps = {
      [AssetReport.Sources.Actor]: new Map(),
      [AssetReport.Sources.Item]: new Map(),
      [AssetReport.Sources.JournalEntry]: new Map(),
      [AssetReport.Sources.Macro]: new Map(),
      [AssetReport.Sources.Playlist]: new Map(),
      [AssetReport.Sources.RollTable]: new Map(),
      [AssetReport.Sources.Scene]: new Map(),
    };

    /**
     * @type {AssetDetails[]}
     */
    this.toProcess = [];
    /**
     * Stores a lookup for whether assets resolve successfully
     * @type {Map<string, boolean>}
     */
    this.assetResolver = new Map();

    let templates = [
      'templates/asset-report/partials/details.html',
    ];

    templates = templates.map(t => `modules/scene-packer/${t}`);
    loadTemplates(templates);

    const selectModules = new Promise((resolve, reject) => new ModuleSelect(resolve, reject).render(true));
    selectModules.then(({selections, webExternal} = result) => {
      this.allowedModules = selections;
      this._webExternal = webExternal;

      this.ParseSceneAssets();
      this.ParseActorAssets();
      this.ParseJournalAssets();
      this.ParseItemAssets();
      this.ParsePlaylistAssets();
      this.ParseMacroAssets();
      this.ParseRollTableAssets();

      /**
       * Keep track of the original request URL in an ordered array.
       * @type {string[]}
       */
      const assetRequests = [];
      /**
       * Keep track of the asset responses in the same order as the asset requests.
       * @type {Promise<Response>[]}
       */
      const assetResponses = [];

      // Resolve all of the assets to see if they exist on the server.
      const totalToResolve = this.assetResolver.size;
      if (!totalToResolve) {
        Dialog.prompt({
          title: game.i18n.localize('SCENE-PACKER.asset-report.no-assets'),
          content: `<p>${game.i18n.localize('SCENE-PACKER.asset-report.no-assets-details')}</p>`,
          label: game.i18n.localize('Close'),
          callback: () => {
          },
        });
        return;
      }
      const d = new Dialog({
        title: game.i18n.localize('SCENE-PACKER.asset-report.processing-assets'),
        content: `<p>${game.i18n.format('SCENE-PACKER.asset-report.processing-assets-count', {count: totalToResolve})}</p>`,
        buttons: {
          ok: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('Ok'),
            callback: () => {
            },
          },
        },
        default: 'ok',
      });
      d.render(true);

      for (const assetRequest of this.assetResolver.keys()) {
        assetRequests.push(assetRequest);
        assetResponses.push(AssetReport.FetchWithTimeout(assetRequest, {
          method: 'HEAD',
          headers: {
            'request-url': assetRequest,
          },
        }));
      }

      Promise.allSettled(assetResponses).then(responses => {
        if (d && typeof d.close === 'function') {
          d.close();
        }
        // Store whether the asset resolves.
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const request = assetRequests[i];
          this.assetResolver.set(request, response?.value?.ok || false);
        }
        // Update each asset reference with the new dependency value.
        this.toProcess.forEach(assetDetail => {
          if (this.assetResolver.has(assetDetail.asset)) {
            assetDetail.hasDependency = assetDetail.hasDependency || !this.assetResolver.get(assetDetail.asset);
          }
          const entityData = this.assetMaps[assetDetail.parentType].get(assetDetail.parentID);
          if (entityData) {
            entityData.assetDetails.push(assetDetail);
          }
        });
        // Calculate the overall dependency values.
        Object.values(AssetReport.Sources).forEach(type => {
          for (const entry of this.assetMaps[type].values()) {
            entry.hasDependencies = entry.assetDetails.some(a => a.hasDependency);
          }
        });

        // Render the Asset Report details
        this.render(true);
      });
    }).catch(() => {
      // NOOP
    });
  }

  /** @inheritdoc */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.asset-report.name'),
      id: 'asset-report',
      template: 'modules/scene-packer/templates/asset-report/report.html',
      width: 680,
      height: 'auto',
      classes: ['asset-report'],
      scrollY: ['.report-details'],
    });
  }

  /** @inheritdoc */
  getData(options) {
    return {
      sources: AssetReport.Sources,
      ...this.getAssetData(),
    };
  }

  /**
   * @return {{actors: AssetDetails[], macros: AssetDetails[], tables: AssetDetails[], playlists: AssetDetails[], scenes: AssetDetails[], items: AssetDetails[], journals: AssetDetails[]}}
   */
  getAssetData() {
    return {
      actors: Array.from(this.assetMaps[AssetReport.Sources.Actor].values()).sort((a, b) => a.name.localeCompare(b.name)),
      items: Array.from(this.assetMaps[AssetReport.Sources.Item].values()).sort((a, b) => a.name.localeCompare(b.name)),
      journals: Array.from(this.assetMaps[AssetReport.Sources.JournalEntry].values()).sort((a, b) => a.name.localeCompare(b.name)),
      macros: Array.from(this.assetMaps[AssetReport.Sources.Macro].values()).sort((a, b) => a.name.localeCompare(b.name)),
      playlists: Array.from(this.assetMaps[AssetReport.Sources.Playlist].values()).sort((a, b) => a.name.localeCompare(b.name)),
      tables: Array.from(this.assetMaps[AssetReport.Sources.RollTable].values()).sort((a, b) => a.name.localeCompare(b.name)),
      scenes: Array.from(this.assetMaps[AssetReport.Sources.Scene].values()).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="close"]').click(this.close.bind(this));
    html.find('button[name="copy"]').click(this._onCopy.bind(this));
    html.find('span.tag.toggle-dependencies').click(this._onToggleDependencies.bind(this));
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
  }

  /**
   * Handle copying to clipboard
   * @private
   */
  _onCopy(event) {
    event.preventDefault();

    const text = JSON.stringify(this.getAssetData(), null, 2);

    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    ui.notifications.info(
      game.i18n.localize('SCENE-PACKER.asset-report.copied-to-clipboard'),
      {},
    );

    this.close();
  }

  /**
   * Handle showing or hiding the display of location dependencies
   * @private
   */
  _onToggleDependencies(event) {
    event.preventDefault();
    const $tag = $(event.currentTarget);
    const $text = $tag.find('span');
    const show = game.i18n.localize('SCENE-PACKER.asset-report.show');
    const hide = game.i18n.localize('SCENE-PACKER.asset-report.hide');
    $text.text($text.text() === show ? hide : show);
    $tag.closest('.overview').siblings('.dependencies').toggle();
  }

  /**
   * LazyValue returns a function that can be executed at a later stage.
   * @param {function} func The function to execute lazily
   * @return {function(): *}
   */
  static LazyValue(func) {
    let isCalled = false;
    let result;

    return () => {
      if (!isCalled) {
        isCalled = true;
        result = func();
      }

      return result;
    };
  }

  /**
   * Wrapper around {@link fetch} to include a timeout.
   * Defaults to 5sec.
   * @param {RequestInfo} resource
   * @param {RequestInit} options
   * @return {Promise<Response>}
   */
  static async FetchWithTimeout(resource, options) {
    const {timeout = 5000} = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);

    return response;
  }

  /**
   * Sources of assets within the world.
   */
  static Sources = {
    Actor: 'actors',
    Item: 'items',
    JournalEntry: 'journal',
    Macro: 'macros',
    Playlist: 'playlists',
    RollTable: 'tables',
    Scene: 'scenes',
  };

  /**
   * Locations that assets can be.
   */
  static Locations = {
    ActorImage: 'actor-image',
    ActorTokenImage: 'actor-token-image',
    ActorItemImage: 'actor-item-image',
    ActorEffectImage: 'actor-effect-image',
    ItemImage: 'item-image',
    ItemEffectImage: 'item-effect-image',
    ItemEmbeddedImage: 'item-embedded-image',
    JournalImage: 'journal-image',
    JournalEmbeddedImage: 'journal-embedded-image',
    MacroImage: 'macro-image',
    PlaylistPath: 'playlist-path',
    RollTableImage: 'roll-table-image',
    RollTableResultImage: 'roll-table-result-image',
    SceneBackground: 'scene-background',
    SceneForeground: 'scene-foreground',
    SceneNoteIcon: 'scene-note-icon',
    SceneTileImage: 'scene-tile-image',
    SceneDrawingImage: 'scene-drawing-texture',
    SceneTokenImage: 'scene-token-image',
    SceneTokenEffectIcon: 'scene-token-effect-icon',
  };

  /**
   * @typedef {Object} EntityData
   * @property {string} id - The ID of the document entity.
   * @property {string} name - The name of the document entity.
   * @property {string} type - The type of the document entity.
   * @property {string} css - CSS class to apply to links.
   * @property {AssetDetails[]} assetDetails - Asset details of the document entity.
   * @property {boolean} hasDependencies - Whether the AssetDetails in this EntityData has dependencies on other worlds/modules etc.
   */

  /**
   * @typedef {Object} AssetDetails
   * @property {string} parentID - The id of the document containing the asset.
   * @property {string} parentType - The type of the parent document.
   * @property {string} asset - The asset being checked.
   * @property {Locations} location - The location this asset exists in the world.
   * @property {'core'|'system'|'module'|'world'|'external'|'data'|'custom'|'Unknown'} type - The type of asset this is.
   * @property {string} owner - The module or system this asset belongs to and only useful for these two {@param type}'s.
   * @property {boolean} hasDependency - Whether this asset has a dependency on other worlds/modules etc.
   */

  /**
   * Schedules a given asset's details to be checked
   * @param {string} parentID - The id of the document containing the asset.
   * @param {string} parentType - The type of the parent document.
   * @param {string} asset - The asset being checked.
   * @param {Locations} location - The location this asset exists in the world.
   */
  CheckAsset(parentID, parentType, asset, location) {
    this.toProcess.push((() => {
      /**
       * @type {AssetDetails}
       */
      const details = {
        parentID,
        parentType,
        asset,
        location,
        type: 'Unknown',
        owner: 'Unknown',
        hasDependency: false,
      };

      if (!asset) {
        return details;
      }

      if (!this.assetResolver.has(asset)) {
        this.assetResolver.set(asset, false);
      }

      // Make checks easier
      let _asset = asset.toLowerCase();
      if (_asset.startsWith(`${window.location.origin}/`)) {
        _asset = _asset.replace(`${window.location.origin}/`, '');
      }

      // Check for data URLs, they have no dependencies
      if (_asset.startsWith('data:')) {
        details.type = 'data';

        return details;
      }

      // Check core assets, they have no dependencies
      if (['icons/', 'ui/'].some(a => _asset.startsWith(a))) {
        details.type = 'core';

        return details;
      }

      // Check system assets
      if (_asset.startsWith('systems/')) {
        const system = _asset.split('/')[1];
        details.type = 'system';
        details.owner = system || 'Unknown';
        if (system !== game.system.id) {
          details.hasDependency = true;
        }

        return details;
      }

      // Parse world assets
      if (_asset.startsWith('worlds/')) {
        const world = _asset.split('/')[1];
        details.type = 'world';
        details.owner = world || 'Unknown';
        details.hasDependency = true;

        return details;
      }

      // Check external http[s] urls, list as having dependencies
      if (['http://', 'https://'].some(a => _asset.startsWith(a))) {
        details.type = 'external';
        details.hasDependency = this._webExternal;
        try {
          const url = new URL(asset);
          if (url.origin) {
            details.owner = url.origin;
          }
        } catch (e) {
          // An error means that it should be treated as having a dependency
          details.hasDependency = true;
        }

        return details;
      }

      // Check modules against allowed modules
      if (_asset.startsWith('modules/')) {
        const module = _asset.split('/')[1];
        details.type = 'module';
        details.owner = module || 'Unknown';
        if (!this.allowedModules.includes(module)) {
          details.hasDependency = true;
        }

        return details;
      }

      // Any other location is a custom location so has a dependency
      details.type = 'custom';
      details.owner = 'Unknown';
      details.hasDependency = true;

      return details;
    })());
  }

  /**
   * Parses world Scenes for all of their assets.
   * Sets the {@link EntityData} for the world Scenes, keyed by scene.id
   * @return {Number} The number of Scenes checked.
   */
  ParseSceneAssets() {
    const entities = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entities.push(...game[AssetReport.Sources.Scene].contents);
    } else {
      entities.push(...game[AssetReport.Sources.Scene].entities);
    }
    for (let i = 0; i < entities.length; i++) {
      const scene = entities[i];

      /**
       * @type {EntityData}
       */
      const entityData = {
        id: scene.id,
        name: scene.name,
        type: AssetReport.Sources.Scene,
        css: 'fa-map',
        assetDetails: [],
        hasDependencies: false,
      };

      if (scene.data.img) {
        this.CheckAsset(scene.id, AssetReport.Sources.Scene, scene.data.img, AssetReport.Locations.SceneBackground);
      }

      if (scene.data.foreground) {
        this.CheckAsset(scene.id, AssetReport.Sources.Scene, scene.data.foreground, AssetReport.Locations.SceneForeground);
      }

      const notes = [];
      const tiles = [];
      const drawings = [];
      const tokens = [];

      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (scene.data.notes?.size) {
          notes.push(...Array.from(scene.data.notes.values()));
        }
        if (scene.data.tiles?.size) {
          tiles.push(...Array.from(scene.data.tiles.values()));
        }
        if (scene.data.drawings?.size) {
          drawings.push(...Array.from(scene.data.drawings.values()));
        }
        if (scene.data.tokens?.size) {
          tokens.push(...Array.from(scene.data.tokens.values()));
        }
      } else {
        if (scene.data.notes?.length) {
          notes.push(...scene.data.notes);
        }
        if (scene.data.tiles?.length) {
          tiles.push(...scene.data.tiles);
        }
        if (scene.data.drawings?.length) {
          drawings.push(...scene.data.drawings);
        }
        if (scene.data.tokens?.length) {
          tokens.push(...scene.data.tokens);
        }
      }

      notes.forEach(note => {
        const icon = note?.data?.icon || note?.icon;
        if (icon) {
          this.CheckAsset(scene.id, AssetReport.Sources.Scene, icon, AssetReport.Locations.SceneNoteIcon);
        }
      });

      tiles.forEach(tile => {
        const img = tile?.data?.img || tile?.img;
        if (img) {
          this.CheckAsset(scene.id, AssetReport.Sources.Scene, img, AssetReport.Locations.SceneTileImage);
        }
      });

      drawings.forEach(drawing => {
        const texture = drawing?.data?.texture || drawing?.texture;
        if (texture) {
          this.CheckAsset(scene.id, AssetReport.Sources.Scene, texture, AssetReport.Locations.SceneDrawingImage);
        }
      });

      tokens.forEach(token => {
        const img = token?.data?.img || token?.img;
        if (img) {
          this.CheckAsset(scene.id, AssetReport.Sources.Scene, img, AssetReport.Locations.SceneTokenImage);
        }
        const effects = token?.data?.actorData?.effects || token?.actorData?.effects || [];
        for (let j = 0; j < effects.length; j++) {
          const effect = effects[j];
          if (effect?.icon) {
            this.CheckAsset(scene.id, AssetReport.Sources.Scene, effect.icon, AssetReport.Locations.SceneTokenEffectIcon);
          }
        }
      });

      this.assetMaps[AssetReport.Sources.Scene].set(entityData.id, entityData);
    }

    return entities.length;
  }

  /**
   * Parses world Actors for all of their assets.
   * Sets the {@link EntityData} for the world Actors, keyed by actor.id
   * @return {Number} The number of Actors checked.
   */
  ParseActorAssets() {
    const entities = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entities.push(...game[AssetReport.Sources.Actor].contents);
    } else {
      entities.push(...game[AssetReport.Sources.Actor].entities);
    }
    for (let i = 0; i < entities.length; i++) {
      const actor = entities[i];

      /**
       * @type {EntityData}
       */
      const entityData = {
        id: actor.id,
        name: actor.name,
        type: AssetReport.Sources.Actor,
        css: 'fa-user',
        assetDetails: [],
        hasDependencies: false,
      };

      if (actor.data.img) {
        this.CheckAsset(actor.id, AssetReport.Sources.Actor, actor.data.img, AssetReport.Locations.ActorImage);
      }

      const tokenImage = actor.token?.img || actor.data?.token?.img;
      if (tokenImage) {
        this.CheckAsset(actor.id, AssetReport.Sources.Actor, tokenImage, AssetReport.Locations.ActorTokenImage);
      }

      const items = [];
      const effects = [];

      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (actor.data.items?.size) {
          items.push(...Array.from(actor.data.items.values()));
        }
        if (actor.data.effects?.size) {
          effects.push(...Array.from(actor.data.effects.values()));
        }
      } else {
        if (actor.data.items?.length) {
          items.push(...actor.data.items);
        }
        if (actor.data.effects?.length) {
          effects.push(...actor.data.effects);
        }
      }

      items.forEach(item => {
        const img = item?.data?.img || item?.img;
        if (img) {
          this.CheckAsset(actor.id, AssetReport.Sources.Actor, img, AssetReport.Locations.ActorItemImage);
        }
      });

      effects.forEach(effect => {
        const img = effect?.data?.img || effect?.icon;
        if (img) {
          this.CheckAsset(actor.id, AssetReport.Sources.Actor, img, AssetReport.Locations.ActorEffectImage);
        }
      });

      this.assetMaps[AssetReport.Sources.Actor].set(entityData.id, entityData);
    }

    return entities.length;
  }

  /**
   * Parses world Journals for all of their assets.
   * Sets the {@link EntityData} for the world Journals, keyed by journal.id
   * @return {Number} The number of Journals checked.
   */
  ParseJournalAssets() {
    const entities = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entities.push(...game[AssetReport.Sources.JournalEntry].contents);
    } else {
      entities.push(...game[AssetReport.Sources.JournalEntry].entities);
    }
    for (let i = 0; i < entities.length; i++) {
      const journal = entities[i];

      /**
       * @type {EntityData}
       */
      const entityData = {
        id: journal.id,
        name: journal.name,
        type: AssetReport.Sources.JournalEntry,
        css: 'fa-book-open',
        assetDetails: [],
        hasDependencies: false,
      };

      if (journal.data.img) {
        this.CheckAsset(journal.id, AssetReport.Sources.JournalEntry, journal.data.img, AssetReport.Locations.JournalImage);
      }

      if (journal.data.content) {
        const doc = this.domParser.parseFromString(journal.data.content, 'text/html');
        const images = doc.getElementsByTagName('img');
        for (const image of images) {
          if (image?.src) {
            this.CheckAsset(journal.id, AssetReport.Sources.JournalEntry, image.src, AssetReport.Locations.JournalEmbeddedImage);
          }
        }
      }

      this.assetMaps[AssetReport.Sources.JournalEntry].set(entityData.id, entityData);
    }

    return entities.length;
  }

  /**
   * Parses world Items for all of their assets.
   * Sets the {@link EntityData} for the world Items, keyed by item.id
   * @return {Number} The number of Items checked.
   */
  ParseItemAssets() {
    const entities = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entities.push(...game[AssetReport.Sources.Item].contents);
    } else {
      entities.push(...game[AssetReport.Sources.Item].entities);
    }
    for (let i = 0; i < entities.length; i++) {
      const item = entities[i];

      /**
       * @type {EntityData}
       */
      const entityData = {
        id: item.id,
        name: item.name,
        type: AssetReport.Sources.Item,
        css: 'fa-suitcase',
        assetDetails: [],
        hasDependencies: false,
      };

      if (item.data.img) {
        this.CheckAsset(item.id, AssetReport.Sources.Item, item.data.img, AssetReport.Locations.ItemImage);
      }

      const effects = [];
      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (item.data.effects?.size) {
          effects.push(...Array.from(item.data.effects.values()));
        }
      } else {
        if (item.data.effects?.length) {
          effects.push(...item.data.effects);
        }
      }

      effects.forEach(effect => {
        const icon = effect?.data?.icon || effect?.icon;
        if (icon) {
          this.CheckAsset(item.id, AssetReport.Sources.Item, icon, AssetReport.Locations.ItemEffectImage);
        }
      });

      const itemDescription = item.data?.description?.value || item.data?.data?.description?.value;
      if (itemDescription) {
        const doc = this.domParser.parseFromString(itemDescription, 'text/html');
        const images = doc.getElementsByTagName('img');
        for (const image of images) {
          if (image?.src) {
            this.CheckAsset(item.id, AssetReport.Sources.Item, image.src, AssetReport.Locations.ItemEmbeddedImage);
          }
        }
      }

      this.assetMaps[AssetReport.Sources.Item].set(entityData.id, entityData);
    }

    return entities.length;
  }

  /**
   * Parses world Playlists for all of their assets.
   * Sets the {@link EntityData} for the world Playlists, keyed by playlist.id
   * @return {Number} The number of Playlists checked.
   */
  ParsePlaylistAssets() {
    const entities = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entities.push(...game[AssetReport.Sources.Playlist].contents);
    } else {
      entities.push(...game[AssetReport.Sources.Playlist].entities);
    }
    for (let i = 0; i < entities.length; i++) {
      const playlist = entities[i];

      /**
       * @type {EntityData}
       */
      const entityData = {
        id: playlist.id,
        name: playlist.name,
        type: AssetReport.Sources.Playlist,
        css: 'fa-music',
        assetDetails: [],
        hasDependencies: false,
      };

      const sounds = [];

      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (playlist.data.sounds?.size) {
          sounds.push(...Array.from(playlist.data.sounds.values()));
        }
      } else {
        if (playlist.data.sounds?.length) {
          sounds.push(...playlist.data.sounds);
        }
      }

      sounds.forEach(sound => {
        let path = sound?.data?.path || sound?.path;
        if (path) {
          const flags = sound?.data?.flags || sound?.flags;
          if (flags?.bIsStreamed && flags?.streamingApi === 'youtube' && flags?.streamingId) {
            // This is a streaming sound from youtube
            path = `https://www.youtube.com/watch?v=${flags.streamingId}`;
          }
          this.CheckAsset(playlist.id, AssetReport.Sources.Playlist, path, AssetReport.Locations.PlaylistPath);
        }
      });

      this.assetMaps[AssetReport.Sources.Playlist].set(entityData.id, entityData);
    }

    return entities.length;
  }

  /**
   * Parses world Macros for all of their assets.
   * Sets the {@link EntityData} for the world Macros, keyed by macro.id
   * @return {Number} The number of Macros checked.
   */
  ParseMacroAssets() {
    const entities = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entities.push(...game[AssetReport.Sources.Macro].contents);
    } else {
      entities.push(...game[AssetReport.Sources.Macro].entities);
    }
    for (let i = 0; i < entities.length; i++) {
      const macro = entities[i];

      /**
       * @type {EntityData}
       */
      const entityData = {
        id: macro.id,
        name: macro.name,
        type: AssetReport.Sources.Macro,
        css: 'fa-terminal',
        assetDetails: [],
        hasDependencies: false,
      };

      if (macro.data.img) {
        this.CheckAsset(macro.id, AssetReport.Sources.Macro, macro.data.img, AssetReport.Locations.MacroImage);
      }

      this.assetMaps[AssetReport.Sources.Macro].set(entityData.id, entityData);
    }

    return entities.length;
  }

  /**
   * Parses world RollTables for all of their assets.
   * Sets the {@link EntityData} for the world RollTables, keyed by table.id
   * @return {Number} The number of RollTables checked.
   */
  ParseRollTableAssets() {
    const entities = [];
    if (!isNewerVersion('0.8.0', game.data.version)) {
      entities.push(...game[AssetReport.Sources.RollTable].contents);
    } else {
      entities.push(...game[AssetReport.Sources.RollTable].entities);
    }
    for (let i = 0; i < entities.length; i++) {
      const table = entities[i];

      /**
       * @type {EntityData}
       */
      const entityData = {
        id: table.id,
        name: table.name,
        type: AssetReport.Sources.RollTable,
        css: 'fa-th-list',
        assetDetails: [],
        hasDependencies: false,
      };

      if (table.data.img) {
        this.CheckAsset(table.id, AssetReport.Sources.RollTable, table.data.img, AssetReport.Locations.RollTableImage);
      }

      const results = [];

      if (!isNewerVersion('0.8.0', game.data.version)) {
        if (table.data.results?.size) {
          results.push(...Array.from(table.data.results.values()));
        }
      } else {
        if (table.data.results?.length) {
          results.push(...table.data.results);
        }
      }

      results.forEach(tableResult => {
        const img = tableResult?.data?.img || tableResult?.img;
        if (img) {
          this.CheckAsset(table.id, AssetReport.Sources.RollTable, img, AssetReport.Locations.RollTableResultImage);
        }
      });

      this.assetMaps[AssetReport.Sources.RollTable].set(entityData.id, entityData);
    }

    return entities.length;
  }

}

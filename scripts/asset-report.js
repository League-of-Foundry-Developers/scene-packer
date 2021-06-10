import ModuleSelect from './asset-report/module-select.js';

/**
 * Report on assets
 */
export default class AssetReport extends FormApplication {
  constructor({scene = null} = {}) {
    super();
    this.allowedModules = [];
    this.domParser = new DOMParser();
    this._webExternal = true;
    this.sceneName = scene?.name || '';
    this.mode = scene ? AssetReport.Modes.Scene : AssetReport.Modes.World;
    /** @type {Object} */
    this.moduleToCheck = null;

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

    if (scene) {
      this.runReport({scene: scene});
    } else {
      new Dialog({
        title: game.i18n.localize('SCENE-PACKER.asset-report.name'),
        content: `<p>${game.i18n.localize('SCENE-PACKER.asset-report.selector')}</p><hr>`,
        buttons: {
          world: {
            icon: '<i class="fas fa-globe"></i>',
            label: game.i18n.localize('World'),
            callback: () => {
              this.runReport();
              this.close();
            },
          },
          module: {
            icon: '<i class="fas fa-atlas"></i>',
            label: game.i18n.localize('Module'),
            callback: () => {
              this.close();

              let modules = game.data.modules.filter(m => m.packs?.length && m.active);
              let content = `<p>${game.i18n.localize('SCENE-PACKER.asset-report.module-select.mini')}</p>`;
              if (!modules.length) {
                content += `<p>${game.i18n.localize('SCENE-PACKER.asset-report.module-select.none')}</p>`;
              } else {
                content += '<select id="module-name">';
                modules.forEach(m => {
                  content += `<option value="${m.id}">${m.id}</option>`;
                });
                content += '</select>';
              }
              content += '<hr>';
              new Dialog({
                title: game.i18n.localize('SCENE-PACKER.asset-report.name'),
                content: content,
                buttons: {
                  world: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize('Next'),
                    callback: (html) => {
                      this.close();

                      let moduleName = html.find('#module-name')[0]?.value;
                      if (moduleName) {
                        this.runReport({moduleName});
                      }
                    },
                  },
                  cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize('Cancel'),
                    callback: () => {
                      this.close();
                    },
                  },
                },
                default: 'world',
              }).render(true);
            },
          },
        },
        default: 'world',
      }).render(true);
    }
  }

  /**
   * Runs the Asset Report
   * @param {Object|null} scene - The specific Scene to run a report against or null to report on everything.
   * @param {String} moduleName - The module name to run the report against.
   */
  runReport({scene = null, moduleName = ''} = {}) {
    if (moduleName) {
      this.mode = AssetReport.Modes.Module;
      const module = game.modules.get(moduleName);
      if (module) {
        this.moduleToCheck = module;
      } else {
        return;
      }
    }
    const selectModules = new Promise((resolve, reject) => new ModuleSelect(resolve, reject, {
      mode: this.mode,
      scene,
    }).render(true));
    selectModules.then(async ({selections, webExternal} = result) => {
      this.allowedModules = selections;
      this._webExternal = webExternal;
      const di = new Dialog({
        title: game.i18n.localize('SCENE-PACKER.asset-report.name'),
        content: `<p>${game.i18n.format('SCENE-PACKER.asset-report.wait', {
          type: AssetReport.Sources.Scene,
        })}</p>`,
        buttons: {
          close: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('Close'),
            callback: () => {
              this.close();
            },
          },
        },
        default: 'close',
      });
      di.render(true);
      await this.ParseSceneAssets(scene);
      if (!scene) {
        di.data.content = `<p>${game.i18n.format('SCENE-PACKER.asset-report.wait', {
          type: AssetReport.Sources.Actor,
        })}</p>`;
        di.render();
        await this.ParseActorAssets();
        di.data.content = `<p>${game.i18n.format('SCENE-PACKER.asset-report.wait', {
          type: AssetReport.Sources.JournalEntry,
        })}</p>`;
        di.render();
        await this.ParseJournalAssets();
        di.data.content = `<p>${game.i18n.format('SCENE-PACKER.asset-report.wait', {
          type: AssetReport.Sources.Item,
        })}</p>`;
        di.render();
        await this.ParseItemAssets();
        di.data.content = `<p>${game.i18n.format('SCENE-PACKER.asset-report.wait', {
          type: AssetReport.Sources.Playlist,
        })}</p>`;
        di.render();
        await this.ParsePlaylistAssets();
        di.data.content = `<p>${game.i18n.format('SCENE-PACKER.asset-report.wait', {
          type: AssetReport.Sources.Macro,
        })}</p>`;
        di.render();
        await this.ParseMacroAssets();
        di.data.content = `<p>${game.i18n.format('SCENE-PACKER.asset-report.wait', {
          type: AssetReport.Sources.RollTable,
        })}</p>`;
        di.render();
        await this.ParseRollTableAssets();
      }
      if (di && typeof di.close === 'function') {
        // Wrap in a setTimeout to make sure the application has finished rendering it, otherwise it won't close.
        setTimeout(() => {
          di.close({force: true});
        }, 0)
      }

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
        content: `<p>${game.i18n.format('SCENE-PACKER.asset-report.processing-assets-count', {
          count: 0,
          total: totalToResolve,
        })}</p>`,
        buttons: {
          close: {
            icon: '<i class="fas fa-check"></i>',
            label: game.i18n.localize('Close'),
            callback: () => {
              this.close();
            },
          },
        },
        default: 'close',
      });
      d.render(true);

      const resolveAsset = async (iterator) => {
        for (let [index, assetRequest] of iterator) {
          d.data.content = `<p>${game.i18n.format('SCENE-PACKER.asset-report.processing-assets-count', {
            count: index + 1,
            total: totalToResolve,
          })}</p>`;
          d.render();
          // Set via index position due to concurrency
          assetRequests[index] = assetRequest;
          assetResponses[index] = await AssetReport.FetchWithTimeout(assetRequest, {
            method: 'HEAD',
            mode: 'no-cors',
          });
        }
      };

      const iterator = Array.from(this.assetResolver.keys()).entries();
      const workers = new Array(Math.min(10, totalToResolve)).fill(iterator).map(resolveAsset);

      Promise.allSettled(workers).then(() => {
        if (d && typeof d.close === 'function') {
          // Wrap in a setTimeout to make sure the application has finished rendering it, otherwise it won't close.
          setTimeout(() => {
            d.close({force: true});
          }, 0)
        }
        // Store whether the asset resolves.
        for (let i = 0; i < assetResponses.length; i++) {
          const response = assetResponses[i];
          const request = assetRequests[i];
          this.assetResolver.set(request, response?.ok || false);
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
    const assetData = this.getAssetData();
    const dependencies = {};
    for (const [key, value] of Object.entries(assetData)) {
      dependencies[key] = value.filter(d => d.hasDependencies).length;
    }
    return {
      sources: AssetReport.Sources,
      sceneName: this.sceneName,
      dependencies,
      ...assetData,
    };
  }

  /**
   * @return {{actors: AssetDetails[], macros: AssetDetails[], tables: AssetDetails[], playlists: AssetDetails[], scenes: AssetDetails[], items: AssetDetails[], journals: AssetDetails[]}}
   */
  getAssetData() {
    return {
      actors: Array.from(this.assetMaps[AssetReport.Sources.Actor].values())
        .sort((a, b) => a.name.localeCompare(b.name)),
      items: Array.from(this.assetMaps[AssetReport.Sources.Item].values())
        .sort((a, b) => a.name.localeCompare(b.name)),
      journals: Array.from(this.assetMaps[AssetReport.Sources.JournalEntry].values())
        .sort((a, b) => a.name.localeCompare(b.name)),
      macros: Array.from(this.assetMaps[AssetReport.Sources.Macro].values())
        .sort((a, b) => a.name.localeCompare(b.name)),
      playlists: Array.from(this.assetMaps[AssetReport.Sources.Playlist].values())
        .sort((a, b) => a.name.localeCompare(b.name)),
      tables: Array.from(this.assetMaps[AssetReport.Sources.RollTable].values())
        .sort((a, b) => a.name.localeCompare(b.name)),
      scenes: Array.from(this.assetMaps[AssetReport.Sources.Scene].values())
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="close"]').click(this.close.bind(this));
    html.find('button[name="copy"]').click(this._onCopy.bind(this));
    html.find('.asset-list span.tag.toggle-dependencies').click(this._onToggleDependencies.bind(this));
    html.find('h2').click(this._onToggleDependenciesList.bind(this));
    html.find('#hide-ok').change(this._onToggleHideOk.bind(this));
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
  }

  /**
   * Handle copy button
   * @private
   */
  _onCopy(event) {
    event.preventDefault();

    const assetData = this.getAssetData();
    const data = {};
    Object.keys(assetData).forEach(k => {
      const entities = assetData[k].filter(d => d.hasDependencies);
      if (entities.length) {
        entities.forEach(entity => {
          entity.assetDetails = entity.assetDetails.filter(d => d.hasDependency);
        });
        data[k] = entities;
      }
    });
    const text = JSON.stringify(data, null, 2);

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
   * Handle showing or hiding the list of dependencies
   * @private
   */
  _onToggleDependenciesList(event) {
    event.preventDefault();
    const $tag = $(event.currentTarget);
    const $icon = $tag.find('i.fas').toggleClass('fa-angle-double-down fa-angle-double-up');
    $tag.siblings('ul').toggle();
  }

  /**
   * Handle showing or hiding the list of dependencies
   * @private
   */
  _onToggleHideOk(event) {
    $(event.currentTarget).closest('footer').siblings('div.report-details').find('ul.asset-list > li:not(.has-dependencies)').toggle();
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
   * The mode that the Asset Report is operating in.
   */
  static Modes = {
    Scene: 'scene',
    Module: 'module',
    World: 'world',
  };

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
   * @property {string} pack - The pack this entity belongs to.
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
   * Gets the contents of `type` for the packs beloging to {@link moduleToCheck}
   * @param {String} type
   * @return {String[]}
   */
  async getPackContents(type) {
    const entities = [];
    const modules = this.moduleToCheck.packs.filter(p => p.entity === type);
    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      const pack = game.packs.get(`${module.package}.${module.name}`);
      if (!pack) {
        continue;
      }
      if (!isNewerVersion('0.8.0', game.data.version)) {
        const contents = await pack.getDocuments();
        entities.push(...contents.filter(s => s.name !== '#[CF_tempEntity]'));
      } else {
        const contents = await pack.getContent();
        entities.push(...contents.filter(s => s.name !== '#[CF_tempEntity]'));
      }
    }

    return entities;
  }

  /**
   * Parses world Scenes for all of their assets.
   * Sets the {@link EntityData} for the world Scenes, keyed by scene.id
   * @param {Object} scene The scene to parse. Will parse all Scenes if none are provided.
   * @return {Number} The number of Scenes checked.
   */
  async ParseSceneAssets(scene) {
    const entities = [];
    if (scene) {
      entities.push(scene);
    } else if (this.moduleToCheck) {
      const contents = await this.getPackContents('Scene');
      entities.push(...contents);
    } else if (!isNewerVersion('0.8.0', game.data.version)) {
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
        pack: scene.pack,
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
  async ParseActorAssets() {
    const entities = [];
    if (this.moduleToCheck) {
      const contents = await this.getPackContents('Actor');
      entities.push(...contents);
    } else if (!isNewerVersion('0.8.0', game.data.version)) {
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
        pack: actor.pack,
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
  async ParseJournalAssets() {
    const entities = [];
    if (this.moduleToCheck) {
      const contents = await this.getPackContents('JournalEntry');
      entities.push(...contents);
    } else if (!isNewerVersion('0.8.0', game.data.version)) {
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
        pack: journal.pack,
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
  async ParseItemAssets() {
    const entities = [];
    if (this.moduleToCheck) {
      const contents = await this.getPackContents('Item');
      entities.push(...contents);
    } else if (!isNewerVersion('0.8.0', game.data.version)) {
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
        pack: item.pack,
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
  async ParsePlaylistAssets() {
    const entities = [];
    if (this.moduleToCheck) {
      const contents = await this.getPackContents('Playlist');
      entities.push(...contents);
    } else if (!isNewerVersion('0.8.0', game.data.version)) {
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
        pack: playlist.pack,
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
  async ParseMacroAssets() {
    const entities = [];
    if (this.moduleToCheck) {
      const contents = await this.getPackContents('Macro');
      entities.push(...contents);
    } else if (!isNewerVersion('0.8.0', game.data.version)) {
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
        pack: macro.pack,
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
  async ParseRollTableAssets() {
    const entities = [];
    if (this.moduleToCheck) {
      const contents = await this.getPackContents('RollTable');
      entities.push(...contents);
    } else if (!isNewerVersion('0.8.0', game.data.version)) {
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
        pack: table.pack,
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

import { CONSTANTS } from '../constants.js';
import { FileExists, UploadFile } from '../assets/file.js';
import { ResolvePath } from '../export-import/related/related-data.js';
import { ActorDataLocations } from '../export-import/related/actor.js';
import { ItemDataLocations } from '../export-import/related/item.js';
import { JournalDataLocations } from '../export-import/related/journals.js';

export default class AdventureConverter extends FormApplication {
  constructor(document, options) {
    super(document, options);

    const gameVersion = game.version || game.data.version;
    if (gameVersion !== '10.0' && !isNewerVersion(gameVersion, '10')) {
      throw new Error('Adventure Converter for Scene Packer only works with Foundry VTT v10 or newer.');
    }
  }

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: 'modules/scene-packer/templates/adventure-converter/adventure-converter.html',
      title: game.i18n.localize('SCENE-PACKER.adventure-converter.name'),
      id: 'sp-adventure-converter',
      classes: ['sheet', 'adventure', 'scene-packer', 'adventure-converter'],
      width: 890,
      height: 730,
      tabs: [
        {
          navSelector: '.tabs',
          contentSelector: 'form',
          initial: 'summary',
        },
      ],
      dragDrop: [{ dropSelector: 'form' }],
      scrollY: ['.tab.contents'],
      submitOnChange: true,
      submitOnClose: false,
      closeOnSubmit: false,
    });
  }

  /** @override */
  async getData(options = {}) {
    const instances = Object.values(ScenePacker.instances);
    instances.unshift({
      moduleName: '',
      adventureName: '',
    });
    const hasInstances = instances.length > 1;
    const module = game.modules.get(this.object?.adventureModule);
    const hasAdventureCapabilities = !!(module?.packs?.find(p => p.type === Adventure.name));
    const canConvert = hasInstances && hasAdventureCapabilities;
    const welcomeJournalLink = this.object?.welcomeJournal ?
      `@UUID[${this.object.welcomeJournal.uuid}]{${this.object.welcomeJournal.name}}` :
      '';

    return mergeObject(super.getData(options),
      {
        instances,
        hasInstances,
        contents: this._getContentList(),
        module,
        hasAdventureCapabilities,
        canConvert,
        selectedInstance: ScenePacker.instances[this.object?.adventureModule],
        welcomeJournalDescription: await TextEditor.enrichHTML(
          game.i18n.format('SCENE-PACKER.adventure-converter.welcome-journal-description', { link: welcomeJournalLink }),
          { async: true },
        ),
      },
    );
  }

  /**
   * Prepare a list of content types provided by this adventure.
   * @returns {{icon: string, label: string, count: number}[]}
   * @protected
   */
  _getContentList() {
    const moduleName = this.object?.adventureModule;
    const packs = game.modules.get(moduleName)?.packs;
    if (!packs?.size) {
      return [];
    }

    return Object.entries(Adventure.contentFields)
      .reduce((arr, [field, cls]) => {
        const count = packs.filter(p => p.type === cls.documentName)
          .reduce((c, p) => {
            const pCount = game.packs.get(`${moduleName}.${p.name}`)
              ?.index
              ?.filter(d => d.name !== CONSTANTS.CF_TEMP_ENTITY_NAME)?.length || 0;
            return c + pCount;
          }, 0);
        if (!count) {
          return arr;
        }
        arr.push({
          icon: CONFIG[cls.documentName].sidebarIcon,
          label: game.i18n.localize(count > 1 ? cls.metadata.labelPlural : cls.metadata.label),
          count,
        });
        return arr;
      }, []);
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    const data = expandObject(this._getSubmitData());

    if (!Object.keys(data).length) {
      return;

    }
    if (data.adventureModule && data.adventureModule !== this.object?.adventureModule) {
      data.description = game.modules.get(data.adventureModule)?.description;
    }

    mergeObject(this.object, data);

    if (event.type === 'submit') {
      const sourcePacks = Array.from(game.modules.get(this.object.adventureModule)
        ?.packs
        .filter(p => p.type !== Adventure.name)
        .map(p => p.name) || []);
      AdventureConverter.Process({
        moduleName: this.object.adventureModule,
        targetPack: 'adventure',
        bannerCaption: this.object.caption,
        bannerImage: this.object.img,
        description: this.object.description,
        sourcePacks,
      })
        .then((adventure) => {
          new AdventureExporter(adventure).render(true);
          // TODO add next steps dialog - remove existing packs
          // TODO Add adventure hooks
        });

    }
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);

    html.on('click', 'a.recommend-json', this._onRecommendModuleJSON.bind(this));
  }

  /** @inheritdoc */
  async _onDrop(event) {
    const target = event.target;
    const data = TextEditor.getDragEventData(event);
    const cls = getDocumentClass(data?.type);
    if (target.id === 'welcome-journal' && data.type === CONFIG.JournalEntry.documentClass.name) {
      const document = await cls.fromDropData(data);
      await this.addWelcomeJournal(document);
    }
  }

  /**
   * Adds the given journal entry as the welcome journal for the adventure.
   * @param {JournalEntry} document The JournalEntry to add as the welcome journal.
   * @param {boolean} [displayErrors=true] Whether any error notifications should be permanently displayed.
   */
  async addWelcomeJournal(document, displayErrors = true) {
    if (document.pack) {
      if (game.packs.get(document.pack)?.metadata?.packageName !== this.object.adventureModule) {
        return ui.notifications.error(
          game.i18n.localize('SCENE-PACKER.adventure-converter.error-journal-wrong-pack'),
          { permanent: displayErrors },
        );
      }
      this.object.welcomeJournal = document;

      return this.render();
    }

    const instance = ScenePacker.instances[this.object.adventureModule];
    if (!instance) {
      return ui.notifications.error(
        game.i18n.format('SCENE-PACKER.adventure-converter.error-journal-not-found', { name: document.name }),
        { permanent: displayErrors },
      );
    }
    const compendiumDocument = await instance.FindJournalInCompendiums(document, instance.getSearchPacksForType(document.documentName));
    if (!compendiumDocument) {
      return ui.notifications.error(
        game.i18n.format('SCENE-PACKER.adventure-converter.error-journal-not-found', { name: document.name }),
        { permanent: displayErrors },
      );
    }

    this.object.welcomeJournal = compendiumDocument;

    return this.render();
  }

  /**
   * Finds the Welcome Journal for the adventure.
   * @returns {Promise<JournalEntry[]>}
   */
  async _findWelcomeJournal() {
    const documents = [];
    const instance = ScenePacker.instances[this.object.adventureModule];
    if (!instance || !instance.welcomeJournal) {
      return documents;
    }

    for (const journalPack of (instance.packs?.journals || [])) {
      const pack = game.packs.get(journalPack);
      if (!pack) {
        continue;
      }
      for (const index of pack.index.filter(j => j.name === instance.welcomeJournal)) {
        documents.push(await pack.getDocument(index._id));
      }
    }

    return documents;
  }

  /** @inheritdoc */
  async _onChangeInput(event) {
    await super._onChangeInput(event);
    let needsRender = false;
    const {
      id,
      value,
    } = event.target;
    if (id === 'adventure-module') {
      // Populate fields based on the adventure module being chosen
      this.object.welcomeJournal = null;
      const welcomeJournals = await this._findWelcomeJournal();
      if (welcomeJournals.length === 1) {
        this.object.welcomeJournal = welcomeJournals[0];
      }
      needsRender = true;
    }

    if (id === 'welcome-journal') {
      const document = game.journal.get(value);
      if (document) {
        await this.addWelcomeJournal(document);
      } else {
        this.object.welcomeJournal = null;
        needsRender = true;
      }
    }

    if (needsRender) {
      this.render();
    }
  }

  /**
   * Displays the recommended module JSON and steps to make it compatible.
   * @param {Event} event
   */
  _onRecommendModuleJSON(event) {
    event.preventDefault();
    event.stopPropagation();

    AdventureConverter.RecommendModuleManifestUpdates(this.object?.adventureModule)
      .then((manifest) => {
        const modulePath = `modules/${this.object.adventureModule}/module.json`;
        let content = `<p>${game.i18n.format('SCENE-PACKER.adventure-converter.manifest-upgrade-detail-1', { module: modulePath })}</p>`;
        content += `<ul><li>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-detail-2')}</li>`;
        content += `<li>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-detail-3')}</li>`;
        content += `<li>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-detail-4')}</li>`;
        content += '</ul>';
        content += '<hr>';
        content += `<p class="notification warning">${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-next-steps')}</p>`;
        content += `<ol><li>${game.i18n.format('SCENE-PACKER.adventure-converter.manifest-upgrade-next-steps-1', { module: modulePath })}</li>`;
        content += `<li>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-next-steps-2')}</li>`;
        content += `<li>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-next-steps-3')}</li>`;
        content += `<li>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-next-steps-4')}</li>`;
        content += `<li>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-next-steps-5')}</li>`;
        content += '</ol>';
        content += `<textarea rows="20">${JSON.stringify(manifest, null, 2)}</textarea>`;
        content += `<p>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-automated-steps')}</p>`;
        content += `<ul><li><code>packs/adventure.db</code></li>`;
        content += '<hr>';
        new Dialog({
          title: modulePath,
          content,
          buttons: {
            close: {
              icon: '<i class="fas fa-check"></i>',
              label: game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-ok'),
              callback: () => {
                this.close();
              },
            },
          },
          default: 'close',
          rejectClose: false,
        }, {
          width: 640,
          height: 'auto',
        }).render(true);
      })
      .catch((err) => {
        ui.notifications.error(game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-error'), { permanent: true });
        console.error(err);
      });
  }

  /**
   * Processes the adventure conversion. The Adventure itself still needs to be saved to the compendium.
   * @param {object} options
   * @param {string} options.moduleName
   * @param {string} options.targetPack
   * @param {string[]} options.sourcePacks
   * @param {string} [options.bannerImage]
   * @param {string} [options.bannerCaption]
   * @param {string} [options.description]
   * @param {JournalEntry} [options.welcomeJournal]
   * @returns {Promise<Adventure>}
   */
  static async Process(options = {}) {
    if (!options.moduleName) {
      throw new Error(`Adventure Converter | ${game.i18n.localize('SCENE-PACKER.adventure-converter.process-error-no-module')}`);
    }
    if (!options.targetPack) {
      throw new Error(`Adventure Converter | ${game.i18n.localize('SCENE-PACKER.adventure-converter.process-error-no-target')}`);
    }
    if (!options.sourcePacks || !options.sourcePacks.length) {
      throw new Error(`Adventure Converter | ${game.i18n.localize('SCENE-PACKER.adventure-converter.process-error-no-source')}`);
    }

    // TODO Validate provided options and assets

    const instance = ScenePacker.instances[options.moduleName];
    if (!instance) {
      throw new Error(`Adventure Converter | ${game.i18n.format('SCENE-PACKER.adventure-converter.process-error-no-instance', {
        moduleName: options.moduleName,
      })}`);
    }

    const module = game.modules.get(options.moduleName);
    if (!module) {
      throw new Error(`Adventure Converter | ${game.i18n.format('SCENE-PACKER.adventure-converter.process-error-no-module-found', {
        moduleName: options.moduleName,
      })}`);
    }

    const pack = game.packs.get(`${options.moduleName}.${options.targetPack}`);
    if (!pack) {
      throw new Error(`Adventure Converter | ${game.i18n.format('SCENE-PACKER.adventure-converter.process-error-no-pack-found', {
        packName: options.targetPack,
        moduleName: options.moduleName,
      })}`);
    }
    if (pack.locked) {
      await pack.configure({ locked: false });
    }

    const adventureData = { name: instance.adventureName };
    if (options.bannerImage) {
      adventureData.img = options.bannerImage;
    }
    if (options.bannerCaption) {
      adventureData.caption = options.bannerCaption;
    }
    if (options.description) {
      adventureData.description = options.description;
    }

    /** @type {string[]} */
    const packCodes = [];
    /** @type {ClientDocument[]} */
    const documents = [];
    for (const pack of module.packs.filter(p => p.type !== Adventure.name)
      .map(p => p.name)) {
      const packCode = `${options.moduleName}.${pack}`;
      const packData = await game.packs.get(packCode)
        ?.getDocuments();
      if (packData) {
        packCodes.push(packCode);
        // TODO Unpack and relink all of the documents together
        documents.push(...packData);
      }
    }
    const folderMap = await AdventureConverter.ExtractFolders(documents, packCodes);

    adventureData[Folder.collectionName] = [];
    for (const mappedFolders of Object.values(folderMap)) {
      adventureData[Folder.collectionName].push(...Array.from(mappedFolders.values())
        .map(f => f.toObject()));
    }

    for (const document of documents) {
      if (document.name === CONSTANTS.CF_TEMP_ENTITY_NAME) {
        // Don't add Compendium Folder entities to the pack, they've already been converted into folders above.
        continue;
      }

      if (!adventureData[document.collectionName]) {
        adventureData[document.collectionName] = [];
      }
      let tempDocument = await document.constructor.create(
        document.toObject(),
        { temporary: true },
      );

      let searchPaths = [];
      switch (document.collection.documentName) {
        case Actor.documentName:
          searchPaths = ActorDataLocations;
          break;
        case Item.documentName:
          searchPaths = ItemDataLocations;
          break;
        case JournalEntry.documentName:
          searchPaths = JournalDataLocations;
          // TODO Support Quick Encounters
          break;
        case RollTable.documentName:
          // TODO Support roll tables
          break;
        case Scene.documentName:
          // TODO Support scenes
          // TODO Support Active Tiles
          break;
      }
      if (searchPaths.length) {
        const [content, replaced] = await AdventureConverter.ReplaceDocumentLinksWithLocal(tempDocument, searchPaths);
        if (replaced) {
          tempDocument = content;
        }
      }

      const cfPath = tempDocument?.flags?.cf?.path;
      let needsFallbackFolder = true;
      if (cfPath) {
        // Assign the folder to the document
        const folderMapElement = folderMap[tempDocument.documentName];
        const folder = folderMapElement?.get(cfPath);
        if (folder) {
          tempDocument.updateSource({
            folder: folder.id,
          });
          needsFallbackFolder = false;
        }
      }

      if (needsFallbackFolder) {
        // Fallback to the root folder
        const folderMapElement = folderMap[tempDocument.documentName];
        const folder = folderMapElement?.get(instance.adventureName);
        if (folder) {
          tempDocument.updateSource({
            folder: folder.id,
          });
        } else {
          // Create a new folder
          const folder = await Folder.create({
              _id: randomID(16),
              name: instance.adventureName,
              type: tempDocument.documentName,
            },
            {
              temporary: true,
            });
          folderMapElement?.set(instance.adventureName, folder);
          tempDocument.updateSource({
            folder: folder.id,
          });
        }
      }

      if (tempDocument.flags && tempDocument.flags['scene-packer']) {
        // Remove Scene Packer flags that would trigger unpacking on launch
        tempDocument.updateSource({
          flags: {
            ['scene-packer']: {
              [`-=${CONSTANTS.FLAGS_JOURNALS}`]: null,
              [`-=${CONSTANTS.FLAGS_MACROS}`]: null,
              [`-=${CONSTANTS.FLAGS_PACKED_VERSION}`]: null,
              [`-=${CONSTANTS.FLAGS_PLAYLIST}`]: null,
              [`-=${CONSTANTS.FLAGS_SCENE_JOURNAL}`]: null,
              [`-=${CONSTANTS.FLAGS_SCENE_POSITION}`]: null,
              [`-=${CONSTANTS.FLAGS_SOURCE_MODULE}`]: null,
              [`-=${CONSTANTS.FLAGS_TILES}`]: null,
              [`-=${CONSTANTS.FLAGS_TOKENS}`]: null,
            },
          },
        });
      }
      adventureData[tempDocument.collectionName].push(tempDocument.toObject());
    }

    // Display the adventure compendium
    await pack.render(true);

    const adventure = new Adventure(adventureData, { pack: pack.collection });
    await adventure.constructor.createDocuments([adventureData], {
      pack: pack.collection,
      keepId: true,
      keepEmbeddedIds: true
    });
    return adventure;
  }

  /**
   * Replace all document UUID links with local links
   *   e.g. @[Compendium.foo.bar#baz]{Bill} -> @[Actor.bar#baz]{Bill}
   * @param {ClientDocumentMixin} document
   * @param {string[]} searchPaths
   * @returns {Promise<(object|boolean)[]>}
   */
  static async ReplaceDocumentLinksWithLocal(document, searchPaths) {
    let replaced = false;

    if (!searchPaths.length) {
      return [document, replaced];
    }

    const documentData = document.toObject();

    const replaceContent = async (content) => {
      const rsp = {
        content,
        replaced: false,
      };
      if (typeof content !== 'string') {
        return rsp;
      }
      for (const match of content.matchAll(CONSTANTS.LINK_REGEX)) {
        const oldTarget = match[0];
        let [type, target, hash, name] = match.slice(1, 5);
        let id = target.split('.')
          .pop();
        let doc;
        try {
          doc = await fromUuid(`${type}.${target}`);
        } catch (e) {
          console.warn(`Could not find ${type}.${target}`, match);
          continue;
        }
        if (!doc) {
          continue;
        }
        let newTarget = `@${doc.documentName}[${id}`;
        if (hash) {
          newTarget += `#${hash}`;
        }
        newTarget += `]{${name}}`;
        console.log(`Replacing ${oldTarget} with ${newTarget}`);
        rsp.content = rsp.content.replace(oldTarget, newTarget);
        rsp.replaced = true;
      }
      return rsp;
    };

    for (const path of searchPaths) {
      let needsUpdate = false;

      if (document.collection.documentName === JournalEntry.documentName && path === 'pages') {
        // Journals have an array of pages
        for (const page of (document.pages ?? []).filter(page => page.type === 'text')) {
          if (page.text.content) {
            const rsp = await replaceContent(page.text.content);
            if (rsp.replaced) {
              console.log(`Updating ${document.collection.documentName} "${document.name}" ${page.name}`);
              page.updateSource({ 'text.content': rsp.content });
              replaced = true;
            }
          }
          if (page.text.markdown) {
            const rsp = await replaceContent(page.text.markdown);
            if (rsp.replaced) {
              console.log(`Updating ${document.collection.documentName} "${document.name}" ${page.name}`);
              page.updateSource({ 'text.markdown': rsp.content });
              replaced = true;
            }
          }
        }
        continue;
      }

      let content = ResolvePath(path, documentData);
      const rsp = await replaceContent(content, needsUpdate);
      if (rsp.replaced) {
        content = rsp.content;
        replaced = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`Updating ${document.collection.documentName} "${document.name}" ${path}`);
        document.updateSource({
          [path]: content,
        });
      }
    }

    return [document, replaced];
  }

  /**
   * Extracts folders from the provided documents.
   * @param {ClientDocument[]} documents The documents to extract folder data from. Utilises Compendium Folders data and Scene Packer data to build the list.
   * @param {string[]} [packCodes] The pack codes the documents come from. Used by Compendium Folders to load the folder structure if available.
   * @returns {Promise<Object.<string, Map<string, Folder>>[]>}
   */
  static async ExtractFolders(documents, packCodes) {
    documents.sort(AdventureConverter.SortByPaths);

    const folderMapByType = {};
    for (const type of CONST.FOLDER_DOCUMENT_TYPES) {
      folderMapByType[type] = new Map();
    }

    for (const document of documents) {
      const cfPath = document?.flags?.cf?.path;
      if (!cfPath) {
        continue;
      }

      const cfColor = document?.flags?.cf?.color;
      let cfSorting = document?.flags?.cf?.sorting;
      const cfSort = document?.flags?.cf?.sort ?? document.sort ?? 0;
      if (cfSort && !cfSorting) {
        // This document has a sort value, so it implies manual folder sorting
        cfSorting = 'm';
      }

      const folderMap = folderMapByType[document.documentName];

      const pathParts = cfPath.split(CONSTANTS.CF_SEPARATOR);
      for (let j = 0; j < pathParts.length; j++) {
        const pathPart = pathParts[j];
        if (folderMap.has(pathPart)) {
          continue;
        }
        let parent = null;
        if (j > 0) {
          // Not the first folder in the path, find the parent.
          let parentPart = pathParts[j - 1];
          if (parentPart && folderMap.has(parentPart)) {
            parent = folderMap.get(parentPart);
          }
        }
        // Need to create the folder.
        const folder = await Folder.create({
            _id: randomID(16),
            name: pathPart,
            type: document.documentName,
            parent: parent?.id || null,
            color: cfColor || null,
            sorting: cfSorting,
            sort: cfSort,
          },
          {
            temporary: true,
          });
        folderMap.set(cfPath, folder);
      }
    }

    return folderMapByType;
  }

  static SortByPaths(e1, e2) {
    const cfPath1 = e1.flags?.cf?.path;
    const cfPath2 = e2.flags?.cf?.path;
    const e1Name = e1.name;
    const e2Name = e2.name;
    const e1Sort = e1.sort ?? 0;
    const e2Sort = e2.sort ?? 0;

    if (!cfPath1 && !cfPath2) {
      // Neither have CF data, use the sort order
      return e1Sort - e2Sort;
    }
    if (cfPath1 && !cfPath2) {
      // Sort e1 first as it has CF data
      return -1;
    }
    if (!cfPath1 && cfPath2) {
      // Sort e2 first as it has CF data
      return 1;
    }
    if (e1Name === CONSTANTS.CF_TEMP_ENTITY_NAME && e2Name !== CONSTANTS.CF_TEMP_ENTITY_NAME) {
      // Sort e1 first as it is a CF temp folder entity
      return -1;
    }
    if (e1Name !== CONSTANTS.CF_TEMP_ENTITY_NAME && e2Name === CONSTANTS.CF_TEMP_ENTITY_NAME) {
      // Sort e2 first as it is a CF temp folder entity
      return 1;
    }

    const e1Segments = cfPath1.split(CONSTANTS.CF_SEPARATOR);
    const e2Segments = cfPath2.split(CONSTANTS.CF_SEPARATOR);
    if (e1Segments.length === e2Segments.length) {
      // Both at the same depth, use the sort order
      return e1Sort - e2Sort;
    }
    if (e1Segments.length < e2Segments.length) {
      // Sort e1 first as it has fewer segments
      return -1;
    }
    // Sort e2 first as it has fewer segments
    return 1;
  }

  /**
   * Recommends updates to the given module's manifest.
   * @param {string} moduleName The name of the module to recommend manifest updates for.
   * @returns {Promise<Module>} The updated module Manifest.
   */
  static async RecommendModuleManifestUpdates(moduleName) {
    if (!game.modules.get(moduleName)) {
      throw new Error(
        game.i18n.format('SCENE-PACKER.adventure-converter.manifest-upgrade-module-not-found', { name: moduleName }),
      );
    }
    const module = game.modules.get(moduleName).clone();

    let label = module.title;
    if (module.packs?.size) {
      // Suggest a label if all the other packs have the same labels.
      const labels = new Set(Array.from(module.packs)
        .map(p => p.label));
      if (labels.size === 1) {
        label = labels.first();
      }
    }

    let content = `<form><p>${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-prompt-message')}</p>`;
    content += `<div class="form-group"><label for="label">${game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-prompt-label')}</label>`;
    content += `<div class="form-fields"><input id="label" name="label" type="text" value="${label}"></div></div></form><hr>`;

    label = await Dialog.prompt({
      title: game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-prompt-title'),
      content,
      label: game.i18n.localize('SCENE-PACKER.adventure-converter.manifest-upgrade-prompt-button'),
      callback: async (html) => {
        const form = html[0].querySelector('form');
        return form.getElementsByTagName('input')[0].value;
      },
      rejectClose: false,
    });

    // Ensure that the paths remain relative to the module.
    const esmodules = Array.from(module.esmodules).map(m => AdventureConverter.RelativePath(moduleName, m));
    const scripts = Array.from(module.scripts).map(m => AdventureConverter.RelativePath(moduleName, m));
    const languages = Array.from(module.languages).map(m => {
      const path = AdventureConverter.RelativePath(moduleName, m.path);
      return {
        ...m,
        path,
      }
    });
    const packs = Array.from(module.packs).map(m => {
      const path = AdventureConverter.RelativePath(moduleName, m.path);
      return {
        ...m,
        path,
      }
    });
    packs.push({
      label,
      name: 'adventure',
      path: 'packs/adventure.db',
      type: 'Adventure',
      system: game.system.id,
    });

    await module.updateSource({
      languages,
      esmodules,
      scripts,
      packs,
    });

    const manifest = Module.migrateData(module);

    if (manifest.compatibility?.minimum && !isNewerVersion(manifest.compatibility.minimum, 10)) {
      manifest.updateSource({ 'compatibility.minimum': 10 });
    }
    if (manifest.compatibility?.verified && !isNewerVersion(manifest.compatibility.verified, 10)) {
      manifest.updateSource({ 'compatibility.verified': 10 });
    }
    if (manifest.compatibility?.maximum && !isNewerVersion(manifest.compatibility.maximum, 10)) {
      manifest.updateSource({ 'compatibility.maximum': 10 });
    }

    return manifest;
  }

  static RelativePath(moduleName, path) {
    return path.replace(new RegExp(`^/?modules/${moduleName}/`, 'i'), '');
  }
}

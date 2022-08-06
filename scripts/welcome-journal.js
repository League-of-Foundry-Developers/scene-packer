import { CONSTANTS } from './constants.js';

/**
 * Welcome Journal is a special Journal Sheet that contains import buttons allowing a user to
 * import the associated adventure.
 */
export default class WelcomeJournal extends JournalSheet {
  constructor(journal, options = {}) {
    super(journal, options);

    this.welcomeJournal = journal;
    this.moduleName = options.moduleName || null;
    this.alreadyImported = (game.settings.get(this.moduleName, CONSTANTS.SETTING_PROMPTED) || '0.0.0') !== '0.0.0';
    this.totalCount = new Intl.NumberFormat().format(game.packs.filter(
      (p) => (p.metadata.packageName || p.metadata.package) === this.moduleName,
    ).reduce((a, currentValue) => a + (currentValue?.index?.size || currentValue?.index?.length || 0), 0));
  }

  /** @inheritdoc */
  static get defaultOptions() {
    const defaultOptions = super.defaultOptions;
    defaultOptions.classes.push('sp-welcome-journal');
    return mergeObject(defaultOptions, {
      submitOnClose: false,
    });
  }

  /** @inheritdoc */
  get title() {
    const journalTitle = super.title;
    const module = game.modules.get(this.moduleName);
    const moduleTitle = module.title || module.data.title;
    return `${moduleTitle} - ${journalTitle}`;
  }

  /** @inheritdoc */
  _getHeaderButtons() {
    let buttons = super._getHeaderButtons();

    // Ensure we don't show several of the standard header button
    buttons.findSplice(b => b.class === 'configure-sheet');
    buttons.findSplice(b => b.class === 'share-image');
    buttons.findSplice(b => b.class === 'entry-text');
    buttons.findSplice(b => b.class === 'entry-image');
    buttons.findSplice(b => b.class === 'import');

    return buttons;
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.click(function (e) {
      // Our import all button gets injected after rendering, so it doesn't actually exist at this point in time.
      if (e.target.nodeName !== 'BUTTON' || !e.target.classList.contains('sp-import')) {
        return;
      }
      e.preventDefault();

      const instance = ScenePacker.GetInstance({ moduleName: this.moduleName });
      if (!instance) {
        return;
      }
      const module = game.modules.get(this.moduleName);
      const moduleVersion = (module?.version ?? module?.data?.version) || '0.0.0';

      game.settings.set(this.moduleName, CONSTANTS.SETTING_PROMPTED, moduleVersion);
      if (e.target.classList.contains('sp-import-all')) {
        instance.importAllContent();
      } else if (e.target.classList.contains('sp-import-replace')) {
        const deleteExisting = async function () {
          const sceneIDs = game.scenes.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (sceneIDs.length) {
            await Scene.deleteDocuments(sceneIDs);
          }
          const actorIDs = game.actors.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (actorIDs.length) {
            await Actor.deleteDocuments(actorIDs);
          }
          const itemIDs = game.items.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (itemIDs.length) {
            await Item.deleteDocuments(itemIDs);
          }
          const journalIDs = game.journal.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (journalIDs.length) {
            await JournalEntry.deleteDocuments(journalIDs);
          }
          const rollTableIDs = game.tables.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (rollTableIDs.length) {
            await RollTable.deleteDocuments(rollTableIDs);
          }
          const playlistIDs = game.playlists.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (playlistIDs.length) {
            await Playlist.deleteDocuments(playlistIDs);
          }
          const macroIDs = game.macros.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (macroIDs.length) {
            await Macro.deleteDocuments(macroIDs);
          }
          const cardIDs = game.cards.filter(s => s.getFlag('core', 'sourceId')
            ?.startsWith(`Compendium.${this.moduleName}`)).map(s => s.id);
          if (cardIDs.length) {
            await Card.deleteDocuments(cardIDs);
          }
        }.bind(this);
        deleteExisting().then(() => {
          instance.importAllContent();
        })
      } else if (e.target.classList.contains('sp-import-rename')) {
        instance.importAllContent({forceImport: true, renameOriginals: true});
      }
      this.close();
    }.bind(this));
  }

  /** @inheritdoc */
  get isEditable() {
    return false;
  }

  /** @inheritdoc */
  async _render(force = false, options = {}) {
    await super._render(force, options);

    // Append the import buttons to the bottom of the journal sheet
    let section = $(this.element).find('section:first > .journal-sheet-container > section:last');
    if (!section.length) {
      // Fallback to the old layout used prior to V10
      section = $(this.element).find('section:first').children().first();
    }

    const html = await renderTemplate(`modules/scene-packer/templates/welcome-journal-footer.html`, {
      alreadyImported: this.alreadyImported,
      totalCount: this.totalCount,
    });
    section.append(html);
  }
}

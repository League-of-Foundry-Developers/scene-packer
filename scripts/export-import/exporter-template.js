export class ExporterTemplate {
  static TEMPLATE_VERSION = '1.0.0';

  constructor({
    templateVersion = ExporterTemplate.TEMPLATE_VERSION,
    name = '',
    author = '',
    version = '',
    description = '',
    cover_image = '',
    external_link = '',
    email = '',
    discordId = '',
    system = '',
    category = '',
    play_hours = 0,
    welcome_journal = '',
    welcome_journal_name = '',
    allow_complete_import = true,
    players = { min: 0, max: 0, recommended: 0 },
    player_levels = [],
    token_styles = [],
    pregen = false,
    grid = [],
    themes = [],
    tags = [],
    selections = {}
  } = {}) {
    this.templateVersion = templateVersion;
    this.name = name;
    this.author = author;
    this.version = version;
    this.description = description;
    this.cover_image = cover_image;
    this.external_link = external_link;
    this.email = email;
    this.discordId = discordId;
    this.system = system;
    this.category = category;
    this.play_hours = play_hours;
    this.welcome_journal = welcome_journal;
    this.welcome_journal_name = welcome_journal_name;
    this.allow_complete_import = allow_complete_import;
    this.players = players;
    this.player_levels = player_levels;
    this.token_styles = token_styles;
    this.pregen = pregen;
    this.grid = grid;
    this.themes = themes;
    this.tags = tags;
    this.selections = selections;
  }

  /**
   * Serialize template to JSON string
   * @returns {string} JSON representation
   */
  toJSON() {
    return JSON.stringify({
      templateVersion: this.templateVersion,
      name: this.name,
      author: this.author,
      version: this.version,
      description: this.description,
      cover_image: this.cover_image,
      external_link: this.external_link,
      email: this.email,
      discordId: this.discordId,
      system: this.system,
      category: this.category,
      play_hours: this.play_hours,
      welcome_journal: this.welcome_journal,
      welcome_journal_name: this.welcome_journal_name,
      allow_complete_import: this.allow_complete_import,
      players: this.players,
      player_levels: this.player_levels,
      token_styles: this.token_styles,
      pregen: this.pregen,
      grid: this.grid,
      themes: this.themes,
      tags: this.tags,
      selections: this.selections
    }, null, 2);
  }

  /**
   * Parse JSON to ExporterTemplate instance
   * @param {string|object} json - JSON string or object
   * @returns {ExporterTemplate}
   * @throws {Error} If JSON is invalid
   */
  static fromJSON(json) {
    if (typeof json === 'string') {
      try {
        json = JSON.parse(json);
      } catch (err) {
        throw new Error(game.i18n.localize('SCENE-PACKER.exporter.template.invalid-file'));
      }
    }

    if (!json.templateVersion) {
      if (typeof json === 'string') {
        try {
          json = JSON.parse(json);
        } catch (err) {
          throw new Error(game.i18n.localize('SCENE-PACKER.exporter.template.invalid-file'));
        }
      } else {
        throw new Error(game.i18n.localize('SCENE-PACKER.exporter.template.invalid-file'));
      }
    }

    if (json.templateVersion !== ExporterTemplate.TEMPLATE_VERSION) {
      throw new Error(`Unsupported template version: ${json.templateVersion}`);
    }

    if (!json.selections || typeof json.selections !== 'object') {
      throw new Error(game.i18n.localize('SCENE-PACKER.exporter.template.invalid-file'));
    }

    return new ExporterTemplate(json);
  }

  /**
   * Get list of items from template that no longer exist in the world
   * @returns {Array<{type: string, id: string, name: string}>}
   */
  getMissingItems() {
    const missing = [];

    if (this.welcome_journal) {
      const journal = game.journal.get(this.welcome_journal);
      if (!journal) {
        missing.push({
          type: 'Welcome Journal',
          id: this.welcome_journal,
          name: this.welcome_journal_name || 'Unknown'
        });
      }
    }

    for (const [type, docs] of Object.entries(this.selections)) {
      if (type === 'Folder') {
        for (const folder of docs) {
          if (!game.folders.get(folder.id)) {
            missing.push({
              type: `${folder.type} Folder`,
              id: folder.id,
              name: folder.name
            });
          }
        }
      } else {
        const collection = game.collections.get(type);
        if (!collection) continue;

        for (const doc of docs) {
          if (!collection.get(doc.id)) {
            missing.push({
              type,
              id: doc.id,
              name: doc.name
            });
          }
        }
      }
    }

    return missing;
  }

  /**
   * Trigger browser download of template as JSON file
   * @param {string} [filename] - Optional custom filename
   */
  async download(filename) {
    if (!filename) {
      const exportName = this.name ?? 'scene-packer-template';
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 16).replace('T', '-').replace(/:/g, '');
      filename = `export-${exportName}-${dateStr}.json`;
    }

    const content = this.toJSON();
    if (typeof foundry?.utils?.saveDataToFile === 'function') {
      foundry.utils.saveDataToFile(content, "text/json", filename);
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
}

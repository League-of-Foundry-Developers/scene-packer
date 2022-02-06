/**
 * UnrelatedData holds a map of all document entity references that are not related
 * to a scene within the adventure package. This is used to allow the end-user to
 * select which of these unrelated documents should also be imported into their world.
 */
export class UnrelatedData extends FormApplication {
  /**
   * @param {UnrelatedData|object|string} json - JSON representation of the Unrelated Data
   * @param {Object} object                 Some object which is the target data structure to be updated by the form.
   * @param {ApplicationOptions} options    Additional options which modify the rendering of the sheet.
   */
  constructor(json = {}, object={}, options = {}) {
    super(options);

    /**
     * Data references, keyed by document type.
     * @type {Map<string, UnrelatedDataValue[]>}
     */
    this.data = new Map(this.parseData(json));
  }

  /**
   * Parses the JSON data and returns a Map<string, Set<string>>
   * @param {UnrelatedData|object|string} json - JSON representation of the Unrelated Data
   * @generator
   * @yields {Map<string, UnrelatedDataValue[]>}
   */
  *parseData(json) {
    if (typeof json === 'string') {
      json = JSON.parse(json);
    }

    for (let key in json) {
      yield [key, json[key]];
    }
  }

  /**
   * @typedef {Object} UnrelatedDataValue
   * @property {string} uuid - The UUID of the document.
   * @property {string} name - The name of the document.
   */

  /**
   * Data references, keyed by document type.
   * @type {Map<string, UnrelatedDataValue[]>}
   */
  data = new Map();

  /** @inheritdoc */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.importer.unrelated-title'),
      id: 'scene-packer-importer-unrelated-data',
      template:
        'modules/scene-packer/templates/export-import/unrelated-data.hbs',
      width: 680,
      height: 680,
      classes: ['scene-packer'],
    });
  }

  /**
   * @return {Object|Promise}
   */
  getData(options = {}) {
    const data = {};
    for (const [type, references] of this.data) {
      if (!data[type]) {
        data[type] = [];
      }

      for (const reference of references) {
        const [type, id] = reference.uuid.split('.');
        data[type].push({id: id, name: reference.name, type: type});
      }
    }

    return {
      data,
    };
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="close"]').click(this.close.bind(this));
  }

  /**
   * Returns whether this UnrelatedData has any data.
   * @return {boolean}
   */
  HasUnrelatedData() {
    let count = 0;
    for (const [, references] of this.data) {
      count += references.length;
    }
    return count > 0;
  }

  /**
   * Adds a document to the list of unrelated documents.
   * @param {ClientDocumentMixin|object} doc - The document to add.
   */
  AddDocument(doc) {
    if (!this.data.has(doc.documentName)) {
      this.data.set(doc.documentName, []);
    }

    const uuid = doc.uuid || `${doc.documentName}.${doc.id}`;
    const documentCollection = this.data.get(doc.documentName);
    const item = {uuid: uuid, name: doc.name};
    if (!documentCollection.find(d => d.uuid === uuid)) {
      documentCollection.push(item);
    }
  }

  /**
   * Adds documents to the list of unrelated documents.
   * @param {ClientDocumentMixin[]|object[]} docs - The documents to add.
   */
  AddDocuments(docs) {
    for (const doc of docs) {
      this.AddDocument(doc);
    }
  }

  /**
   * Removes a document from the list of unrelated documents.
   * @param {ClientDocumentMixin|object} doc - The document to remove.
   */
  RemoveDocument(doc) {
    if (!this.data.has(doc.documentName)) {
      return;
    }

    const uuid = doc.uuid || `${doc.documentName}.${doc.id}`;
    const documentCollection = this.data.get(doc.documentName);
    let index = -1;
    for (let i = 0; i < documentCollection.length; i++) {
      if (documentCollection[i].uuid === uuid) {
        index = i;
        break;
      }
    }
    if (index !== -1) {
      documentCollection.splice(index, 1);
    }
  }

  /**
   * Removes documents from the list of unrelated documents.
   * @param {ClientDocumentMixin[]|object[]} docs - The documents to remove.
   */
  RemoveDocuments(docs) {
    for (const doc of docs) {
      this.RemoveDocument(doc);
    }
  }

  /**
   * Removes the UUID from the list of unrelated documents.
   * @param {string} uuid - The UUID of the document to remove.
   */
  RemoveUUID(uuid) {
    const [type] = uuid.split('.');

    if (!this.data.has(type)) {
      return;
    }

    const documentCollection = this.data.get(type);
    let index = -1;
    for (let i = 0; i < documentCollection.length; i++) {
      if (documentCollection[i].uuid === uuid) {
        index = i;
        break;
      }
    }
    if (index !== -1) {
      documentCollection.splice(index, 1);
    }
  }

  /**
   * Removes the relation from the list of unrelated documents.
   * @param {Relation} relation - The relation to remove
   */
  RemoveRelation(relation) {
    if (!relation?.uuid) {
      return;
    }

    this.RemoveUUID(relation.uuid);
  }

  /**
   * Removes relations from the list of unrelated documents.
   * @param {Relation[]} relations
   */
  RemoveRelations(relations) {
    for (const relation of relations) {
      this.RemoveRelation(relation);
    }
  }

  toJSON() {
    // Convert the mapping set into an array so that it can be JSON encoded.
    const response = new Map();
    for (const [key, val] of this.data) {
      response.set(key, [...val]);
    }

    return Object.fromEntries(response.entries());
  }
}

import {CONSTANTS} from '../../constants.js';

/**
 * RelatedData holds a map of all document entity references
 * to ensure that all required data is imported.
 */
export class RelatedData {
  /**
   * Data references, keyed by source UUID.
   * Value is a set of related UUIDs that is referenced by the source UUID.
   * @type {Map<string, Set<Relation>>}
   */
  data = new Map();

  /**
   * Add related reference mapping.
   * @param {RelatedData} data - Target relations, keyed by source UUID.
   */
  AddRelatedData(data) {
    if (!data?.data) {
      return;
    }

    for (const [source, targets] of data.data) {
      if (!source || !targets?.size) {
        continue;
      }

      if (!this.data.has(source)) {
        this.data.set(source, new Set());
      }

      const set = this.data.get(source);
      for (const target of targets) {
        if (!target) {
          continue;
        }
        set.add(target);
      }
    }
  }

  /**
   * Add references for the given source and relations.
   * @param {string} source - Source UUID.
   * @param {Relation[]} relations - Related UUIDs.
   */
  AddRelations(source, relations) {
    if (!source || !relations.length) {
      return;
    }

    if (!this.data.has(source)) {
      this.data.set(source, new Set());
    }
    const set = this.data.get(source);
    for (const relation of relations) {
      if (!relation) {
        continue;
      }
      set.add(relation);
    }
  }

  /**
   * Add references for the given source and relation.
   * @param {string} source - Source UUID.
   * @param {Relation} relation - Related UUID.
   */
  AddRelation(source, relation) {
    if (!source || !relation) {
      return;
    }

    if (!this.data.has(source)) {
      this.data.set(source, new Set());
    }
    const set = this.data.get(source);
    set.add(relation);
  }

  /**
   * Gets the related data for the given source.
   * If no source is provided, all data related to any source is returned.
   * @param {string?} source - Source UUID.
   * @return {Relation[]}
   */
  GetRelatedData(source) {
    if (!source) {
      const relatedData = new Set();
      for (const [, targets] of this.data) {
        for (const target of targets) {
          relatedData.add(target);
        }
      }

      return Array.from(relatedData);
    }

    if (!this.data.has(source)) {
      return [];
    }

    return Array.from(this.data.get(source));
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

/**
 * @typedef {Object} Relation
 * @property {string} uuid - The related UUID.
 * @property {string} path - The path to the UUID within the parent.
 * @property {string?} embeddedId - The ID of the embedded related entity.
 * @property {string?} embeddedPath - The path to the embedded related entity.
 */

/**
 * @typedef {Object} ContentWithPath
 * @property {string} content - The content.
 * @property {string} path - The path to the content within the parent.
 */

/**
 * Extracts all UUID references from the given HTML content.
 * @param {string} content - HTML content.
 * @param {string} path - The path that this content exists at.
 * @return {Relation[]} - UUIDs referred to within the content.
 */
export function ExtractUUIDsFromContent(content, path) {
  const references = [];
  if (!content) {
    return references;
  }

  const domParser = new DOMParser();

  const links = [...content.matchAll(CONSTANTS.LINK_REGEX)];
  for (let link of links) {
    let [, type, id] = link;
    references.push({path, uuid: `${type}.${id}`});
  }

  const doc = domParser.parseFromString(content, 'text/html');
  for (const link of doc.getElementsByTagName('a')) {
    if (!link.dataset?.entity || !link.dataset?.id) {
      continue;
    }
    let uuid = `${link.dataset.entity}.${link.dataset.id}`;
    if (link.dataset.pack) {
      uuid = `Compendium.${link.dataset.pack}.${link.dataset.id}`;
    }
    references.push({path, uuid: uuid});
  }

  return references;
}

/**
 * ResolvePath - Returns the value from the object at the given path.
 * @see https://stackoverflow.com/a/22129960/191306
 * @param {string} path - The dot notation path to the value (e.g. "data.data.description").
 * @param {object} obj - The object to resolve the path against.
 * @param {string} separator - The separator to use when splitting the path.
 * @return {*}
 */
export function ResolvePath(path, obj = self, separator = '.') {
  const properties = Array.isArray(path) ? path : path.split(separator);
  return properties.reduce((prev, curr) => prev && prev[curr], obj);
}

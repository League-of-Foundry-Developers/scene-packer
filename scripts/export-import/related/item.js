import {ExtractUUIDsFromContent, RelatedData, ResolvePath} from './related-data.js';

/**
 * ItemDataLocations - the list of locations where HTML content is stored.
 * @type {string[]}
 */
export const ItemDataLocations = [
  'data.data.description.value', // dnd5e, pf2e, harn, alienrpg etc
  'data.data.identification.identified.data.description.value', // pf2e
  'data.data.identification.unidentified.data.description.value', // pf2e
  'data.data.notes', // harn

  'data.flags.gm-notes.notes', // gm-notes module (https://github.com/syl3r86/gm-notes)
];

/**
 * ExtractRelatedItemData - extracts the entity UUIDs that are related to the given item.
 * @param {object} item - the item to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedItemData(item) {
  const relatedData = new RelatedData();
  if (!item) {
    return relatedData;
  }

  for (const path of ItemDataLocations) {
    const content = ResolvePath(path, item);
    if (typeof content !== 'string') {
      continue;
    }

    const relations = ExtractUUIDsFromContent(content);
    if (relations.length) {
      relatedData.AddRelations(item.uuid, relations);
    }
  }

  return relatedData;
}


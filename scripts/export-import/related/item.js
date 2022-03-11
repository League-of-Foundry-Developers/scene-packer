import {ExtractUUIDsFromContent, RelatedData, ResolvePath} from './related-data.js';

/**
 * ItemDataLocations - the list of locations where HTML content is stored.
 * @type {string[]}
 */
export const ItemDataLocations = [
  // dnd5e, pf2e, harn, alienrpg etc
  'data.description.value',
  'data.data.description.value',
  'data.description.chat',
  'data.data.description.chat',
  'data.description.unidentified',
  'data.data.description.unidentified',

  // pf2e
  'data.identification.identified.data.description.value',
  'data.data.identification.identified.data.description.value',
  'data.identification.unidentified.data.description.value',
  'data.data.identification.unidentified.data.description.value',

  // harn
  'data.notes',
  'data.data.notes',

  // gm-notes module (https://github.com/syl3r86/gm-notes)
  'flags.gm-notes.notes',
  'data.flags.gm-notes.notes',
];

/**
 * ExtractRelatedItemData - extracts the entity UUIDs that are related to the given item.
 * @param {Item|ClientDocumentMixin} item - the item to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedItemData(item) {
  const relatedData = new RelatedData();
  if (!item) {
    return relatedData;
  }

  const id = item.id || item._id;
  const uuid = item.uuid || `${Item.documentName}.${id}`;

  for (const path of ItemDataLocations) {
    const content = ResolvePath(path, item);
    if (typeof content !== 'string') {
      continue;
    }

    const relations = ExtractUUIDsFromContent(content, path);
    if (relations.length) {
      relatedData.AddRelations(uuid, relations);
    }
  }

  return relatedData;
}


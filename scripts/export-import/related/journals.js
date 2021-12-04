import {ExtractUUIDsFromContent, RelatedData, ResolvePath} from './related-data.js';

/**
 * JournalDataLocations - the list of locations where HTML content is stored.
 * @type {string[]}
 */
export const JournalDataLocations = [
  // dnd5e, pf2e, aliengrpg etc
  'data.content',

  // gm-notes module (https://github.com/syl3r86/gm-notes)
  'data.flags.gm-notes.notes',
];

/**
 * ExtractRelatedJournalData - extracts the entity UUIDs that are related to the journal entry.
 * @param {object} journal - the journal to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedJournalData(journal) {
  const relatedData = new RelatedData();
  if (!journal) {
    return relatedData;
  }

  for (const path of JournalDataLocations) {
    const content = ResolvePath(path, journal);
    if (typeof content !== 'string') {
      continue;
    }

    const relations = ExtractUUIDsFromContent(content);
    if (relations.length) {
      relatedData.AddRelations(journal.uuid, relations);
    }
  }


  return relatedData;
}

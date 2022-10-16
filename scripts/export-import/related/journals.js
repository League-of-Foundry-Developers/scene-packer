import {CONSTANTS} from '../../constants.js';
import {ExtractRelatedActiveTileData} from './active-tiles.js';
import {ExtractUUIDsFromContent, RelatedData, ResolvePath} from './related-data.js';

/**
 * JournalDataLocations - the list of locations where HTML content is stored.
 * @type {string[]}
 */
export const JournalDataLocations = [
  // dnd5e, pf2e, aliengrpg etc
  'content',
  'data.content',
  'pages',

  // gm-notes module (https://github.com/syl3r86/gm-notes)
  'flags.gm-notes.notes',
  'data.flags.gm-notes.notes',
];

/**
 * ExtractRelatedJournalData - extracts the entity UUIDs that are related to the journal entry.
 * @param {JournalEntry|ClientDocumentMixin} journal - the journal to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedJournalData(journal) {
  const relatedData = new RelatedData();
  if (!journal) {
    return relatedData;
  }

  const id = journal.id || journal._id;
  const uuid = journal.uuid || `${JournalEntry.documentName}.${id}`;

  for (const path of JournalDataLocations) {
    const content = ResolvePath(path, journal);
    if (!content) {
      continue
    }
    if (path === 'pages') {
      for (const text of content.filter(c => c.type === 'text')) {
        const relations = ExtractUUIDsFromContent(text.content, path);
        if (relations.length) {
          relatedData.AddRelations(uuid, relations);
        }
      }
    }

    if (typeof content !== 'string') {
      continue;
    }

    const relations = ExtractUUIDsFromContent(content, path);
    if (relations.length) {
      relatedData.AddRelations(uuid, relations);
    }
  }

  relatedData.AddRelatedData(ExtractRelatedQuickEncounterData(journal));
  relatedData.AddRelatedData(ExtractRelatedEnhancedJournalData(journal));

  return relatedData;
}

/**
 * ExtractRelatedQuickEncounterData - extracts the entity UUIDs that are related to the Quick Encounter embedded within the journal entry.
 * @param {JournalEntry|ClientDocumentMixin} journal - the journal to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedQuickEncounterData(journal) {
  const relatedData = new RelatedData();
  if (!journal) {
    return relatedData;
  }

  let quickEncounter = {};
  const path = 'flags.quick-encounters.quickEncounter';
  const journalData = CONSTANTS.IsV10orNewer() ? journal : journal.data;
  const quickEncounterData = getProperty(journalData, path);
  if (!quickEncounterData) {
    return relatedData;
  }

  try {
    if (typeof quickEncounterData === 'string') {
      quickEncounter = JSON.parse(quickEncounterData);
    } else if (typeof quickEncounterData === 'object') {
      quickEncounter = quickEncounterData;
    }
    if (!quickEncounter) {
      return relatedData;
    }
  } catch (e) {
    return relatedData;
  }

  const id = journal.id || journal._id;
  const uuid = journal.uuid || `${JournalEntry.documentName}.${id}`;

  if (quickEncounter.journalEntryId) {
    const journal = game.journal.find((a) => {
      return (
        (a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === quickEncounter.journalEntryId ||
          a.getFlag('core', 'sourceId') === quickEncounter.journalEntryId ||
          a.id === quickEncounter.journalEntryId) &&
        !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated')
      );
    });
    if (journal && journal.id !== id) {
      const journalUUID = journal.uuid || `Journal.${journal.id}`;
      relatedData.AddRelation(uuid, {uuid: journalUUID, path});
    }
  }

  if (quickEncounter.extractedActors) {
    for (let i = 0; i < quickEncounter.extractedActors.length; i++) {
      const extractedActor = quickEncounter.extractedActors[i];
      const actor = game.actors.find((a) => {
        return (
          (a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === extractedActor.actorID ||
            a.getFlag('core', 'sourceId') === extractedActor.actorID ||
            a.id === extractedActor.actorID) &&
          !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated')
        );
      });
      if (actor) {
        relatedData.AddRelation(uuid, {uuid: actor.uuid, path});
      }
    }
  }

  relatedData.AddRelatedData(ExtractRelatedActiveTileData(quickEncounter.savedTilesData, uuid));

  return relatedData;
}

/**
 * ExtractRelatedEnhancedJournalData - extracts the entity UUIDs that are related to Monk's Enhanced Journal data.
 * @param {JournalEntry|ClientDocumentMixin} journal - the journal to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedEnhancedJournalData(journal) {
  const relatedData = new RelatedData();
  if (!journal) {
    return relatedData;
  }

  const path = 'flags.monks-enhanced-journal';
  const journalData = CONSTANTS.IsV10orNewer() ? journal : journal.data;
  const enhancedJournalData = getProperty(journalData, path);
  if (!enhancedJournalData) {
    return relatedData;
  }

  const id = journal.id || journal._id;
  const uuid = journal.uuid || `${JournalEntry.documentName}.${id}`;

  for (const relationship of enhancedJournalData.relationships || []) {
    if (relationship?.id) {
      relatedData.AddRelation(uuid, {uuid: `Journal.${relationship.id}`, path: 'flags.monks-enhanced-journal.relationships'});
    }
  }

  for (const actor of enhancedJournalData.actors || []) {
    if (actor?.uuid) {
      relatedData.AddRelation(uuid, {uuid: actor.uuid, path: 'flags.monks-enhanced-journal.actors'});
    }
  }
}

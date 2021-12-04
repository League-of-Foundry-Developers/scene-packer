import {ExtractUUIDsFromContent, RelatedData, ResolvePath} from './related-data.js';

/**
 * ActorDataLocations - the list of locations where HTML content is stored.
 * @type {string[]}
 */
export const ActorDataLocations = [
  // dnd5e, wfrp4e, pf2e, pf1, swade, sfrpg, dsa5, D35E
  'data.details.biography.value',
  // grpga, worldbuilding, dnd4e
  'data.biography',
  // alienrpg, symbaroum
  'data.notes',
  // morkborg, blades-in-the-dark, earthdawn4e
  'data.description',
  // shadowrun5e
  'data.description.value',
  // pf1, dsa5, D35E
  'data.details.notes.value',
  // wwn
  'data.details.notes',
  // wwn
  'data.details.description',
  // pf2e
  'data.details.biography.public',
  // vaesen
  'data.note',
  // cortexprime
  'data.actorType.notes',
  // cortexprime
  'data.actorType.description',
  // cyphersystem
  'data.basic.notes',
  // cyphersystem
  'data.basic.description',
  // sfrpg
  'data.details.biography.gmNotes',
  // forbidden-lands
  'data.bio.note.value',
  // age-system
  'data.data.features',

  // gm-notes module (https://github.com/syl3r86/gm-notes)
  'data.flags.gm-notes.notes',
];

/**
 * ExtractRelatedActorData - extracts the entity UUIDs that are related to the given actor.
 * @param {object} actor - the actor to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedActorData(actor) {
  const relatedData = new RelatedData();
  if (!actor) {
    return relatedData;
  }

  for (const content of ExtractActorContent(actor)) {
    if (typeof content !== 'string') {
      continue;
    }

    const relations = ExtractUUIDsFromContent(content);
    if (relations.length) {
      relatedData.AddRelations(actor.uuid, relations);
    }
  }

  return relatedData;
}

/**
 * ExtractActorContent - extracts the HTML content from the given actor.
 * @param {object} actor - the actor to extract the content from.
 * @return {string[]} - the list of HTML content.
 */
export function ExtractActorContent(actor) {
  const contentData = [];
  if (!actor) {
    return contentData;
  }

  for (const path of ActorDataLocations) {
    const content = ResolvePath(path, actor);
    if (content) {
      contentData.push(content);
    }
  }

  return contentData;
}

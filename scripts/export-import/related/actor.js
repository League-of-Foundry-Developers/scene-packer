import {ExtractUUIDsFromContent, RelatedData, ResolvePath} from './related-data.js';
import ScenePacker from '../../scene-packer.js';

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

  // Include Token Attacher related data
  relatedData.AddRelatedData(ExtractRelatedTokenAttacherData(actor));

  return relatedData;
}

/**
 * ExtractRelatedTokenAttacherData - extracts the entity UUIDS that are related to the token attacher data.
 * @see https://github.com/KayelGee/token-attacher
 * @param {object} actor - the actor to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedTokenAttacherData(actor) {
  const relatedData = new RelatedData();
  if (!actor?.data) {
    return relatedData;
  }

  let tokenAttacherData = getProperty(actor.data, 'token.flags.token-attacher.prototypeAttached');
  if (tokenAttacherData?.Tile?.length) {
    // Extract Monk's Active Tile related actions
    ScenePacker.GetActiveTilesData(tokenAttacherData.Tile).forEach(tile => {
      (getProperty(tile.data, 'flags.monks-active-tiles.actions') || [])
        .filter(
          (a) => a?.data?.macroid ||
            a?.data?.entity?.id ||
            a?.data?.item?.id ||
            a?.data?.location?.sceneId ||
            a?.data?.rolltableid
        ).forEach(action => {
        if (action.data?.macroid) {
          relatedData.AddRelation(actor.uuid, `Macro.${action.data.macroid}`);
        } else if (action.data?.location?.sceneId) {
          relatedData.AddRelation(actor.uuid, `Scene.${action.data.location.sceneId}`);
        } else if (action.data?.rolltableid) {
          relatedData.AddRelation(actor.uuid, `RollTable.${action.data.rolltableid}`);
        } else if (action.data?.entity?.id) {
          relatedData.AddRelation(actor.uuid, action.data.entity.id);
        } else if (action.data?.item?.id) {
          relatedData.AddRelation(actor.uuid, action.data.item.id);
        }
      })
    });
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

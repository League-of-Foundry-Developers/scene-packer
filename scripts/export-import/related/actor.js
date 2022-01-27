import {ExtractRelatedItemData} from './item.js';
import {ExtractUUIDsFromContent, RelatedData, ResolvePath} from './related-data.js';
import ScenePacker from '../../scene-packer.js';

/**
 * ActorDataLocations - the list of locations where HTML content is stored.
 * @type {string[]}
 */
export const ActorDataLocations = [
  // dnd5e, wfrp4e, pf2e, pf1, swade, sfrpg, dsa5, D35E
  'details.biography.value',
  'data.details.biography.value',
  // grpga, worldbuilding, dnd4e
  'biography',
  'data.biography',
  // alienrpg, symbaroum
  'notes',
  'data.notes',
  // morkborg, blades-in-the-dark, earthdawn4e
  'description',
  'data.description',
  // shadowrun5e
  'description.value',
  'data.description.value',
  // pf1, dsa5, D35E
  'details.notes.value',
  'data.details.notes.value',
  // wwn
  'details.notes',
  'data.details.notes',
  // wwn
  'details.description',
  'data.details.description',
  // pf2e
  'details.biography.public',
  'data.details.biography.public',
  // vaesen
  'note',
  'data.note',
  // cortexprime
  'actorType.notes',
  'data.actorType.notes',
  // cortexprime
  'actorType.description',
  'data.actorType.description',
  // cyphersystem
  'basic.notes',
  'data.basic.notes',
  // cyphersystem
  'basic.description',
  'data.basic.description',
  // sfrpg
  'details.biography.gmNotes',
  'data.details.biography.gmNotes',
  // forbidden-lands
  'bio.note.value',
  'data.bio.note.value',
  // age-system
  'data.features',
  'data.data.features',

  // gm-notes module (https://github.com/syl3r86/gm-notes)
  'data.flags.gm-notes.notes',
];

/**
 * ExtractRelatedActorData - extracts the entity UUIDs that are related to the given actor.
 * @param {Actor|ClientDocumentMixin} actor - the actor to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedActorData(actor) {
  const relatedData = new RelatedData();
  if (!actor) {
    return relatedData;
  }
  const id = actor.id || actor._id;
  const uuid = actor.uuid || `${Actor.documentName}.${id}`;

  for (const contentWithPath of ExtractActorContent(actor)) {
    if (typeof contentWithPath?.content !== 'string') {
      continue;
    }

    const relations = ExtractUUIDsFromContent(contentWithPath.content, contentWithPath.path);
    if (relations.length) {
      relatedData.AddRelations(uuid, relations);
    }
  }

  // Include Token Attacher related data
  relatedData.AddRelatedData(ExtractRelatedTokenAttacherData(actor));

  // Include related Items belonging to the actor
  if (actor.items) {
    for (const item of actor.items) {
      const relatedItems = ExtractRelatedItemData(item);
      for (const relations of relatedItems.data.values()) {
        for (const relation of relations) {
          relatedData.AddRelation(uuid, {path: 'items', uuid: relation.uuid, embeddedId: item.id, embeddedPath: relation.path});
        }
      }
    }
  }

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

  const id = actor.id || actor._id;
  const uuid = actor.uuid || `${Actor.documentName}.${id}`;

  let path = 'token.flags.token-attacher.prototypeAttached';
  let tokenAttacherData = getProperty(actor.data, path);
  if (tokenAttacherData?.Tile?.length) {
    // Extract Monk's Active Tile related actions
    ScenePacker.GetActiveTilesData(tokenAttacherData.Tile).forEach(tile => {
      (getProperty(tile.data, 'flags.monks-active-tiles.actions') || [])
        .filter(
          (a) => a?.data?.macroid ||
            a?.data?.entity?.id ||
            a?.data?.item?.id ||
            a?.data?.location?.sceneId ||
            a?.data?.rolltableid,
        ).forEach(action => {
        if (action.data?.macroid) {
          relatedData.AddRelation(uuid, {uuid: `Macro.${action.data.macroid}`, path});
        } else if (action.data?.location?.sceneId) {
          relatedData.AddRelation(uuid, {uuid: `Scene.${action.data.location.sceneId}`, path});
        } else if (action.data?.rolltableid) {
          relatedData.AddRelation(uuid, {uuid: `RollTable.${action.data.rolltableid}`, path});
        } else if (action.data?.entity?.id) {
          relatedData.AddRelation(uuid, {uuid: action.data.entity.id, path});
        } else if (action.data?.item?.id) {
          relatedData.AddRelation(uuid, {uuid: action.data.item.id, path});
        }
      });
    });
  }

  return relatedData;
}

/**
 * ExtractActorContent - extracts the HTML content from the given actor.
 * @param {object} actor - the actor to extract the content from.
 * @return {ContentWithPath[]} - the list of HTML content.
 */
export function ExtractActorContent(actor) {
  const contentData = [];
  if (!actor) {
    return contentData;
  }

  for (const path of ActorDataLocations) {
    const content = ResolvePath(path, actor);
    if (content) {
      contentData.push({path, content});
    }
  }

  return contentData;
}

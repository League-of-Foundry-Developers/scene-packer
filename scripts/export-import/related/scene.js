import {ExtractRelatedActiveTileData} from './active-tiles.js';
import {RelatedData} from './related-data.js';

/**
 * ExtractRelatedSceneData - extracts the entity UUIDs that are related to the given scene.
 * @param {Scene|ClientDocumentMixin} scene - the scene to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedSceneData(scene) {
  const relatedData = new RelatedData();
  if (!scene) {
    return relatedData;
  }

  const id = scene.id || scene._id;
  const uuid = scene.uuid || `${Scene.documentName}.${id}`;

  if (scene.journal) {
    relatedData.AddRelation(uuid, {uuid: `JournalEntry.${scene.journal.id}`, path: 'journal'});
  }

  if (scene.playlist) {
    relatedData.AddRelation(uuid, {uuid: `Playlist.${scene.playlist.id}`, path: 'playlist'});
  }

  // TODO Test V7
  const notes = scene.data.notes.map(n => {
    return {uuid: `JournalEntry.${n.data.entryId}`, path: 'notes'};
  }).filter(d => d);
  if (notes.length) {
    relatedData.AddRelations(uuid, notes);
  }

  const tokens = scene.data.tokens.map(t => {
    return {uuid: `Actor.${t.data.actorId}`, path: 'tokens'};
  }).filter(d => d);
  if (tokens.length) {
    relatedData.AddRelations(uuid, tokens);
  }

  relatedData.AddRelatedData(ExtractRelatedActiveTileData(scene.data?.tiles, uuid));

  return relatedData;
}

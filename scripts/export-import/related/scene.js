import {CONSTANTS} from '../../constants.js';
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

  const sceneData = CONSTANTS.IsV10orNewer() ? scene : scene.data;
  const notes = sceneData.notes.map(n => {
    const noteData = CONSTANTS.IsV10orNewer() ? n : n.data;
    return {uuid: `JournalEntry.${noteData.entryId}`, path: 'notes'};
  }).filter(d => d);
  if (notes.length) {
    relatedData.AddRelations(uuid, notes);
  }

  const tokens = sceneData.tokens.map(t => {
    const tokenData = CONSTANTS.IsV10orNewer() ? t : t.data;
    return {uuid: `Actor.${tokenData.actorId}`, path: 'tokens'};
  }).filter(d => d);
  if (tokens.length) {
    relatedData.AddRelations(uuid, tokens);
  }

  relatedData.AddRelatedData(ExtractRelatedActiveTileData(sceneData?.tiles, uuid));

  return relatedData;
}

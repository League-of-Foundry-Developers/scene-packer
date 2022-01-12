import {RelatedData} from './related-data.js';

/**
 * ExtractRelatedSceneData - extracts the entity UUIDs that are related to the given scene.
 * @param {object} scene - the scene to extract the related data from.
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

  // Monk's Active Tile Triggers support.
  const activeTiles = ScenePacker.GetActiveTilesData(scene.data?.tiles);
  if (activeTiles.length) {
    const extractActiveTileReference = (value) => {
      if (!value) {
        return undefined;
      }
      const entityParts = value.split('.');
      if (entityParts.length < 2 || !entityParts[0] || !entityParts[1]) {
        // Missing definition of the entity type and entity id, unable to match.
        return undefined;
      }
      return `${entityParts[0]}.${entityParts[1]}`;
    }
    let path = 'flags.monks-active-tiles.actions';
    for (const tile of activeTiles) {
      const actions = tile.getFlag('monks-active-tiles', 'actions');
      for (const action of actions) {
        const entityReference = extractActiveTileReference(action.data?.entity?.id);
        if (entityReference && entityReference !== `Scene.${scene.id}`) {
          // We have a reference to an entity that isn't this current scene.
          relatedData.AddRelation(uuid, {uuid: entityReference, path});
        }

        const itemReference = extractActiveTileReference(action.data?.item?.id);
        if (itemReference) {
          relatedData.AddRelation(uuid, {uuid: itemReference, path});
        }

        if (action.data?.location?.sceneId) {
          relatedData.AddRelation(uuid, {uuid: `Scene.${action.data.location.sceneId}`, path});
        }

        if (action.data?.macroid) {
          relatedData.AddRelation(uuid, {uuid: `Macro.${action.data.macroid}`, path});
        }

        if (action.data?.rolltableid) {
          relatedData.AddRelation(uuid, {uuid: `RollTable.${action.data.rolltableid}`, path});
        }
      }
    }
  }

  return relatedData;
}

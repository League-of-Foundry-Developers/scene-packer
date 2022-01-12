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

  if (scene.journal) {
    relatedData.AddRelation(scene.uuid, `JournalEntry.${scene.journal.id}`);
  }

  if (scene.playlist) {
    relatedData.AddRelation(scene.uuid, `Playlist.${scene.playlist.id}`);
  }

  // TODO Test V7
  const notes = scene.data.notes.map(n => `JournalEntry.${n.data.entryId}`).filter(d => d);
  if (notes.length) {
    relatedData.AddRelations(scene.uuid, notes);
  }

  const tokens = scene.data.tokens.map(t => `Actor.${t.data.actorId}`).filter(d => d);
  if (tokens.length) {
    relatedData.AddRelations(scene.uuid, tokens);
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
    for (const tile of activeTiles) {
      const actions = tile.getFlag('monks-active-tiles', 'actions');
      for (const action of actions) {
        const entityReference = extractActiveTileReference(action.data?.entity?.id);
        if (entityReference && entityReference !== `Scene.${scene.id}`) {
          // We have a reference to an entity that isn't this current scene.
          relatedData.AddRelation(scene.uuid, entityReference);
        }

        const itemReference = extractActiveTileReference(action.data?.item?.id);
        if (itemReference) {
          relatedData.AddRelation(scene.uuid, itemReference);
        }

        if (action.data?.location?.sceneId) {
          relatedData.AddRelation(scene.uuid, `Scene.${action.data.location.sceneId}`);
        }

        if (action.data?.macroid) {
          relatedData.AddRelation(scene.uuid, `Macro.${action.data.macroid}`);
        }

        if (action.data?.rolltableid) {
          relatedData.AddRelation(scene.uuid, `RollTable.${action.data.rolltableid}`);
        }
      }
    }
  }

  return relatedData;
}

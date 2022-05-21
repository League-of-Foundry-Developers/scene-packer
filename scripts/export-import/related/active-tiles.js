import {CONSTANTS} from '../../constants.js';
import {RelatedData} from './related-data.js';

/**
 * ExtractRelatedActiveTileData - extracts the entity UUIDs that are related to the given active tiles.
 * @param {Object[]|EmbeddedCollection} tiles - The tiles which might contain Monk's Active Tiles actions
 * @param {string} parentUUID - The UUID of the parent entity
 * @return {RelatedData}
 */
export function ExtractRelatedActiveTileData(tiles, parentUUID) {
  const relatedData = new RelatedData();
  const activeTiles = ScenePacker.GetActiveTilesData(tiles);

  if (!activeTiles.length) {
    return relatedData;
  }

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
    const tileData = CONSTANTS.IsV10orNewer() ? tile : tile.data || tile;
    const actions = getProperty(tileData, path);
    for (const action of actions) {
      const actionData = CONSTANTS.IsV10orNewer() ? action : action.data;
      const entityReference = extractActiveTileReference(actionData?.entity?.id);
      if (entityReference && entityReference !== `Scene.${scene.id}`) {
        // We have a reference to an entity that isn't this current scene.
        relatedData.AddRelation(parentUUID, {uuid: entityReference, path});
      }

      const itemReference = extractActiveTileReference(actionData?.item?.id);
      if (itemReference) {
        relatedData.AddRelation(parentUUID, {uuid: itemReference, path});
      }

      if (actionData?.location?.sceneId) {
        relatedData.AddRelation(parentUUID, {uuid: `Scene.${actionData.location.sceneId}`, path});
      }

      if (actionData?.macroid) {
        relatedData.AddRelation(parentUUID, {uuid: `Macro.${actionData.macroid}`, path});
      }

      if (actionData?.rolltableid) {
        relatedData.AddRelation(parentUUID, {uuid: `RollTable.${actionData.rolltableid}`, path});
      }
    }
  }

  return relatedData;
}

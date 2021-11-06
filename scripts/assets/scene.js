import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given scene
 * @param {object} scene - The scene to extract assets from.
 * @return {AssetData}
 * @constructor
 */
export async function ExtractSceneAssets(scene) {
  const data = new AssetData({
    id: scene?.id || '',
    name: scene?.name || '',
    documentType: scene?.documentName || 'Unknown',
  });

  if (!scene) {
    return data;
  }

  if (scene.data.img) {
    await data.AddAsset({
      id: scene.id,
      key: 'img',
      parentID: scene.id,
      parentType: scene.documentName,
      documentType: scene.documentName,
      location: AssetReport.Locations.SceneBackground,
      asset: scene.data.img,
    });
  }

  if (scene.data.foreground) {
    await data.AddAsset({
      id: scene.id,
      key: 'foreground',
      parentID: scene.id,
      parentType: scene.documentName,
      documentType: scene.documentName,
      location: AssetReport.Locations.SceneForeground,
      asset: scene.data.foreground,
    });
  }

  const notes = [];
  const tiles = [];
  const drawings = [];
  const tokens = [];
  const sounds = [];

  if (CONSTANTS.IsV8orNewer()) {
    if (scene.data.notes?.size) {
      notes.push(...Array.from(scene.data.notes.values()));
    }
    if (scene.data.tiles?.size) {
      tiles.push(...Array.from(scene.data.tiles.values()));
    }
    if (scene.data.drawings?.size) {
      drawings.push(...Array.from(scene.data.drawings.values()));
    }
    if (scene.data.tokens?.size) {
      tokens.push(...Array.from(scene.data.tokens.values()));
    }
    if (scene.data.sounds?.size) {
      sounds.push(...Array.from(scene.data.sounds.values()));
    }
  } else {
    if (scene.data.notes?.length) {
      notes.push(...scene.data.notes);
    }
    if (scene.data.tiles?.length) {
      tiles.push(...scene.data.tiles);
    }
    if (scene.data.drawings?.length) {
      drawings.push(...scene.data.drawings);
    }
    if (scene.data.tokens?.length) {
      tokens.push(...scene.data.tokens);
    }
    if (scene.data.sounds?.length) {
      sounds.push(...scene.data.sounds);
    }
  }

  for (const note of notes) {
    const icon = note?.data?.icon || note?.icon;
    if (icon) {
      await data.AddAsset({
        id: note.id,
        key: 'icon',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: note.documentName || 'Note',
        location: AssetReport.Locations.SceneNoteIcon,
        asset: icon,
      });
    }
  }

  for (const tile of tiles) {
    const img = tile?.data?.img || tile?.img;
    if (img) {
      await data.AddAsset({
        id: tile.id,
        key: 'img',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: tile.documentName || 'Tile',
        location: AssetReport.Locations.SceneTileImage,
        asset: img,
      });
    }
  }

  for (const drawing of drawings) {
    const texture = drawing?.data?.texture || drawing?.texture;
    if (texture) {
      await data.AddAsset({
        id: drawing.id,
        key: 'img',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: drawing.documentName || 'Drawing',
        location: AssetReport.Locations.SceneDrawingImage,
        asset: texture,
      });
    }
  }

  for (const token of tokens) {
    const img = token?.data?.img || token?.img;
    if (img) {
      await data.AddAsset({
        id: token.id,
        key: 'img',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: token.documentName || 'Token',
        location: AssetReport.Locations.SceneTokenImage,
        asset: img,
      });
    }
  }

  for (const sound of sounds) {
    let path = sound?.data?.path || sound?.path;
    if (path) {
      await data.AddAsset({
        id: sound.id,
        key: 'path',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: sound.documentName || 'AmbientSound',
        location: AssetReport.Locations.SceneAmbientSound,
        asset: path,
      });
    }
  }

  return data;
}

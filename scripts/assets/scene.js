import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given scene
 * @param {Scene||ClientDocumentMixin} scene - The scene to extract assets from.
 * @return {AssetData}
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

  const sceneData = CONSTANTS.IsV10orNewer() ? scene : scene.data;
  if (sceneData.img) {
    await data.AddAsset({
      id: scene.id,
      key: 'img',
      parentID: scene.id,
      parentType: scene.documentName,
      documentType: scene.documentName,
      location: AssetReport.Locations.SceneBackground,
      asset: sceneData.img,
    });
  }

  if (sceneData.background?.src) {
    await data.AddAsset({
      id: scene.id,
      key: 'img',
      parentID: scene.id,
      parentType: scene.documentName,
      documentType: scene.documentName,
      location: AssetReport.Locations.SceneBackground,
      asset: sceneData.background.src,
    });
  }

  if (sceneData.foreground) {
    await data.AddAsset({
      id: scene.id,
      key: 'foreground',
      parentID: scene.id,
      parentType: scene.documentName,
      documentType: scene.documentName,
      location: AssetReport.Locations.SceneForeground,
      asset: sceneData.foreground,
    });
  }

  const notes = [];
  const tiles = [];
  const drawings = [];
  const tokens = [];
  const sounds = [];

  if (sceneData.notes?.size) {
    notes.push(...Array.from(sceneData.notes.values()));
  }
  if (sceneData.tiles?.size) {
    tiles.push(...Array.from(sceneData.tiles.values()));
  }
  if (sceneData.drawings?.size) {
    drawings.push(...Array.from(sceneData.drawings.values()));
  }
  if (sceneData.tokens?.size) {
    tokens.push(...Array.from(sceneData.tokens.values()));
  }
  if (sceneData.sounds?.size) {
    sounds.push(...Array.from(sceneData.sounds.values()));
  }

  for (const note of notes) {
    const noteData = CONSTANTS.IsV10orNewer() ? note : note?.data;
    if (noteData.texture?.src) {
      await data.AddAsset({
        id: note.id,
        key: 'texture.src',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: note.documentName || 'Note',
        location: AssetReport.Locations.SceneNoteIcon,
        asset: noteData.texture.src,
      });
      continue;
    }

    const icon = noteData?.icon ?? note?.icon;
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
    const tileData = CONSTANTS.IsV10orNewer() ? tile : tile?.data;
    const img = tileData?.img || tile?.img;
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
    if (tileData.texture?.src) {
      await data.AddAsset({
        id: tile.id,
        key: 'texture.src',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: tile.documentName || 'Tile',
        location: AssetReport.Locations.SceneTileImage,
        asset: tileData.texture.src,
      });
    }
  }

  for (const drawing of drawings) {
    const drawingData = CONSTANTS.IsV10orNewer() ? drawing : drawing?.data;
    const texture = drawingData?.texture || drawing?.texture;
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
    const tokenData = CONSTANTS.IsV10orNewer() ? token : token?.data;
    const img = tokenData?.img || token?.img;
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
    if (tokenData.texture?.src) {
      await data.AddAsset({
        id: token.id,
        key: 'texture.src',
        parentID: scene.id,
        parentType: scene.documentName,
        documentType: token.documentName || 'Token',
        location: AssetReport.Locations.SceneTokenImage,
        asset: tokenData.texture.src,
      });
    }
  }

  for (const sound of sounds) {
    const soundData = CONSTANTS.IsV10orNewer() ? sound : sound?.data;
    let path = soundData?.path || sound?.path;
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

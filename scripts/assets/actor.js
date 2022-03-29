import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given actor
 * @param {Actor|ClientDocumentMixin} actor - The actor to extract assets from.
 * @return {AssetData}
 */
export async function ExtractActorAssets(actor) {
  const data = new AssetData({
    id: actor?.id || '',
    name: actor?.name || '',
    documentType: actor?.documentName || 'Unknown',
  });

  if (!actor) {
    return data;
  }

  if (actor.data.img) {
    await data.AddAsset({
      id: actor.id,
      key: 'img',
      parentID: actor.id,
      parentType: actor.documentName,
      documentType: actor.documentName,
      location: AssetReport.Locations.ActorImage,
      asset: actor.data.img,
    });
  }

  const tokenImage = actor.token?.img || actor.data?.token?.img;
  if (tokenImage) {
    await data.AddAsset({
      id: actor.id,
      key: 'token.img',
      parentID: actor.id,
      parentType: actor.documentName,
      documentType: actor.documentName,
      location: AssetReport.Locations.ActorTokenImage,
      asset: tokenImage,
    });
  }

  const items = [];
  const effects = [];

  if (actor.data.items?.size) {
    items.push(...Array.from(actor.data.items.values()));
  }
  if (actor.data.effects?.size) {
    effects.push(...Array.from(actor.data.effects.values()));
  }

  for (const item of items) {
    const img = item?.data?.img || item?.img;
    if (img) {
      await data.AddAsset({
        id: item.id,
        key: 'img',
        parentID: actor.id,
        parentType: actor.documentName,
        documentType: item.documentName || 'Item',
        location: AssetReport.Locations.ActorItemImage,
        asset: img,
      });
    }
  }

  for (const effect of effects) {
    const img = effect?.data?.img;
    if (img) {
      await data.AddAsset({
        id: effect.id,
        key: 'img',
        parentID: actor.id,
        parentType: actor.documentName,
        documentType: effect.documentName || 'ActiveEffect',
        location: AssetReport.Locations.ActorEffectImage,
        asset: img,
      });
    }
    const icon = effect?.data?.img || effect?.data?.icon;
    if (icon) {
      await data.AddAsset({
        id: effect.id,
        key: 'icon',
        parentID: actor.id,
        parentType: actor.documentName,
        documentType: effect.documentName || 'ActiveEffect',
        location: AssetReport.Locations.ActorEffectImage,
        asset: icon,
      });
    }
  }

  // Add token attacher assets
  const tokenAttacherData = actor.data.token?.flags['token-attacher']?.prototypeAttached;
  if (tokenAttacherData) {
    for (const tile of (tokenAttacherData.Tile || [])) {
      if (tile?.img) {
        await data.AddAsset({
          id: actor.id,
          key: 'token.attacher.tile.img',
          parentID: actor.id,
          parentType: actor.documentName,
          documentType: actor.documentName,
          location: AssetReport.Locations.ActorTokenAttacherTile,
          asset: tile.img,
        });
      }
    }
    for (const token of (tokenAttacherData.Token || [])) {
      if (token?.img) {
        await data.AddAsset({
          id: actor.id,
          key: 'token.attacher.token.img',
          parentID: actor.id,
          parentType: actor.documentName,
          documentType: actor.documentName,
          location: AssetReport.Locations.ActorTokenAttacherToken,
          asset: token.img,
        });
      }
    }
    for (const drawing of (tokenAttacherData.Drawing || [])) {
      if (drawing?.texture) {
        await data.AddAsset({
          id: actor.id,
          key: 'token.attacher.drawing.texture',
          parentID: actor.id,
          parentType: actor.documentName,
          documentType: actor.documentName,
          location: AssetReport.Locations.ActorTokenAttacherDrawingTexture,
          asset: drawing.texture,
        });
      }
    }
  }

  return data;
}

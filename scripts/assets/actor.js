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

  const actorData = CONSTANTS.IsV10orNewer() ? actor : actor.data;
  if (actorData.img) {
    await data.AddAsset({
      id: actor.id,
      key: 'img',
      parentID: actor.id,
      parentType: actor.documentName,
      documentType: actor.documentName,
      location: AssetReport.Locations.ActorImage,
      asset: actorData.img,
    });
  }

  const tokenImage = actor.token?.img || actorData?.token?.img;
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

  if (actorData.items?.size) {
    items.push(...Array.from(actorData.items.values()));
  }
  if (actorData.effects?.size) {
    effects.push(...Array.from(actorData.effects.values()));
  }

  for (const item of items) {
    const itemData = CONSTANTS.IsV10orNewer() ? item : item?.data;
    const img = itemData?.img || item?.img;
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
    const effectData = CONSTANTS.IsV10orNewer() ? effect : effect?.data;
    const img = effectData?.img;
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
    const icon = effectData?.img || effectData?.icon;
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
  const tokenAttacherData = actorData.token?.flags['token-attacher']?.prototypeAttached;
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

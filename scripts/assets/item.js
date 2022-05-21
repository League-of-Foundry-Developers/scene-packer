import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given item
 * @param {Item|ClientDocumentMixin} item - The item to extract assets from.
 * @return {AssetData}
 */
export async function ExtractItemAssets(item) {
  const data = new AssetData({
    id: item?.id || '',
    name: item?.name || '',
    documentType: item?.documentName || 'Unknown',
  });

  if (!item) {
    return data;
  }

  const itemData = CONSTANTS.IsV10orNewer() ? item : item.data;
  if (itemData.img) {
    await data.AddAsset({
      id: item.id,
      key: 'img',
      parentID: item.id,
      parentType: item.documentName,
      documentType: item.documentName,
      location: AssetReport.Locations.ItemImage,
      asset: itemData.img,
    });
  }

  const effects = [];

  if (itemData.effects?.size) {
    effects.push(...Array.from(itemData.effects.values()));
  }

  for (const effect of effects) {
    const effectData = CONSTANTS.IsV10orNewer() ? effect : effect?.data;
    const img = effectData?.img;
    if (img) {
      await data.AddAsset({
        id: effect.id,
        key: 'effect.img',
        parentID: item.id,
        parentType: item.documentName,
        documentType: effect.documentName || 'ActiveEffect',
        location: AssetReport.Locations.ItemEffectImage,
        asset: img,
      });
    }
    const icon = effectData?.icon;
    if (icon) {
      await data.AddAsset({
        id: effect.id,
        key: 'effect.icon',
        parentID: item.id,
        parentType: item.documentName,
        documentType: effect.documentName || 'ActiveEffect',
        location: AssetReport.Locations.ItemEffectImage,
        asset: icon,
      });
    }
  }

  let itemDescription;
  if (CONSTANTS.IsV10orNewer()) {
    itemDescription = itemData?.description?.value || itemData?.system?.description?.value;
  } else {
    itemDescription = itemData?.description?.value || itemData?.data?.description?.value;
  }
  if (itemDescription) {
    const doc = new DOMParser().parseFromString(itemDescription, 'text/html');
    const images = doc.getElementsByTagName('img');
    for (const image of images) {
      if (image?.src && !image.src.startsWith('data:')) {
        await data.AddAsset({
          id: item.id,
          key: 'description',
          parentID: item.id,
          parentType: item.documentName,
          documentType: item.documentName,
          location: AssetReport.Locations.ItemEmbeddedImage,
          asset: image.src,
        });
      }
    }
  }

  return data;
}

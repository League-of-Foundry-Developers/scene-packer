import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given item
 * @param {object} item - The item to extract assets from.
 * @return {AssetData}
 * @constructor
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

  if (item.data.img) {
    await data.AddAsset({
      id: item.id,
      key: 'img',
      parentID: item.id,
      parentType: item.documentName,
      documentType: item.documentName,
      location: AssetReport.Locations.ItemImage,
      asset: item.data.img,
    });
  }

  const effects = [];

  if (CONSTANTS.IsV8orNewer()) {
    if (item.data.effects?.size) {
      effects.push(...Array.from(item.data.effects.values()));
    }
  } else {
    if (item.data.effects?.length) {
      effects.push(...item.data.effects);
    }
  }

  for (const effect of effects) {
    const img = effect?.data?.img || effect?.icon;
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
  }

  const itemDescription =
    item.data?.description?.value || item.data?.data?.description?.value;
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

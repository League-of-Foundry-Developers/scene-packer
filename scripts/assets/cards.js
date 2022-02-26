import {AssetData} from './data.js';
import AssetReport from '../asset-report.js';

/**
 * Extract assets from the given cards
 * @param {Cards|ClientDocumentMixin} cards - The cards to extract assets from.
 * @return {AssetData}
 */
export async function ExtractCardAssets(cards) {
  const data = new AssetData({
    id: cards?.id || '',
    name: cards?.name || '',
    documentType: cards?.documentName || 'Unknown',
  });

  if (!cards) {
    return data;
  }

  if (cards.data.img) {
    await data.AddAsset({
      id: cards.id,
      key: 'img',
      parentID: cards.id,
      parentType: cards.documentName,
      documentType: cards.documentName,
      location: AssetReport.Locations.RollTableImage,
      asset: cards.data.img,
    });
  }

  for (const card of cards.data.cards) {
    if (card.data?.back?.img) {
      await data.AddAsset({
        id: card.id,
        key: 'card.img',
        parentID: cards.id,
        parentType: cards.documentName,
        documentType: card.documentName,
        location: AssetReport.Locations.CardBackImage,
        asset: card.data.back.img,
      });
    }

    for (let i = 0; i < card.data.faces.length; i++) {
      const face = card.data.faces[i];
      if (face.img) {
        await data.AddAsset({
          id: i,
          key: `card.faces.img`,
          parentID: card.id,
          parentType: card.documentName,
          documentType: face.documentName || card.documentName,
          location: AssetReport.Locations.CardFaceImage,
          asset: face.img,
        });
      }
    }
  }

  return data;
}

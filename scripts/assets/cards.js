import {AssetData} from './data.js';
import AssetReport from '../asset-report.js';
import {CONSTANTS} from '../constants.js';

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

  const cardsData = CONSTANTS.IsV10orNewer() ? cards : cards.data;
  if (cardsData.img) {
    await data.AddAsset({
      id: cards.id,
      key: 'img',
      parentID: cards.id,
      parentType: cards.documentName,
      documentType: cards.documentName,
      location: AssetReport.Locations.RollTableImage,
      asset: cardsData.img,
    });
  }

  for (const card of cardsData.cards) {
    const cardData = CONSTANTS.IsV10orNewer() ? card : card.data;
    if (cardData?.back?.img) {
      await data.AddAsset({
        id: card.id,
        key: 'card.img',
        parentID: cards.id,
        parentType: cards.documentName,
        documentType: card.documentName,
        location: AssetReport.Locations.CardBackImage,
        asset: cardData.back.img,
      });
    }

    for (let i = 0; i < cardData.faces.length; i++) {
      const face = cardData.faces[i];
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

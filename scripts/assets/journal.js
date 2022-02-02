import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';

/**
 * Extract assets from the given journal
 * @param {JournalEntry|ClientDocumentMixin} journal - The journal to extract assets from.
 * @return {AssetData}
 */
export async function ExtractJournalEntryAssets(journal) {
  const data = new AssetData({
    id: journal?.id || '',
    name: journal?.name || '',
    documentType: journal?.documentName || 'Unknown',
  });

  if (!journal) {
    return data;
  }

  if (journal.data.img) {
    await data.AddAsset({
      id: journal.id,
      key: 'img',
      parentID: journal.id,
      parentType: journal.documentName,
      documentType: journal.documentName,
      location: AssetReport.Locations.JournalImage,
      asset: journal.data.img,
    });
  }

  if (journal.data.content) {
    const doc = new DOMParser().parseFromString(
      journal.data.content,
      'text/html'
    );
    const images = doc.getElementsByTagName('img');
    for (const image of images) {
      if (image?.src && !image.src.startsWith('data:')) {
        await data.AddAsset({
          id: journal.id,
          key: 'content',
          parentID: journal.id,
          parentType: journal.documentName,
          documentType: journal.documentName,
          location: AssetReport.Locations.JournalEmbeddedImage,
          asset: image.src,
        });
      }
    }
  }

  return data;
}

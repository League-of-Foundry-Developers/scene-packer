import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import {CONSTANTS} from '../constants.js';
import {ExtractActorAssets} from './actor.js';

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

  const journalData = CONSTANTS.IsV10orNewer() ? journal : journal.data;
  if (journalData.img) {
    await data.AddAsset({
      id: journal.id,
      key: 'img',
      parentID: journal.id,
      parentType: journal.documentName,
      documentType: journal.documentName,
      location: AssetReport.Locations.JournalImage,
      asset: journalData.img,
    });
  }

  if (journalData.content) {
    const doc = new DOMParser().parseFromString(
      journalData.content,
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

  if (journalData.pages) {
    for (const page of journalData.pages) {
      if (page.type === 'image' && page.src) {
        await data.AddAsset({
          id: page.id,
          key: 'pages',
          parentID: journal.id,
          parentType: journal.documentName,
          documentType: journal.documentName,
          location: AssetReport.Locations.JournalImage,
          asset: page.src,
        });
      }

      if (page.type === 'text' && page.text?.content) {
        const doc = new DOMParser().parseFromString(
          page.text.content,
          'text/html'
        );
        const images = doc.getElementsByTagName('img');
        for (const image of images) {
          if (image?.src && !image.src.startsWith('data:')) {
            await data.AddAsset({
              id: page.id,
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
    }
  }

  data.AddAssetData(await ExtractQuickEncounterAssets(journal));
  data.AddAssetData(await ExtractMonksEnhancedJournalAssets(journal));

  return data;
}

/**
 * Extract Quick Encounter assets from the journal
 * @param {JournalEntry|ClientDocumentMixin} journal - The journal to extract assets from.
 * @return {AssetData}
 */
export async function ExtractQuickEncounterAssets(journal) {
  const data = new AssetData({
    id: journal?.id || '',
    name: journal?.name || '',
    documentType: journal?.documentName || 'Unknown',
  });

  if (!journal) {
    return data;
  }

  let quickEncounter = {};
  const path = 'flags.quick-encounters.quickEncounter';
  const journalData = CONSTANTS.IsV10orNewer() ? journal : journal.data;
  const quickEncounterData = getProperty(journalData, path);
  if (!quickEncounterData) {
    return data;
  }

  try {
    if (typeof quickEncounterData === 'string') {
      quickEncounter = JSON.parse(quickEncounterData);
    } else if (typeof quickEncounterData === 'object') {
      quickEncounter = quickEncounterData;
    }
    if (!quickEncounter) {
      return data;
    }
  } catch (e) {
    return data;
  }

  if (quickEncounter.savedTilesData) {
    for (const tile of quickEncounter.savedTilesData) {
      if (tile?.img) {
        await data.AddAsset({
          id: tile.id,
          key: 'quick.encounter.tile',
          parentID: journal.id,
          parentType: journal.documentName,
          documentType: journal.documentName,
          location: AssetReport.Locations.JournalQuickEncounterTileImage,
          asset: tile.img,
        });
      }
    }
  }

  if (quickEncounter.extractedActors) {
    for (let i = 0; i < quickEncounter.extractedActors.length; i++) {
      const extractedActor = quickEncounter.extractedActors[i];
      const actor = game.actors.find((a) => {
        return (
          (a.getFlag(CONSTANTS.MODULE_NAME, 'sourceId') === extractedActor.actorID ||
            a.getFlag('core', 'sourceId') === extractedActor.actorID ||
            a.id === extractedActor.actorID) &&
          !a.getFlag(CONSTANTS.MODULE_NAME, 'deprecated')
        );
      });
      if (actor) {
        data.AddAssetData(await ExtractActorAssets(actor));

        for (const token of extractedActor.savedTokensData || []) {
          const tokenImage = token?.img;
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
        }
      }
    }
  }

  return data;
}

/**
 * Extract assets from the given Monk's Enhanced Journal
 * @param {JournalEntry|ClientDocumentMixin} journal - The journal to extract assets from.
 * @return {AssetData}
 */
export async function ExtractMonksEnhancedJournalAssets(journal) {
  const data = new AssetData({
    id: journal?.id || '',
    name: journal?.name || '',
    documentType: journal?.documentName || 'Unknown',
  });

  if (!journal) {
    return data;
  }

  const journalData = CONSTANTS.IsV10orNewer() ? journal : journal.data;
  const enhancedJournalData = getProperty(journalData, 'flags.monks-enhanced-journal');
  if (!enhancedJournalData) {
    return data;
  }

  if (enhancedJournalData.audiofile) {
    await data.AddAsset({
      id: journal.id,
      key: 'monks.enhanced.journal.audiofile',
      parentID: journal.id,
      parentType: journal.documentName,
      documentType: journal.documentName,
      location: AssetReport.Locations.JournalMonksEnhancedAudioFile,
      asset: enhancedJournalData.audiofile,
    });
  }

  for (const actor of enhancedJournalData.actors || []) {
    if (actor?.img && !actor.img.startsWith('data:')) {
      await data.AddAsset({
        id: journal.id,
        key: 'monks.enhanced.journal.actor',
        parentID: journal.id,
        parentType: journal.documentName,
        documentType: journal.documentName,
        location: AssetReport.Locations.JournalMonksEnhancedActorImage,
        asset: actor.img,
      });
    }
  }

  for (const slide of enhancedJournalData.slides || []) {
    if (slide?.img && !slide.img.startsWith('data:')) {
      await data.AddAsset({
        id: journal.id,
        key: 'monks.enhanced.journal.slide',
        parentID: journal.id,
        parentType: journal.documentName,
        documentType: journal.documentName,
        location: AssetReport.Locations.JournalMonksEnhancedSlideImage,
        asset: slide.img,
      });
    }
    if (slide?.audiofile) {
      await data.AddAsset({
        id: journal.id,
        key: 'monks.enhanced.journal.slide.audiofile',
        parentID: journal.id,
        parentType: journal.documentName,
        documentType: journal.documentName,
        location: AssetReport.Locations.JournalMonksEnhancedSlideAudioFile,
        asset: slide.audiofile,
      });
    }
  }

  for (const item of enhancedJournalData.items || []) {
    if (item?.img && !item.img.startsWith('data:')) {
      await data.AddAsset({
        id: journal.id,
        key: 'monks.enhanced.journal.item',
        parentID: journal.id,
        parentType: journal.documentName,
        documentType: journal.documentName,
        location: AssetReport.Locations.JournalMonksEnhancedItemImage,
        asset: item.img,
      });
    }
  }

  for (const item of enhancedJournalData.rewards?.items || []) {
    if (item?.img && !item.img.startsWith('data:')) {
      await data.AddAsset({
        id: journal.id,
        key: 'monks.enhanced.journal.reward.item',
        parentID: journal.id,
        parentType: journal.documentName,
        documentType: journal.documentName,
        location: AssetReport.Locations.JournalMonksEnhancedRewardItemImage,
        asset: item.img,
      });
    }
  }

  return data;
}

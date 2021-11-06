import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';

/**
 * Extract assets from the given macro
 * @param {object} macro - The macro to extract assets from.
 * @return {AssetData}
 * @constructor
 */
export async function ExtractMacroAssets(macro) {
  const data = new AssetData({
    id: macro?.id || '',
    name: macro?.name || '',
    documentType: macro?.documentName || 'Unknown',
  });

  if (!macro) {
    return data;
  }

  if (macro.data.img) {
    await data.AddAsset({
      id: macro.id,
      key: 'img',
      parentID: macro.id,
      parentType: macro.documentName,
      documentType: macro.documentName,
      location: AssetReport.Locations.MacroImage,
      asset: macro.data.img,
    });
  }

  return data;
}

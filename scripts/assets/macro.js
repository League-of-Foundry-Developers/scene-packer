import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import {CONSTANTS} from '../constants.js';

/**
 * Extract assets from the given macro
 * @param {Macro|ClientDocumentMixin} macro - The macro to extract assets from.
 * @return {AssetData}
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

  const macroData = CONSTANTS.IsV10orNewer() ? macro : macro.data;
  if (macroData.img) {
    await data.AddAsset({
      id: macro.id,
      key: 'img',
      parentID: macro.id,
      parentType: macro.documentName,
      documentType: macro.documentName,
      location: AssetReport.Locations.MacroImage,
      asset: macroData.img,
    });
  }

  return data;
}

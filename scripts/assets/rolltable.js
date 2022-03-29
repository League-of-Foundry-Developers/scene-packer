import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given roll table
 * @param {RollTable|ClientDocumentMixin} table - The table to extract assets from.
 * @return {AssetData}
 */
export async function ExtractRollTableAssets(table) {
  const data = new AssetData({
    id: table?.id || '',
    name: table?.name || '',
    documentType: table?.documentName || 'Unknown',
  });

  if (!table) {
    return data;
  }

  const tableData = CONSTANTS.IsV10orNewer() ? table : table.data;
  if (tableData.img) {
    await data.AddAsset({
      id: table.id,
      key: 'img',
      parentID: table.id,
      parentType: table.documentName,
      documentType: table.documentName,
      location: AssetReport.Locations.RollTableImage,
      asset: tableData.img,
    });
  }

  const results = [];

  if (tableData.results?.size) {
    results.push(...Array.from(tableData.results.values()));
  }

  for (const tableResult of results) {
    const tableResultData = CONSTANTS.IsV10orNewer() ? tableResult : tableResult?.data;
    const img = tableResultData?.img || tableResult?.icon;
    if (img) {
      await data.AddAsset({
        id: tableResult.id,
        key: 'result.img',
        parentID: table.id,
        parentType: table.documentName,
        documentType: tableResult.documentName || 'TableResult',
        location: AssetReport.Locations.RollTableResultImage,
        asset: img,
      });
    }
  }

  return data;
}

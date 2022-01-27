import {RelatedData} from './related-data.js';
import {CONSTANTS} from '../../constants.js';

/**
 * ExtractRelatedRollTableData - extracts the entity UUIDs that are related to the given roll table.
 * @param {RollTable|ClientDocumentMixin} table - the roll table to extract the related data from.
 * @return {RelatedData}
 */
export function ExtractRelatedRollTableData(table) {
  const relatedData = new RelatedData();
  if (!table) {
    return relatedData;
  }

  const id = table.id || table._id;
  const uuid = table.uuid || `${RollTable.documentName}.${id}`;

  for (const result of table.data?.results) {
    let collection = result.data?.collection;
    const resultId = result.data?.resultId;

    if (!CONSTANTS.PACK_IMPORT_ORDER.includes(collection)) {
      // Make the uuid reference consistent with "standard" ones.
      collection = `Compendium.${collection}`;
    }

    if (collection && resultId) {
      relatedData.AddRelation(uuid, {path: 'results', uuid: `${collection}.${resultId}`, embeddedId: result.id});
    }
  }
}

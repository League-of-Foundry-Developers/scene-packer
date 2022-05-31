import {CONSTANTS} from '../constants.js';
import {ExtractRelatedActorData} from './related/actor.js';
import {ExtractRelatedItemData} from './related/item.js';
import {ExtractRelatedJournalData} from './related/journals.js';
import {ExtractRelatedRollTableData} from './related/rolltable.js';
import {ExtractRelatedSceneData} from './related/scene.js';
import {RelatedData} from './related/related-data.js';

/**
 * @typedef {object} AvailableDocuments
 * @property {object[]} actors - Available actor documents.
 * @property {object[]} journals - Available journal documents.
 * @property {object[]} scenes - Available scene documents.
 * @property {object[]} items - Available item documents.
 * @property {object[]} macros - Available macro documents.
 * @property {object[]} playlists - Available playlist documents.
 * @property {object[]} rollTables - Available roll table documents.
 * @property {object[]} cards - Available card documents.
 */

/**
 * Returns a list of update values with the converted Compendium references to their local references.
 * @param {ClientDocumentMixin} context
 * @param {ClientDocumentMixin[]} documents - The documents to replace compendium references within.
 * @param {AvailableDocuments} availableDocuments - The documents that are available to search for references within.
 * @param {string} logContext - The context to use for logging.
 * @return {object[]} The entities with their references replaced.
 */
export function ReplaceCompendiumReferences(context, documents, availableDocuments, logContext) {
  const updates = [];
  /**
   * Track the updated references, keyed by documentId.
   * @type {Map<string, object>}
   */
  const updateMap = new Map();

  for (const datum of documents) {
    const dataId = datum.id || datum._id;
    let relatedData = new RelatedData();
    switch (context) {
      case Actor:
        relatedData = ExtractRelatedActorData(datum);
        break;
      case JournalEntry:
        relatedData = ExtractRelatedJournalData(datum);
        break;
      case Scene:
        relatedData = ExtractRelatedSceneData(datum);
        break;
      case Item:
        relatedData = ExtractRelatedItemData(datum);
        break;
      case RollTable:
        relatedData = ExtractRelatedRollTableData(datum);
        break;
    }
    if (!relatedData.data.size) {
      continue;
    }

    for (const relations of relatedData.data.values()) {
      for (const relation of relations) {
        if (!relation.uuid.startsWith('Compendium.')) {
          // Only try to replace compendium references
          continue;
        }

        const ActorSources = {
          type: Actor,
          data: [
            game[Actor.collectionName],
            availableDocuments.actors,
          ],
        };
        const JournalSources = {
          type: JournalEntry,
          data: [
            game[JournalEntry.collectionName],
            availableDocuments.journals,
          ],
        };
        const SceneSources = {
          type: Scene,
          data: [
            game[Scene.collectionName],
            availableDocuments.scenes,
          ],
        };
        const ItemSources = {
          type: Item,
          data: [
            game[Item.collectionName],
            availableDocuments.items,
          ],
        };
        const MacroSources = {
          type: Macro,
          data: [
            game[Macro.collectionName],
            availableDocuments.macros,
          ],
        };
        const PlaylistSources = {
          type: Playlist,
          data: [
            game[Playlist.collectionName],
            availableDocuments.playlists,
          ],
        };
        const RollTableSources = {
          type: RollTable,
          data: [
            game[RollTable.collectionName],
            availableDocuments.rollTables,
          ],
        };
        const CardSources = (typeof Cards !== 'undefined') ? {
          type: Cards,
          data: [
            game[Cards.collectionName],
            availableDocuments.cards,
          ],
        } : undefined;

        let sources = [
          ActorSources,
          JournalSources,
          SceneSources,
          ItemSources,
          MacroSources,
          PlaylistSources,
          RollTableSources,
        ];
        if (CardSources) {
          sources.push(CardSources);
        }

        let relationParts = relation.uuid.split('.');
        relationParts.pop(); // Remove the id
        const type = relationParts.pop();
        switch (type) {
          case 'actors':
          case 'monsters':
            sources = [ActorSources];
            break;
          case 'journals':
          case 'journal':
          case 'handouts':
          case 'notes':
            sources = [JournalSources];
            break;
          case 'maps':
          case 'scenes':
            sources = [SceneSources];
            break;
          case 'items':
            sources = [ItemSources];
            break;
          case 'macros':
            sources = [MacroSources];
            break;
          case 'playlists':
            sources = [PlaylistSources];
            break;
          case 'rolltables':
          case 'tables':
            sources = [RollTableSources];
            break;
          case 'cards':
            if (CardSources) {
              sources = [CardSources];
            }
            break;
        }

        let foundEntity;
        for (const sourceType of sources) {
          for (const source of sourceType.data) {
            foundEntity = source.find(e => (getProperty(e, 'data.flags.core.sourceId') || getProperty(e, 'flags.core.sourceId')) === relation.uuid);
            if (foundEntity) {
              if (!foundEntity.uuid || !foundEntity.documentName || !foundEntity.id) {
                foundEntity.documentName = sourceType.type.documentName;
                foundEntity.id = foundEntity._id;
                foundEntity.uuid = `${foundEntity.documentName}.${foundEntity.id}`;
              }
              break;
            }
          }
          if (foundEntity) {
            break;
          }
        }
        if (!foundEntity) {
          continue;
        }

        let path = relation.path;
        if (path.startsWith('data.')) {
          path = path.substring(5);
        }
        let existingUpdate = updateMap.get(dataId) || {};
        let oldValue;
        if (existingUpdate[path]) {
          oldValue = existingUpdate[path];
        } else {
          oldValue = getProperty(datum, relation.path);
          if (relation.embeddedId && oldValue) {
            oldValue = oldValue.get(relation.embeddedId);
          }
        }
        if (!oldValue) {
          ScenePacker.logType(
            logContext,
            'error',
            true,
            game.i18n.format(
              'SCENE-PACKER.importer.no-existing-value',
              {
                path: relation.path,
              },
            ),
            datum,
          );
          continue;
        }

        if (typeof oldValue === 'object' && oldValue._id && (oldValue.documentCollection ?? oldValue.collection) && (oldValue.documentId ?? oldValue.resultId)) {
          // This is a roll table result.
          updates.push({
            _id: dataId,
            collection: foundEntity.documentName,
            resultId: foundEntity.id,
            embeddedId: oldValue._id,
          });
          continue;
        }

        if (typeof oldValue !== 'string') {
          // Only strings can be updated
          continue;
        }
        const [, moduleName, pack, id] = relation.uuid.split('.');
        const oldReference = `@Compendium[${moduleName}.${pack}.${id}]`;
        const newReference = `@${foundEntity.documentName}[${foundEntity.id}]`;

        let newValue = oldValue.replace(oldReference, newReference);
        let hyperlinksChanged = 0;
        const doc = CONSTANTS.DOM_PARSER.parseFromString(newValue, 'text/html');
        for (const link of doc.getElementsByTagName('a')) {
          if (!link.classList.contains('entity-link') || link.dataset.pack !== `${moduleName}.${pack}` || link.dataset.id !== id) {
            continue;
          }

          link.removeAttribute('data-pack');
          link.setAttribute('data-entity', foundEntity.documentName);
          link.setAttribute('data-id', foundEntity.id);
          hyperlinksChanged++;
        }

        if (hyperlinksChanged) {
          newValue = doc.body.innerHTML;
        }

        if (newValue === oldValue) {
          continue;
        }

        ScenePacker.logType(
          logContext,
          'info',
          true,
          game.i18n.format(
            'SCENE-PACKER.importer.converting-reference',
            {
              type: foundEntity.documentName,
              name: datum.name,
              oldRef: relation.uuid,
              newRef: foundEntity.uuid,
              path: path,
            },
          ),
        );

        if (relation.embeddedId) {
          updates.push({
            _id: dataId,
            [path]: newValue,
            embeddedId: relation.embeddedId,
            embeddedPath: relation.embeddedPath,
          });
        } else {
          existingUpdate[path] = newValue;
          updateMap.set(dataId, existingUpdate);
        }
      }
    }
  }

  for (const [id, update] of updateMap) {
    updates.push({_id: id, ...update});
  }

  return updates;
}

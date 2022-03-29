import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given playlist
 * @param {Playlist|ClientDocumentMixin} playlist - The playlist to extract assets from.
 * @return {AssetData}
 */
export async function ExtractPlaylistAssets(playlist) {
  const data = new AssetData({
    id: playlist?.id || '',
    name: playlist?.name || '',
    documentType: playlist?.documentName || 'Unknown',
  });

  if (!playlist) {
    return data;
  }

  const sounds = [];

  const playlistData = CONSTANTS.IsV10orNewer() ? playlist : playlist.data;
  if (playlistData.sounds?.size) {
    sounds.push(...Array.from(playlistData.sounds.values()));
  }

  for (const sound of sounds) {
    const soundData = CONSTANTS.IsV10orNewer() ? sound : sound?.data;
    const path = soundData?.path || sound?.path;
    if (path) {
      await data.AddAsset({
        id: sound.id,
        key: 'path',
        parentID: playlist.id,
        parentType: playlist.documentName,
        documentType: sound.documentName || 'PlaylistSound',
        location: AssetReport.Locations.PlaylistPath,
        asset: path,
      });
    }
  }

  return data;
}

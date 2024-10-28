import { AssetData } from './data.js';
import AssetReport from '../asset-report.js';
import { CONSTANTS } from '../constants.js';

/**
 * Extract assets from the given playlist
 * @param {Playlist|ClientDocumentMixin} playlist - The playlist to extract assets from.
 * @param {Set<string>} selectedSounds - The sounds in the playlist.
 * @return {AssetData}
 */
export async function ExtractPlaylistAssets(playlist, selectedSounds) {
  const data = new AssetData({
    id: playlist?.id || '',
    name: playlist?.name || '',
    documentType: playlist?.documentName || 'Unknown',
  });

  if (!playlist) {
    return data;
  }

  let sounds = [];

  const playlistData = CONSTANTS.IsV10orNewer() ? playlist : playlist.data;
  if (playlistData.sounds?.size) {
    sounds.push(...Array.from(playlistData.sounds.values()));
  }

  if (selectedSounds.size) {
    // Remove sounds that are not selected
    sounds = sounds.filter(sound => selectedSounds.has(sound.id));
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

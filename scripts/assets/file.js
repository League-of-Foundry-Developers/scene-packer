import {CONSTANTS, IsUsingTheForge} from '../constants.js';

/**
 * List of directories belonging to Core data. See FilePicker._inferCurrentDirectory
 * @type {string[]}
 */
export const PublicDirs = [
  'cards',
  'css',
  'fonts',
  'icons',
  'lang',
  'scripts',
  'sounds',
  'ui',
];

/**
 * Returns whether the requested target path is part of the public Foundry VTT file system.
 * @param {string} target - The currently requested target path
 * @return {boolean}
 */
export function IsPublic(target) {
  if (IsUsingTheForge()) {
    if (target.startsWith(`${ForgeVTT.ASSETS_LIBRARY_URL_PREFIX}bazaar/core/`)) {
      return true;
    }
  }
  return PublicDirs.some((d) => target.startsWith(d));
}

/**
 * Returns whether the requested target path is part of a system within Foundry VTT.
 * @param {string} target - The currently requested target path
 * @return {boolean}
 */
export function IsSystem(target) {
  if (IsUsingTheForge()) {
    if (target.startsWith(`${ForgeVTT.ASSETS_LIBRARY_URL_PREFIX}bazaar/systems/`)) {
      return true;
    }
  }
  return target.startsWith('systems/');
}

/**
 * Get the source location for use within FilePicker
 * @param {string} target - The currently requested target path
 * @return {string}
 */
export function GetFilePickerSource(target) {
  if (
    IsUsingTheForge() &&
    target.startsWith(ForgeVTT.ASSETS_LIBRARY_URL_PREFIX)
  ) {
    return 'forgevtt';
  }

  if (IsPublic(target)) {
    return 'public';
  }

  try {
    if (FilePicker.matchS3URL(target)) {
      return 's3';
    }
  } catch (e) {
    // NOOP
  }

  return 'data';
}

/**
 * Get file picker options for the requested target path
 * @param {string} target - The currently requested target path
 * @return {Object}
 */
export function GetFilePickerOptions(target) {
  let options = {};
  let bucket;
  try {
    // Check for s3 matches
    bucket = game.settings.get('moulinette-core', 's3Bucket');

    if (!bucket) {
      const s3Match = FilePicker.matchS3URL(target);
      if (s3Match) {
        bucket = s3Match.groups.bucket;
      }
    }
  } catch (e) {
    // NOOP
  }
  if (bucket) {
    options.bucket = bucket;
  }

  return options;
}

/**
 * Expand a wildcard path, returning all matching files.
 * @param {string} path - The path containing a wildcard that should be expanded.
 * @return {Promise<string[]>}
 */
export async function ExpandWildcard(path) {
  // Cannot expand absolute URLs
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return [path];
  }

  try {
    const base = await FilePicker.browse(
      GetFilePickerSource(path),
      path,
      Object.assign(GetFilePickerOptions(path), {
        wildcard: true,
      })
    );
    return base.files;
  } catch (e) {
    ScenePacker.logType(CONSTANTS.MODULE_NAME, 'error', true, `Could not load ${path}`, e);
    // Something is better than nothing
    return [path];
  }
}

/**
 * Check if a file exists.
 * @param {string} path - The path to check if it exists
 * @returns Promise<boolean>
 */
export async function FileExists(path) {
  try {
    const parentFolder = await FilePicker.browse(
      GetFilePickerSource(path),
      path,
      Object.assign(GetFilePickerOptions(path), {
        wildcard: true,
      })
    );
    return parentFolder.files.includes(path);
  } catch (e) {
    ScenePacker.logType(CONSTANTS.MODULE_NAME, 'error', true, `Could not load ${path}`, e);
    return false;
  }
}

/**
 * Get the base URL for the current game
 * @returns {Promise<string|string>}
 */
export async function GetBaseURL() {
  try {
    const bucket = game.settings.get('moulinette-core', 's3Bucket');

    if(bucket && bucket.length > 0 && bucket !== "null") {
      const e = game.data.files.s3.endpoint;
      return `${e.protocol}//${bucket}.${e.host}/`
    }
  } catch (e) {
    // NOOP
  }

  if (IsUsingTheForge()) {
    const theForgeAssetsLibraryUserPath = ForgeVTT.ASSETS_LIBRARY_URL_PREFIX + (await ForgeAPI.getUserId() || "user");
    return theForgeAssetsLibraryUserPath ? theForgeAssetsLibraryUserPath + "/" : "";
  }

  return "";
}

/**
 * Creates folders recursively
 * @param {string} path - The path to create
 */
export async function CreateFolderRecursive(path) {
  const source = GetFilePickerSource(path);
  const options = GetFilePickerOptions(path);
  const folders = path.split('/');
  let curFolder = '';
  for (const f of folders) {
    const parentFolder = await FilePicker.browse(source, curFolder, options);
    curFolder += (curFolder.length > 0 ? '/' : '') + f;
    const dirs = parentFolder.dirs.map((d) => decodeURIComponent(d));
    if (!dirs.includes(decodeURIComponent(curFolder))) {
      try {
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `Creating folder ${curFolder}`);
        await FilePicker.createDirectory(source, curFolder, options);
      } catch (e) {
        ScenePacker.logType(CONSTANTS.MODULE_NAME, 'error', true, `Unable to create ${curFolder}`, e);
      }
    }
  }
}

/**
 * Upload a File to the server, creating the folder structure if required. Overwrites an existing file by default.
 * @param {File} file - The File object to upload
 * @param {string} folderPath - The destination path
 * @param {object} [options={}]  Additional file upload options passed as form data
 * @returns Promise<Object> - The response object
 */
export async function UploadFile(file, folderPath, options = {}) {
  if (typeof options.overwrite === 'undefined') {
    options.overwrite = true;
  }

  const source = GetFilePickerSource(folderPath);
  options = Object.assign(GetFilePickerOptions(folderPath), options);
  await CreateFolderRecursive(folderPath);

  if (!options.overwrite && (await FileExists(`${folderPath}/${file.name}`))) {
    const baseURL = await GetBaseURL();
    ScenePacker.logType(CONSTANTS.MODULE_NAME, 'info', true, `File ${folderPath} already exists, skipping.`);
    return {
      path: `${baseURL}${folderPath}/${file.name}`,
    };
  }

  try {
    if (IsUsingTheForge()) {
      return await ForgeVTT_FilePicker.upload(source, folderPath, file, {}, options);
    } else {
      return await FilePicker.upload(source, folderPath, file, {}, options);
    }
  } catch (e) {
    ScenePacker.logType(CONSTANTS.MODULE_NAME, 'error', true, `Unable to upload ${folderPath}`, e);
  }
}

/**
 * Format bytes as human-readable text.
 * @see https://stackoverflow.com/a/14919494/191306
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 * @return {string} Formatted string.
 */
export function HumanFileSize(bytes, si = true, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + ' ' + units[u];
}

Handlebars.registerHelper('HumanFileSize', function (options) {
  return HumanFileSize(options.hash.bytes, options.hash.si, options.hash.dp);
});

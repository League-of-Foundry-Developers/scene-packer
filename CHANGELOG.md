# Changelog

## v2.1.1

- Added support for Playlist compendium packs.
  - This supports re-linking playlists to scenes.

## v2.1.0

- Added support for Foundry VTT v0.8.2
  - Version 0.7.9 support will eventually be dropped. 
- Improved fallback functionality for [Automatic Journal Icon Numbers](https://foundryvtt.com/packages/journal-icon-numbers). More improvements in this space to come in future versions.

## v2.0.5

- Fixed Token <--> Actor linking when SourceId references exist. Thanks Falerion for providing the data to replicate.

## v2.0.4

- Fixed error shown when a non-GM user connects.
  - Error: User lacks permission to update the World setting

## v2.0.3

- Fixed the compendium packs being missing. Thanks Noshei :)
- Tokens no longer require names to be packed.
- Removed step specifying to re-export compendiums as it is no longer required.

## v2.0.2

- Load compendium pack data prior to trying to use it to reduce the chance of possible race conditions.
- Journal Pins that are entirely unlinked will no longer throw an error, they'll just be packed up and included as unlinked pins.

## v2.0.1

- Fixed bug where importing from compendiums would sometimes break.

## v2.0.0

- Major rewrite of how the module is accessed.
  - Scene Packer now supports more than one ScenePacker enabled module in a world. Previously they would conflict with each other and cause issues.
- DEPRECATED: Calls to `window['scene-packer']` have been deprecated in favour of a global `ScenePacker` object.
  - View the Readme for the new way to initialise Scene Packer.
    - `ScenePacker.Initialise({...});`
    - `ScenePacker.RelinkJournalEntries('module-name', {dryRun: true});`
    - `ScenePacker.PromptRelinkJournalEntries();`
    - `ScenePacker.HasPackedData(scene, moduleName);`
    - `ScenePacker['module-name'];`
    - etc.
- Made the `Enable Scene Packer context menu` setting appear under `Library: Scene Packer` rather than the module utilising Scene Packer.
- Packing a Scene will now store the initial view position of the Scene. Unpacking a Scene will use this value rather than defaulting to 0, 0 and a zoom of 1.
- The Welcome Journal will now only show once per module version, rather than once per imported Scene. Upgrading the version of your module will redisplay the Welcome Journal (allowing you to show Changelogs etc.).
- Added [libWrapper](https://foundryvtt.com/packages/lib-wrapper/) to set the `sourceId` value of entities imported from compendiums in versions of FoundryVTT prior to 0.8.0 (which does it by default).
  - This allows appropriate tracking and linking of entities imported.
- Unpacking a Scene will show its associated Journal entry to an authorised person. Generally this is just the GM unless your Journal has different permissions.
  - Journal sheets will not automatically appear if you use the "Import All" option on the dialog you receive when first enabling a "packed" module.
- Packing and Unpacking a Scene will prioritise matching based on `sourceId`'s for exact matches, rather than by name (it will still fall back to name based matching).
- Before unpacking a Scene, a check will be made to ensure the Scene was packed with a compatible version of Scene Packer.
- Added a performance report dialog option. Trigger it with `ScenePacker.ShowPerformanceReport();` or via the Macro in the compendium.
  - This can be useful when building your Scenes to get an idea of how "heavy" they are.
- Removed warning about remembering to Unpack after Packing. It's no longer needed. Unpacking a Scene over the top of itself won't cause any problems.

## v1.0.5

- Added "How to use" style journals to the Scene Packer compendium.
- Added options on how to initialise Scene Packer. See readme or compendium Journal for examples.
- Added "dry run" mode to `await window['scene-packer'].relinkJournalEntries('module-name', {dryRun: true});` allowing
  you to see the changes that will be made to compendium journals without actually making the changes.
- Added `await window['scene-packer'].promptRelinkJournalEntries();` as a way to prompt the module name and dry-run
  mode. Also added a macro version bundled in the compendium.
- Added better handling of cases where data wasn't in a valid state for packing.
- Added initial support for specifying Macro packs. Works similar to setting creature or journal
  packs. `packer.SetMacroPacks();`
- Removed `packer.DisableImportPrompts();` as it wouldn't fire at the appropriate time. See new methods for initialising
  Scene Packer for replacement option.
- Switched config option default so that Scene context menus (right clicking) no longer shows Scene Packer options by
  default (because most people are users, not developers).
- Added Macro compendium to assist with usage.
- Fixed minor typos and grammatical errors.

## v1.0.4

- Added welcome prompt to import and unpack all scenes in the adventure.
- Importing the adventure multiple times will no longer import the welcome journal multiple times.
- Removed compendium prompts. `packer.DisableImportPrompts();` will now disable the welcome prompt.

## v1.0.3

- Added `packer.DisableImportPrompts();` as a way to prevent the popups from appearing when opening your module's
  compendiums.
- Added `Unpack Scene Data` option to Scene context menu.
- Changed Scene context menu options to only show based on whether the Scene has Packed Data already.
- Default to showing the context menu on scenes for GMs.
- Changed the flag used to store whether the adventure module has been imported from a `boolean` to a `version` string
  to allow future support of "upgrades" to the module.
- Exposed `HasPackedData(scene, moduleName, tokenFlag, journalFlag)` static method to allow checking whether a given
  Scene has data packed for the given module.

## v1.0.2

- Fixed bug that would occur if Journal entries weren't in a folder of the same name as the adventure.
- Delay calling `scenePackerReady` hook until after the canvas is ready.
- Added `await window['scene-packer'].relinkJournalEntries('module-name');` static method
  - Automatically goes through the Journals in the module's compendium packs and updates the references from the World
    version to the Compendium versions.

## v1.0.1

- Added localization.
- Removed `SetCompendiumSceneName()` as it is no longer needed.

## v1.0.0

- Initial release.

# Changelog

## v1.0.6

- Made the `Enable Scene Packer context menu` setting appear under `Library: Scene Packer` rather than the module utilising Scene Packer.
- The Welcome Journal will now only show once per module version, rather than once per imported Scene.
- Added a performance report dialog. Trigger it with `window['scene-packer'].showPerformanceReport();` or via the Macro in the compendium.

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

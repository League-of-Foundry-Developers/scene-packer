# Changelog

## v1.0.4

- Added welcome prompt to import and unpack all scenes in the adventure.
- Importing the adventure multiple times will no longer import the welcome journal multiple times.
- Removed compendium prompts. `packer.DisableImportPrompts();` will now disable the welcome prompt.

## v1.0.3

- Added `packer.DisableImportPrompts();` as a way to prevent the popups from appearing when opening your module's compendiums.
- Added `Unpack Scene Data` option to Scene context menu.
- Changed Scene context menu options to only show based on whether the Scene has Packed Data already.
- Default to showing the context menu on scenes for GMs.
- Changed the flag used to store whether the adventure module has been imported from a `boolean` to a `version` string to allow future support of "upgrades" to the module.
- Exposed `HasPackedData(scene, moduleName, tokenFlag, journalFlag)` static method to allow checking whether a given Scene has data packed for the given module.

## v1.0.2

- Fixed bug that would occur if Journal entries weren't in a folder of the same name as the adventure.
- Delay calling `scenePackerReady` hook until after the canvas is ready.
- Added `await window['scene-packer'].relinkJournalEntries('module-name');` static method
    - Automatically goes through the Journals in the module's compendium packs and updates the references from the World version to the Compendium versions.

## v1.0.1

- Added localization.
- Removed `SetCompendiumSceneName()` as it is no longer needed.

## v1.0.0

- Initial release.

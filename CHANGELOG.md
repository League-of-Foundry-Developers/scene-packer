# Changelog

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

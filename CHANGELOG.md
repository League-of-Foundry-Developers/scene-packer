# Changelog

## v2.2.16

- Updated the thumbnail generation for core Foundry VTT v0.7.x when exporting to a compendium.
  - Regenerate thumbnail image if there isn't already a valid compendium compatible image.
  - This patches v0.7.x to be more in line with how v0.8.x works.

## v2.2.15

- Enhanced the `Asset Report`.
  - Now limits asset validation to 10 concurrent requests to prevent server overloading/timing out requests.
  - The report is now collapsed by default and will show a summary. Click on the heading to expand the section.
  - Copying the report as JSON will now only copy the assets that have dependencies.

## v2.2.14

- Scene thumbnails are now generated for tile only Scenes when exporting to a Compendium
  - Core v0.7.x normally requires a Scene Background to generate a thumbnail.
- Added additional spacing to the Instance Prompt dialog.
- Downgraded several Errors to Warnings.

## v2.2.13

- Compatibility with Core v0.8.6
- Fixed further data incompatibilities between Core v0.7.x and Core v0.8.x

## v2.2.12

- Updated `Asset Report`
  - Handle inconsistencies in data formats between core v0.7.x and v0.8.x
  - Support Playlists created by Bellows.

## v2.2.11

- Added `Asset Report`.
  - Displays a report showing which assets in your world would not render correctly if they were loaded by someone else via your module.
  - For example, did you miss updating a reference to an asset that exists in your `/worlds` folder?
- Added new bundled Macros.
  - *Show Asset Report*
    - [View an example video](https://www.youtube.com/watch?v=eBLbUCNfsmk) running against the [Example Scene Packer](https://github.com/sneat/example-scene-packer) module.
  - *Show Scenes Worth Packing*
    - Displays a dialog that lists which Scenes contain data that would benefit from being packed by Scene Packer (e.g. which Scenes have Actors or Journal Pins on them).
- Fixed incorrectly showing Pack Scene Data context menu option.
  - `Pack Scene Data` context menu wasn't respecting the setting flag correctly. This menu item is once again off by default.

## v2.2.10

- Compatibility with Core v0.7.10

## v2.2.9

- Updated example module register code to explicitly wrap in a self-invoking anonymous function `(() => { ... })()`.
  - This prevents clashes with JS constants if more than one Scene Packed module is enabled.
  - **Please update your registration/initialisation code.**

## v2.2.8

- Fixed bug with exporting entities to Compendiums.
  - Thanks Charlie for the report.
- Added compatibility with Foundry VTT v0.8.5

## v2.2.7

- Added additional gates to ensure we only process data if there's valid data to process.

## v2.2.6

- Actually fix the logic condition for v2.2.4 for real this time.

## v2.2.5

- Fix the logic condition for v2.2.4

## v2.2.4

- Fixed error when Quick Encounters module was not installed on the server, rather than just not enabled.

## v2.2.3

- Added compatibility with Foundry VTT v0.8.4
- Fixed welcome and introduction journals being imported multiple times (once for each scene).

## v2.2.2

- Entity Default Permissions
  - Entities exported to compendiums with a default permission of something other than "None" will now import back again with that default permission.
  - This only applies to compendiums that are owned by a module registered with Scene Packer.

## v2.2.1

- Added compatibility with Foundry VTT v0.8.3
- Made Scene Performance Report macro more robust when there isn't a scene active - thanks [arcanistzed](https://github.com/League-of-Foundry-Developers/scene-packer/issues/17) for the report.

## v2.2.0

- Added support for packing Scenes that have embedded [Quick Encounters](https://foundryvtt.com/packages/quick-encounters).
- Added support for automatically importing Macros to the world via the `additionalMacros` variable. See [readme](https://github.com/League-of-Foundry-Developers/scene-packer#module-code-requirements) or embedded journal entries for details.
- Vastly changed the way that entities are referenced to rarely rely on name based matching.
  - *Please re-pack your adventures to ensure that `sourceId` values are set.*
    1. Re-export everything to your compendiums.
    1. Re-pack your Scenes.
    1. Re-export your Scenes to your compendiums.
  - This change is backwards compatible for now.
- After unpacking a Scene you will return to the Scenes tab in the sidebar.
  - It was somewhat frustrating ending up on the Actors, Journals or Playlists tab - whatever was the last thing to be imported.
- Improved Journal entries distributed with Scene Packer to provide more guidance and support.
- Added link to module showcasing features:
  - https://github.com/sneat/example-scene-packer

## v2.1.2

- Added new bundled Macros to:
  - *Reset world Scene Packer prompts*
    - Handy if you are wanting to test that "first load" experience.
  - *Verify module compendium data*
    - Useful to ensure that your compendiums have the required Scene Packer data embedded.
    - This Macro will get further functionality in future versions.
- Fixed bug which prevented updating links to Playlists within Journal entries.
- Fixed bug which prevented Scene Journals from relinking properly.

## v2.1.1

- Added support for Playlist compendium packs.
  - Playlists linked on a Packed Scene will automatically import if they don't already exist.

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

# Changelog

## v2.4.0

- Updated wording to make it clearer when there are no modules correctly registered with Scene Packer.
  - Useful for new creators. This usually happens when you haven't quite initialised your module correctly.
  - A reminder that the [module generator](https://sneat.github.io/scene-packer-module-generator/) is a good starting point for generating modules that are compatible with Scene Packer.

## v2.3.24

- Specifically mark Scene Packer as compatible with Foundry Core V9.
  - Scene Packer remains backwards compatible to v0.7.9
  - Deprecation warnings will be removed in v2.4.0
- Added support for [Journal Anchor Links](https://foundryvtt.com/packages/jal).
  - Big thank you to Mgiepz for the community submission.
- Relinking entities will now ask you if you want to lock the compendiums, rather than doing it by default.
- Updated macro `Bulk Lock/Unlock compendiums` to support World compendiums.

## v2.3.23

- Adjust folder creation to work around changes in [Compendium Folders](https://foundryvtt.com/packages/compendium-folders) internal API.

## v2.3.22

- Fixed an edge case where relinking entities wouldn't match correctly if they originated from a DDB Import.
- Added macro `Bulk Unpack Scenes`
  - This macro will unpack any scene in your world that has not yet been unpacked. Useful if you have imported a bunch of Scenes all at once, but didn't use the "Import All" option.
- Reduce the number of notifications that show when unpacking a lot of scenes at once.

## v2.3.21

- Updated unpacking of [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles) to handle multiple references within a single action.
- Added alternate matching method when unpacking scenes.
- "Import all" will no longer show individual UI notifications. This will greatly cut down on the number of notifications that are shown.

## v2.3.20

- Allow journal unpacking to find by compendium reference as well.
  - This improves the likelihood of unpacking correctly, even if the IDs changed over time.
- Fixed a bug where tokens wouldn't correctly link to system compendiums, depending on how the module was initialised.
- Updated the `Show Scenes Worth Packing` macro display why a Scene should be packed and also added basic "verification" support to compare the compendium packs against the local scene data.
  - The verify step does not compare the packed data, it only checks for the presence of packed data.

## v2.3.19

- Added missing support for RollTable packing and unpacking within [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles).

## v2.3.18

- Added support for packing and unpacking remaining embedded references within [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles).
  - Triggers should all now correctly unpack and update their references appropriately.

## v2.3.17

- Updated the `Relink compendium entries` macro to support relinking RollTable entries.

## v2.3.16

- Fixed issue when packing a scene if `Monk's Active Tile Triggers` isn't installed on the instance.
- Added macro `Bulk Lock/Unlock compendiums`.
  - This macro allows you to bulk lock or unlock compendiums belonging to the selected module.

## v2.3.15

- Corrected the use of `additionalModulePacks` to be used across all of Scene Packer, rather than just within `Relink compendium entries`.

## v2.3.14

- Added support for packing and unpacking Macros embedded within [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles).
  - Thanks to "Name Here" for the feature suggestion.

## v2.3.13

- Changed the way that the initial import dialog shows for module upgrades.
  - Upgrading an existing Scene Packer packed module will now prompt the end-user to decide how they want the update to be imported.
  - Includes a big scary warning message to do backups first.
- Adds backwards compatible support for upcoming core version 9 prototype 2 release.

## v2.3.12

- Updated the `Relink compendium entries` macro to handle the case where *only* hyperlink style links exist within a journal. 
  - Previously the updates would only occur if at least one Foundry VTT style link existed.

## v2.3.11

- Updated the `Relink compendium entries` macro to now also search within Item descriptions for references to other entries.
  - If your game system uses a non-standard item description field, then the macro will not work/throw errors. Please report any issues you experience.

## v2.3.10

- Scene Packer will no longer change valid note icons.
  - Fixes issue [#60](https://github.com/League-of-Foundry-Developers/scene-packer/issues/60) reported by toastygm

## v2.3.9

- Added ability to relink entries across modules.
  - By setting the `additionalModulePacks` value in your initialisation script, you can specify additional modules to be considered as sources for the `Relink compendium journal entries` macro.
  - You might want to do this as a way to quickly relink Items to a system compendium (such as those in the `dnd5e` system), or to another module that you have listed as a dependency.
  - Feature suggested by `WarVisionary`.
- Added macro `Bulk replace asset references`.
  - This tool will search for asset references **within your world** that start with the provided value and replace that portion with the other provided value.
  - Includes a dry-run mode to see what it *would* do, without actually making changes.

## v2.3.8

- Fixed bug where `Import All` would import entities multiple times when multiple packs of the same type existed in a module.
- Fixed bug where Journals and Actors might be imported multiple times if an entry can't be found in the compendiums. Thanks `OwlbearAviary` and `WarVisionary` for the data to be able to replicate the issue.

## v2.3.7

- Manually clearing a Scene's packed data will now also reset which module it is packed against.
- Added bundled macro `Detach Scene from Scene Packer instance` to allow you to reset which module a Scene is packed against.
- Added references to https://sneat.github.io/scene-packer-module-generator/ as a way to jump start creating a new module.
  - Useful for those who:
    - want to create a Scene Packer integrated module
    - want to create a standard module
    - want to create a Shared Compendium module

## v2.3.6

- Ensure that entries that are packed with [Compendium Folders](https://foundryvtt.com/packages/compendium-folders) data are imported in the appropriate order to ensure that folder colours are built progressively.

## v2.3.5

- If the [Compendium Folders](https://foundryvtt.com/packages/compendium-folders) module is enabled, make use of its internal functionality to create the folder structures if they exist.
  - Will continue to do an approximation if `Compendium Folders` is not enabled.
- Utilise the folder colour set via [Compendium Folders](https://foundryvtt.com/packages/compendium-folders).
  - Note that if `Compendium Folders` is not enabled, the folder colours may not be quite as intended.

## v2.3.4

- Add error message when a scene with Journal Pins or Actor Tokens tries to be packed, but there aren't valid `journalPacks`/`creaturePacks` values defined for the module.
  - The console will try to suggest valid options for your module.

## v2.3.3

- Re-enable displaying the Welcome Journal when the "Import All" button is used.
- Added `Bulk pack scenes` macro
  - This macro will pack/repack all scenes in the requested scene folder.
  - Handy if you have several scenes in a folder that you are wanting to pack prior to exporting them.

## v2.3.2

- Fixed linking of Journal entries that contain spaces (was broken in v2.3.1).
  - Thanks toastygm

## v2.3.1

- Enhanced `Relink compendium journal entries` macro to support hyperlink style references such as:
  - `<a class="entity-link" data-entity="Actor" data-id="NzBhNmIwNTcxN2Y0">Commoner</a>`
  - `<a class="entity-link" data-entity="JournalEntry" data-id="NTkwZjliZmMwNGQ2">The Approach</a>`

## v2.3.0

- Added support for taking into account the folder structure that the [Compendium Folders](https://foundryvtt.com/packages/compendium-folders) module provides.
  - When automatically importing entities from compendiums (such as Actors and Journals), Scene Packer will check for the entity for embedded Compendium Folder data.
    - If present, Scene Packer will create folders with the same names and depth that the content creator intended.
    - As a content creator, simply export to your compendiums using the Compendium Folder `Export Folder Structure` functionality.
  - See the embedded Journal Entry for additional information.
  - *The end user does not need to install the Compendium Folder module.*
- Added an "Import all entities" option to the initial import dialog.
  - Selecting this option will import everything from all of the compendiums that belong to the registered module.
  - This option combined with the above `Compendium Folders` support allows end-users to have the same entities and folder structure as the content creator.
- Patched 0.7.x `"Sight angle must be between 1 and 360 degrees."` error message when importing from some compendium packs.
- Added automatic hash functionality when importing from compendiums, allowing for future update functionality.
  - This will allow content creators to update Journal Entries etc. in the future.
  - Utilises:
    - [fast-json-stable-stringify](https://github.com/epoberezkin/fast-json-stable-stringify) (MIT License)
    - [jsHashes](https://github.com/h2non/jshashes) (BSD-3-Clause License)
- Compatibility with Core v0.8.8

## v2.2.25

- As part of testing the upcoming [compendium index changes](https://gitlab.com/foundrynet/foundryvtt/-/issues/5453) in Core v0.8.8 it became clear that there were calls to `.getIndex()` that were not needed. These have been removed.
  - End users may experience a minor performance improvement.
- Disabled the in-your-face `libWrapper` warning and replaced it with a warning notification.

## v2.2.24

- Compatibility with Core v0.8.7
- Improved the actor and journal matching that occurs when packing a Scene.
  - This should help with cases where you have imported an Actor from a compendium, modified the Actor and then exported it to your compendium.
- Tokens not representing an Actor will be excluded from being packed.
  - This means that if you select "None" in the "Represented Actor" drop down, you can exclude certain Actors from being imported as part of the Scene unpacking process.
- Better error handling when unpacking and importing entities.
- Ensure Scene Packer flags are correctly saving when exporting to compendiums.

## v2.2.23

- Enhanced the `Asset Report`
  - Ambient sounds in a scene are now validated as well.

## v2.2.22

- Fixed `Relink compendium journal entries` macro on core v0.8.6

## v2.2.21

- Fixed packing Journal Pins in Core v0.8.3+
  - Document validation added in v0.8.3 broke the additional data that gets added to the scene notes. Now fixed again. Thanks Bradfordly :)

## v2.2.20

- Added ability to run the `Asset Report` against a module that contains compendium packs.
  - See [walkthrough video](https://www.youtube.com/watch?v=GgEQgl4fAjw) for a full rundown.

## v2.2.19

- Added ability to run the `Asset Report` against a single Scene.
  - Right click on a Scene in the sidebar to access `Run Asset Report`. Be sure to have enabled the `Show Context Menu` option for Scene Packer in settings.
- Re-added support for [Bug Reporter](https://foundryvtt.com/packages/bug-reporter) module in Core v0.8.3+.

## v2.2.18

- Fixed `Relink compendium journal entries` macro in v0.8.x
  - It now correctly locks and unlocks the compendium entries. Thanks Manfred.

## v2.2.17

- Enhanced the `Asset Report`.
  - Fixed asset concurrency sometimes generating incorrect reports.

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

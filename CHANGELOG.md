# Changelog

## v2.7.4

- Updated the "Relink compendium Entries" macro:
  - Added support for `Advancement` style Items.  
- Reduced the number of UI notifications that occur when Relinking Compendium Entities.
  - Full details remain in the console (F12).

## v2.7.3

- Maintain the sort order when importing all documents from the welcome dialog.
  - Right-clicking on a compendium and choosing "Import All" will still use the default Foundry VTT functionality, which removes the sort order. 

## v2.7.2

- Fixed Moulinette exporter not working on v11.
- Fixed folders managed by core not importing correctly.
  - A parent folder will be created automatically if there is more than document in the root of the compendium. Or to put it a different way, importing from a compendium will always import into a single parent directory.
- Updated French translation. Co-authored-by: 
  - rectulo
  - Marc Feuillen

## v2.7.1

- Fix issue where the Moulinette module was incorrectly required for handling a direct Zip upload.
- Added check to see whether the Zip file is too large to process by the browser.
  - This value is approximately 2GB on Chrome and approximately 4GB on Firefox. 

## v2.7.0

- Added support for importing Moulinette Zip files from the Settings window.
  - This is for any creators who choose to make the Zip files directly available.
- Fixed folder structure not being created correctly when importing from Moulinette.
- Removed a couple of v7 code references that are no longer needed.

## v2.6.16

- Mark Scene Packer as compatible with v11 of Foundry.
- Fixed Moulinette importer failing when importing a Single Scene from a pack.
- Maintain "Sort" value of documents being exported to a compendium via the Compendium Folders module.

## v2.6.15

- Automated migration of D&D 5e documents will now apply if the module only specifies the system for individual packs, rather than the overall module.

## v2.6.14

- "Asset Report" will now check assets embedded within Adventures.
- Adventures imported via Moulinette will attempt to migrate the data prior to creating the entries in the world.
  - In a lot of cases, this will allow packs created in old versions of Foundry VTT to still be imported in newer versions, rather than just throwing errors.
- Updated the "Relink compendium Entries" macro:
  - Include UUID style references for all document types where available.
- Documents linked within RollTables now have an additional fallback method for linking.
- Automated migration of D&D 5e documents will now only occur on a D&D 5e world.
  - Previously it would attempt to apply if any of the loaded packs were configured for D&D 5e.
- Allow unpacking to continue if the system doesn't match.
  - An example of this is loading a D&D 5e module into a PF2e world. Actors and Items won't load, but scenes and journals will still work.

## v2.6.13

- Updated "Asset Report" macro functionality:
  - Better handles checking of assets within v10 Journal Pages.
  - Entities with asset dependencies are once again clickable in the report.

## v2.6.12

- Added French translation. Co-authored-by: 
  - rectulo
  - Marc Feuillen

## v2.6.11

- Updated the "Relink compedium Entries" macro to better handle v10.
  - Now handles Actor.Item and associated "embedded" documents within entities.
- Updated packing/unpacking of Monk's Active Tile's data to handle the new way it stores cross-scene teleport information.

## v2.6.10

- Updated the "Relink compendium Entries" macro to better handle v10.
  - Better handling of Journal Pages.
  - Handle `UUID` style references.

## v2.6.9

- Fixed up several issues with the "Moulinette Exporter" in V10 while maintaining compatibility with V9.
- Changed default asset timeout to unlimited (was 120 seconds).
- Fixed journal icons when unpacking a V9 packed world in V10.
  - Previously they would revert to the default book due to the image path changes.

## v2.6.7

- Fixed the "Adventure Converter" to correctly handle compendium pack paths presented by Foundry Core during the suggested `module.json` file changes.
- Updated the "Bulk Pack Scenes" macro to correctly handle differences in folder data structure for nested folders in V10.
- Improved the folder creation process when utilising structures exported by the Compendium Folders module.
- Improved the handling of scene note icons in v10.

## v2.6.6

- Migrate items as well for D&D5e system updates.
- Allow the "Reset world Scene Packer prompts" macro to also reset the D&D5e migration process.

## v2.6.5

- Migrate actor and token images where needed for D&D5e system updates.
- Reduce v10 warnings 
- Updated "Relink compendium entries" macro  to better handle matching by name within rolltable entries.
- Updated libwrapper shim to 1.12.2.

## v2.6.4

- Updated the "Relink compendium Entries" macro to better handle Quick Encounter data matching.
  - It will now fall back to name based matching if it fails to match by ID. If it doesn't find a direct match still, it will put a warning into the console (F12).

## v2.6.3

- RollTables imported via the "Import All" method will now change their compendium references to local world documents where possible.
  - This resolves an issue that was occurring when a RollTable was referencing a Quick Encounter Journal Entry.

## v2.6.2

- Fixed issue relating to extracting related documents from Journals in v9 and below.

## v2.6.1

- Fixed "Adventure Converter" to correctly suggest manifest json file updated for v10.

## v2.6.0

- Added a new import dialog for modules that utilise a "Welcome Journal".
- Added an "Adventure Converter" to assist Creators in converting their existing Scene Packed adventures to the new Adventure format available in V10 of Foundry VTT.
  - As a creator, you can launch this via the Module Settings.
  - This feature serves no purpose to end-users and is only useful to module creators.

## v2.5.7

- Fixed issue with the Moulinette importer where asset references would point to the wrong place if you are using an S3 bucket.
  - It was failing to use the S3 bucket URL prefix.

## v2.5.6

- Fixed long-standing Asset Report bug where it would incorrectly mark http/https assets as "External" regardless of what the checkbox was set to.
- Fixed issue where Asset Report would mark assets as "External" even if they are part of an "allowed" module.
  - Issue was introduced as part of the changes to support v10.

## v2.5.5
- Fixed a bug that was preventing Quick Encounters from being relinked correctly.
  - The bug was introduced in v2.5.0 as part of the v10 changes.

## v2.5.4
- Adjusted the way in which packs are searched, to handle an edge case where a pack might be referenced, but not available.

## v2.5.3

- Handle the case where an actor on a scene is a duplicate of another existing actor, but renamed.
  - Fixes a bug where a token would not be relinked correctly due to the mismatch.
- Wait for Actors to finish be imported when unpacking a scene to avoid edge cases due to timing issues.
- Switch away from using deprecated RollTable functions in V10.
- Added new format for V10 compatibility definition.

## v2.5.2

- Fixed incorrect version checking which would mark packaged modules as outdated.
  - If you packed a scene with version 2.5.0 or 2.5.1 you will need to pack them again.

## v2.5.1

- Added configurable asset timeout.
  - This is used as part of the Moulinette integration and can be adjusted to suit your needs based on your download speed. Particularly useful if you are loading in assets that are large such as animated videos.
- Fixed a bug where unpacking a scene wouldn't correctly identify Journals as missing.

## v2.5.0

- Removed support for v0.7.X of Foundry VTT.
  - Minimum supported version is now 0.8.6 (the earliest stable release in the v8 line).
- Added support for v10 of Foundry VTT.
  - Removed various warnings related to the new data models behind the scene.
- Sorting of Folders is now supported for compendiums built via [Compendium Folders](https://github.com/earlSt1/vtt-compendium-folders/pull/140).
  - Previously, only the documents inside folders were sorted, folders were always listed alphabetically.
- Updated the `Bulk replace asset references` macro to better handle all asset locations.
  - This change comes at the cost of unnecessary updates until [Core V10](https://gitlab.com/foundrynet/foundryvtt/-/issues/6813) is released.
- Upgraded the [libWrapper shim](https://github.com/ruipin/fvtt-lib-wrapper/blob/master/shim/SHIM.md) version.
- Visually differentiate between running the Asset Report in "World" or "Module" mode. No functional changes.

## v2.4.5

- Better support for relinking [Monk's Enhanced Journal](https://foundryvtt.com/packages/monks-enhanced-journal)'s relationships between Journals.
  - Please raise an [issue](https://github.com/League-of-Foundry-Developers/scene-packer/issues) if you encounter any problems.

## v2.4.4

- Further enhance the methods of matching added in v2.4.3.

## v2.4.3

- Enhance the methods of matching compendium entities to world entities to reduce the number of times that an existing entity is missed.
  - When a world entity was incorrectly thought to be missing, Scene Packer would try to import it again. This was causing either duplicates, or an error due to a "unique key constraint".
- Update references to deprecated methods that are being removed in V10.

## v2.4.2

- Added support for [Monk's Enhanced Journal](https://foundryvtt.com/packages/monks-enhanced-journal) Encounters.
- Ensure that scenes imported from a compendium have a default navigation value set.
  - Works around this issue until it is fixed in core: https://gitlab.com/foundrynet/foundryvtt/-/issues/6812
- Moulinette Importer improvement
  - [Quick Encounters](https://foundryvtt.com/packages/quick-encounters) and [Monk's Enhanced Journal](https://foundryvtt.com/packages/monks-enhanced-journal) Encounters are now supported.
  - Added several new categorisation values.
  - Now shows an error message if it fails to download data from Moulinette correctly.
- Bulk asset replacer now supports replacing scene thumbnails as well.

## v2.4.1

- Improved Moulinette Exporter
  - Added additional categorisation fields to support searching and filtering within Moulinette, making adventures easier to find.
  - Most fields now are either pre-filled based on world data, or remember your previous values.

![Scene Packer - Moulinette export settings example](https://raw.githubusercontent.com/League-of-Foundry-Developers/scene-packer/main/assets/scene-packer-moulinette-export-settings.png)

- Fixed typo that would prevent Relinking entities in some circumstances

## v2.4.0

- New feature: Distributing packed scenes and adventures via [Moulinette](https://www.moulinette.cloud/)
  - This feature allows content creators to distribute their creations to the community without needing to create modules for every release, reducing the number of modules an end-user needs to have installed.
  - End-users can import just the scene/s they need and all the associated assets and entities for those scenes will be automatically downloaded.
  - End-users can also import an entire adventure if the creator has enabled the option (some creators generate so much content that importing everything will slow the Foundry VTT instance down significantly).
  - Standard Moulinette features such as locking down access via Patreon tiers work.
  - See https://www.youtube.com/watch?v=XZjuE1j_7GQ for an example of how to use the new feature.
  - Join the [Scene Packer Discord Server](https://discord.gg/HY3xhBEf2A) if you have any questions, comments, suggestions, or would like to organise a demo.
- Updated wording to make it clearer when there are no modules correctly registered with Scene Packer.
  - Useful for new creators. This usually happens when you haven't quite initialised your module correctly.
  - A reminder that the [module generator](https://sneat.github.io/scene-packer-module-generator/) is a good starting point for generating modules that are compatible with Scene Packer.
- Added initial support for unpacking [Automated Evocations](https://github.com/theripper93/automated-evocations#store-companions-on-actor) companions.
  - Companion data must be stored on the actor prior to exporting to your compendium. See the [Automated Evocations module readme](https://github.com/theripper93/automated-evocations#store-companions-on-actor) for details.
  - Unpacking will only work if the end-user utilises the "Import All" functionality. It *will not* work for individually imported actors.
- Updated macro `Clean up #[CF_tempEntity] entries` to support deleting the CF entities from compendiums.
  - You must manually unlock the compendium first.
- Added new `Hooks`:
  - `ScenePacker.importAllComplete` - Called after all documents in a pack have been imported.
    - `Hooks.on("ScenePacker.importAllComplete", (data) => { const {moduleName, adventureName, instance} = data; })`
  - `ScenePacker.importMoulinetteComplete` - Called after documents in a pack from Moulinette have been imported.
    - `Hooks.on("ScenePacker.importMoulinetteComplete", (data) => { const {sceneID, actorID, info} = data; })`
  - `ScenePacker.sceneUnpacked` - Called after a scene has been unpacked.
    - `Hooks.on("ScenePacker.sceneUnpacked", (data) => { const {scene, moduleName, adventureName, instance} = data; })`

## v2.3.31

- Support folder sorting via [Compendium Folders](https://github.com/earlSt1/vtt-compendium-folders/pull/135).
- Fixed another interaction issue between [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles) and [Quick Encounters](https://foundryvtt.com/packages/quick-encounters).
  - MATT values would be updated correctly, but wouldn't persist after a refresh. This has now been fixed.

## v2.3.30

- Fixed issue where packing a scene would not identify any [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles) to pack.

## v2.3.29

- Updated functionality for [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles) and [Quick Encounters](https://foundryvtt.com/packages/quick-encounters).
  - Supports new data references added by Monk's Active Tile Triggers.
    - Scene teleport syntax.
    - Rolltable syntax.
  - Supports new active tile's created by Quick Encounters.

## v2.3.28

- Fixed issue where an Actor, JournalEntry or Macro would incorrectly show as missing in the original source world due to data flags not existing on the source document.

## v2.3.27

- Updated macro `Clean up #[CF_tempEntity] entries` to support deleting the CF entities from compendiums.
- Updated macro `Show Scenes Worth Packing` to correctly identify [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles).

## v2.3.26

- Try an alternate search pack name when unable to find a pack. There are some cases where creators utilise world compendiums for Actor packs to get around the system specific limitations of Actor compendiums.

## v2.3.25

- Fixed issue where packing/unpacking a scene would only pack or unpack the currently active scene rather than the one selected.
  - Thanks to Virto Nex for reporting this issue.

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

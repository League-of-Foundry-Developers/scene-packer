![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/League-of-Foundry-Developers/scene-packer) ![GitHub Releases](https://img.shields.io/github/downloads/League-of-Foundry-Developers/scene-packer/latest/total) ![GitHub Releases](https://img.shields.io/github/downloads/League-of-Foundry-Developers/scene-packer/total) ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fscene-packer&colorB=4aa94a) ![Foundry Version](https://img.shields.io/badge/dynamic/json.svg?url=https://github.com/League-of-Foundry-Developers/scene-packer/releases/latest/download/module.json&label=foundry%20version&query=$.compatibleCoreVersion&colorB=blueviolet)

# Scene Packer

A library to help other developers package up Scenes and Adventures to solve several frustrations when importing Scenes from a module compendium. With Scene Packer the following works:

- Scene Journal Pins link to the correct Journal.
  - This is the feature that started this module. I was frustrated that I could put a Scene into a compendium with journal pins and then when I imported from a compendium, the journal pin was there, but didn't load anything. This module gives you portable compendium journal pins that link to the original journal entry. The journal links will persist when importing from compendiums.
- Actor tokens on a Scene link to the correct Actor.
  - The second frustration that prompted this module. Normally you would import a Scene with Actor tokens on it and they look correct, but don't open anything. So you would have to go through and link them all up again manually. This module gives you portable compendium actor tokens on a scene that link to the original actor data automatically.
- Journals configured for the Scene link correctly.
  - No longer will the Journal dropdown on the Scene configuration screen be empty when importing from a compendium.
- Playlists configured for the Scene link correctly.
  - No longer will the Playlist dropdown on the Scene configuration screen be empty when importing from a compendium.
- Imported Journals link correctly to other Journal entries.
  - By using the automatic link fixer, you won't have broken links due to Journals referencing World entities, rather than compendium entities.
- Actors, Journals and Playlists referenced by a Scene are automatically imported.
- [Quick Encounters](https://foundryvtt.com/packages/quick-encounters) work, creating working journal pins that you can double-click on and actors that are linked correctly.
- You can provide a list of Journals and/or Macros that you want to ensure are imported to the world.

In summary, it makes importing a Scene from a Compendium (via an "adventure module") work as though you build it in your world.

Scene Packer is system agnostic, it doesn't matter whether you're packaging up a D&D5e module, or a Pathfinder one, or an Alien RPG one, Scene Packer doesn't mind.

## Installation

In the setup screen, find the module `Library: Scene Packer` under the "Add-on Modules" tab. Alternatively, use the URL https://github.com/League-of-Foundry-Developers/scene-packer/releases/latest/download/module.json to install the module.

## Usage

There are several `Journal entries` bundled with Scene Packer. In them, you can find references on how to use Scene Packer both as a Developer and as a GM.

To use the Scene Packer as part of your module you will need to add it as a dependency in your `module.json` file as well as add/update your module javascript (see [Module code requirements](#module-code-requirements) below).

```json
"dependencies": [
  {
    "name": "scene-packer",
    "manifest": "https://github.com/League-of-Foundry-Developers/scene-packer/releases/latest/download/module.json",
    "type": "module"
  }
]
```

### Module code requirements

Once you have added Scene Packer as a dependency you need to add some initialisation code to register your module with Scene Packer.

Include the following in your [module javascript](https://foundryvtt.com/article/module-development/#includes), updating the variable names where appropriate.

```javascript
(() => {
  const adventureName = 'The Name of Your Adventure or Collection';
  const moduleName = 'your-module-name-as-defined-in-your-manifest-file';

  /**
   * welcomeJournal (if set) will automatically be imported and opened after the first activation of a scene imported
   * from the module compendium.
   * Set to the following to disable:
   *   const welcomeJournal = '';
   */
  const welcomeJournal = 'A1. Adventure Introduction';
  /**
   * additionalJournals will automatically be imported.
   * Set to the following to disable:
   *   const additionalJournals = [];
   */
  const additionalJournals = ['A2. Adventure Overview'];
  /**
   * additionalMacros will automatically be imported.
   * Set to the following to disable:
   *   const additionalMacros = [];
   */
  const additionalMacros = [];
  /**
   * creaturePacks is a list of compendium packs to look in for Actors by name (in prioritised order).
   * The first entry here assumes that you have an Actor pack in your module with the "name" of "actors".
   * Set to the following to disable:
   *   const creaturePacks = [];
   */
  const creaturePacks = [`${moduleName}.actors`, 'dnd5e.monsters'];
  /**
   * journalPacks is a list of compendium packs to look in for Journals by name (in prioritised order).
   * The first entry here assumes that you have a Journal pack in your module with the "name" of "journals".
   * Set to the following to disable:
   *   const journalPacks = [];
   */
  const journalPacks = [`${moduleName}.journals`];
  /**
   * macroPacks is a list of compendium packs to look in for Macros by name (in prioritised order).
   * The first entry here assumes that you have a Macro pack in your module with the "name" of "macros".
   * Set to the following to disable:
   *   const macroPacks = [];
   */
  const macroPacks = [`${moduleName}.macros`];
  /**
   * playlistPacks is a list of compendium packs to look in for Playlists by name (in prioritised order).
   * The first entry here assumes that you have a Playlist pack in your module with the "name" of "playlists".
   * Set to the following to disable:
   *   const playlistPacks = [];
   */
  const playlistPacks = [`${moduleName}.playlists`];

  Hooks.once('scenePackerReady', ScenePacker => {
    // Initialise the Scene Packer with your adventure name and module name
    let packer = ScenePacker.Initialise({
      adventureName,
      moduleName,
      creaturePacks,
      journalPacks,
      macroPacks,
      playlistPacks,
      welcomeJournal,
      additionalJournals,
      additionalMacros,
      allowImportPrompts: true, // Set to false if you don't want the popup
    });
  });
})()
```

### Packing your Scenes

To pack your scene ready for distribution:

1. Enable the `Scene Packer context menu` in Module Settings.
2. Build your scene as normal, adding Actors and Journal Pins where you'd like.
3. Export your Scenes/Actors/Journals/Roll Tables/Items/Macros/Playlists to your compendiums as normal. 
4. Run the script to Update Journal links to fix up the journal compendium linking (see section below)
5. Right click on your Scene in the Scenes Directory and choose `Pack Scene Data`.
6. Export your Scene to your compendium (replacing your existing entry, merging by name to retain the ID reference).

![scene-context-menu](scene-context-menu.png)

### Updating Journal links

When you build an adventure module, it's a painful process updating all of your Journal references to link to the compendium versions. You can simplify this by running the following command in your browser console putting in your appropriate module name (as per your manifest json name):

```js
await ScenePacker.RelinkJournalEntries('module-name', {dryRun: false});
```

Alternatively, you can run the macro `Relink compendium journal entries` that is included in the Scene Packer compendium, which will prompt you for your module name and whether you want to run in "dry run" mode (not saving changes).

This will automatically go through the Journal compendiums that belong to your module, and change the reference links to the compendium versions. For example, if you had a link to `@Actor[alvhCr52HIrWmoez]{Commoner}` it would change it to `@Compendium[your-module.actors.lOBiqShvkT83eGzY]{Commoner}` using your module and compendium names and ID references.

## Macros

There are several Macros included in the `Library: Scene Packer` compendium entry. Each macro has a comment at the top describing its purpose. It is well worth having a look at what is available there.

## Quick Encounters

Support for packing Scenes with embedded [Quick Encounters](https://foundryvtt.com/packages/quick-encounters) data was added in v2.2.0 of Scene Packer. There is a Journal Entry bundled in the Scene Packer compendium which describes how to pack these scenes.

## Example module use

You can view an example module that showcases Scene Packer's features at https://github.com/sneat/example-scene-packer

## Acknowledgements

A portion of the code is based on code created by [honeybadger](https://github.com/trioderegion) and used with permission.

Thanks to [Baileywiki](https://www.patreon.com/baileywiki) for their initial testing and feedback.

## Support

Please submit any issues via the [Bug Reporter](https://foundryvtt.com/packages/bug-reporter) module or via [GitHub Issues](https://github.com/League-of-Foundry-Developers/scene-packer/issues).

You can contact me on Discord `blair#9056` in the [<img src="https://github.com/League-of-Foundry-Developers/scene-packer/raw/main/assets/icons/hand-truck.png" alt="icon" height="24" valign="middle">
 Scene Packer server](https://discord.com/invite/HY3xhBEf2A) or the `Foundry VTT server` if you have questions, comments, queries, suggestions etc.

If you are making money and utilising this module, please consider sending a few dollars my way and/or providing me with the cool adventures and modules you're building :)

[![Patreon](https://img.shields.io/badge/patreon-donate-blue.svg)](https://www.patreon.com/blairm)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/A0A0488MI)

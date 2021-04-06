![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/League-of-Foundry-Developers/scene-packer) ![GitHub Releases](https://img.shields.io/github/downloads/League-of-Foundry-Developers/scene-packer/latest/total) ![GitHub Releases](https://img.shields.io/github/downloads/League-of-Foundry-Developers/scene-packer/total) ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fscene-packer&colorB=4aa94a) ![Foundry Version](https://img.shields.io/badge/dynamic/json.svg?url=https://github.com/League-of-Foundry-Developers/scene-packer/releases/latest/download/module.json&label=foundry%20version&query=$.compatibleCoreVersion&colorB=blueviolet)

# Scene Packer

A library to help other developers package up Scenes and Adventures to solve the following:

- Scene Journal Pins link to the correct Journal
- Actor tokens on a Scene link to the correct Actor
- Relink journal entries to compendium entities (to automatically fix the broken links after exporting from your World to your Compendium)

## Installation

In the setup screen, use the URL <https://raw.githubusercontent.com/League-of-Foundry-Developers/scene-packer/master/module.json> to install the module.

## Usage

To use the Scene Packer as part of your module you will need to add it as a dependency in your `module.json` file.

```json
"dependencies": [
  {
    "name": "scene-packer",
    "manifest": "https://raw.githubusercontent.com/League-of-Foundry-Developers/scene-packer/master/module.json"
  }
]
```

### Module code requirements

To unpack your scenes automatically when first viewed by a user, include the following in your module javascript, updating the variable names where appropriate.

```javascript
const adventureName = 'The Name of Your Adventure or Collection';
const moduleName = 'your-module-name-as-defined-in-your-manifest-file';

/**
 * welcomeJournal (if set) will automatically be imported and opened after the first activation of a scene imported from the module compendium.
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
const journalPacks = [`${moduleName}.journals`];/**
 * macroPacks is a list of compendium packs to look in for Macros by name (in prioritised order).
 * The first entry here assumes that you have a Macro pack in your module with the "name" of "macros".
 * Set to the following to disable:
 *   const macroPacks = [];
 */
const macroPacks = [`${moduleName}.macros`];

Hooks.once('scenePackerReady', ({ getInstance }) => {
  // Initialise the Scene Packer with your adventure name and module name
  let packer = getInstance(adventureName, moduleName, {
    creaturePacks,
    journalPacks,
    macroPacks,
    welcomeJournal,
    additionalJournals,
    allowImportPrompts: true, // Set to false if you don't want the popup
  });
});
```

### Packing your Scenes

To pack your scene ready for distribution:

1. Enable the `Scene Packer context menu` in Module Settings.
2. Build your scene as normal, adding Actors and Journal Pins where you'd like.
3. Export your Actors/Journals/Roll Tables/Items/Macros to your compendiums as normal. 
4. Run the script to Update Journal links to fix up the journal compendium linking (see section below)
5. Re-export your Journals to compendiums, be sure to select the "Merge By Name" option to prevent the IDs from changing (and therefore re-breaking the links)
6. Right click on your Scene in the Scenes Directory and choose `Pack Scene Data`.
7. Export your Scene to your compendium.
8. Right click on your Scene in the Scenes Directory and choose `Clear Packed Scene Data`.

  - You want to choose this otherwise next time you open your Scene locally it will run the Scene import scripts.

![scene-context-menu](scene-context-menu.png)

### Updating Journal links

When you build an adventure module, it's a painful process updating all of your Journal references to link to the compendium versions. You can simplify this by running the following command in your browser console putting in your appropriate module name (as per your manifest json name):

```js
await window['scene-packer'].relinkJournalEntries('module-name', {dryRun: false});
```

Alternatively, you can run the macro `Relink compendium journal entries` that is included in the Scene Packer compendium, which will prompt you for your module name and whether you want to run in "dry run" mode (not saving changes).

This will automatically go through the Journal compendiums that belong to your module, and change the reference links to the compendium versions. For example, if you had a link to `@Actor[alvhCr52HIrWmoez]{Commoner}` it would change it to `@Compendium[your-module.actors.lOBiqShvkT83eGzY]{Commoner}` using your module and compendium names and ID references.

## TODO

- Provide example complete module

## Acknowledgements

A portion of the code is based on code created by [honeybadger](https://github.com/trioderegion) and used with permission.

Thanks to [Baileywiki](https://www.patreon.com/baileywiki) for their initial testing and feedback.

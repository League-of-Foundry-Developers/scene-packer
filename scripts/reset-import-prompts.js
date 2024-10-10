import { CONSTANTS } from './constants.js';

export default class ResetImportPrompts extends FormApplication {

  /** @inheritDoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize('SCENE-PACKER.reset-prompts.name'),
      id: 'scene-packer-reset-import-prompts',
      template: 'modules/scene-packer/templates/reset-import-prompts.hbs',
      classes: ['scene-packer'],
    });
  }

  /**
   * @returns {Object|Promise<Object>}
   */
  getData(options = {}) {
    const instances = Object.values(ScenePacker.instances).map(m => {
      const module = game.modules.get(m.moduleName);
      return {
        id: module?.id || m.moduleName,
        name: (module?.title ?? module?.data?.title) || m.adventureName,
      }
    });
    return {
      instances,
    };
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    const moduleName = formData['module-name'];
    if (!moduleName) {
      return;
    }

    await Promise.allSettled([
      game.settings.set(moduleName, CONSTANTS.SETTING_IMPORTED_VERSION, '0.0.0'),
      game.settings.set(moduleName, CONSTANTS.SETTING_PROMPTED, '0.0.0'),
      game.settings.set(moduleName, CONSTANTS.SETTING_SHOW_WELCOME_PROMPTS, true),
      game.settings.set(moduleName, CONSTANTS.SETTING_SYSTEM_MIGRATION_VERSION, '0.0.0'),
    ]);

    if (canvas?.scene?.getFlag(moduleName, CONSTANTS.SETTING_IMPORTED_VERSION)) {
      await canvas.scene.setFlag(moduleName, CONSTANTS.SETTING_IMPORTED_VERSION, '0.0.0')
    }

    setTimeout(() => {
      window.location.reload();
    }, 200);
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="close"]').click(this.close.bind(this));
  }
}

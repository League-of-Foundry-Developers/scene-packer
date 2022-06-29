import AssetReport from '../asset-report.js';
import {CONSTANTS} from '../constants.js';

/**
 * Module Selection for the Asset Report
 */
export default class ModuleSelect extends FormApplication {
  constructor(...args) {
    const resolve = args.shift();
    const reject = args.shift();
    const {mode = AssetReport.Modes.World, scene = null} = args.shift();

    super();
    this.resolve = resolve;
    this.reject = reject;
    this.mode = mode;
    this.sceneName = scene?.name || '';
    this._filter = 'all';
    this._expanded = false;
    this._checked = {};
    this._webExternal = true;

    if (game.modules.get('scene-packer') && ScenePacker?.instances) {
      Object.keys(ScenePacker.instances).forEach(name => {
        this._checked[name] = true;
        // Automatically include dependencies too
        const module = game.modules.get(name);
        if (module) {
          const dependencies = (CONSTANTS.IsV10orNewer() ? module.dependencies : module.data?.dependencies) || [];
          dependencies.forEach(dep => {
            if (dep?.name) {
              this._checked[dep.name] = true;
            }
          });
        }
      });
      this._checked['scene-packer'] = true;
    }
  }

  /** @inheritdoc */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: `${game.i18n.localize('SCENE-PACKER.asset-report.name')} - ${game.i18n.localize('SCENE-PACKER.asset-report.module-select.title')}`,
      id: 'asset-report-module-select',
      template: 'modules/scene-packer/templates/asset-report/module-select.html',
      width: 680,
      height: 'auto',
      classes: ['asset-report'],
      scrollY: ['.package-list'],
      filters: [{inputSelector: 'input[name="search"]', contentSelector: '.package-list'}],
    });
  }

  /** @inheritdoc */
  getData(options) {
    // Prepare modules
    const modules = (CONSTANTS.IsV10orNewer() ? game.modules : game.data.modules).map(m => {
      let mod;
      if (CONSTANTS.IsV10orNewer()) {
        mod = m.toObject();
      } else {
        mod = m.data.toObject();
      }
      mod.id = m.id;
      mod.activeModule = m.active;
      mod.hasPacks = mod.packs.length > 0;
      mod.hasScripts = mod.scripts.length > 0;
      mod.hasStyles = mod.styles.length > 0;
      mod.systemOnly = mod.systems && (mod.systems.indexOf(game.system.id) !== -1);
      mod.systemTag = game.system.id;
      mod.incompatible = m.incompatible;
      mod.unavailable = m.unavailable;
      mod.dependencies = mod.dependencies ? mod.dependencies.map(d => CONSTANTS.IsV10orNewer() ? d.id : d.name) : null;
      return mod;
    }).sort((a, b) => {
      const aName = CONSTANTS.IsV10orNewer() ? a.id : a.name;
      const bName = CONSTANTS.IsV10orNewer() ? b.id : b.name;
      if (this._checked[aName] !== this._checked[bName]) {
        return (this._checked[bName] || 0) - (this._checked[aName] || 0);
      }
      if (a.activeModule !== b.activeModule) {
        return b.activeModule - a.activeModule;
      }
      return a.title.localeCompare(b.title);
    });

    // Return data for rendering
    return {
      modules,
      expanded: this._expanded,
      webExternal: this._webExternal,
      sceneName: this.sceneName,
      mode: this.mode,
    };
  }


  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="cancel"]').click(this._cancel.bind(this));
    html.find('.filter').click(this._onFilterList.bind(this));
    html.find('button.expand').click(this._onExpandCollapse.bind(this));
    html.find('#scene-packer-module-select-web-external').on('change', this._onChangeWebExternal.bind(this));

    this._restoreCheckboxState();
  }

  _cancel() {
    if (typeof this.reject === 'function') {
      this.reject();
    }
    return this.close();
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    const selections = [];
    for (let [k, v] of Object.entries(formData)) {
      if (!k || !v || k === '__scene-packer-web-external') {
        continue;
      }
      selections.push(k);
    }

    if (typeof this.resolve === 'function') {
      this.resolve({selections, webExternal: this._webExternal});
    }
  }

  /**
   * Restores the Form UI to the internal checked state
   * @private
   */
  _restoreCheckboxState() {
    for (let [k, v] of Object.entries(this._checked)) {
      if (this.form[k]) {
        this.form[k].checked = v;
      }
    }
  }

  /**
   * Handle a button-click to deactivate all modules
   * @private
   */
  _onDeactivateAll(event) {
    event.preventDefault();
    for (let input of this.element[0].querySelectorAll('input[type="checkbox"]')) {
      this._checked[input.name] = input.checked = false;
    }
  }

  /**
   * Handle expanding or collapsing the display of descriptive elements
   * @private
   */
  _onExpandCollapse(event) {
    event.preventDefault();
    this._expanded = !this._expanded;
    this.render();
  }

  /**
   * Handle changing whether web assets should be treated as external
   * @private
   */
  _onChangeWebExternal(event) {
    event.preventDefault();
    this._webExternal = event.currentTarget.checked;
  }

  /**
   * Handle filtering modules
   * @private
   */
  _onFilterList(event) {
    event.preventDefault();
    this._filter = event.target.dataset.filter;
    this.render();
  }


  /** @inheritdoc */
  _onSearchFilter(event, query, rgx, html) {
    if (isNewerVersion('0.8.1', CONSTANTS.Version())) {
      // rgx and SearchFilter were added in 0.8.1, previously the arguments were
      // event, query, html
      html = rgx;
      rgx = new RegExp(RegExp.escape(query || ''), 'i');
    }
    for (let li of html.children) {
      if (!query) {
        li.classList.remove('hidden');
        continue;
      }
      const name = li.dataset.moduleName;
      const title = (li.querySelector('.package-title')?.textContent || '').trim();
      const author = (li.querySelector('.author')?.textContent || '').trim();
      let match = false;
      if (!isNewerVersion('0.8.1', CONSTANTS.Version())) {
        match = rgx.test(SearchFilter.cleanQuery(name)) ||
          rgx.test(SearchFilter.cleanQuery(title)) ||
          rgx.test(SearchFilter.cleanQuery(author));
      } else {
        match = rgx.test(name) || rgx.test(title) || rgx.test(author);
      }
      li.classList.toggle('hidden', !match);
    }
  }
}

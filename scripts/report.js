import {CONSTANTS} from './constants.js';

/**
 * Report on the performance of the current scene.
 */
export default class Report {
  constructor() {
    this.Core = Report.GetCoreDetails();
    this.User = Report.GetUserDetails();
    this.Scene = Report.GetSceneDetails();
    this.Database = Report.GetDatabaseSizes();
    this.Modules = Report.GetModuleCounts();
    this.Browser = Report.GetBrowserDetails();
    this.WebGL = Report.GetWebGLDetails();
    const memory = Report.GetMemoryUse();
    if (memory) {
      this.Memory = memory;
    }
  }

  /**
   * Renders a dialog with the performance report details.
   */
  static RenderReport() {
    const r = new Report();
    let output = '';
    for (const [k1, v1] of Object.entries(r)) {
      output += `${k1}:\n`;
      for (const [k2, v2] of Object.entries(v1)) {
        output += `  ${k2}: ${v2}\n`;
      }
    }
    const d = new Dialog({
      title: game.i18n.localize('SCENE-PACKER.performance-report.title'),
      content: `<textarea readonly style="height: 500px" type="text" id="debugmacro">${output}</textarea>`,
      buttons: {
        copy: {
          icon: '<i class="fas fa-copy"></i>',
          label: game.i18n.localize('SCENE-PACKER.performance-report.copy'),
          callback: () => {
            $('#debugmacro').select();
            document.execCommand('copy');
          },
        },
        close: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize('SCENE-PACKER.performance-report.close'),
        },
      },
      default: 'close',
      close: () => {
      },
    });

    d.options.width = 600;
    d.position.width = 600;
    d.render(true);
  }

  /**
   * Core details.
   * @returns {{Foundry: string, System: string}}
   */
  static GetCoreDetails() {
    return {
      Foundry: CONSTANTS.Version(),
      System: `${game.system.id} version ${game.system.version || game.system.data.version}`,
    };
  }

  /**
   * User details of the user generating the report.
   * @returns {{Role: string}}
   */
  static GetUserDetails() {
    return {
      Role: Object.keys(CONST.USER_ROLES)[game.user.role],
    };
  }

  /**
   * Scene details.
   * @returns {{Sounds: number, Tiles: number, Background: string, Lights: number, Dimensions: string, Walls: number, Notes: number, Name: string, Tokens: number, Drawings: number}}
   */
  static GetSceneDetails() {
    if (!canvas || !canvas.scene) {
      return {
        Error: 'No scene active.'
      }
    }

    return {
      Name: canvas.scene?.name,
      Walls: canvas.walls?.placeables?.length,
      Lights: canvas.lighting?.placeables?.length,
      Tokens: canvas.tokens?.placeables?.length,
      Tiles: canvas.background?.placeables?.length,
      Sounds: canvas.sounds?.placeables?.length,
      Drawings: canvas.drawings?.placeables?.length,
      Notes: canvas.notes?.placeables?.length,
      Dimensions: `${canvas.dimensions?.width} x ${canvas.dimensions?.height}`,
      Background: `${canvas.background?.bg?.texture?.width} x ${canvas.background?.bg?.texture?.height}`,
      Foreground: `${canvas.foreground?.img?.texture?.width || 0} x ${canvas.foreground?.img?.texture?.height || 0}`,
    };
  }

  /**
   * Database sizes.
   * @returns {{Scenes: number, Journals: number, Tables: number, Actors: number, Items: number, RollTables: number, Macros: number}}
   */
  static GetDatabaseSizes() {
    return {
      Actors: game.actors.size,
      Items: game.items.size,
      Scenes: game.scenes.size,
      Journals: game.journal.size,
      Tables: game.tables.size,
      Macros: game.macros.size,
      RollTables: game.tables.size,
    };
  }

  /**
   * Module counts.
   * @returns {{Total: number, Enabled: number}}
   */
  static GetModuleCounts() {
    return {
      Total: game.modules.size,
      Enabled: [...game.modules.values()].filter(m => m.active).length,
    };
  }

  /**
   * Browser details.
   * @returns {{Agent: string, Platform: string, Vendor: string}}
   */
  static GetBrowserDetails() {
    return {
      Platform: navigator.platform,
      Vendor: navigator.vendor,
      Agent: navigator.userAgent,
    };
  }

  /**
   * WebGL details.
   * @returns {{Context: string, WebGL_Version: string, GL_Vendor: string, MAX_TEXTURE_SIZE: number, Renderer: string, MAX_RENDERBUFFER: number}}
   */
  static GetWebGLDetails() {
    const details = {
      Context: 'FAILED TO GET WEBGL CONTEXT',
      GL_Vendor: '',
      Renderer: '',
      WebGL_Version: '',
      MAX_TEXTURE_SIZE: 0,
      MAX_RENDERBUFFER: 0,
    };
    const gl = canvas.app.renderer.gl;
    if (!gl) {
      return details;
    }

    details.Context = gl.constructor.name;
    details.GL_Vendor = gl.getParameter(gl.VENDOR);
    details.Renderer = gl.getParameter(gl.RENDERER);
    details.WebGL_Version = gl.getParameter(gl.VERSION);
    details.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    details.MAX_RENDERBUFFER = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

    return details;
  }

  /**
   * Memory use. Not supported in all browsers.
   * @returns {null|{Heap_Total: string, Heap_Used: string, Heap_Limit: string}}
   */
  static GetMemoryUse() {
    if (!performance?.memory) {
      return null;
    }

    return {
      Heap_Limit: Report.FormatBytes(performance?.memory?.jsHeapSizeLimit),
      Heap_Total: Report.FormatBytes(performance?.memory?.totalJSHeapSize),
      Heap_Used: Report.FormatBytes(performance?.memory?.usedJSHeapSize),
    };
  }

  /**
   * Format a number of bytes as a human readable string.
   * @param bytes {number} The bytes to format.
   * @param decimalPlaces {number} The number of decimal places to show. Default 2.
   * @returns {string}
   */
  static FormatBytes(bytes, decimalPlaces = 2) {
    if (!bytes) {
      return '0 Bytes';
    }
    const c = 0 > decimalPlaces ? 0 : decimalPlaces, d = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, d)).toFixed(c)) + ' ' + [
      'Bytes',
      'KB',
      'MB',
      'GB',
      'TB',
      'PB',
      'EB',
      'ZB',
      'YB',
    ][d];
  }
}

import type * as Blockly from "blockly";
import type { MissionEngine } from "./types";

const toolbox: Blockly.utils.toolbox.ToolboxDefinition = {
  kind: "categoryToolbox",
  contents: [],
};

export const missionEngine: MissionEngine = {
  toolbox,
  registerBlocks() {},
  createInitialMission() {},
  generate() {
    return {
      code: "# AirSim 积木引擎正在初始化。\n",
      issues: [{ severity: "warning", message: "积木引擎尚未加载。" }],
      canExport: false,
    };
  },
};


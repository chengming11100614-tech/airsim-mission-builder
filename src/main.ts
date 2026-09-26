import * as Blockly from "blockly";
import { missionEngine } from "./engine";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("找不到应用挂载点。\n");
}

missionEngine.registerBlocks();
app.textContent = `AirSim Mission Builder · Blockly ${Blockly.VERSION}`;


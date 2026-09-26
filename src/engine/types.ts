import type * as Blockly from "blockly";

export const WORKSPACE_SCHEMA_VERSION = 1 as const;

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  blockId?: string;
}

export interface GenerationResult {
  code: string;
  issues: ValidationIssue[];
  canExport: boolean;
}

export interface MissionDocument {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  name: string;
  workspace: Record<string, unknown>;
}

export interface MissionEngine {
  readonly toolbox: Blockly.utils.toolbox.ToolboxDefinition;
  registerBlocks(): void;
  createInitialMission(workspace: Blockly.WorkspaceSvg): void;
  generate(workspace: Blockly.Workspace): GenerationResult;
}


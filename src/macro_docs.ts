import * as vscode from 'vscode';
import { ConfigManager } from './config-manager';

export interface MacroInfo {
    title: string;
    desc: string;
    source: string;
}

export type MacroDocs = Record<string, MacroInfo>
export type ReplacementMacros = Record<string, string>

let macroDocsManager: ConfigManager<MacroDocs>;
let replacementMacrosManager: ConfigManager<ReplacementMacros>;

export function setupMacroManagers(context: vscode.ExtensionContext) {
    macroDocsManager = new ConfigManager<MacroDocs>(context, {
        relativeFilePath: 'data/macro_docs.json',
        configSection: 'omoriYamlPortraitViewer',
        configKey: 'macroDocsOverrides'
    });

    replacementMacrosManager = new ConfigManager<ReplacementMacros>(context, {
        relativeFilePath: 'data/replacement_macros.json',
        configSection: 'omoriYamlPortraitViewer',
        configKey: 'snippetOverrides'
    });
}

export function getMacroDocs(): MacroDocs {
    return macroDocsManager.get();
}

export function getReplacementMacros(): ReplacementMacros {
    return replacementMacrosManager.get();
}
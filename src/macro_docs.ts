import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface MacroInfo {
    title: string;
    desc: string;
    source: string;
}

export type MacroDocs = Record<string, MacroInfo>
export type ReplacementMacros = Record<string, string>

let cachedMacroDocs: MacroDocs | null = null;
let cachedReplacementMacros: ReplacementMacros | null = null;

export function registerClearCachedMacroDocs(context: vscode.ExtensionContext) {
    // Clear cache automatically whenever settings change
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('omoriYamlPortraitViewer.macroDocsOverrides')) {
                cachedMacroDocs = null; // Invalidate the cache
                console.log('Macro docs cache invalidated due to config change.');
            }
        })
    );
}

export function getMacroDocs(context: vscode.ExtensionContext): MacroDocs {
    // Return the cached data instantly if it exists
    if (cachedMacroDocs !== null) return cachedMacroDocs;

    let baseDocs: MacroDocs = {};

    // Cache miss: Load the base file from disk
    try {
        const docFilePath = path.join(context.extensionPath, 'data/macro_docs.json');
        const docContentRaw = fs.readFileSync(docFilePath, 'utf8');
        baseDocs = JSON.parse(docContentRaw);
    } catch (error) {
        console.error("Failed loading macro_docs.json asset layer:", error);
    }

    // Fetch and merge workspace configurations
    const config = vscode.workspace.getConfiguration('omoriYamlPortraitViewer');
    const userOverrides = config.get<MacroDocs>('macroDocsOverrides') || {};

    const finalDocs: MacroDocs = { ...baseDocs };
    for (const [key, value] of Object.entries(userOverrides)) {
        finalDocs[key] = {
            ...finalDocs[key],
            ...value
        };
    }

    // Save the computed map to cache for future lookups
    cachedMacroDocs = finalDocs;
    return cachedMacroDocs;
}
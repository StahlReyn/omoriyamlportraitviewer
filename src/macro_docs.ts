import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface MacroInfo {
    title: string;
    desc: string;
    source: string;
}

export type MacroDocs = Record<string, MacroInfo>

export function getMacroDocs(context: vscode.ExtensionContext): MacroDocs {
	try {
		const docFilePath = path.join(context.extensionPath, 'data/macro_docs.json');
		const docContentRaw = fs.readFileSync(docFilePath, 'utf8');
		return JSON.parse(docContentRaw);
	} catch (error) {
		console.error("Failed loading macro_docs.json asset layer:", error);
		return {}; // Fallback to avoid crashing
	}
}
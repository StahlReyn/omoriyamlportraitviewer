import { DialogueWebviewManager } from './dialogue_webview';
import { getMacroDocs, MacroDocs } from './macro_docs';
import { MacroHighlightManager } from './macro_highlight';
import { registerPortraitPreview } from './portrait_preview';

import * as vscode from 'vscode';

let macroDocs: MacroDocs = {};

function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('myCoolExtension');
	const enableMacroHighlight = config.get('enableMacroHighlight', true);
	const enablePortraitPreview = config.get('enablePortraitPreview', true);
	
    macroDocs = getMacroDocs(context);
    let portraitPath = config.get('portraitPath', "../../img/faces/");

	if (enableMacroHighlight) {
        let macroHighlightManager = new MacroHighlightManager(macroDocs);
        macroHighlightManager.processHighlight(context);
	}
	
	if (enablePortraitPreview) {
		registerPortraitPreview(context, portraitPath);
	}
    
    let dialogueWebviewManager = new DialogueWebviewManager(portraitPath, macroDocs)
    dialogueWebviewManager.registerPortraitWebView(context)
}

exports.activate = activate;

function deactivate() { }
import { DialogueWebviewManager } from './dialogue_webview';
import { setupMacroManagers } from './macro_docs';
import { MacroHighlightManager } from './macro_highlight';
import { registerPortraitPreview } from './portrait_preview';

import * as vscode from 'vscode';

function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('omoriYamlPortraitViewer');
	const enableMacroHighlight = config.get('enableMacroHighlight', true);
	const enablePortraitPreview = config.get('enablePortraitPreview', true);

    let portraitPath = config.get('portraitPath', "../../img/faces/");

	setupMacroManagers(context)

	if (enableMacroHighlight) {
        let macroHighlightManager = new MacroHighlightManager();
        macroHighlightManager.processHighlight(context);
	}
	
	if (enablePortraitPreview) {
		registerPortraitPreview(context, portraitPath);
	}
    
    let dialogueWebviewManager = new DialogueWebviewManager(portraitPath)
    dialogueWebviewManager.registerPortraitWebView(context)
}

exports.activate = activate;

function deactivate() { }
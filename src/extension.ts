import { getMacroDocs, processHighlight } from './macro_highlight';
import { registerPortraitPreview } from './portrait_preview';

import * as vscode from 'vscode';

function activate(context: vscode.ExtensionContext) {
	const config = vscode.workspace.getConfiguration('myCoolExtension');
	const enableMacroHighlight = config.get('enableMacroHighlight', true);
	const enablePortraitPreview = config.get('enablePortraitPreview', true);
	
	if (enableMacroHighlight) {
		getMacroDocs(context);
		processHighlight(context);
	}
	
	if (enablePortraitPreview) {
		let portraitPath = config.get('portraitPath', "../../img/faces/");
		registerPortraitPreview(context, portraitPath);
	}
}

exports.activate = activate;

function deactivate() { }
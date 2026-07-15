import { getMacroDocs, processHighlight } from './macro_highlight';
import { registerPortraitPreview } from './portrait_preview';

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

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

    let disposable = vscode.commands.registerCommand('extension.openEditor', () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active file found. Open a dialogue YAML file first.');
            return;
        }

        const document = activeEditor.document;
        if (document.languageId !== 'yaml' && !document.fileName.endsWith('.yaml') && !document.fileName.endsWith('.yml')) {
            vscode.window.showErrorMessage('Active document is not a YAML file.');
            return;
        }

        const filePath = document.fileName;
        const fileContents = document.getText(); // Reads text directly from the editor buffer

        let yamlData: any;
        try {
            yamlData = yaml.load(fileContents) || {};
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to parse YAML: ${e}`);
            return;
        }

        // Create the panel
        const panel = vscode.window.createWebviewPanel(
            'dialogueYaml',
            `Preview: ${vscode.workspace.asRelativePath(filePath)}`,
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        // Send the initial data to the Webview
        panel.webview.html = getWebviewContent(context);
        panel.webview.postMessage({ command: 'load', data: yamlData });
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(context) {
	const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'index.html');
    return fs.readFileSync(htmlPath.fsPath, 'utf8');
}

exports.activate = activate;

function deactivate() { }
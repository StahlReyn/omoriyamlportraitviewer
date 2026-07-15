import { getMacroDocs, processHighlight } from './macro_highlight';
import { registerPortraitPreview } from './portrait_preview';

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

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

    let disposable = vscode.commands.registerCommand('extension.openPreview', () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;

        const document = activeEditor.document;
        const filePath = document.fileName;
        const fileDir = path.dirname(filePath);

        let yamlData: any;
        try {
            yamlData = yaml.load(document.getText()) || {};
        } catch (e) {
            vscode.window.showErrorMessage(`YAML Parse Error: ${e}`);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'dialoguePreview',
            `Preview: ${path.basename(filePath)}`,
            vscode.ViewColumn.Two,
            { 
                enableScripts: true,
                // Crucial: Allow the webview to read assets from your image directory
                localResourceRoots: [
                    vscode.Uri.file(path.join(fileDir, '../../img/faces'))
                ]
            }
        );

        // Process nodes to attach valid Webview Image URIs
        const processedData = Object.keys(yamlData).reduce((acc: any, key) => {
            const node = yamlData[key];
            let webviewImgUri = '';

            if (node.faceset) {
                const imgAbsolutePath = path.resolve(fileDir, '../../img/faces', `${node.faceset}.png`);

                if (fs.existsSync(imgAbsolutePath)) {
                    const fileUri = vscode.Uri.file(imgAbsolutePath);
                    webviewImgUri = panel.webview.asWebviewUri(fileUri).toString();
                }
            }

            acc[key] = {
                ...node,
                imageUri: webviewImgUri // Hand off the authorized URI to the HTML
            };
            return acc;
        }, {});


        panel.webview.html = getWebviewContent(context);

        // Post the processed data to HTML
        panel.webview.postMessage({ command: 'load', data: processedData });
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(context) {
	const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'src', 'index.html');
    return fs.readFileSync(htmlPath.fsPath, 'utf8');
}

exports.activate = activate;

function deactivate() { }
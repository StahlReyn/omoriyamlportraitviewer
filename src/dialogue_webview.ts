import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { MacroDocs } from './macro_docs';

export class DialogueWebviewManager {
    private macroRegex = new RegExp("", 'g');
    private imgPath = "../../img/faces"
    private macroDocs: MacroDocs = {}

    public constructor(imgPath: string, macroDocs: MacroDocs) {
        this.imgPath = imgPath;
        this.setMacroDocs(macroDocs);
    }

    public setMacroDocs(macroDocs: MacroDocs) {
        this.macroDocs = macroDocs;
        const macroKeys = Object.keys(macroDocs);
        const escapedKeys = macroKeys.map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
        this.macroRegex = new RegExp(escapedKeys.join('|'), 'gi');
    }
    
    public registerPortraitWebView(context: vscode.ExtensionContext) {
        let disposable = vscode.commands.registerCommand('extension.openPreview', () => this.openDialogueWebview(context));
        context.subscriptions.push(disposable);
    }
    
    private openDialogueWebview(context: vscode.ExtensionContext) {
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
                    vscode.Uri.file(path.join(fileDir, this.imgPath))
                ]
            }
        );
    
        // Process nodes to attach valid Webview Image URIs
        const processedData = Object.keys(yamlData).reduce((acc: any, key) => {
            const node = yamlData[key];
            node.name = ""
            let webviewImgUri = '';
    
            if (node.faceset) {
                const imgAbsolutePath = path.resolve(fileDir, this.imgPath, `${node.faceset}.png`);
    
                if (fs.existsSync(imgAbsolutePath)) {
                    const fileUri = vscode.Uri.file(imgAbsolutePath);
                    webviewImgUri = panel.webview.asWebviewUri(fileUri).toString();
                }
            }
    
            // For now always strip macro
            let name_match = node.text.match(/\\n<(.+)>/)
            if (name_match) { // Match 0 is whole, 1 is capture
                node.name = name_match[1]
            }
            
            node.text = node.text.replace("<br>", "\n");
            // Hardcode remove macro with variable for now
            node.text = node.text.replace(/\\((?:c)|(?:com)|(?:sinv)|(?:sinh)|(?:quake))\[[^\]]*\]/gi, "");
            if (node.text && this.macroDocs) {
                node.text = node.text.replace(this.macroRegex, "");
            }
    
            acc[key] = {
                ...node,
                imageUri: webviewImgUri // Hand off the authorized URI to the HTML
            };
            return acc;
        }, {});
    
    
        panel.webview.html = this.getWebviewContent(context);
    
        // Post the processed data to HTML
        panel.webview.postMessage({ command: 'load', data: processedData });
    }
    
    private getWebviewContent(context: vscode.ExtensionContext) {
        const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'data', 'index.html');
        return fs.readFileSync(htmlPath.fsPath, 'utf8');
    }
}
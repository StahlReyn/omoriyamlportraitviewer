import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { MacroDocs } from './macro_docs';

export class DialogueWebviewManager {
    private macroRegex = new RegExp("", 'g');
    private imgPath = "../../img/faces"
    private macroDocs: MacroDocs = {}
    private panel: vscode.WebviewPanel | null = null;

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
        let openPreviewCmd = vscode.commands.registerCommand('extension.openPreview', () => this.openDialogueWebview(context));
        let saveListener = vscode.workspace.onDidSaveTextDocument((document) => this.updateWebview(document));
        context.subscriptions.push(openPreviewCmd, saveListener);
    }

    private updateWebview(document: vscode.TextDocument) {
        if (!(document.languageId === 'yaml' || document.languageId === 'yml')) return;
        if (!this.panel) return;
        vscode.window.showInformationMessage("Updated Preview for " + path.basename(document.fileName));
        const fileDir = path.dirname(document.fileName);
        const imgPath = path.join(fileDir, this.imgPath);
        const processedData = this.getDocumentData(this.panel, document, imgPath)
        this.panel.webview.postMessage({ command: 'update', data: processedData });
    }
    
    private openDialogueWebview(context: vscode.ExtensionContext) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) return;
    
        const document = activeEditor.document;
        const filePath = document.fileName;
        const fileDir = path.dirname(filePath);
        const imgPath = path.join(fileDir, this.imgPath);
        
        this.panel = vscode.window.createWebviewPanel(
            'dialoguePreview',
            `Preview: ${path.basename(filePath)}`,
            vscode.ViewColumn.Two,
            { 
                enableScripts: true,
                // Crucial: Allow the webview to read assets from your image directory
                localResourceRoots: [vscode.Uri.file(imgPath)]
            }
        );
        this.panel.webview.html = this.getWebviewContent(context);
        
        // Listen for a 'ready' signal from the webview before sending the data payload
        this.panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'ready') {
                const processedData = this.getDocumentData(this.panel!, document, imgPath);
                this.panel!.webview.postMessage({ command: 'load', data: processedData });
            }
        }, null, context.subscriptions);
    }

    private cleanDialogueText(text: string) {
        if (!text) return text;
        text = text.replace("<br>", "\n");
        // Hardcode remove macro with variable for now
        text = text.replace(/\\((?:c)|(?:com)|(?:sinv)|(?:sinh)|(?:quake))\[[^\]]*\]/gi, "");
        text = text.replace(/\\n\<[^\>]*\>/gi, "");
        if (this.macroDocs) {
            text = text.replace(this.macroRegex, "");
        }
        return text;
    }

    private getDocumentData(panel: vscode.WebviewPanel, document: vscode.TextDocument, imgPath: string) {
        let yamlData: any;
        try {
            yamlData = yaml.load(document.getText()) || {};
        } catch (e) {
            vscode.window.showErrorMessage(`YAML Parse Error: ${e}`);
            return;
        }
        return this.processYamlData(panel, yamlData, imgPath);
    }

    // Process nodes to attach valid Webview Image URIs
    private processYamlData(panel: vscode.WebviewPanel, yamlData: any, imgPath: string) {
        return Object.keys(yamlData).reduce((acc: any, key) => {
            const node = yamlData[key];
            node.name = ""
            let webviewImgUri = '';
    
            if (node.faceset) {
                const imgAbsolutePath = path.resolve(imgPath, `${node.faceset}.png`);
    
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
            
            node.text = this.cleanDialogueText(node.text);
    
            acc[key] = {
                ...node,
                imageUri: webviewImgUri // Hand off the authorized URI to the HTML
            };
            return acc;
        }, {});
    }
    
    private getWebviewContent(context: vscode.ExtensionContext) {
        const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'data', 'index.html');
        return fs.readFileSync(htmlPath.fsPath, 'utf8');
    }
}
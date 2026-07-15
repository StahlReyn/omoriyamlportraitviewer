import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

let currentTooltipSize = 0;
const tooltipSizes = [100, 200, 300, 400, 500, 0];

export function registerPortraitPreview(context: vscode.ExtensionContext, portraitPath: string) {
    // Register command to open image in the editor
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openImageYaml', (imgPath) => {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(imgPath));
        })
    );

    // Register command to resize image in the tooltip
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.resizeImageYaml', async ({ imgPath, size }) => {
            currentTooltipSize = size === 0 ? 0 : parseInt(size, 10);
            await vscode.window.showInformationMessage('Changes will only take effect after reopening the tooltip due to VS Code limitations.', { modal: true });
        })
    );

    // Register hover providers for all supported languages
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('yaml', {
            provideHover(document, position) {
                return provideHover(document, position, portraitPath);
            }
        })
    );
}

/**
 * Provides hover content when the user hovers over a comment
 */
function provideHover(document: vscode.TextDocument, position: vscode.Position, portraitPath: string) {
    if (document.languageId != 'yaml') { return; }

    const lineText = document.lineAt(position.line).text;
    return processComment(lineText, document, portraitPath);
}

// Processes the comment text to determine if it contains an image comment.
function processComment(commentText: string, document: vscode.TextDocument, portraitPath: string) {
    const commentPattern = /.*?faceset: ([\w\d]*)/;
    const match = commentText.match(commentPattern);
    if (!match) { return; }

    const imagePath = match[1];
    if (!imagePath) { return; }

    const cleanImagePath = portraitPath + imagePath.trim() + ".png";
    const documentFolderPath = path.dirname(document.uri.fsPath);
    let imgPath = path.join(documentFolderPath, cleanImagePath);

    let imgExists = false;

    try {
        imgExists = fs.existsSync(imgPath);
    } catch (error) {
        imgExists = false;
    }

    if (imgExists) {
        const imgUri = vscode.Uri.file(imgPath).toString();

        // Generate size adjustment links
        const sizeLinks = tooltipSizes.map(size =>
        {
            const displaySize = size === 0 ? 'No Scale' : `${size}px`;
            if (size === currentTooltipSize) {
                return `**[${displaySize}](command:extension.resizeImageYaml?${encodeURIComponent(JSON.stringify({ imgPath, size }))})**`;
            }

            return `[${displaySize}](command:extension.resizeImageYaml?${encodeURIComponent(JSON.stringify({ imgPath, size }))})`;

        }).join(' ');

        // Construct the hover content
        const hoverContent = [
            '## Portrait Preview',
            '',
            `[Open Image in IDE](command:extension.openImageYaml?${encodeURIComponent(JSON.stringify(imgPath))})`,
            '',
            sizeLinks,
            '',
            currentTooltipSize === 0
                ? `![Image](${imgUri})`
                : `![Image](${imgUri}|width=${currentTooltipSize}px)`,
        ].join('\n');

        // Create and return the hover object
        const markdown = new vscode.MarkdownString(hoverContent, true);
        markdown.isTrusted = true;
        return new vscode.Hover(markdown);
    } else {
        // If the image does not exist, display an error message
        const hoverContent = [
            '## Portrait Preview',
            `Could not find image file.`,
            '',
            `Path: \`${imgPath}\``,
        ].join('\n');

        const markdown = new vscode.MarkdownString(hoverContent, true);
        markdown.isTrusted = true;
        return new vscode.Hover(markdown);
    }
}

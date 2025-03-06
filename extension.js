// Import necessary modules
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

// Initialize the default tooltip size
let currentTooltipSize = 0;

// Define available tooltip sizes
const tooltipSizes = [100, 200, 300, 400, 500, 0];

/**
 * Activates the extension
 */
function activate(context) {
	console.log("ACTIVATE PROVIDER")
	vscode.window.showInformationMessage('Hello World!');

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
				return provideHover(document, position);
			}
		})
	);
}

/**
 * Provides hover content when the user hovers over a comment
 */
function provideHover(document, position) {
	if (document.languageId != 'yaml') { return; }

	const lineText = document.lineAt(position.line).text;
	return processComment(lineText, document);
}

// Processes the comment text to determine if it contains an image comment.
function processComment(commentText, document) {
	const commentPattern = /.*?faceset: ([\w\d]*)/;
	const match = commentText.match(commentPattern);
	if (!match) { return; }

	const imagePath = match[1];
	if (!imagePath) { return; }

	const cleanImagePath = "../../img/faces/" + imagePath.trim() + ".png";
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
			if (size === currentTooltipSize)
			{
				return `**[${displaySize}](command:extension.resizeImageYaml?${encodeURIComponent(JSON.stringify({ imgPath, size }))})**`;
			}

			return `[${displaySize}](command:extension.resizeImageYaml?${encodeURIComponent(JSON.stringify({ imgPath, size }))})`;

		}).join(' ');

		// Construct the hover content
		const hoverContent = [
			'## Omori Faceset',
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
			'## Image Comments',
			`Could not find image file.`,
			'',
			`**Path**: ${imgPath}`,
		].join('\n');

		const markdown = new vscode.MarkdownString(hoverContent, true);
		markdown.isTrusted = true;
		return new vscode.Hover(markdown);
	}
}

exports.activate = activate;
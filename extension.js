// Import necessary modules
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

// Initialize the default tooltip size
let currentTooltipSize = 0;

// Define available tooltip sizes
const tooltipSizes = [100, 200, 300, 400, 500, 0];

function activate(context) {
	// Highlight color
	processHighlight(context)

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
			if (size === currentTooltipSize) {
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

function processHighlight(context) {
	const macroDecorationType = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'rgba(255, 81, 0, 0.18)', 
		border: '1px solid rgba(255, 140, 0, 0.4)',
		borderRadius: '3px',
		color: '#FFCC00'
	});

	const innerDecorationType = vscode.window.createTextEditorDecorationType({
		color: '#00FFFF' // Inner bracket content color (e.g., Cyan)
	});

	let activeEditor = vscode.window.activeTextEditor;

	function updateDecorations() {
		if (!activeEditor || activeEditor.document.languageId !== 'yaml') {
			return;
		}

		const text = activeEditor.document.getText();
		const decorations = [];

		// Regex matching all the variations (\!, \c[12], \fn<font>, <br>, etc.)
		const macroRegex = new RegExp([
			/\\[a-zA-Z%]+(?:<[^>]+>|\[[^\]]+\])/, // Tagged styles like \fn<font> or \c[12]
			/|/,
			/\\[! . | { } $ > < ^ g]/,           // Single-character escaped macros like \!
			/|/,
			/<br>/                               // Literal HTML-style line breaks
		].map(regex => regex.source).join(''), 'g'); // Joins patterns + global 'g' flag
		
		let match;

		while ((match = macroRegex.exec(text))) {
			const startPos = activeEditor.document.positionAt(match.index);
			const endPos = activeEditor.document.positionAt(match.index + match[0].length);
			const decoration = { range: new vscode.Range(startPos, endPos) };
			decorations.push(decoration);
		}

		// Paint the chunks directly onto the editor canvas
		activeEditor.setDecorations(macroDecorationType, decorations);
	}

	// Trigger update on launch, switching tabs, or typing text
	if (activeEditor) { updateDecorations(); }
	vscode.window.onDidChangeActiveTextEditor(editor => { activeEditor = editor; updateDecorations(); }, null, context.subscriptions);
	vscode.workspace.onDidChangeTextDocument(event => { if (activeEditor && event.document === activeEditor.document) { updateDecorations(); } }, null, context.subscriptions);
}

exports.activate = activate;

function deactivate() { }
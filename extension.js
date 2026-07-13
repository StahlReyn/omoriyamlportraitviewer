// Import necessary modules
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

// Initialize the default tooltip size
let currentTooltipSize = 0;

// Define available tooltip sizes
const tooltipSizes = [100, 200, 300, 400, 500, 0];

// Global object to store the parsed documentation definitions
let macroDocs = {};
const fallbackDoc = { 
	title: 'Macro Operator', 
	desc: '*Unknown Macro. This may be defined by an external plugin.*',
	source: 'Unknown'
}

function activate(context) {
	try {
        // Build an absolute file path
        const docFilePath = path.join(context.extensionPath, 'macro-docs.json');
        const docContentRaw = fs.readFileSync(docFilePath, 'utf8');
        macroDocs = JSON.parse(docContentRaw);
    } catch (error) {
        console.error("Failed loading macro-docs.json asset layer:", error);
        macroDocs = {}; // Fallback to avoid crashing
    }

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

const macroBoxDecorationType = vscode.window.createTextEditorDecorationType({
	backgroundColor: 'rgba(123, 39, 0, 0.15)', 
	border: '1px solid rgba(255, 140, 0, 0.3)',
	borderRadius: '3px',
});

const simpleMacroDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(37, 100, 44, 0.12)',
    border: '1px solid rgba(0, 146, 85, 0.4)',
    borderRadius: '3px',
    color: '#459272'
});

const macroTextDecorationType = vscode.window.createTextEditorDecorationType({
	color: '#A87B00'
});

const innerTextDecorationType = vscode.window.createTextEditorDecorationType({
	color: '#FFEC73'
});

function processHighlight(context) {
	let activeEditor = vscode.window.activeTextEditor;
	
	function updateDecorations() {
		if (!activeEditor || activeEditor.document.languageId !== 'yaml') {
			return;
		}

		const text = activeEditor.document.getText();
		const boxDecorations = [];
		const macroTextDecorations = [];
		const innerTextDecorations = [];
		const simpleMacroDecorations = [];

		const macroRegex = new RegExp([
			/(\\[a-zA-Z%]+)(?:<([^>]+)>|\[([^\]]+)\])/, // Group 1: Prefix, Group 2: Inner <>, Group 3: Inner []
			/|/,
			/(\\[! . | { } $ > < ^ g])/,               // Group 4: Single-char escape
			/|/,
			/(<br>)/                                   // Group 5: Line breaks
		].map(regex => regex.source).join(''), 'g');

		let match;

		while ((match = macroRegex.exec(text))) {
			const fullMatchStr = match[0];
			const startIdx = match.index;

			const macroPrefix = match[1]; 
			const innerAngleText = match[2]; 
			const innerSquareText = match[3];

			// Fetch custom documentation card based on the tag prefix or simple name
			const docLookupKey = macroPrefix ? macroPrefix.toLowerCase() : fullMatchStr.toLowerCase();
			const docInfo = macroDocs[docLookupKey] || fallbackDoc;

			// --- BRANCH 1: MACROS WITH PARAMETERS ---
			if (innerAngleText !== undefined || innerSquareText !== undefined) {
				const isAngle = innerAngleText !== undefined;
				const openBracket = isAngle ? '<' : '[';
				const closeBracket = isAngle ? '>' : ']';
				const parameterValue = isAngle ? innerAngleText : innerSquareText;

				const openBracketIdx = startIdx + fullMatchStr.indexOf(openBracket);
				const closeBracketIdx = startIdx + fullMatchStr.lastIndexOf(closeBracket);

				// 1. Unified outer background capsule box with full macro documentation card
				const boxRange = new vscode.Range(
					activeEditor.document.positionAt(startIdx),
					activeEditor.document.positionAt(startIdx + fullMatchStr.length)
				);

				const unifiedHover = new vscode.MarkdownString();
				unifiedHover.appendMarkdown(`### ${docInfo.title}\n\n`);
				unifiedHover.appendMarkdown(`${docInfo.desc}\n\n`);
				unifiedHover.appendMarkdown(`---\n`);
				unifiedHover.appendMarkdown(`* **Syntax:** \`${macroPrefix}${openBracket}value${closeBracket}\`\n`);
				unifiedHover.appendMarkdown(`* **Current Value:** \`${parameterValue}\``);
				unifiedHover.appendMarkdown(`\n\nSource: \`${docInfo.source || "Unknown"}\``);

				boxDecorations.push({ 
					range: boxRange,
					hoverMessage: unifiedHover // Tooltip applies to the entire background area
				});

				// 2. Prefix and opening bracket text style range (\fn< or \c[) - No unique hover needed
				const prefixRange = new vscode.Range(
					activeEditor.document.positionAt(startIdx),
					activeEditor.document.positionAt(openBracketIdx + 1)
				);
				macroTextDecorations.push({ range: prefixRange });

				// 3. Isolated inner variable parameter value text style range
				const innerRange = new vscode.Range(
					activeEditor.document.positionAt(openBracketIdx + 1),
					activeEditor.document.positionAt(closeBracketIdx)
				);
				innerTextDecorations.push({ range: innerRange });

				// 4. Closing bracket component text style range explicitly (>] or ])
				const suffixRange = new vscode.Range(
					activeEditor.document.positionAt(closeBracketIdx),
					activeEditor.document.positionAt(closeBracketIdx + 1)
				);
				macroTextDecorations.push({ range: suffixRange });

			// --- BRANCH 2: SIMPLE PARAMETERLESS MACROS (\!, <br>) ---
			} else {
				const simpleRange = new vscode.Range(
					activeEditor.document.positionAt(startIdx),
					activeEditor.document.positionAt(startIdx + fullMatchStr.length)
				);

				const simpleHover = new vscode.MarkdownString();
				simpleHover.appendMarkdown(`### ${docInfo.title}\n\n`);
				simpleHover.appendMarkdown(`${docInfo.desc}\n\n`);
				simpleHover.appendMarkdown(`---\nSource: \`${docInfo.source || "Unknown"}\``);

				simpleMacroDecorations.push({ 
					range: simpleRange,
					hoverMessage: simpleHover
				});
			}
		}

		// Render channels onto canvas viewport
		activeEditor.setDecorations(macroBoxDecorationType, boxDecorations);
		activeEditor.setDecorations(macroTextDecorationType, macroTextDecorations);
		activeEditor.setDecorations(innerTextDecorationType, innerTextDecorations);
		activeEditor.setDecorations(simpleMacroDecorationType, simpleMacroDecorations);
	}

	// Trigger update on launch, switching tabs, or typing text
	if (activeEditor) { updateDecorations(); }
	vscode.window.onDidChangeActiveTextEditor(editor => { activeEditor = editor; updateDecorations(); }, null, context.subscriptions);
	vscode.workspace.onDidChangeTextDocument(event => { if (activeEditor && event.document === activeEditor.document) { updateDecorations(); } }, null, context.subscriptions);
}

exports.activate = activate;

function deactivate() { }
import * as vscode from 'vscode';
import { MacroDocs, MacroInfo } from './macro_docs';

export class MacroHighlightManager {
    private macroDocs: MacroDocs = {};

    private static readonly fallbackDoc: MacroInfo = { 
        title: 'Macro Operator', 
        desc: '*Unknown Macro. This may be defined by an external plugin.*',
        source: 'Unknown'
    }
    
    private static readonly macroBoxDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(123, 39, 0, 0.15)', 
        border: '1px solid rgba(255, 140, 0, 0.3)',
        borderRadius: '3px',
    });
    
    private static readonly simpleMacroDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(37, 100, 44, 0.12)',
        border: '1px solid rgba(0, 146, 85, 0.4)',
        borderRadius: '3px',
        color: '#459272'
    });
    
    private static readonly macroTextDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#A87B00'
    });
    
    private static readonly innerTextDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#FFEC73'
    });
    
    private static readonly macroRegex = new RegExp([
        /(\\[a-zA-Z%]+)(?:<([^>]+)>|\[([^\]]+)\])/, // Group 1: Prefix, Group 2: Inner <>, Group 3: Inner []
        /|/,
        /(\\[! . | { } $ > < ^ g])/,               // Group 4: Single-char escape
        /|/,
        /(<br>)/                                   // Group 5: Line breaks
    ].map(regex => regex.source).join(''), 'g');

    public constructor(macroDocs) {
        this.macroDocs = macroDocs;
    }
    
    public processHighlight(context: vscode.ExtensionContext) {
        let activeEditor = vscode.window.activeTextEditor;
    
        // Trigger update on launch, switching tabs, or typing text
        if (activeEditor) { this.updateDecorations(activeEditor); }
    
        vscode.window.onDidChangeActiveTextEditor(editor => { 
            activeEditor = editor; this.updateDecorations(activeEditor); 
        }, null, context.subscriptions);
    
        vscode.workspace.onDidChangeTextDocument(event => { 
            if (activeEditor && event.document === activeEditor.document) { this.updateDecorations(activeEditor); } 
        }, null, context.subscriptions);
    }
    
    private updateDecorations(activeEditor: vscode.TextEditor | undefined) {
        if (!activeEditor || activeEditor.document.languageId !== 'yaml') {
            return;
        }
    
        const text = activeEditor.document.getText();
        const boxDecorations: vscode.DecorationOptions[] = [];
        const macroTextDecorations: vscode.DecorationOptions[] = [];
        const innerTextDecorations: vscode.DecorationOptions[] = [];
        const simpleMacroDecorations: vscode.DecorationOptions[] = [];
    
        let match;
    
        while ((match = MacroHighlightManager.macroRegex.exec(text))) {
            const fullMatchStr = match[0];
            const startIdx = match.index;
    
            const macroPrefix = match[1]; 
            const innerAngleText = match[2]; 
            const innerSquareText = match[3];
    
            // Fetch custom documentation card based on the tag prefix or simple name
            const docLookupKey = macroPrefix ? macroPrefix.toLowerCase() : fullMatchStr.toLowerCase();
            const docInfo = this.macroDocs[docLookupKey] || MacroHighlightManager.fallbackDoc;
    
            // --- BRANCH 1: MACROS WITH PARAMETERS ---
            if (innerAngleText !== undefined || innerSquareText !== undefined) {
                const isAngle = innerAngleText !== undefined;
                const openBracket = isAngle ? '<' : '[';
                const closeBracket = isAngle ? '>' : ']';
                const parameterValue = isAngle ? innerAngleText : innerSquareText;
    
                const openBracketIdx = startIdx + fullMatchStr.indexOf(openBracket);
                const closeBracketIdx = startIdx + fullMatchStr.lastIndexOf(closeBracket);
    
                // 1. Unified outer background capsule box with full macro documentation card
                const syntax = `${macroPrefix}${openBracket}value${closeBracket}`
                const value = `${parameterValue}`
    
                boxDecorations.push({ 
                    range: MacroHighlightManager.rangeFromIndex(activeEditor, startIdx, startIdx + fullMatchStr.length),
                    hoverMessage: MacroHighlightManager.createHover(docInfo, syntax, value) // Tooltip applies to the entire background area
                });
    
                macroTextDecorations.push({ range: MacroHighlightManager.rangeFromIndex(activeEditor, startIdx, openBracketIdx + 1) });
                innerTextDecorations.push({ range: MacroHighlightManager.rangeFromIndex(activeEditor, openBracketIdx + 1, closeBracketIdx) });
                macroTextDecorations.push({ range: MacroHighlightManager.rangeFromIndex(activeEditor, closeBracketIdx, closeBracketIdx + 1) });
    
            // --- BRANCH 2: SIMPLE PARAMETERLESS MACROS (\!, <br>) ---
            } else {
                simpleMacroDecorations.push({ 
                    range: MacroHighlightManager.rangeFromIndex(activeEditor, startIdx, startIdx + fullMatchStr.length),
                    hoverMessage: MacroHighlightManager.createHover(docInfo)
                });
            }
        }
    
        // Render channels onto canvas viewport
        activeEditor.setDecorations(MacroHighlightManager.macroBoxDecorationType, boxDecorations);
        activeEditor.setDecorations(MacroHighlightManager.macroTextDecorationType, macroTextDecorations);
        activeEditor.setDecorations(MacroHighlightManager.innerTextDecorationType, innerTextDecorations);
        activeEditor.setDecorations(MacroHighlightManager.simpleMacroDecorationType, simpleMacroDecorations);
    }
    
    private static rangeFromIndex(editor: vscode.TextEditor, start: number, end: number) {
        return new vscode.Range(
            editor.document.positionAt(start),
            editor.document.positionAt(end)
        );
    }
    
    private static createHover(docInfo: MacroInfo, syntax?: string, value?: string) {
        const hover = new vscode.MarkdownString();
        hover.appendMarkdown(`### ${docInfo.title}\n\n`);
        hover.appendMarkdown(`${docInfo.desc}\n\n`);
        hover.appendMarkdown(`---\n`);
    
        if (syntax) hover.appendMarkdown(`* **Syntax:** \`${syntax}\`\n`);
        if (value) hover.appendMarkdown(`* **Current Value:** \`${value}\``);
    
        hover.appendMarkdown(`\n\nSource: \`${docInfo.source || "Unknown"}\``);
    
        return hover;
    }
}

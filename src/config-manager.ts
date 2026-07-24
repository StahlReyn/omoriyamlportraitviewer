import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ConfigManager<T extends Record<string, any>> {
    private cache: T | null = null;
    private extensionContext: vscode.ExtensionContext;
    private relativeFilePath: string;
    private configSection: string;
    private configKey: string;

    constructor(
        context: vscode.ExtensionContext,
        options: {
            relativeFilePath: string;
            configSection: string;
            configKey: string;
        }
    ) {
        this.extensionContext = context;
        this.relativeFilePath = options.relativeFilePath;
        this.configSection = options.configSection;
        this.configKey = options.configKey;

        this.initListener();
    }

    private initListener(): void {
        const fullConfigPath = `${this.configSection}.${this.configKey}`;
        this.extensionContext.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration(fullConfigPath)) {
                    this.cache = null;
                    console.log(`Cache invalidated for: ${fullConfigPath}`);
                }
            })
        );
    }

    public get(): T {
        if (this.cache !== null) {
            return this.cache;
        }

        let baseData: Record<string, any> = {};

        try {
            const absolutePath = path.join(this.extensionContext.extensionPath, this.relativeFilePath);
            if (fs.existsSync(absolutePath)) {
                const rawContent = fs.readFileSync(absolutePath, 'utf8');
                baseData = JSON.parse(rawContent);
            }
        } catch (error) {
            console.error(`Failed loading asset layer from ${this.relativeFilePath}:`, error);
        }

        const config = vscode.workspace.getConfiguration(this.configSection);
        const userOverrides = config.get<Record<string, any>>(this.configKey) || {};

        const finalData = { ...baseData };
        
        // Merge Layer
        for (const [key, value] of Object.entries(userOverrides)) {
            // Check if value is a nested object (like MacroInfo) and not null
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                finalData[key] = {
                    ...(finalData[key] || {}),
                    ...value
                };
            } else {
                // If value is a simple string (like ReplacementMacros) or primitive, overwrite completely
                finalData[key] = value;
            }
        }

        this.cache = finalData as T;
        return this.cache;
    }
}

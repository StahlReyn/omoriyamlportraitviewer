interface ParserState {
    size: number;
    color: number;
    // TDS tags
    sinv: number;
    sinh: number;
    quake: number;
    hasOpenTag: boolean;
    /** Emits the closing tag of the previous state and opens the new state */
    renderStateTransition(): string;
}

interface MacroRule {
    /** The regex pattern to match this macro (e.g. /\\\{/ or /\\sinv\[(\d+)\]/) */
    pattern: RegExp;
    /** Processes the match array and mutates the state, returning the HTML token */
    action: (state: ParserState, match: RegExpExecArray) => string;
}

// Rules List
const rules: MacroRule[] = [
    {
        pattern: /\\\{/g,
        action: (s) => { s.size *= 1.3; return s.renderStateTransition(); }
    },
    {
        pattern: /\\\}/g,
        action: (s) => { s.size /= 1.3; return s.renderStateTransition(); }
    },
    {
        pattern: /\\c\[(\d+)\]/g, // Matches \c[x]
        action: (s, match) => { s.color = parseInt(match[1]); return s.renderStateTransition(); }
    },
    {
        pattern: /\\sinv\[(\d+)\]/g, // Matches \sinv[x]
        action: (s, match) => { s.sinv = parseInt(match[1]); return s.renderStateTransition(); }
    },
    {
        pattern: /\\sinh\[(\d+)\]/g, // Matches \sinh[x]
        action: (s, match) => { s.sinh = parseInt(match[1]); return s.renderStateTransition(); }
    },
    {
        pattern: /\\quake\[(\d+)\]/g, // Matches \quake[x]
        action: (s, match) => { s.quake = parseInt(match[1]); return s.renderStateTransition(); }
    }
];

const emptyRules: RegExp[] = [
    /\\\</g, /\\\>/g, /\\\./g, /\\\!/g, /\\\^/g, /\\com\[(\d+)\]/g
]

// Combine patterns into one master scanner.
const masterPattern = new RegExp(
    rules.map(r => r.pattern.source).join('|'),
    'gi'
);

const masterEmptyPattern = new RegExp(
    emptyRules.map(r => r.source).join('|'),
    'gi'
);

export function parseCustomMacros(text: string): string {
    // Initial State
    const state: ParserState = {
        size: 1.0,
        sinv: 0,
        sinh: 0,
        quake: 0,
        color: 0,
        hasOpenTag: false,
        renderStateTransition() {
            const closeTag = this.hasOpenTag ? '</span>' : '';
            this.hasOpenTag = true;

            let classes: string[] = [];
            if (this.sinv != 0) classes.push("sinv");
            if (this.sinh != 0) classes.push("sinh");
            if (this.quake != 0) classes.push("quake");
            if (this.color != 0) classes.push("c" + this.color);
            // console.log("Text Classes", classes);

            const styles = ` style="font-size: ${this.size.toFixed(2)}em;"`;
            const classDisplay = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
            return `${closeTag}<span${classDisplay}${styles}>`;
        },
    };

    let htmlOutput = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // Initial clean of empty macros
    text = text.replaceAll(masterEmptyPattern, "")
    
    // Loop across the document text
    while ((match = masterPattern.exec(text)) !== null) {
        // Append the raw plain text found before this macro matched
        htmlOutput += text.substring(lastIndex, match.index);

        // Find which rule triggered the match
        const matchedText = match[0];
        for (const rule of rules) {
            rule.pattern.lastIndex = 0; // Reset stateful flag
            const ruleMatch = rule.pattern.exec(matchedText);

            if (ruleMatch) {
                // Execute rule action and inject its specific state HTML
                htmlOutput += rule.action(state, ruleMatch);
                break;
            }
        }
        // Move the pointer forward past the entire matched macro block
        lastIndex = masterPattern.lastIndex;
    }

    // Append remaining text content past the final macro
    htmlOutput += text.substring(lastIndex);
    // Ensure tag balancing closure
    return state.hasOpenTag ? `${htmlOutput}</span>` : htmlOutput;
}
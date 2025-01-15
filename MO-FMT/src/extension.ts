import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // コマンドの登録
    let formatCommand = vscode.commands.registerCommand('mo-fmt.format', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            editor.edit(editBuilder => {
                const text = document.getText();
                const formattedText = formatModelicaCode(text);
                const fullRange = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                editBuilder.replace(fullRange, formattedText);
            });
        }
    });

    // フォーマッターの登録
    let formatProvider = vscode.languages.registerDocumentFormattingEditProvider('modelica', {
        provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
            const text = document.getText();
            const formattedText = formatModelicaCode(text);
            
            const firstLine = document.lineAt(0);
            const lastLine = document.lineAt(document.lineCount - 1);
            const range = new vscode.Range(firstLine.range.start, lastLine.range.end);
            
            return [vscode.TextEdit.replace(range, formattedText)];
        }
    });

    context.subscriptions.push(formatCommand, formatProvider);
}


function formatModelicaCode(text: string): string {
    const lines = text.split('\n');
    const formattedLines: string[] = [];
    let indentLevel = 0;
    let annotationLevel = 0;

    function getIndent(level: number): string {
        return '  '.repeat(level);
    }

    function formatLongExpression(expr: string, baseIndent: number): string[] {
        const maxLength = 60;
        const parts = expr.split(/([(),{}])/);
        let currentLine = '';
        const result: string[] = [];
        const indent = getIndent(baseIndent);

        for (const part of parts) {
            if (currentLine.length + part.length > maxLength) {
                if (currentLine.trim()) {
                    result.push(indent + currentLine.trim());
                }
                currentLine = part;
            } else {
                currentLine += part;
            }
        }

        if (currentLine.trim()) {
            result.push(indent + currentLine.trim());
        }

        return result;
    }

    for (let line of lines) {
        let trimmedLine = line.trim();

        // インデントレベルの調整
        if (trimmedLine.startsWith('package ')) {
            indentLevel = 0;
        } else if (trimmedLine.startsWith('model ')) {
            indentLevel = 1;
        } else if (trimmedLine.startsWith('end ')) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        // アノテーション処理
        if (trimmedLine.includes('annotation(')) {
            const parts = trimmedLine.split('annotation(');
            formattedLines.push(getIndent(indentLevel) + parts[0].trim());
            formattedLines.push(getIndent(indentLevel) + 'annotation(');
            annotationLevel = indentLevel + 1;
            trimmedLine = parts[1];
        }

        if (trimmedLine.includes('Placement(')) {
            const parts = trimmedLine.split('Placement(');
            formattedLines.push(getIndent(annotationLevel) + 'Placement(');
            annotationLevel++;
            trimmedLine = parts[1];
        }

        if (trimmedLine.includes('transformation(')) {
            const parts = trimmedLine.split('transformation(');
            formattedLines.push(getIndent(annotationLevel) + 'transformation(');
            annotationLevel++;
            trimmedLine = parts[1];
        }

        // 長い行の処理
        if (trimmedLine.length > 60) {
            formattedLines.push(...formatLongExpression(trimmedLine, indentLevel));
        } else {
            formattedLines.push(getIndent(indentLevel) + trimmedLine);
        }

        // セミコロンでの改行
        if (trimmedLine.includes(';')) {
            const parts = trimmedLine.split(';');
            for (let i = 0; i < parts.length - 1; i++) {
                if (parts[i].trim()) {
                    formattedLines.push(getIndent(indentLevel) + parts[i].trim() + ';');
                }
            }
            if (parts[parts.length - 1].trim()) {
                formattedLines.push(getIndent(indentLevel) + parts[parts.length - 1].trim());
            }
        }

        // アノテーションレベルのリセット
        if (trimmedLine.endsWith('))')) {
            annotationLevel = indentLevel;
        }
    }

    return formattedLines.join('\n');
}

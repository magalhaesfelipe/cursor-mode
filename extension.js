const vscode = require("vscode");
const { execFile } = require("child_process");

let on = false;

async function applyColor() {
	const cfg = vscode.workspace.getConfiguration("scrollLockCursor");
	const color = on ? cfg.get("onColor") : cfg.get("offColor");
	const wb = vscode.workspace.getConfiguration("workbench");
	const current = wb.get("colorCustomizations") || {};
	if (current["editorCursor.foreground"] === color) return;
	await wb.update(
		"colorCustomizations",
		{ ...current, "editorCursor.foreground": color },
		vscode.ConfigurationTarget.Global,
	);
}

// Windows only: read the real Scroll Lock state once (startup / window focus)
// to correct any drift from presses made while VS Code wasn't focused.
function syncFromOS() {
	if (process.platform !== "win32") return;
	const script = `
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class K { [DllImport("user32.dll")] public static extern short GetKeyState(int k); }
"@
[K]::GetKeyState(0x91) -band 1`;
	const encoded = Buffer.from(script, "utf16le").toString("base64");
	execFile(
		"powershell.exe",
		["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
		{ windowsHide: true },
		(err, out) => {
			if (err) return;
			on = out.trim() === "1";
			applyColor();
		},
	);
}

function activate(context) {
	context.subscriptions.push(
		vscode.commands.registerCommand("scrollLockCursor.toggle", () => {
			on = !on;
			applyColor();
		}),
		vscode.window.onDidChangeWindowState((s) => {
			if (s.focused) syncFromOS();
		}),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("scrollLockCursor")) applyColor();
		}),
	);
	syncFromOS();
	applyColor();
}

function deactivate() {}
module.exports = { activate, deactivate };

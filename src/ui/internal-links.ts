import { Keymap, TFile, type App, type WorkspaceLeaf } from "obsidian";

export interface InternalLinkRenderContext {
	app: App;
	leaf: WorkspaceLeaf;
	source: string;
	sourcePath: string;
}

export function renderInternalNoteLink(
	containerEl: HTMLElement,
	context: InternalLinkRenderContext,
	path: string,
	label?: string,
): HTMLElement {
	const abstractFile = context.app.vault.getAbstractFileByPath(path);
	if (!(abstractFile instanceof TFile)) {
		return containerEl.createSpan({
			text: label ?? path,
			cls: "diary-stats-missing-link",
		});
	}

	const linktext = context.app.metadataCache.fileToLinktext(abstractFile, context.sourcePath);
	const linkEl = containerEl.createEl("a", {
		text: label ?? abstractFile.basename,
		cls: "internal-link diary-stats-internal-link",
		href: linktext,
	});
	linkEl.dataset.href = linktext;
	linkEl.setAttr("title", path);
	linkEl.addEventListener("click", (event) => {
		event.preventDefault();
		const paneType = Keymap.isModifier(event, "Mod") ? "tab" : false;
		void context.app.workspace.openLinkText(linktext, context.sourcePath, paneType);
	});

	const maybeTriggerHoverPreview = (event: MouseEvent): void => {
		if (!Keymap.isModifier(event, "Mod")) {
			delete linkEl.dataset.previewTriggered;
			return;
		}

		if (linkEl.dataset.previewTriggered === "true") {
			return;
		}

		linkEl.dataset.previewTriggered = "true";
		context.app.workspace.trigger("hover-link", {
			event,
			source: context.source,
			hoverParent: context.leaf,
			targetEl: linkEl,
			linktext,
			sourcePath: context.sourcePath,
		});
	};

	linkEl.addEventListener("mouseover", maybeTriggerHoverPreview);
	linkEl.addEventListener("mousemove", maybeTriggerHoverPreview);
	linkEl.addEventListener("mouseleave", () => {
		delete linkEl.dataset.previewTriggered;
	});

	return linkEl;
}

export function renderInternalLinkList(
	containerEl: HTMLElement,
	context: InternalLinkRenderContext,
	paths: string[],
): void {
	if (paths.length === 0) {
		containerEl.createSpan({ text: "(none)", cls: "diary-stats-muted" });
		return;
	}

	paths.forEach((path, index) => {
		renderInternalNoteLink(containerEl, context, path);
		if (index < paths.length - 1) {
			containerEl.createSpan({ text: " | ", cls: "diary-stats-link-separator" });
		}
	});
}

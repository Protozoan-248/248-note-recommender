import { ItemView, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import type { RecommendationResult } from "../types";

export const VIEW_TYPE_NOTE_RECOMMENDER = "note-recommender-view";

export class NoteRecommenderView extends ItemView {
	private result: RecommendationResult | null = null;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_NOTE_RECOMMENDER;
	}

	getDisplayText(): string {
		return "Note recommender";
	}

	getIcon(): string {
		return "sparkles";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.createEl("h2", { text: "Note recommender" });
		this.contentEl.createEl("p", { text: "Recommendations will appear here once the plugin runs." });
	}

	setResult(result: RecommendationResult): void {
		this.result = result;
		this.render();
	}

	private render(): void {
		this.contentEl.empty();
		this.contentEl.createEl("h2", { text: "Note recommender" });

		if (!this.result) {
			this.contentEl.createEl("p", { text: "No recommendations yet." });
			return;
		}

		const current = this.result.currentPath ?? "(none)";
		this.contentEl.createEl("p", { text: `Current note: ${current}` });

		const list = this.contentEl.createEl("ul");
		for (const recommendation of this.result.recommendations) {
			const item = list.createEl("li");
			item.addClass("mod-cta");

			const title = item.createEl("a", {
				href: "",
				text: recommendation.path,
			});
			title.addEventListener("click", (event) => {
				event.preventDefault();
				void this.openNote(recommendation.path);
			});

			item.createEl("div", { text: `Score: ${recommendation.score.toFixed(1)}` });

			const details = item.createEl("details");
			details.createEl("summary", { text: "Reasoning" });
			details.createEl("div", { text: recommendation.explanation });
		}
	}

	private async openNote(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			return;
		}

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
		if (leaf.view instanceof MarkdownView) {
			leaf.view.setEphemeralState({});
		}
	}
}

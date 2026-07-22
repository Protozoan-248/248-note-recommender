import { App, normalizePath, TFolder } from "obsidian";

export async function writeExportFile(
	app: App,
	exportFolderPath: string,
	baseFileName: string,
	extension: "md" | "csv",
	content: string,
): Promise<string> {
	const normalizedFolderPath = normalizeExportFolderPath(exportFolderPath);
	if (normalizedFolderPath.length > 0) {
		await ensureFolderPath(app, normalizedFolderPath);
	}

	const timestamp = buildExportTimestamp(new Date());
	const fileName = `${baseFileName}-${timestamp}.${extension}`;
	const preferredPath = normalizedFolderPath.length > 0
		? normalizePath(`${normalizedFolderPath}/${fileName}`)
		: fileName;
	const filePath = resolveUniqueFilePath(app, preferredPath);

	await app.vault.create(filePath, content);
	return filePath;
}

function normalizeExportFolderPath(path: string): string {
	return path.replace(/\\/gu, "/").trim().replace(/^\/+|\/+$/gu, "");
}

async function ensureFolderPath(app: App, folderPath: string): Promise<void> {
	const segments = folderPath.split("/").filter((segment) => segment.length > 0);
	let currentPath = "";

	for (const segment of segments) {
		currentPath = currentPath.length > 0 ? `${currentPath}/${segment}` : segment;
		const existing = app.vault.getAbstractFileByPath(currentPath);
		if (!existing) {
			await app.vault.createFolder(currentPath);
			continue;
		}

		if (!(existing instanceof TFolder)) {
			throw new Error(`Cannot create export folder because a file already exists at ${currentPath}.`);
		}
	}
}

function resolveUniqueFilePath(app: App, preferredPath: string): string {
	if (!app.vault.getAbstractFileByPath(preferredPath)) {
		return preferredPath;
	}

	const lastDotIndex = preferredPath.lastIndexOf(".");
	const basePath = lastDotIndex === -1 ? preferredPath : preferredPath.slice(0, lastDotIndex);
	const extension = lastDotIndex === -1 ? "" : preferredPath.slice(lastDotIndex);

	for (let suffix = 2; suffix < 1000; suffix += 1) {
		const candidatePath = `${basePath}-${suffix}${extension}`;
		if (!app.vault.getAbstractFileByPath(candidatePath)) {
			return candidatePath;
		}
	}

	throw new Error(`Unable to find a unique export file path for ${preferredPath}.`);
}

function buildExportTimestamp(date: Date): string {
	const year = date.getFullYear();
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	const hours = `${date.getHours()}`.padStart(2, "0");
	const minutes = `${date.getMinutes()}`.padStart(2, "0");
	const seconds = `${date.getSeconds()}`.padStart(2, "0");
	return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

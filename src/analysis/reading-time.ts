export function normalizeReadingWordsPerMinute(wordsPerMinute: number): number {
	if (!Number.isFinite(wordsPerMinute) || wordsPerMinute <= 0) {
		return 230;
	}

	return Math.max(1, Math.round(wordsPerMinute));
}

export function estimateReadingTimeMinutes(wordCount: number, wordsPerMinute: number): number {
	if (wordCount <= 0) {
		return 0;
	}

	return wordCount / normalizeReadingWordsPerMinute(wordsPerMinute);
}

export function formatReadingTime(minutes: number): string {
	if (minutes <= 0) {
		return "0 min";
	}

	const roundedMinutes = Math.max(1, Math.round(minutes));
	if (roundedMinutes < 60) {
		return `${roundedMinutes} min`;
	}

	if (roundedMinutes < 24 * 60) {
		const hours = Math.floor(roundedMinutes / 60);
		const remainingMinutes = roundedMinutes % 60;
		return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
	}

	const days = Math.floor(roundedMinutes / (24 * 60));
	const remainingHours = Math.floor((roundedMinutes % (24 * 60)) / 60);
	return remainingHours > 0 ? `${days} d ${remainingHours} h` : `${days} d`;
}

export function formatElapsedDuration(milliseconds: number): string {
	if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
		return "0 s";
	}

	if (milliseconds < 1000) {
		return `${Math.max(1, Math.round(milliseconds))} ms`;
	}

	const totalSeconds = milliseconds / 1000;
	if (totalSeconds < 60) {
		return `${totalSeconds.toFixed(totalSeconds < 10 ? 1 : 0)} s`;
	}

	const totalMinutes = Math.floor(totalSeconds / 60);
	const remainingSeconds = Math.round(totalSeconds % 60);
	if (totalMinutes < 60) {
		return remainingSeconds > 0 ? `${totalMinutes} min ${remainingSeconds} s` : `${totalMinutes} min`;
	}

	const totalHours = Math.floor(totalMinutes / 60);
	const remainingMinutes = totalMinutes % 60;
	return remainingMinutes > 0 ? `${totalHours} h ${remainingMinutes} min` : `${totalHours} h`;
}

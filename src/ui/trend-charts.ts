import { BarChart, LineChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type {
	AverageEntryLengthMethod,
	HourlyActivityData,
	MonthLengthProfileData,
	StructuralTrendData,
	TagCoverageTrendData,
	TextAwareTrendData,
	YearlyTrendData,
} from "../types";
import { formatReadingTime } from "../analysis/reading-time";
import type { DisposableChart } from "./heatmap-charts";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export function renderYearlyTotalsChart(containerEl: HTMLElement, data: YearlyTrendData): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 56,
			top: 38,
			bottom: 40,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) =>
				buildTooltipLines(
					params[0]?.axisValueLabel ?? "",
					params.map((param) => `${param.seriesName}: ${formatSeriesValue(param.seriesName, param.value)}`),
				),
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => point.year.toString()),
		},
		yAxis: [
			{
				type: "value",
				name: "Entries",
			},
			{
				type: "value",
				name: "Words",
			},
		],
		series: [
			{
				name: "Entries",
				type: "bar",
				data: data.points.map((point) => point.entryCount),
				barMaxWidth: 28,
				itemStyle: {
					color: "#ba6d27",
					borderRadius: [5, 5, 0, 0],
				},
			},
			{
				name: "Words",
				type: "line",
				yAxisIndex: 1,
				smooth: true,
				data: data.points.map((point) => point.wordCount),
				lineStyle: {
					width: 2,
					color: "#2f5f9b",
				},
				itemStyle: {
					color: "#2f5f9b",
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

export function renderYearlyReadingDepthChart(
	containerEl: HTMLElement,
	data: YearlyTrendData,
	entryLengthMethod: AverageEntryLengthMethod,
): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());
	const entryLengthSeriesName = entryLengthMethod === "median" ? "Median words" : "Mean words";
	const entryLengthSeriesData = data.points.map((point) =>
		entryLengthMethod === "median" ? point.medianWordsPerEntry : point.averageWordsPerEntry,
	);

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 64,
			top: 38,
			bottom: 40,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) =>
				buildTooltipLines(
					params[0]?.axisValueLabel ?? "",
					params.map((param) => `${param.seriesName}: ${formatSeriesValue(param.seriesName, param.value)}`),
				),
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => point.year.toString()),
		},
		yAxis: [
			{
				type: "value",
				name: "Minutes",
			},
			{
				type: "value",
				name: entryLengthSeriesName,
			},
		],
		series: [
			{
				name: "Reading time",
				type: "bar",
				data: data.points.map((point) => point.readingTimeMinutes),
				barMaxWidth: 28,
				itemStyle: {
					color: "#6f8f46",
					borderRadius: [5, 5, 0, 0],
				},
			},
			{
				name: entryLengthSeriesName,
				type: "line",
				yAxisIndex: 1,
				smooth: true,
				data: entryLengthSeriesData,
				lineStyle: {
					width: 2,
					color: "#8c4b7f",
				},
				itemStyle: {
					color: "#8c4b7f",
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

export function renderMonthLengthProfileChart(
	containerEl: HTMLElement,
	data: MonthLengthProfileData,
): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 64,
			top: 38,
			bottom: 40,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) => {
				const point = data.points.find((candidate) => candidate.monthLabel === (params[0]?.axisValueLabel ?? ""));
				const lines = params.map((param) => `${param.seriesName}: ${formatSeriesValue(param.seriesName, param.value)}`);
				if (point) {
					lines.push(`Median words: ${formatNumber(point.medianWords)} words`);
				}

				return buildTooltipLines(params[0]?.axisValueLabel ?? "", lines);
			},
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => point.monthLabel),
		},
		yAxis: [
			{
				type: "value",
				name: "Mean words",
			},
			{
				type: "value",
				name: "Entries",
			},
		],
		series: [
			{
				name: "Mean words",
				type: "bar",
				data: data.points.map((point) => point.averageWords),
				barMaxWidth: 24,
				itemStyle: {
					color: "#a7602d",
					borderRadius: [4, 4, 0, 0],
				},
			},
			{
				name: "Entries",
				type: "line",
				yAxisIndex: 1,
				smooth: true,
				data: data.points.map((point) => point.entryCount),
				lineStyle: {
					width: 2,
					color: "#356b96",
				},
				itemStyle: {
					color: "#356b96",
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

export function renderHourlyActivityChart(containerEl: HTMLElement, data: HourlyActivityData): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 64,
			top: 38,
			bottom: 40,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) =>
				buildTooltipLines(
					params[0]?.axisValueLabel ?? "",
					params.map((param) => `${param.seriesName}: ${formatSeriesValue(param.seriesName, param.value)}`),
				),
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => `${point.hour.toString().padStart(2, "0")}:00`),
		},
		yAxis: [
			{
				type: "value",
				name: "Entries",
			},
			{
				type: "value",
				name: "Mean words",
			},
		],
		series: [
			{
				name: "Entries",
				type: "bar",
				data: data.points.map((point) => point.entryCount),
				barMaxWidth: 22,
				itemStyle: {
					color: "#6b8d42",
					borderRadius: [4, 4, 0, 0],
				},
			},
			{
				name: "Mean words",
				type: "line",
				yAxisIndex: 1,
				smooth: true,
				data: data.points.map((point) => point.averageWords),
				lineStyle: {
					width: 2,
					color: "#8c4b7f",
				},
				itemStyle: {
					color: "#8c4b7f",
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

export function renderStructuralTrendsChart(containerEl: HTMLElement, data: StructuralTrendData): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 56,
			right: 62,
			top: 42,
			bottom: 42,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) =>
				buildTooltipLines(
					params[0]?.axisValueLabel ?? "",
					params.map((param) => `${param.seriesName}: ${formatStructuralSeriesValue(param.seriesName, param.value)}`),
				),
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => point.year.toString()),
		},
		yAxis: [
			{
				type: "value",
				name: "Burstiness / concentration",
				min: -1,
				max: 1,
			},
			{
				type: "value",
				name: "Entropy / shift",
			},
		],
		series: [
			{
				name: "Burstiness",
				type: "line",
				smooth: true,
				data: data.points.map((point) => point.burstinessIndex),
				lineStyle: {
					width: 2,
					color: "#b1493f",
				},
				itemStyle: {
					color: "#b1493f",
				},
			},
			{
				name: "Concentration",
				type: "line",
				smooth: true,
				data: data.points.map((point) => point.writingConcentrationIndex),
				lineStyle: {
					width: 2,
					color: "#5f7f35",
				},
				itemStyle: {
					color: "#5f7f35",
				},
			},
			{
				name: "Tag entropy",
				type: "line",
				yAxisIndex: 1,
				smooth: true,
				data: data.points.map((point) => point.tagEntropy),
				lineStyle: {
					width: 2,
					color: "#2f5f9b",
				},
				itemStyle: {
					color: "#2f5f9b",
				},
			},
			{
				name: "Regime shift",
				type: "bar",
				yAxisIndex: 1,
				data: data.points.map((point) => point.regimeShiftFromPrevious ?? 0),
				barMaxWidth: 18,
				itemStyle: {
					color: "#d6b451",
					borderRadius: [4, 4, 0, 0],
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

export function renderTagCoverageChart(containerEl: HTMLElement, data: TagCoverageTrendData): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 62,
			top: 40,
			bottom: 42,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) =>
				buildTooltipLines(
					params[0]?.axisValueLabel ?? "",
					params.map((param) => `${param.seriesName}: ${formatTagCoverageValue(param.seriesName, param.value)}`),
				),
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => point.year.toString()),
		},
		yAxis: [
			{
				type: "value",
				name: "Tagged share",
				min: 0,
				max: 1,
			},
			{
				type: "value",
				name: "Tags per note",
			},
		],
		series: [
			{
				name: "Tagged note share",
				type: "bar",
				data: data.points.map((point) => point.taggedEntryShare),
				barMaxWidth: 24,
				itemStyle: {
					color: "#a35c2d",
					borderRadius: [4, 4, 0, 0],
				},
			},
			{
				name: "Mean tags per note",
				type: "line",
				yAxisIndex: 1,
				smooth: true,
				data: data.points.map((point) => point.meanTagsPerNote),
				lineStyle: {
					width: 2,
					color: "#356b96",
				},
				itemStyle: {
					color: "#356b96",
				},
			},
			{
				name: "Median tags per note",
				type: "line",
				yAxisIndex: 1,
				smooth: true,
				data: data.points.map((point) => point.medianTagsPerNote),
				lineStyle: {
					width: 2,
					color: "#6d8a3a",
				},
				itemStyle: {
					color: "#6d8a3a",
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

export function renderTextAwareVocabularyChart(containerEl: HTMLElement, data: TextAwareTrendData): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 58,
			top: 40,
			bottom: 42,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) =>
				buildTooltipLines(
					params[0]?.axisValueLabel ?? "",
					params.map((param) => `${param.seriesName}: ${formatTextAwareValue(param.seriesName, param.value)}`),
				),
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => point.year.toString()),
		},
		yAxis: {
			type: "value",
			name: "Richness / novelty",
			min: 0,
			max: 1,
		},
		series: [
			{
				name: "Lexical richness",
				type: "line",
				smooth: true,
				data: data.points.map((point) => point.lexicalRichness),
				lineStyle: {
					width: 2,
					color: "#8a4d7b",
				},
				itemStyle: {
					color: "#8a4d7b",
				},
			},
			{
				name: "Novelty rate",
				type: "line",
				smooth: true,
				data: data.points.map((point) => point.noveltyRate),
				lineStyle: {
					width: 2,
					color: "#4f7e35",
				},
				itemStyle: {
					color: "#4f7e35",
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

export function renderTextAwareStyleChart(containerEl: HTMLElement, data: TextAwareTrendData): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 64,
			top: 40,
			bottom: 42,
		},
		legend: {
			top: 0,
		},
		tooltip: {
			trigger: "axis",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: Array<{ axisValueLabel: string; seriesName: string; value: number }>) =>
				buildTooltipLines(
					params[0]?.axisValueLabel ?? "",
					params.map((param) => `${param.seriesName}: ${formatTextAwareValue(param.seriesName, param.value)}`),
				),
		},
		xAxis: {
			type: "category",
			data: data.points.map((point) => point.year.toString()),
		},
		yAxis: [
			{
				type: "value",
				name: "Sentence length",
			},
			{
				type: "value",
				name: "Phrase share",
				min: 0,
				max: 1,
			},
		],
		series: [
			{
				name: "Average sentence length",
				type: "line",
				smooth: true,
				data: data.points.map((point) => point.averageSentenceLength),
				lineStyle: {
					width: 2,
					color: "#2f5f9b",
				},
				itemStyle: {
					color: "#2f5f9b",
				},
			},
			{
				name: "Recurring phrase share",
				type: "bar",
				yAxisIndex: 1,
				data: data.points.map((point) => point.recurringPhraseShare),
				barMaxWidth: 22,
				itemStyle: {
					color: "#c59537",
					borderRadius: [4, 4, 0, 0],
				},
			},
		],
	});

	resizeObserver.observe(containerEl);
	return {
		dispose: () => {
			resizeObserver.disconnect();
			chart.dispose();
		},
	};
}

function formatNumber(value: number): string {
	return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatSeriesValue(seriesName: string, value: number): string {
	switch (seriesName) {
		case "Entries":
			return `${formatNumber(value)} entries`;
		case "Words":
			return `${formatNumber(value)} words`;
		case "Reading time":
			return formatReadingTime(value);
		case "Mean words":
		case "Median words":
			return `${formatNumber(value)} words`;
		default:
			return formatNumber(value);
	}
}

function formatStructuralSeriesValue(seriesName: string, value: number): string {
	switch (seriesName) {
		case "Tag entropy":
			return `${formatNumber(value)} entropy`;
		case "Regime shift":
			return `${formatNumber(value)} score`;
		default:
			return formatNumber(value);
	}
}

function formatTagCoverageValue(seriesName: string, value: number): string {
	switch (seriesName) {
		case "Tagged note share":
			return `${Math.round(value * 100)}%`;
		case "Mean tags per note":
		case "Median tags per note":
			return `${formatNumber(value)} tags`;
		default:
			return formatNumber(value);
	}
}

function formatTextAwareValue(seriesName: string, value: number): string {
	switch (seriesName) {
		case "Lexical richness":
			return `${formatNumber(value)} richness`;
		case "Novelty rate":
		case "Recurring phrase share":
			return `${Math.round(value * 100)}%`;
		case "Average sentence length":
			return `${formatNumber(value)} words/sentence`;
		default:
			return formatNumber(value);
	}
}

function buildTooltipLines(title: string, lines: string[]): string {
	return [title, ...lines].join("<br/>");
}

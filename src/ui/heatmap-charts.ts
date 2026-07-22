import { EChartsType, init } from "echarts/core";
import { HeatmapChart } from "echarts/charts";
import { GridComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import * as echarts from "echarts/core";
import type {
	MonthlyHeatmapData,
	MonthlyWordsHeatmapData,
	TagFrequencyHeatmapData,
	WeekdayHeatmapData,
} from "../types";

echarts.use([HeatmapChart, GridComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

export interface HeatmapPalette {
	lowColor: string;
	highColor: string;
}

export interface DisposableChart {
	dispose: () => void;
}

export function renderMonthlyHeatmapChart(
	containerEl: HTMLElement,
	data: MonthlyHeatmapData,
	palette: HeatmapPalette,
): DisposableChart {
	const chart = init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 58,
			right: 20,
			top: 18,
			bottom: 48,
		},
		tooltip: {
			trigger: "item",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: { data: { monthLabel: string; yearLabel: string; count: number } }) =>
				`${params.data.monthLabel} ${params.data.yearLabel}<br/>Entries: ${params.data.count}`,
		},
		xAxis: {
			type: "category",
			data: data.months,
			splitArea: { show: true },
		},
		yAxis: {
			type: "category",
			data: data.years.map((year) => year.toString()),
			splitArea: { show: true },
		},
		visualMap: {
			min: 0,
			max: Math.max(1, data.maxEntryCount),
			calculable: false,
			orient: "horizontal",
			left: "center",
			bottom: 0,
			itemWidth: 14,
			itemHeight: 120,
			inRange: {
				color: [palette.lowColor, palette.highColor],
			},
		},
		series: [
			{
				type: "heatmap",
				data: data.cells.map((cell) => ({
					value: [cell.monthIndex, data.years.indexOf(cell.year), cell.entryCount],
					monthLabel: data.months[cell.monthIndex],
					yearLabel: cell.year.toString(),
					count: cell.entryCount,
				})),
				itemStyle: {
					borderWidth: 1,
					borderColor: "#00000010",
				},
				label: { show: false },
				emphasis: {
					itemStyle: {
						borderColor: "#00000028",
						borderWidth: 1,
						shadowBlur: 8,
						shadowColor: "rgba(0, 0, 0, 0.16)",
					},
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

export function renderWeekdayHeatmapChart(
	containerEl: HTMLElement,
	data: WeekdayHeatmapData,
	palette: HeatmapPalette,
): DisposableChart {
	const chart = init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 58,
			right: 20,
			top: 18,
			bottom: 48,
		},
		tooltip: {
			trigger: "item",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: {
				data: {
					weekdayLabel: string;
					yearLabel: string;
					entryCount: number;
					weekdayOccurrences: number;
					averageEntriesPerWeekday: number;
				};
			}) =>
				`${params.data.weekdayLabel} ${params.data.yearLabel}<br/>Entries: ${params.data.entryCount}<br/>Average per weekday: ${params.data.averageEntriesPerWeekday.toFixed(2)}<br/>Occurrences in year: ${params.data.weekdayOccurrences}`,
		},
		xAxis: {
			type: "category",
			data: data.weekdays,
			splitArea: { show: true },
		},
		yAxis: {
			type: "category",
			data: data.years.map((year) => year.toString()),
			splitArea: { show: true },
		},
		visualMap: {
			min: 0,
			max: Math.max(1, data.maxAverageEntries),
			calculable: false,
			orient: "horizontal",
			left: "center",
			bottom: 0,
			itemWidth: 14,
			itemHeight: 120,
			inRange: {
				color: [palette.lowColor, palette.highColor],
			},
		},
		series: [
			{
				type: "heatmap",
				data: data.cells.map((cell) => ({
					value: [cell.weekdayIndex, data.years.indexOf(cell.year), cell.averageEntriesPerWeekday],
					weekdayLabel: data.weekdays[cell.weekdayIndex],
					yearLabel: cell.year.toString(),
					entryCount: cell.entryCount,
					weekdayOccurrences: cell.weekdayOccurrences,
					averageEntriesPerWeekday: cell.averageEntriesPerWeekday,
				})),
				itemStyle: {
					borderWidth: 1,
					borderColor: "#00000010",
				},
				label: { show: false },
				emphasis: {
					itemStyle: {
						borderColor: "#00000028",
						borderWidth: 1,
						shadowBlur: 8,
						shadowColor: "rgba(0, 0, 0, 0.16)",
					},
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

export function renderMonthlyWordsHeatmapChart(
	containerEl: HTMLElement,
	data: MonthlyWordsHeatmapData,
	palette: HeatmapPalette,
): DisposableChart {
	const chart = init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 58,
			right: 20,
			top: 18,
			bottom: 48,
		},
		tooltip: {
			trigger: "item",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: {
				data: {
					monthLabel: string;
					yearLabel: string;
					wordCount: number;
					entryCount: number;
					averageWordsPerEntry: number;
				};
			}) =>
				`${params.data.monthLabel} ${params.data.yearLabel}<br/>Words: ${params.data.wordCount}<br/>Entries: ${params.data.entryCount}<br/>Average words per entry: ${params.data.averageWordsPerEntry.toFixed(1)}`,
		},
		xAxis: {
			type: "category",
			data: data.months,
			splitArea: { show: true },
		},
		yAxis: {
			type: "category",
			data: data.years.map((year) => year.toString()),
			splitArea: { show: true },
		},
		visualMap: {
			min: 0,
			max: Math.max(1, data.maxWordCount),
			calculable: false,
			orient: "horizontal",
			left: "center",
			bottom: 0,
			itemWidth: 14,
			itemHeight: 120,
			inRange: {
				color: [palette.lowColor, palette.highColor],
			},
		},
		series: [
			{
				type: "heatmap",
				data: data.cells.map((cell) => ({
					value: [cell.monthIndex, data.years.indexOf(cell.year), cell.wordCount],
					monthLabel: data.months[cell.monthIndex],
					yearLabel: cell.year.toString(),
					wordCount: cell.wordCount,
					entryCount: cell.entryCount,
					averageWordsPerEntry: cell.averageWordsPerEntry,
				})),
				itemStyle: {
					borderWidth: 1,
					borderColor: "#00000010",
				},
				label: { show: false },
				emphasis: {
					itemStyle: {
						borderColor: "#00000028",
						borderWidth: 1,
						shadowBlur: 8,
						shadowColor: "rgba(0, 0, 0, 0.16)",
					},
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

export function renderTagFrequencyHeatmapChart(
	containerEl: HTMLElement,
	data: TagFrequencyHeatmapData,
	palette: HeatmapPalette,
): DisposableChart {
	const chart = init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 118,
			right: 20,
			top: 18,
			bottom: 48,
		},
		tooltip: {
			trigger: "item",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: {
				data: {
					tagLabel: string;
					yearLabel: string;
					entryCount: number;
				};
			}) => `${params.data.tagLabel} in ${params.data.yearLabel}<br/>Entries: ${params.data.entryCount}`,
		},
		xAxis: {
			type: "category",
			data: data.years.map((year) => year.toString()),
			splitArea: { show: true },
		},
		yAxis: {
			type: "category",
			data: data.tags,
			splitArea: { show: true },
		},
		visualMap: {
			min: 0,
			max: Math.max(1, data.maxEntryCount),
			calculable: false,
			orient: "horizontal",
			left: "center",
			bottom: 0,
			itemWidth: 14,
			itemHeight: 120,
			inRange: {
				color: [palette.lowColor, palette.highColor],
			},
		},
		series: [
			{
				type: "heatmap",
				data: data.cells.map((cell) => ({
					value: [data.years.indexOf(cell.year), cell.tagIndex, cell.entryCount],
					tagLabel: data.tags[cell.tagIndex],
					yearLabel: cell.year.toString(),
					entryCount: cell.entryCount,
				})),
				itemStyle: {
					borderWidth: 1,
					borderColor: "#00000010",
				},
				label: { show: false },
				emphasis: {
					itemStyle: {
						borderColor: "#00000028",
						borderWidth: 1,
						shadowBlur: 8,
						shadowColor: "rgba(0, 0, 0, 0.16)",
					},
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

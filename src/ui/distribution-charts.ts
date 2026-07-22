import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import type { HistogramData } from "../types";
import type { DisposableChart } from "./heatmap-charts";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

export function renderWordCountHistogramChart(containerEl: HTMLElement, data: HistogramData): DisposableChart {
	return renderHistogramChart(containerEl, data, {
		barColor: "#986c32",
		rangeSuffix: "words",
	});
}

export function renderRevisionLagHistogramChart(containerEl: HTMLElement, data: HistogramData): DisposableChart {
	return renderHistogramChart(containerEl, data, {
		barColor: "#4d7c8a",
		rangeSuffix: "days",
	});
}

interface HistogramChartOptions {
	barColor: string;
	rangeSuffix: string;
}

function renderHistogramChart(
	containerEl: HTMLElement,
	data: HistogramData,
	options: HistogramChartOptions,
): DisposableChart {
	const chart = echarts.init(containerEl);
	const resizeObserver = new ResizeObserver(() => chart.resize());

	chart.setOption({
		animation: false,
		grid: {
			left: 52,
			right: 18,
			top: 18,
			bottom: 66,
		},
		tooltip: {
			trigger: "item",
			borderWidth: 0,
			padding: [8, 10],
			formatter: (params: { data: { label: string; start: number; end: number; count: number } }) => {
				const endLabel = Math.max(params.data.start, params.data.end - 1);
				return `Range: ${formatHistogramValue(params.data.start)}-${formatHistogramValue(endLabel)} ${options.rangeSuffix}<br/>Entries: ${params.data.count}`;
			},
		},
		xAxis: {
			type: "category",
			name: options.rangeSuffix === "words" ? "Words" : "Days",
			nameLocation: "middle",
			nameGap: 42,
			data: data.bins.map((bin) => bin.label),
			axisLabel: {
				rotate: data.bins.length > 8 ? 30 : 0,
			},
		},
		yAxis: {
			type: "value",
			name: "Entries",
		},
		series: [
			{
				type: "bar",
				data: data.bins.map((bin) => ({
					value: bin.count,
					label: bin.label,
					start: bin.start,
					end: bin.end,
					count: bin.count,
				})),
				barMaxWidth: 28,
				itemStyle: {
					color: options.barColor,
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

function formatHistogramValue(value: number): string {
	return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

import type { Candle } from "../../../shared/simulation";
import { useEffect, useRef, useState } from "react";

type MarketCanvasProps = {
  candles: Candle[];
  slippage: { size: number; impact: number }[];
  price: number;
  cadenceMs: number;
};

const formatPrice = (value: number) => `$${value.toFixed(value < 10 ? 3 : 2)}`;

export function MarketCanvas({ candles, slippage, price, cadenceMs }: MarketCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
    context.scale(pixelRatio, pixelRatio);
    const width = rect.width;
    const height = rect.height;
    context.clearRect(0, 0, width, height);

    const chartTop = 18;
    const chartHeight = height * 0.64;
    const volumeTop = chartTop + chartHeight + 15;
    const volumeHeight = height * 0.18;
    const slipLeft = width * 0.76;
    const visible = candles.slice(-72);
    const values = visible.flatMap(candle => [candle.high, candle.low]);
    const minPrice = Math.min(...values) * 0.992;
    const maxPrice = Math.max(...values) * 1.008;
    const priceRange = Math.max(maxPrice - minPrice, 0.001);
    const candleAreaWidth = width * 0.72;
    const step = candleAreaWidth / Math.max(visible.length, 1);
    const maxVolume = Math.max(...visible.map(candle => candle.volume), 1);

    context.lineWidth = 1;
    context.strokeStyle = "rgba(130, 155, 179, 0.13)";
    context.setLineDash([2, 4]);
    for (let line = 0; line < 5; line += 1) {
      const y = chartTop + (chartHeight / 4) * line;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.setLineDash([]);

    visible.forEach((candle, index) => {
      const x = index * step + step / 2;
      const mapY = (value: number) => chartTop + (maxPrice - value) / priceRange * chartHeight;
      const openY = mapY(candle.open);
      const closeY = mapY(candle.close);
      const highY = mapY(candle.high);
      const lowY = mapY(candle.low);
      const up = candle.close >= candle.open;
      const color = up ? "#40e7af" : "#ff6b7c";
      context.strokeStyle = color;
      context.fillStyle = color;
      context.globalAlpha = 0.94;
      context.beginPath();
      context.moveTo(x, highY);
      context.lineTo(x, lowY);
      context.stroke();
      context.fillRect(x - Math.max(1.3, step * 0.26), Math.min(openY, closeY), Math.max(2, step * 0.52), Math.max(1, Math.abs(closeY - openY)));
      context.globalAlpha = 0.24;
      const barHeight = (candle.volume / maxVolume) * volumeHeight;
      context.fillRect(x - Math.max(1.3, step * 0.26), volumeTop + volumeHeight - barHeight, Math.max(2, step * 0.52), barHeight);
      context.globalAlpha = 1;
    });

    const currentY = chartTop + (maxPrice - price) / priceRange * chartHeight;
    context.strokeStyle = "rgba(109, 224, 255, 0.78)";
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(0, currentY);
    context.lineTo(candleAreaWidth, currentY);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#071117";
    context.fillRect(candleAreaWidth - 1, currentY - 11, 67, 22);
    context.fillStyle = "#85efff";
    context.font = "600 10px IBM Plex Mono, monospace";
    context.fillText(formatPrice(price), candleAreaWidth + 5, currentY + 3);

    context.fillStyle = "rgba(143, 164, 184, 0.82)";
    context.font = "10px IBM Plex Mono, monospace";
    context.fillText("VOLUME", 9, volumeTop + 10);
    context.fillText("SLIPPAGE / SIZE", slipLeft + 10, chartTop + 11);
    const maxImpact = Math.max(...slippage.map(point => point.impact), 1);
    context.strokeStyle = "rgba(248, 180, 82, 0.9)";
    context.lineWidth = 1.5;
    context.beginPath();
    slippage.forEach((point, index) => {
      const x = slipLeft + 14 + index * ((width - slipLeft - 36) / Math.max(slippage.length - 1, 1));
      const y = chartTop + 28 + (1 - point.impact / maxImpact) * (chartHeight - 38);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
      context.fillStyle = "#f8b452";
      context.fillRect(x - 2, y - 2, 4, 4);
    });
    context.stroke();
    context.fillStyle = "rgba(248, 180, 82, 0.8)";
    context.fillText(`${maxImpact.toFixed(1)}%`, slipLeft + 12, chartTop + chartHeight - 3);

    if (hover) {
      context.strokeStyle = "rgba(215, 229, 242, 0.35)";
      context.beginPath();
      context.moveTo(hover.x, chartTop);
      context.lineTo(hover.x, volumeTop + volumeHeight);
      context.stroke();
    }
  }, [candles, hover, price, slippage]);

  return (
    <div className="relative h-[310px] w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        onMouseMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
        onMouseLeave={() => setHover(null)}
      />
      <div className="pointer-events-none absolute bottom-0 left-2 flex items-center gap-4 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
        <span>HFT Feed / {cadenceMs}ms</span>
        <span className="text-cyan-300">Canvas Engine</span>
      </div>
    </div>
  );
}

'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  ESTADO_INFO,
  ESTADOS,
  type Estado,
  type PuntoImpuesto,
  type PuntoMes,
} from '@/lib/estadisticas';

// Las claves coinciden con los `dataKey`: el contenedor expone `--color-<clave>`.
// El color no es la única pista: la leyenda nombra cada serie y el tooltip
// muestra el número de cada una.
const CONFIG = Object.fromEntries(
  ESTADOS.map((e) => [e, { label: ESTADO_INFO[e].etiqueta, color: ESTADO_INFO[e].color }]),
) satisfies ChartConfig;

function Barras(radio: [number, number, number, number]) {
  return ESTADOS.map((estado, i) => (
    <Bar
      key={estado}
      dataKey={estado}
      stackId="estados"
      fill={`var(--color-${estado})`}
      // Solo el extremo de la pila lleva bordes redondeados.
      radius={i === ESTADOS.length - 1 ? radio : 0}
      isAnimationActive={false}
    />
  ));
}

/** Posición de cada serie: tooltip y leyenda siguen el mismo orden que las tarjetas. */
const orden = (item: { dataKey?: unknown }) => ESTADOS.indexOf(item.dataKey as Estado);

function Tooltip<T>(titulo: (punto: T) => string) {
  return (
    <ChartTooltip
      // Sin el borde por defecto, que en el tema oscuro queda blanco.
      cursor={{ stroke: 'none' }}
      itemSorter={orden}
      content={
        <ChartTooltipContent
          className="min-w-48"
          labelFormatter={(_, payload) => {
            const punto = payload?.[0]?.payload as T | undefined;
            return punto ? titulo(punto) : null;
          }}
        />
      }
    />
  );
}

function Leyenda() {
  // `itemSorter={null}`: respeta el orden de las <Bar> (por defecto Recharts ordena alfabéticamente).
  return <ChartLegend itemSorter={null} content={<ChartLegendContent className="flex-wrap" />} />;
}

export function GraficoPorMes({ datos }: { datos: PuntoMes[] }) {
  return (
    <ChartContainer config={CONFIG} className="aspect-auto h-72 w-full">
      <BarChart data={datos} margin={{ left: -16, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        {Tooltip<PuntoMes>((p) => p.etiquetaLarga)}
        {Leyenda()}
        {Barras([4, 4, 0, 0])}
      </BarChart>
    </ChartContainer>
  );
}

export function GraficoPorImpuesto({ datos }: { datos: PuntoImpuesto[] }) {
  // Barras horizontales: los nombres de los impuestos se leen enteros aun en el celular.
  const alto = Math.max(200, datos.length * 44 + 72);
  return (
    <ChartContainer config={CONFIG} className="aspect-auto w-full" style={{ height: alto }}>
      <BarChart data={datos} layout="vertical" margin={{ left: 0, right: 8 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="nombre"
          tickLine={false}
          axisLine={false}
          width={110}
          interval={0}
        />
        {Tooltip<PuntoImpuesto>((p) => p.nombre)}
        {Leyenda()}
        {Barras([0, 4, 4, 0])}
      </BarChart>
    </ChartContainer>
  );
}

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type ChartRow = Record<string, string | number>;

interface Props {
    data: ChartRow[];
    dataKey: string;
    color?: string;
    label?: string;
    height?: number;
}

export function TrendChart({ data, dataKey, color = '#ff4500', label, height = 220 }: Props) {
    const fmt = (d: string) => {
        const dt = new Date(d);
        return `${dt.getMonth() + 1}/${dt.getDate()}`;
    };

    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                    dataKey="date"
                    tickFormatter={fmt}
                    tick={{ fill: '#52526b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                />
                <YAxis
                    tick={{ fill: '#52526b', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                />
                <Tooltip
                    contentStyle={{
                        background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.85rem',
                    }}
                    labelFormatter={fmt}
                    formatter={(v: number | string) => [v, label ?? dataKey]}
                />
                <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: color }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DataItem {
    name: string;
    value: number;
    color?: string;
}

interface Props {
    data: DataItem[];
    color?: string;
    height?: number;
    valueLabel?: string;
}

const DEFAULT_COLOR = '#ff4500';

export function BarChartWidget({ data, color = DEFAULT_COLOR, height = 200, valueLabel = 'Count' }: Props) {
    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                    dataKey="name"
                    tick={{ fill: '#8e92a4', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
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
                    formatter={(v: number | string) => [v, valueLabel]}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.map((entry, i) => (
                        <Cell key={i} fill={entry.color ?? color} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}

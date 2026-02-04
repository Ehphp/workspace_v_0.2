import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

interface TechData {
    name: string;
    value: number;
}

interface TechStackUsageChartProps {
    techData: TechData[];
}

const TECH_COLORS = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
];

const CustomContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, value, colors } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: colors[index % colors.length],
                    stroke: '#fff',
                    strokeWidth: 2,
                    strokeOpacity: 1,
                }}
                rx={4}
                ry={4}
            />
            {width > 20 && height > 20 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    stroke="#000"
                    strokeWidth={0.5}
                    fontSize={12}
                    fontWeight="bold"
                    dy={4}
                    style={{ pointerEvents: 'none' }}
                >
                    {value}
                </text>
            )}
        </g>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg rounded-lg p-2 text-xs">
                <p className="font-semibold text-slate-900">{payload[0].payload.name}</p>
                <p className="text-slate-600">
                    Usage: <span className="font-medium text-blue-600">{payload[0].value}</span>
                </p>
            </div>
        );
    }
    return null;
};

export function TechStackUsageChart({ techData }: TechStackUsageChartProps) {
    if (!techData || techData.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-sm text-slate-500">No data available</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <Treemap
                data={techData}
                dataKey="value"
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#8884d8"
                content={<CustomContent colors={TECH_COLORS} />}
            >
                <Tooltip content={<CustomTooltip />} />
            </Treemap>
        </ResponsiveContainer>
    );
}

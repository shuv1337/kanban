export function ShuvbanIcon({ size = 20, className }: { size?: number; className?: string }): React.ReactElement {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" className={className}>
			<rect width="64" height="64" rx="14" fill="#E53935" />
			<text
				x="32"
				y="46"
				fontFamily="-apple-system,system-ui,sans-serif"
				fontSize="40"
				fontWeight="700"
				fill="white"
				textAnchor="middle"
			>
				S
			</text>
		</svg>
	);
}

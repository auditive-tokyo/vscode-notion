import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

// Initialize mermaid with VS Code dark theme settings
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "var(--vscode-font-family)",
  themeVariables: {
    primaryColor: "#007ACC",
    primaryTextColor: "#fff",
    primaryBorderColor: "#007ACC",
    lineColor: "#6E7681",
    secondaryColor: "#0E639C",
    tertiaryColor: "#1F2937",
    background: "#1F2937",
    mainBkg: "#1F2937",
    nodeBorder: "#007ACC",
    clusterBkg: "#374151",
    clusterBorder: "#4B5563",
    titleColor: "#fff",
    edgeLabelBackground: "#374151",
  },
});

interface MermaidDiagramProps {
  chart: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !chart.trim()) return;

      try {
        // Generate unique ID for each render
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error("[MermaidDiagram] Render error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to render diagram",
        );
      }
    };

    renderChart();
  }, [chart]);

  if (error) {
    return (
      <div className="mermaid-error bg-red-900/30 border border-red-500 rounded p-4 my-4">
        <div className="text-red-400 font-semibold mb-2">⚠️ Mermaid Error</div>
        <pre className="text-red-300 text-sm whitespace-pre-wrap">{error}</pre>
        <details className="mt-2">
          <summary className="text-gray-400 cursor-pointer text-sm">
            Show source code
          </summary>
          <pre className="mt-2 text-gray-300 text-xs bg-gray-800 p-2 rounded overflow-x-auto">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram my-4 p-4 bg-gray-800 rounded-lg overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

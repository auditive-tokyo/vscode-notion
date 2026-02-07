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
  const renderCounterRef = useRef(0);

  const createRenderId = (): string => {
    const cryptoRef = globalThis.crypto;
    if (cryptoRef?.getRandomValues) {
      const bytes = new Uint32Array(2);
      cryptoRef.getRandomValues(bytes);
      return `mermaid-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }
    renderCounterRef.current += 1;
    return `mermaid-${Date.now().toString(
      36,
    )}-${renderCounterRef.current.toString(36)}`;
  };

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !chart.trim()) return;

      try {
        // Generate unique ID for each render
        const id = createRenderId();
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
        <div
          className="font-semibold mb-2"
          style={{ color: "var(--vscode-errorForeground)" }}
        >
          ⚠️ Mermaid Error
        </div>
        <pre
          className="text-sm whitespace-pre-wrap"
          style={{ color: "var(--vscode-errorForeground)" }}
        >
          {error}
        </pre>
        <details className="mt-2">
          <summary
            className="cursor-pointer text-sm"
            style={{ color: "var(--vscode-descriptionForeground)" }}
          >
            Show source code
          </summary>
          <pre
            className="mt-2 text-xs p-2 rounded overflow-x-auto"
            style={{
              color: "var(--vscode-editor-foreground)",
              backgroundColor: "var(--vscode-textCodeBlock-background)",
            }}
          >
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram my-4 p-4 rounded-lg overflow-x-auto"
      style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/**
 * Rehype plugin to ensure tables have valid header rows
 * Converts the first <tr> of a <table> to use <th> instead of <td>
 * and adds scope="col" attributes for accessibility
 */
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

// Simplified type based on rehype/unified's Element node structure
interface ElementNode {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children?: ElementNode[];
}

const rehypeTableHeaders: Plugin = () => {
  return (tree) => {
    visit(tree, "element", (node: ElementNode) => {
      if (node.tagName !== "table") {
        return;
      }

      // Find the first <tr> in the table
      let firstTr: ElementNode | null = null;

      // Check if table has thead
      const thead = node.children?.find((child) => child.tagName === "thead");
      if (thead) {
        firstTr =
          thead.children?.find((child) => child.tagName === "tr") || null;
      } else {
        // Otherwise, find first tr directly in table
        firstTr =
          node.children?.find((child) => child.tagName === "tr") || null;
      }

      if (firstTr && Array.isArray(firstTr.children)) {
        // Check if first row has any td elements (meaning it's not already a header row)
        const hasTd = firstTr.children.some(
          (cell): cell is ElementNode => cell.tagName === "td",
        );

        if (hasTd) {
          // Convert td to th in the first row
          firstTr.children = firstTr.children.map((cell): ElementNode => {
            if (cell.tagName === "td") {
              return {
                ...cell,
                tagName: "th",
                properties: {
                  ...cell.properties,
                  scope: "col",
                },
              };
            }
            return cell;
          });
        } else {
          // If first row already has th, just ensure they have scope attribute
          firstTr.children = firstTr.children.map((cell): ElementNode => {
            if (cell.tagName === "th") {
              return {
                ...cell,
                properties: {
                  ...cell.properties,
                  scope: cell.properties?.scope || "col",
                },
              };
            }
            return cell;
          });
        }
      }
    });
  };
};

export default rehypeTableHeaders;

/**
 * Cell value type used across table, board, and other renderers
 */
export type CellValue = string | { start: string | null; end: string | null };

/**
 * Convert cell value to string
 * @param cell - Cell value (string or DateValue object)
 * @returns String representation of the cell value
 */
export const cellToString = (cell: CellValue): string => {
  if (typeof cell === "string") {
    return cell;
  }
  // DateValue オブジェクトの場合
  if (cell && typeof cell === "object" && "start" in cell) {
    if (cell.end && cell.start !== cell.end) {
      return `${cell.start} → ${cell.end}`;
    }
    return cell.start || "";
  }
  return "";
};

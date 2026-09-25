// Accept both fixture rows and Recharts payloads. Older data has no metadata.
export const partialResultLabel = (
  result: Record<string, unknown> | undefined,
  packageManager?: string,
): string | undefined => {
  const prefix = packageManager ? `${packageManager}_` : "";
  if (result?.[`${prefix}partial`] !== true) return undefined;
  const attempted = result[`${prefix}attempted_runs`];
  const successful = result[`${prefix}successful_runs`];
  return typeof attempted === "number" && typeof successful === "number"
    ? `Partial: ${successful}/${attempted} runs succeeded`
    : "Partial result";
};

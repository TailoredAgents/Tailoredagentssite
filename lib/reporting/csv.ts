export function csvLine(values: unknown[]) {
  return (
    values
      .map((value) => {
        let text = value == null ? "" : String(value);
        // Leading whitespace/control characters can hide a spreadsheet formula.
        // eslint-disable-next-line no-control-regex -- Required to neutralize spreadsheet formula prefixes.
        if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text))
          text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
      })
      .join(",") + "\r\n"
  );
}

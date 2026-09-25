/** Conservative recognition of explicit, final-line interactive prompts. */
export function isInputPrompt(output: string): boolean {
  const clean = output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
  const line = clean.split('\n').at(-1)?.trim() ?? '';
  if (/press (?:enter|any key) to continue[.!:]?$/i.test(line)) return true;
  return (
    /(?:\?|:|\])\s*$/.test(line) &&
    /(?:trust this folder|continue\?|confirm\?|are you sure|press enter|\([YyNn]\/\w+\)|\[[YyNn]\/\w+\])/i.test(
      line,
    )
  );
}

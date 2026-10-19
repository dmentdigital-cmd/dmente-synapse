export function extractBrainLinks(content: string): { target: string; label: string }[] {
  const links = new Map<string, { target: string; label: string }>()
  const add = (target: string, label: string) => {
    if (links.size >= 100 || !target || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(target)) return
    links.set(target, { target, label: label || target })
  }
  for (const match of content.matchAll(/!?\[\[([^\]\r\n]{1,2000})\]\]/g)) {
    const [target, label] = match[1].split('|')
    add(target.trim(), label?.trim() ?? target.trim())
  }
  for (const match of content.matchAll(/!?\[([^\]\r\n]*)\]\((<[^>\r\n]+>|[^)\r\n]+)\)/g)) {
    const target = match[2].replace(/^<|>$/g, '').replace(/\s+["'][^]*$/, '').trim()
    add(target, match[1])
  }
  return [...links.values()]
}

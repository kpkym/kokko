import { parse as parseYaml } from 'yaml';

export interface ParsedFrontmatter {
  name: string;
  description: string;
}

export function parseSkillFrontmatter(text: string, path: string): ParsedFrontmatter {
  const normalized = text.replace(/\r\n/g, '\n').replace(/^\s*\n/, '');
  if (!normalized.startsWith('---\n')) {
    throw new Error(`[skills] ${path}: missing frontmatter fence`);
  }
  const rest = normalized.slice(4);
  const closeIdx = rest.indexOf('\n---');
  if (closeIdx === -1) {
    throw new Error(`[skills] ${path}: missing closing frontmatter fence`);
  }
  const yamlText = rest.slice(0, closeIdx);
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[skills] ${path}: invalid YAML: ${msg}`);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`[skills] ${path}: frontmatter must be a YAML mapping`);
  }
  const obj = parsed as Record<string, unknown>;
  if (!('name' in obj)) {
    throw new Error(`[skills] ${path}: missing 'name' field in frontmatter`);
  }
  if (typeof obj.name !== 'string') {
    throw new Error(`[skills] ${path}: 'name' must be a string`);
  }
  if (!('description' in obj)) {
    throw new Error(`[skills] ${path}: missing 'description' field in frontmatter`);
  }
  if (typeof obj.description !== 'string') {
    throw new Error(`[skills] ${path}: 'description' must be a string`);
  }
  return { name: obj.name, description: obj.description };
}

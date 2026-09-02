const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SPACE = LETTERS.length ** 3;

export function isAlias(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function codeAt(n: number): string {
  const index = ((n % SPACE) + SPACE) % SPACE;
  const a = Math.floor(index / (26 * 26));
  const b = Math.floor(index / 26) % 26;
  const c = index % 26;
  return LETTERS[a] + LETTERS[b] + LETTERS[c];
}

/** Stable starting point so the same applicant keeps the same code unless it
 *  collides with one already handed out. */
function startFrom(id: string): number {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % SPACE;
}

export function nextAlias(id: string, used: Set<string>): string {
  const start = startFrom(id);
  for (let offset = 0; offset < SPACE; offset++) {
    const code = codeAt(start + offset);
    if (!used.has(code)) return code;
  }
  throw new Error("Could not allocate a unique applicant alias.");
}

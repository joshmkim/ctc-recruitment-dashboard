/**
 * The forty graders the seed inserts.
 *
 * Written out rather than generated so the list is reviewable in a diff and
 * stable between runs — seeding twice must not produce eighty graders. The names
 * deliberately share no surnames with the seed applicants, so it is never
 * ambiguous whether a name on screen is someone grading or someone applying.
 *
 * This is a plain module rather than part of `lib/actions/seed.ts` because a
 * `"use server"` file may only export async functions.
 */
export const SEED_GRADERS = [
  "Ana Beaumont",
  "Bryce Whitfield",
  "Camille Arnaud",
  "Darius Whitlock",
  "Eleanor Pike",
  "Ezra Hollingsworth",
  "Farrah Sinclair",
  "Gabriel Ashworth",
  "Harriet Vance",
  "Ibrahim Castellanos",
  "Jia Lockhart",
  "Julian Broadbent",
  "Katarina Vesely",
  "Lachlan Cromwell",
  "Lena Fairbanks",
  "Marcus Thornbury",
  "Nia Ravensworth",
  "Nolan Fitzgerald",
  "Odette Marchand",
  "Oscar Pemberton",
  "Perla Santangelo",
  "Quentin Ashby",
  "Rosalind Kerrigan",
  "Rowan Highsmith",
  "Saoirse Callaghan",
  "Sebastian Wexford",
  "Simone Delacroix",
  "Talia Rosenblum",
  "Theo Kingsley",
  "Uma Chandrasekar",
  "Vera Lindstrom",
  "Victor Ashcombe",
  "Wren Halloway",
  "Xavier Montrose",
  "Yasmin Abernathy",
  "Zachary Underhill",
  "Zoe Pennington",
  "Amelia Winterbourne",
  "Caleb Ravenscroft",
  "Delphine Marchetta",
] as const;

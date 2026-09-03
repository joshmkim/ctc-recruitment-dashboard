/**
 * Drive file ids out of whatever the form wrote into the Resume column.
 *
 * A file-upload question records `open?id=<id>`, but the same column picks up
 * `file/d/<id>/view` links when anything is moved or re-shared in Drive, so both
 * are read. When a question allows several uploads the cell holds every URL,
 * comma-separated — hence a list rather than a single id, so a second attachment
 * cannot silently disappear behind the first.
 */
export function driveFileIds(resumeUrl: string) {
  const ids = resumeUrl
    .split(/[,\s]+/)
    .map((part) => part.match(/(?:\/file\/d\/|[?&]id=)([\w-]{10,})/)?.[1])
    .filter((id): id is string => Boolean(id));

  return [...new Set(ids)];
}

export function drivePreviewUrl(id: string) {
  return `https://drive.google.com/file/d/${id}/preview`;
}

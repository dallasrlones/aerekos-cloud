/** Per-service metaphor map — shared skeleton, different soul. */
export const METAPHORS = {
  planet: {
    id: 'planet',
    zone: 'Fleet worlds',
    emptyTitle: 'No worlds online',
    emptyHint: 'Register a device to bring a planet into the system.',
    cta: 'Add device',
  },
  hangar: {
    id: 'hangar',
    zone: 'Launch bay',
    emptyTitle: 'Bay empty',
    emptyHint: 'Launch a container craft onto your fleet.',
    cta: 'Launch',
  },
  archive: {
    id: 'archive',
    zone: 'Source archive',
    emptyTitle: 'Archive empty',
    emptyHint: 'Create a repository to store lineages of code.',
    cta: 'Create repository',
  },
  vault: {
    id: 'vault',
    zone: 'Deep vault',
    emptyTitle: 'No chambers',
    emptyHint: 'Create a bucket chamber to store objects.',
    cta: 'Create bucket',
  },
  cipher: {
    id: 'cipher',
    zone: 'Cipher vault',
    emptyTitle: 'No seals',
    emptyHint: 'Create a key or secret to seal credentials.',
    cta: 'Create',
  },
  station: {
    id: 'station',
    zone: 'Mission station',
    emptyTitle: 'Nothing here yet',
    emptyHint: 'Create the first resource for this service.',
    cta: 'Create',
  },
};

export function getMetaphor(id) {
  return METAPHORS[id] || METAPHORS.station;
}

// Newest publish wins (D7): when a Desk takes the published showsheet, and when its own copy hasn't been published.
// ISO timestamps compare correctly as strings.

// The newest of this Desk's own copies: its last adopted publish, or a file it loaded itself
export const latestIso = (...isos) => isos.sort().pop();

// Take a publish only if it is newer than anything this Desk has and actually has units
export const shouldAdoptPublish = (publishedAtIso, haveIso, units) => !!(publishedAtIso && publishedAtIso > haveIso && Array.isArray(units) && units.length);

// This Desk loaded a file after the last publish (and didn't adopt anything newer), so the iPads are behind
export const isUnpublished = (lastPublishedAt, localIso, adoptedIso) => !!localIso && localIso > (lastPublishedAt || '') && localIso > adoptedIso;

// The line under "Floor Plan Links": the file's name and when the links were loaded. Links taken from a publish carry
// no file name, so only the parts that exist are shown (never "undefined", and no made-up name).
export const floorPlanMetaLine = (meta, when) => meta ? [meta.filename, meta.loadedAt ? when(meta.loadedAt) : ''].filter(Boolean).join(' · ') : '';

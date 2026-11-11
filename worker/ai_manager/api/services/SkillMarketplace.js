'use strict';

/**
 * Skill marketplace registry (publish / install within tenant).
 */

const { randomUUID } = require('crypto');

class SkillMarketplace {
  constructor() {
    this.listings = new Map();
  }

  publish({
    projectId, skillId, name, description, visibility = 'project',
  }) {
    const id = randomUUID();
    const row = {
      id,
      project_id: projectId,
      skill_id: skillId,
      name: name || skillId,
      description: description || '',
      visibility,
      installs: 0,
      published_at: Date.now(),
    };
    this.listings.set(id, row);
    return row;
  }

  list({ visibility } = {}) {
    let rows = [...this.listings.values()];
    if (visibility) rows = rows.filter((r) => r.visibility === visibility);
    return rows.sort((a, b) => b.published_at - a.published_at);
  }

  install(listingId, { projectId, skills }) {
    const listing = this.listings.get(listingId);
    if (!listing) return null;
    listing.installs += 1;
    const src = skills?.get(listing.skill_id);
    if (!src || !skills) return { listing, skill: null };
    const copy = skills.upsert({
      ...src,
      id: undefined,
      name: `${src.name}@install`,
      provenance: {
        ...(src.provenance || {}), marketplace_listing: listingId, installed_for: projectId,
      },
    });
    return { listing, skill: copy };
  }
}

const marketplace = new SkillMarketplace();

module.exports = { SkillMarketplace, marketplace };

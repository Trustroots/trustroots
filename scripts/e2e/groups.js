const GROUPS = {
  'account-public': [
    'auth-smoke',
    'public',
    'authenticated',
    'photo-upload-firefox',
    'member',
  ],
  community: [
    'messages',
    'message-actions',
    'relationships-safety',
    'experiences',
    'messages-firefox-layout',
  ],
  'admin-search': [
    'admin',
    'search-offers-circles',
    'search-map-rendered',
    'search-map-wheel-firefox',
  ],
};

function selectProjects(projects, group, serialise) {
  if (!group) return projects;
  if (!Object.prototype.hasOwnProperty.call(GROUPS, group)) {
    throw new Error(`Unknown e2e group: ${group}`);
  }

  const names = ['setup-authenticated', ...GROUPS[group]];
  return names.map((name, index) => {
    const project = projects.find(candidate => candidate.name === name);
    if (!project) throw new Error(`Missing e2e project: ${name}`);
    return {
      ...project,
      dependencies:
        index === 0
          ? []
          : serialise
          ? [names[index - 1]]
          : (project.dependencies || []).filter(dependency =>
              names.includes(dependency),
            ),
    };
  });
}

module.exports = { GROUPS, selectProjects };

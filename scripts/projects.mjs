export function prepareProjects(data) {
  if (!Array.isArray(data) || !data.length) {
    throw new Error("projects.json must define at least one project.");
  }
  const anchors = new Set(["main", "top", "new-tab-note", "primary-navigation"]);
  const fields = new Set([
    "id",
    "name",
    "category",
    "context",
    "summary",
    "technical",
    "technologies",
    "languages",
    "repository",
    "action",
  ]);
  return data.map((project, index) => {
    const label = `projects.json[${index}]`;
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      throw new Error(`${label} must be an object.`);
    }
    const unknown = Object.keys(project).find((field) => !fields.has(field));
    if (unknown) throw new Error(`${label}.${unknown} is not a supported field; see AGENTS.md.`);
    if (
      typeof project.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id) ||
      [project.id, `${project.id}-title`].some((id) => anchors.has(id))
    ) {
      throw new Error(`${label}.id must be a unique, non-reserved lowercase slug.`);
    }
    for (const field of ["name", "category", "context", "summary", "technical"]) {
      if (typeof project[field] !== "string" || !project[field].trim()) {
        throw new Error(`${label}.${field} must be a non-empty string.`);
      }
    }
    for (const field of ["technologies", "languages"]) {
      if (
        !Array.isArray(project[field]) ||
        !project[field].length ||
        !project[field].every((value) => typeof value === "string" && value.trim())
      ) {
        throw new Error(`${label}.${field} must be a non-empty list of non-empty strings.`);
      }
    }
    if (
      "action" in project &&
      (!project.action ||
        typeof project.action !== "object" ||
        Array.isArray(project.action) ||
        typeof project.action.label !== "string" ||
        !project.action.label.trim())
    ) {
      throw new Error(
        `${label}.action requires a non-empty label and an HTTPS URL, or must be omitted.`,
      );
    }
    const links = [["repository", project.repository]];
    if (project.action) links.push(["action.url", project.action.url]);
    for (const [field, value] of links) {
      if (typeof value !== "string" || !URL.canParse(value)) {
        throw new Error(`${label}.${field} must be a valid HTTPS URL.`);
      }
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error(`${label}.${field} must be an HTTPS URL without embedded credentials.`);
      }
    }
    anchors.add(project.id);
    anchors.add(`${project.id}-title`);
    return { ...project, number: String(index + 1).padStart(2, "0") };
  });
}

export function createProjectsSchema(projects, page, person) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@type": "CollectionPage",
        "@id": page.canonical,
        url: page.canonical,
        name: page.title,
        description: page.description,
        author: { "@id": person["@id"] },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: projects.length,
          itemListElement: projects.map((project, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "SoftwareSourceCode",
              "@id": `${page.canonical}#${project.id}`,
              name: project.name,
              description: `${project.summary} ${project.technical}`,
              url: `${page.canonical}#${project.id}`,
              codeRepository: project.repository,
              programmingLanguage: project.languages,
              keywords: project.technologies.join(", "),
              author: { "@id": person["@id"] },
              sameAs: [project.repository, ...(project.action ? [project.action.url] : [])],
            },
          })),
        },
      },
    ],
  };
}

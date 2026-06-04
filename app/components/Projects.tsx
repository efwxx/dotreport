import type { ProjectItem } from "@/lib/sections";

type Props = {
  title?: string;
  items: ProjectItem[];
};

export function Projects({ title, items }: Props) {
  if (!items?.length) return null;
  return (
    <section className="projects-section">
      {title && <h2 className="section-title">{title}</h2>}
      <div className="projects-grid">
        {items.map((p, i) => (
          <ProjectCard key={`${i}-${p.title}`} project={p} />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: ProjectItem }) {
  const body = (
    <>
      <div className="project-header">
        {project.icon && (
          <span className="project-icon" aria-hidden>
            {project.icon}
          </span>
        )}
        <span className="project-title">{project.title}</span>
        {project.href && (
          <span className="project-arrow" aria-hidden>
            →
          </span>
        )}
      </div>
      {project.description && (
        <div className="project-desc">{project.description}</div>
      )}
      {project.tags && project.tags.length > 0 && (
        <div className="project-tags">
          {project.tags.map((t) => (
            <span key={t} className="project-tag">
              {t}
            </span>
          ))}
        </div>
      )}
    </>
  );

  if (project.href) {
    return (
      <a
        className="card project-card project-card-link"
        href={project.href}
        target="_blank"
        rel="noreferrer"
      >
        {body}
      </a>
    );
  }
  return <div className="card project-card">{body}</div>;
}

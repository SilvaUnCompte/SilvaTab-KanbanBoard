import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Archive, ChevronDown, GripVertical, LogOut, Plus, Settings } from "lucide-react";
import { useState } from "react";
import type { Project } from "../../../shared/schemas";
import { useLogout, useMoveProject } from "../hooks";
import { ArchiveDialog } from "./ArchiveDialog";
import { ProjectDialog } from "./ProjectDialog";
import { ErrorBanner, ProjectAvatar } from "./ui";

type DialogState = { kind: "project"; project?: Project } | { kind: "archive" } | null;

export function Sidebar({
  projects,
  selectedId,
  onSelect,
  open,
  onOpen,
  onClose,
}: {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Phone only: the project list unfolds over the board; on desktop it is always shown. */
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const logout = useLogout();
  const move = useMoveProject();

  const onDragEnd = ({ draggableId, source, destination }: DropResult) => {
    if (destination && destination.index !== source.index) move.mutate({ id: draggableId, position: destination.index });
  };

  return (
    <aside className="sidebar col" data-open={open}>
      <header className="sidebar-header row gap-8">
        <span className="brand-mark" />
        <span className="brand grow">Silva's Tab</span>
        <button className="icon-btn" title="Sign out" onClick={() => logout.mutate(undefined)}>
          <LogOut size={15} />
        </button>
      </header>

      <div className="projects-bar row">
        <span className="text-label grow">Projects</span>
        <button className="icon-btn new-project-btn" title="New project" onClick={() => setDialog({ kind: "project" })}>
          <Plus size={16} />
        </button>
        <button className="icon-btn unfold-btn" title="Show projects" onClick={onOpen}>
          <ChevronDown size={16} />
        </button>
      </div>

      <div className="sidebar-panel col grow">

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="projects">
            {(drop) => (
              <nav ref={drop.innerRef} {...drop.droppableProps} className="scroll-y grow" style={{ padding: "0 6px 12px" }}>
                {projects.map((project, index) => (
                  <Draggable key={project.id} draggableId={project.id} index={index}>
                    {(drag, snapshot) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        role="button"
                        tabIndex={0}
                        className="project-item"
                        aria-current={project.id === selectedId}
                        data-dragging={snapshot.isDragging}
                        onClick={() => onSelect(project.id)}
                        onKeyDown={(e) => e.key === "Enter" && onSelect(project.id)}
                      >
                        <ProjectAvatar project={project} />
                        <span className="grow truncate">{project.name}</span>
                        <button
                          className="icon-btn"
                          title="Project settings"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialog({ kind: "project", project });
                          }}
                        >
                          <Settings size={14} />
                        </button>
                        {/* Only the handle starts a drag, so swiping the list elsewhere scrolls it (touch screens). */}
                        <span {...drag.dragHandleProps} className="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
                          <GripVertical size={14} />
                        </span>
                      </div>
                    )}
                  </Draggable>
                ))}
                {drop.placeholder}
                {projects.length === 0 && <div className="empty text-small">No project yet</div>}
              </nav>
            )}
          </Droppable>
        </DragDropContext>

        {move.error && (
          <div style={{ padding: "0 8px 8px" }}>
            <ErrorBanner error={move.error} />
          </div>
        )}

        <footer className="sidebar-footer row">
          <button className="link-btn text-small" onClick={() => setDialog({ kind: "archive" })}>
            <Archive size={13} /> Archive
          </button>
          {/* The brand header is hidden on phones, so sign out moves here. */}
          <button className="link-btn text-small show-mobile" onClick={() => logout.mutate(undefined)}>
            <LogOut size={13} /> Sign out
          </button>
        </footer>
      </div>
      <div className="sidebar-backdrop" onClick={onClose} />

      {dialog?.kind === "archive" && (
        <ArchiveDialog
          onClose={() => setDialog(null)}
          onRestored={(id) => {
            setDialog(null);
            onSelect(id);
          }}
        />
      )}
      {dialog?.kind === "project" && (
        <ProjectDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            setDialog(null);
            if (saved) onSelect(saved.id);
            else if (dialog.project?.id === selectedId) onSelect(null);
          }}
        />
      )}
    </aside>
  );
}

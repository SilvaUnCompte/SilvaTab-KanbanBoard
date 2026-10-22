import { useEffect } from "react";
import { Board } from "./components/Board";
import { LoginScreen, PasswordScreen } from "./components/LoginScreen";
import { Sidebar } from "./components/Sidebar";
import { useCurrentUser, useHashRoute, useProjects, useSession } from "./hooks";

export function App() {
  const session = useSession();
  if (session.isPending) return null;
  const user = session.data?.user;
  if (!user) return <LoginScreen />;
  return user.mustChangePassword ? <PasswordScreen /> : <Workspace />;
}

function Workspace() {
  const { data: projects = [], isPending } = useProjects();
  const user = useCurrentUser();
  const { projectId: selectedId, taskId, projectsOpen, selectProject: setSelectedId, openTask, openProjects, closeOverlay } =
    useHashRoute();
  const selected = projects.find((p) => p.id === selectedId);

  // Fall back to the first project when nothing (or a deleted project) is selected.
  useEffect(() => {
    if (!isPending && !selected && projects.length) setSelectedId(projects[0].id);
  }, [isPending, selected, projects, setSelectedId]);

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        onSelect={setSelectedId}
        open={projectsOpen}
        onOpen={openProjects}
        onClose={closeOverlay}
      />
      {selected ? (
        <Board key={selected.id} project={selected} openTaskId={taskId} onOpenTask={openTask} onCloseTask={closeOverlay} />
      ) : (
        <main className="main">
          <div className="center grow text-secondary">{isPending ? "" : user?.isAdmin ? "Create a project to get started" : "No project is shared with you yet"}</div>
        </main>
      )}
    </div>
  );
}

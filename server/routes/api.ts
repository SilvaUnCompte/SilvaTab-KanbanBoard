import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  AccountAccessInput,
  AccountCreateInput,
  allows,
  LoginInput,
  PasswordChangeInput,
  ProjectInput,
  ProjectMoveInput,
  ProjectUpdateInput,
  TagCreateInput,
  TagUpdateInput,
  TaskCreateInput,
  TaskMoveInput,
  TaskStatus,
  TaskUpdateInput,
  type ProjectAccess,
  type Session,
} from "../../shared/schemas.js";
import { closeSession, openSession, readSession } from "../auth.js";
import { AppError } from "../errors.js";
import { accessOf, type Principal } from "../services/accountService.js";
import type { Services } from "../services/index.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Signed-in account, set on authenticated routes. */
    principal: Principal;
  }
}

type IdParams = { Params: { id: string } };

const toSession = (principal: Principal | null): Session => ({
  user: principal && { username: principal.username, isAdmin: principal.isAdmin, mustChangePassword: principal.mustChangePassword },
});

export async function apiRoutes(app: FastifyInstance, { services }: { services: Services }) {
  const { accounts, projects, tags, tasks } = services;

  app.decorateRequest("principal", null as unknown as Principal);

  const currentPrincipal = async (req: FastifyRequest) => {
    const session = readSession(req);
    return session ? accounts.resolve(session) : null;
  };

  /** preHandler checking the account's right on the project owning the `:id` resource. */
  const requires =
    (needed: ProjectAccess, projectOf: (id: string) => Promise<string>) => async (req: FastifyRequest) => {
      const projectId = await projectOf((req.params as { id: string }).id);
      if (!allows(accessOf(req.principal, projectId), needed)) {
        throw AppError.forbidden(needed === "edit" ? "You can only read this project" : "You have no access to this project");
      }
    };
  const projectParam = async (id: string) => id;
  const tagProject = async (id: string) => (await tags.get(id)).projectId;
  const taskProject = async (id: string) => (await tasks.get(id)).projectId;

  // ---------- Session ----------

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { username, password } = LoginInput.parse(req.body);
    const principal = await accounts.authenticate(username, password);
    if (!principal) return reply.code(401).send({ error: "Wrong username or password" });
    openSession(reply, principal.id);
    return toSession(principal);
  });

  app.post("/logout", async (_req, reply) => {
    closeSession(reply);
    return toSession(null);
  });

  app.get("/session", async (req) => toSession(await currentPrincipal(req)));

  // ---------- Signed-in routes ----------

  app.register(async (authed) => {
    authed.addHook("onRequest", async (req) => {
      const principal = await currentPrincipal(req);
      if (!principal) throw new AppError(401, "Unauthorized");
      req.principal = principal;
    });

    // Changing the password invalidates the current session, so a new one is opened.
    authed.post("/password", async (req, reply) => {
      const { password } = PasswordChangeInput.parse(req.body);
      const principal = await accounts.changePassword(req.principal, password);
      openSession(reply, principal.id);
      return toSession(principal);
    });

    authed.register(async (secured) => {
      secured.addHook("onRequest", async (req) => {
        if (req.principal.mustChangePassword) throw AppError.forbidden("Choose a new password first");
      });

      secured.get<{ Querystring: { archived?: string } }>("/projects", (req) =>
        projects.list(req.query.archived === "true", (id) => accessOf(req.principal, id)),
      );

      secured.get<IdParams>("/projects/:id/tags", { preHandler: requires("read", projectParam) }, (req) => tags.list(req.params.id));
      secured.post<IdParams>("/projects/:id/tags", { preHandler: requires("edit", projectParam) }, (req) =>
        tags.create(req.params.id, TagCreateInput.parse(req.body)),
      );
      secured.patch<IdParams>("/tags/:id", { preHandler: requires("edit", tagProject) }, (req) =>
        tags.update(req.params.id, TagUpdateInput.parse(req.body)),
      );
      secured.delete<IdParams>("/tags/:id", { preHandler: requires("edit", tagProject) }, async (req, reply) => {
        await tags.delete(req.params.id);
        return reply.code(204).send();
      });

      secured.get<IdParams & { Querystring: { status?: string } }>(
        "/projects/:id/tasks",
        { preHandler: requires("read", projectParam) },
        (req) => tasks.list(req.params.id, TaskStatus.optional().parse(req.query.status)),
      );
      secured.post<IdParams>("/projects/:id/tasks", { preHandler: requires("edit", projectParam) }, (req) =>
        tasks.create(req.params.id, TaskCreateInput.parse(req.body)),
      );
      secured.patch<IdParams>("/tasks/:id", { preHandler: requires("edit", taskProject) }, (req) =>
        tasks.update(req.params.id, TaskUpdateInput.parse(req.body)),
      );
      secured.post<IdParams>("/tasks/:id/move", { preHandler: requires("edit", taskProject) }, (req) =>
        tasks.move(req.params.id, TaskMoveInput.parse(req.body)),
      );
      secured.delete<IdParams>("/tasks/:id", { preHandler: requires("edit", taskProject) }, async (req, reply) => {
        await tasks.delete(req.params.id);
        return reply.code(204).send();
      });

      // ---------- Admin only ----------

      secured.register(async (admin) => {
        admin.addHook("onRequest", async (req) => {
          if (!req.principal.isAdmin) throw AppError.forbidden("Only the admin can do this");
        });

        admin.post("/projects", (req) => projects.create(ProjectInput.parse(req.body)));
        admin.patch<IdParams>("/projects/:id", (req) => projects.update(req.params.id, ProjectUpdateInput.parse(req.body)));
        admin.post<IdParams>("/projects/:id/move", (req) => projects.move(req.params.id, ProjectMoveInput.parse(req.body)));
        admin.delete<IdParams>("/projects/:id", async (req, reply) => {
          await projects.delete(req.params.id);
          return reply.code(204).send();
        });

        admin.get("/accounts", () => accounts.list());
        admin.post("/accounts", (req) => accounts.create(AccountCreateInput.parse(req.body)));
        admin.post<IdParams>("/accounts/:id/password", (req) => accounts.resetPassword(req.params.id));
        admin.put<IdParams>("/accounts/:id/access", (req) => accounts.setAccess(req.params.id, AccountAccessInput.parse(req.body)));
        admin.delete<IdParams>("/accounts/:id", async (req, reply) => {
          await accounts.delete(req.params.id);
          return reply.code(204).send();
        });
      });
    });
  });
}

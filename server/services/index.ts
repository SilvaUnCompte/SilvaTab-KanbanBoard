import type { Db } from "../db.js";
import { AccountService } from "./accountService.js";
import { ProjectService } from "./projectService.js";
import { TagService } from "./tagService.js";
import { TaskService } from "./taskService.js";

export function createServices(db: Db, admin: { username: string; password: string }) {
  const projects = new ProjectService(db);
  const tags = new TagService(db, projects);
  const tasks = new TaskService(db, projects, tags);
  const accounts = new AccountService(db, projects, admin);
  return { accounts, projects, tags, tasks };
}

export type Services = ReturnType<typeof createServices>;

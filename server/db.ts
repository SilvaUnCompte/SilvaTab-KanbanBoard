import { MongoClient, type ObjectId } from "mongodb";
import type { ProjectAccess, TaskPriority, TaskStatus } from "../shared/schemas.js";

export interface ProjectDoc {
  _id: ObjectId;
  name: string;
  initials: string;
  hue: number;
  /** Missing on projects created before archiving existed. */
  archived?: boolean;
  /** Missing on projects created before reordering existed: they come first, by creation date. */
  position?: number;
  createdAt: Date;
}

export interface TaskDoc {
  _id: ObjectId;
  projectId: ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
  blockedBy: ObjectId[];
  /** Missing on tasks created before tags existed. */
  tags?: ObjectId[];
  /** Missing on tasks created before priorities existed. */
  priority?: TaskPriority;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagDoc {
  _id: ObjectId;
  projectId: ObjectId;
  label: string;
  /** Lower-cased label, unique per project. */
  key: string;
  hue: number;
  createdAt: Date;
}

export interface UserDoc {
  _id: ObjectId;
  username: string;
  /** Lower-cased username, unique. */
  key: string;
  passwordHash: string;
  mustChangePassword: boolean;
  /** Read or edit right by project id; missing projects are hidden. */
  access: Record<string, Exclude<ProjectAccess, "none">>;
  /** Sessions opened before this date are rejected. */
  credentialsChangedAt: Date;
  createdAt: Date;
}

export async function connectDb(url: string, dbName: string) {
  const client = new MongoClient(url);
  await client.connect();
  const db = client.db(dbName);
  const projects = db.collection<ProjectDoc>("projects");
  const tasks = db.collection<TaskDoc>("tasks");
  const tags = db.collection<TagDoc>("tags");
  const users = db.collection<UserDoc>("users");
  await projects.createIndex({ position: 1, createdAt: 1 });
  await tasks.createIndex({ projectId: 1, status: 1, position: 1 });
  await tags.createIndex({ projectId: 1, key: 1 }, { unique: true });
  await users.createIndex({ key: 1 }, { unique: true });
  return { client, projects, tasks, tags, users };
}

export type Db = Awaited<ReturnType<typeof connectDb>>;

import { ObjectId, type UpdateFilter } from "mongodb";
import {
  caseKey,
  ObjectIdString,
  type Account,
  type AccountAccessInput,
  type AccountCreateInput,
  type AccountWithPassword,
  type ProjectAccess,
} from "../../shared/schemas.js";
import { generatePassword, hashPassword, safeEqual, verifyPassword, type SessionInfo } from "../auth.js";
import type { Db, UserDoc } from "../db.js";
import { AppError } from "../errors.js";
import { toObjectId } from "./ids.js";
import type { ProjectService } from "./projectService.js";

/** The signed-in account. The admin is not stored: its credentials come from the environment. */
export interface Principal extends Account {
  isAdmin: boolean;
}

export const accessOf = (principal: Principal, projectId: string): ProjectAccess =>
  principal.isAdmin ? "edit" : (principal.access[projectId] ?? "none");

const ADMIN_ID = "admin";

const toAccount = (doc: UserDoc): Account => ({
  id: doc._id.toHexString(),
  username: doc.username,
  mustChangePassword: doc.mustChangePassword,
  access: doc.access,
});

const toPrincipal = (doc: UserDoc): Principal => ({ ...toAccount(doc), isAdmin: false });

export class AccountService {
  private readonly admin: Principal;

  constructor(
    private readonly db: Db,
    private readonly projects: ProjectService,
    private readonly adminCredentials: { username: string; password: string },
  ) {
    this.admin = { id: ADMIN_ID, username: adminCredentials.username, isAdmin: true, mustChangePassword: false, access: {} };
  }

  async authenticate(username: string, password: string): Promise<Principal | null> {
    const key = caseKey(username);
    if (key === caseKey(this.admin.username)) return safeEqual(password, this.adminCredentials.password) ? this.admin : null;
    const doc = await this.db.users.findOne({ key });
    return doc && (await verifyPassword(password, doc.passwordHash)) ? toPrincipal(doc) : null;
  }

  /** Account behind a session, unless it was deleted or its password changed since the session was opened. */
  async resolve({ userId, issuedAt }: SessionInfo): Promise<Principal | null> {
    if (userId === ADMIN_ID) return this.admin;
    if (!ObjectIdString.safeParse(userId).success) return null;
    const doc = await this.db.users.findOne({ _id: new ObjectId(userId) });
    return doc && doc.credentialsChangedAt.getTime() <= issuedAt ? toPrincipal(doc) : null;
  }

  async list(): Promise<Account[]> {
    const docs = await this.db.users.find().sort({ key: 1 }).toArray();
    return docs.map(toAccount);
  }

  /** New accounts see no project and must replace the generated password at first sign-in. */
  async create({ username }: AccountCreateInput): Promise<AccountWithPassword> {
    const key = caseKey(username);
    if (key === caseKey(this.admin.username)) throw new AppError(409, `"${username}" is reserved for the admin`);
    const password = generatePassword();
    const now = new Date();
    const doc: UserDoc = {
      _id: new ObjectId(),
      username,
      key,
      passwordHash: await hashPassword(password),
      mustChangePassword: true,
      access: {},
      credentialsChangedAt: now,
      createdAt: now,
    };
    await this.db.users.insertOne(doc);
    return { ...toAccount(doc), password };
  }

  /** Signs the user out and makes them pick a new password at next sign-in. */
  async resetPassword(id: string): Promise<AccountWithPassword> {
    const password = generatePassword();
    const doc = await this.setCredentials(toObjectId(id), password, true);
    if (!doc) throw AppError.notFound("Account", id);
    return { ...toAccount(doc), password };
  }

  async changePassword(principal: Principal, password: string): Promise<Principal> {
    if (principal.isAdmin) throw AppError.badRequest("The admin password is set by the SILVA_PASSWORD environment variable");
    const doc = await this.setCredentials(new ObjectId(principal.id), password, false);
    if (!doc) throw AppError.notFound("Account", principal.id);
    return toPrincipal(doc);
  }

  async setAccess(id: string, { projectId, access }: AccountAccessInput): Promise<Account> {
    await this.projects.get(projectId);
    const field = `access.${projectId}`;
    const update = (access === "none" ? { $unset: { [field]: "" } } : { $set: { [field]: access } }) as UpdateFilter<UserDoc>;
    const doc = await this.db.users.findOneAndUpdate({ _id: toObjectId(id) }, update, { returnDocument: "after" });
    if (!doc) throw AppError.notFound("Account", id);
    return toAccount(doc);
  }

  async delete(id: string): Promise<void> {
    const { deletedCount } = await this.db.users.deleteOne({ _id: toObjectId(id) });
    if (!deletedCount) throw AppError.notFound("Account", id);
  }

  private async setCredentials(_id: ObjectId, password: string, mustChangePassword: boolean) {
    const $set = { passwordHash: await hashPassword(password), mustChangePassword, credentialsChangedAt: new Date() };
    return this.db.users.findOneAndUpdate({ _id }, { $set }, { returnDocument: "after" });
  }
}

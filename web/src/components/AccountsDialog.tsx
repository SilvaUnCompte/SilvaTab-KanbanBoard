import { BookOpen, Check, Copy, EyeOff, KeyRound, List, Pencil, Plus, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ACCESS_LABELS, PROJECT_ACCESSES, type Account, type AccountWithPassword, type ProjectAccess } from "../../../shared/schemas";
import { useAccounts, useCreateAccount, useDeleteAccount, useProjects, useResetPassword, useSetAccess } from "../hooks";
import { CloseFooter, DeleteIconButton, ErrorBanner, Modal, ProjectAvatar } from "./ui";

/** Sub-dialogs replace the account list instead of stacking, so Escape only closes the top one. */
type View =
  | { kind: "list" }
  | { kind: "confirmReset"; account: Account }
  | { kind: "password"; account: AccountWithPassword }
  | { kind: "access"; accountId: string };

/** Admin panel: create accounts, reset their password, choose which projects they see and delete them. */
export function AccountsDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const back = () => setView({ kind: "list" });
  const showPassword = (account: AccountWithPassword) => setView({ kind: "password", account });

  switch (view.kind) {
    case "confirmReset":
      return <ConfirmResetDialog account={view.account} onCancel={back} onReset={showPassword} />;
    case "password":
      return <PasswordDialog account={view.account} onClose={back} />;
    case "access":
      return <AccessDialog accountId={view.accountId} onClose={back} />;
    default:
      return (
        <AccountList
          onClose={onClose}
          onCreated={showPassword}
          onReset={(account) => setView({ kind: "confirmReset", account })}
          onEditAccess={(account) => setView({ kind: "access", accountId: account.id })}
        />
      );
  }
}

function AccountList({
  onClose,
  onCreated,
  onReset,
  onEditAccess,
}: {
  onClose: () => void;
  onCreated: (account: AccountWithPassword) => void;
  onReset: (account: Account) => void;
  onEditAccess: (account: Account) => void;
}) {
  const { data: accounts = [], isPending, error } = useAccounts();
  const create = useCreateAccount();
  const remove = useDeleteAccount();
  /** Username typed in the new-account row, null while the row is hidden. */
  const [newName, setNewName] = useState<string | null>(null);

  const title = (
    <span className="row gap-8">
      Accounts
      <button className="icon-btn" title="New account" onClick={() => setNewName("")}>
        <Plus size={16} />
      </button>
    </span>
  );

  return (
    <Modal size="sm" title={title} onClose={onClose} footer={<CloseFooter onClose={onClose} />}>
      {newName !== null && (
        <form
          className="row gap-8"
          onSubmit={async (e) => {
            e.preventDefault();
            onCreated(await create.mutateAsync({ username: newName }));
          }}
        >
          <input className="input grow" autoFocus placeholder="Username" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button className="btn btn-primary" disabled={!newName.trim() || create.isPending}>Create</button>
        </form>
      )}
      {!isPending && accounts.length === 0 && newName === null && <div className="empty">No account yet</div>}
      <div className="col gap-4">
        {accounts.map((account) => (
          <div key={account.id} className="row gap-8">
            <span className="grow truncate">{account.username}</span>
            {account.mustChangePassword && (
              <span className="badge" title="The generated password has not been replaced yet">Pending</span>
            )}
            <button className="icon-btn" title="Project access" onClick={() => onEditAccess(account)}>
              <List size={14} />
            </button>
            <button className="icon-btn" title="Reset password" onClick={() => onReset(account)}>
              <KeyRound size={14} />
            </button>
            <DeleteIconButton title="Delete account" onDelete={() => remove.mutate(account.id)} />
          </div>
        ))}
      </div>
      <ErrorBanner error={error ?? create.error ?? remove.error} />
    </Modal>
  );
}

function ConfirmResetDialog({
  account,
  onCancel,
  onReset,
}: {
  account: Account;
  onCancel: () => void;
  onReset: (account: AccountWithPassword) => void;
}) {
  const reset = useResetPassword();
  return (
    <Modal
      size="sm"
      title="Reset password"
      onClose={onCancel}
      footer={
        <>
          <span className="grow" />
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={reset.isPending} onClick={async () => onReset(await reset.mutateAsync(account.id))}>
            Reset
          </button>
        </>
      }
    >
      <span>
        Generate a new password for <strong>{account.username}</strong>? They are signed out and will have to choose their own
        password at next sign-in.
      </span>
      <ErrorBanner error={reset.error} />
    </Modal>
  );
}

function PasswordDialog({ account, onClose }: { account: AccountWithPassword; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(account.password);
    setCopied(true);
  };

  return (
    <Modal size="sm" title={`Password of ${account.username}`} onClose={onClose} footer={<CloseFooter onClose={onClose} />}>
      <span className="text-secondary">
        Send it to {account.username}: it will not be shown again, and must be replaced at first sign-in.
      </span>
      <div className="row gap-8">
        <input className="input grow mono" readOnly autoFocus value={account.password} onFocus={(e) => e.currentTarget.select()} />
        <button className="btn" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </Modal>
  );
}

const ACCESS_ICONS: Record<ProjectAccess, LucideIcon> = { none: EyeOff, read: BookOpen, edit: Pencil };

const nextAccess = (access: ProjectAccess) => PROJECT_ACCESSES[(PROJECT_ACCESSES.indexOf(access) + 1) % PROJECT_ACCESSES.length];

function AccessDialog({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts();
  const { data: projects = [] } = useProjects();
  const setAccess = useSetAccess();
  const account = accounts.find((a) => a.id === accountId);

  return (
    <Modal size="sm" title={`Projects of ${account?.username ?? ""}`} onClose={onClose} footer={<CloseFooter onClose={onClose} />}>
      {projects.length === 0 && <div className="empty">No project</div>}
      <div className="col gap-4">
        {projects.map((project) => {
          const access = account?.access[project.id] ?? "none";
          const Icon = ACCESS_ICONS[access];
          return (
            <div key={project.id} className="row gap-8">
              <ProjectAvatar project={project} />
              <span className="grow truncate">{project.name}</span>
              <button
                className="icon-btn access-toggle"
                data-access={access}
                title={`${ACCESS_LABELS[access]} (click to change)`}
                onClick={() => setAccess.mutate({ id: accountId, projectId: project.id, access: nextAccess(access) })}
              >
                <Icon size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <ErrorBanner error={setAccess.error} />
    </Modal>
  );
}

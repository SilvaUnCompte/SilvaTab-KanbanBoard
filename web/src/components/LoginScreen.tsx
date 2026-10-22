import { useState, type ReactNode } from "react";
import { useChangePassword, useLogin, useLogout } from "../hooks";
import { ErrorBanner } from "./ui";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  return (
    <AuthCard
      onSubmit={() => login.mutate({ username, password })}
      error={login.error}
      submit="Sign in"
      canSubmit={Boolean(username.trim() && password) && !login.isPending}
    >
      <label className="field">
        <span className="text-secondary">Username</span>
        <input className="input" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label className="field">
        <span className="text-secondary">Password</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
    </AuthCard>
  );
}

/** Shown on first sign-in and after a reset: the generated password must be replaced. */
export function PasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const change = useChangePassword();
  const logout = useLogout();
  const mismatch = Boolean(confirm) && confirm !== password;

  return (
    <AuthCard
      onSubmit={() => change.mutate(password)}
      error={change.error ?? (mismatch ? "Passwords do not match" : null)}
      submit="Save password"
      canSubmit={Boolean(password) && confirm === password && !change.isPending}
      extra={
        <button type="button" className="link-btn text-small" onClick={() => logout.mutate(undefined)}>
          Sign out
        </button>
      }
    >
      <span className="text-secondary">Choose your own password to continue.</span>
      <label className="field">
        <span className="text-secondary">New password</span>
        <input
          className="input"
          type="password"
          autoFocus
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="text-secondary">Confirm</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
    </AuthCard>
  );
}

function AuthCard({
  onSubmit,
  error,
  submit,
  canSubmit,
  extra,
  children,
}: {
  onSubmit: () => void;
  error: unknown;
  submit: string;
  canSubmit: boolean;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="center full">
      <form
        className="login-card col gap-16"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="row gap-8">
          <span className="brand-mark" />
          <span className="brand">Silva's Tab</span>
        </div>
        {children}
        <ErrorBanner error={error} />
        <button className="btn btn-primary" disabled={!canSubmit}>
          {submit}
        </button>
        {extra}
      </form>
    </div>
  );
}

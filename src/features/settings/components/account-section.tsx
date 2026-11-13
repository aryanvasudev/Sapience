"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { DeleteIcon, PersonAddIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { signOut } from "@/features/auth/actions";
import { cn } from "@/lib/utils";

import { deleteAccount, deleteTutorHistory, setPassword, type SettingsResult } from "../actions";

function Result({ result }: { result: SettingsResult | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={cn("text-sm", result.ok ? "text-muted-foreground" : "text-destructive")}>
      {result.message}
    </p>
  );
}

export function AccountSection({ email, isAnonymous }: { email: string | null; isAnonymous: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-8">
      {isAnonymous ? (
        <div className="grid gap-3 rounded-lg border bg-card p-4">
          <p className="text-[0.9375rem] font-medium">You&apos;re using Sapience as a guest</p>
          <p className="text-sm text-muted-foreground">
            Create an account to keep your lessons, answers and revision on any device. Everything you&apos;ve done so far
            moves to the new account.
          </p>
          <Button asChild className="justify-self-start">
            <Link href="/signup">
              <PersonAddIcon />
              Create an account
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm">
            Signed in as <span className="font-medium">{email ?? "your account"}</span>
          </p>
          <PasswordForm />
        </>
      )}

      <div className="grid gap-2">
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
        >
          {pending ? "Signing out…" : "Sign out"}
        </Button>
        {isAnonymous ? (
          <p className="text-sm text-muted-foreground">Signing out of a guest session loses its progress.</p>
        ) : null}
      </div>
    </div>
  );
}

function PasswordForm() {
  const id = useId();
  const [password, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  return (
    <form
      className="grid max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await setPassword({ password });
          setResult(r);
          if (r.ok) setValue("");
        });
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        Set a new password
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
          value={password}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <Button type="submit" variant="outline" disabled={pending || password.length < 8}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        At least 8 characters.
      </p>
      <Result result={result} />
    </form>
  );
}

export function DataSection() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          Your conversations with the tutor are stored so they reopen with the lecture. Saved concepts are managed in the
          Library.
        </p>
        <ConfirmButton
          label="Delete tutor history"
          title="Delete every tutor conversation?"
          description="Questions and answers from every lecture are removed. Lessons, saved concepts and revision stay."
          confirmLabel="Delete history"
          disabled={pending}
          onConfirm={() => startTransition(async () => setResult(await deleteTutorHistory()))}
        />
        <Result result={result} />
      </div>
      <DeleteAccount />
    </div>
  );
}

function DeleteAccount() {
  const id = useId();
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  return (
    <div className="grid gap-3 rounded-lg border border-destructive/30 p-4">
      <p className="text-[0.9375rem] font-medium">Delete account</p>
      <p className="text-sm text-muted-foreground">
        Removes your account and everything in it: progress, answers, tutor history, saved concepts and revision. This
        can&apos;t be undone. Shared lessons stay for other students.
      </p>
      <form
        className="grid max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await deleteAccount({ confirm })));
        }}
      >
        <label htmlFor={id} className="text-sm">
          Type <span className="font-mono font-medium">delete</span> to confirm
        </label>
        <div className="flex gap-2">
          <Input id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} />
          <Button type="submit" variant="destructive" disabled={pending || confirm !== "delete"}>
            <DeleteIcon />
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </div>
        <Result result={result} />
      </form>
    </div>
  );
}

function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  disabled,
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="justify-self-start" disabled={disabled}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" variant="destructive" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { DeleteIcon, PersonAddIcon } from "@/components/icons";
import { MorphText } from "@/components/motion/morph-text";
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

import { deleteAccount, deleteTutorHistory, setPassword, type SettingsResult } from "../actions";
import { SettingsCard, SettingsFooter, SettingsResultText, SettingsRow, SettingsRows } from "./settings-card";

/** Row whose control sits beside the label on every width (a single button). */
const INLINE_ROW = "grid-cols-[minmax(0,1fr)_auto] items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]";

export function AccountSection({ email, isAnonymous }: { email: string | null; isAnonymous: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <SettingsCard
      id="account"
      title="Account"
      description={
        isAnonymous ? (
          "You're using Sapience as a guest."
        ) : (
          <>
            Signed in as <span className="text-foreground">{email ?? "your account"}</span>
          </>
        )
      }
    >
      <SettingsRows>
        {isAnonymous ? (
          <SettingsRow
            label="Keep your progress"
            description="Create an account to keep your lessons, answers and revision on any device. Everything you've done so far moves to the new account."
            className="md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <Button asChild>
              <Link href="/signup">
                <PersonAddIcon />
                Create an account
              </Link>
            </Button>
          </SettingsRow>
        ) : (
          <PasswordRow />
        )}

        <SettingsRow
          label="Sign out"
          description={isAnonymous ? "Signing out of a guest session loses its progress." : "Sign out of Sapience on this device."}
          className={INLINE_ROW}
        >
          <Button type="button" variant="outline" disabled={pending} onClick={() => startTransition(() => signOut())}>
            <MorphText>{pending ? "Signing out…" : "Sign out"}</MorphText>
          </Button>
        </SettingsRow>
      </SettingsRows>
    </SettingsCard>
  );
}

function PasswordRow() {
  const id = useId();
  const [password, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  return (
    <SettingsRow label="Set a new password" htmlFor={id} description="At least 8 characters." descriptionId={`${id}-hint`}>
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await setPassword({ password });
            setResult(r);
            if (r.ok) setValue("");
          });
        }}
      >
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
            className="rounded-[10px]"
          />
          <Button type="submit" variant="outline" disabled={pending || password.length < 8}>
            <MorphText>{pending ? "Saving…" : "Save"}</MorphText>
          </Button>
        </div>
        <SettingsResultText result={result} />
      </form>
    </SettingsRow>
  );
}

export function DataSection() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  return (
    <>
      <SettingsCard
        id="data"
        title="Your data"
        description={
          <>
            What the AI receives, and what Sapience keeps, is explained on the{" "}
            <Link
              href="/privacy"
              className="text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors duration-150 ease-(--ease-out) [@media(hover:hover)]:hover:decoration-foreground"
            >
              privacy page
            </Link>
            .
          </>
        }
      >
        <SettingsRows>
          <SettingsRow
            label="Tutor history"
            description="Your conversations with the tutor are stored so they reopen with the lecture. Saved concepts are managed in the Library."
            className="md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="grid justify-items-start gap-2 md:justify-items-end">
              <ConfirmButton
                label="Delete tutor history"
                title="Delete every tutor conversation?"
                description="Questions and answers from every lecture are removed. Lessons, saved concepts and revision stay."
                confirmLabel="Delete history"
                disabled={pending}
                onConfirm={() => startTransition(async () => setResult(await deleteTutorHistory()))}
              />
              <SettingsResultText result={result} />
            </div>
          </SettingsRow>
        </SettingsRows>
      </SettingsCard>
      <DeleteAccount />
    </>
  );
}

function DeleteAccount() {
  const id = useId();
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  return (
    <SettingsCard
      id="delete-account"
      title="Delete account"
      description="Removes your account and everything in it: progress, answers, tutor history, saved concepts and revision. This can't be undone. Shared lessons stay for other students."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => setResult(await deleteAccount({ confirm })));
        }}
      >
        <SettingsRows>
          <SettingsRow
            label={
              <>
                Type <span className="font-mono">delete</span> to confirm
              </>
            }
            htmlFor={id}
          >
            <Input
              id={id}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="rounded-[10px] font-mono"
            />
          </SettingsRow>
        </SettingsRows>
        <SettingsFooter>
          <SettingsResultText result={result} className="mr-auto" />
          <Button type="submit" variant="destructive" disabled={pending || confirm !== "delete"}>
            <DeleteIcon />
            <MorphText>{pending ? "Deleting…" : "Delete"}</MorphText>
          </Button>
        </SettingsFooter>
      </form>
    </SettingsCard>
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
        <Button type="button" variant="outline" disabled={disabled}>
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

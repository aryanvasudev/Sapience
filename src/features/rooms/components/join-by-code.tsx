"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { ArrowForwardIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRoomCode, joinPath, normalizeRoomCode } from "@/lib/rooms/code";

import { FormError } from "./room-ui";
import { ScanQrDialog } from "./scan-qr-dialog";

/** "Join with a code": type it or scan the room's QR. Both lead to the join confirmation. */
export function JoinByCode() {
  const id = useId();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const go = (value: string) => router.push(joinPath(value));

  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const normalized = normalizeRoomCode(code);
        if (!isRoomCode(normalized)) return setError("Room codes are 6 letters and numbers, like K7Q 4MX.");
        go(normalized);
      }}
    >
      <label htmlFor={`${id}-code`} className="text-sm font-medium">
        Join with a code
      </label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-code`}
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="K7Q 4MX"
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          className="w-36 flex-none font-mono tracking-[0.12em] uppercase placeholder:tracking-[0.12em]"
        />
        <Button type="submit" variant="outline" disabled={normalizeRoomCode(code).length === 0}>
          Join
          <ArrowForwardIcon />
        </Button>
        <ScanQrDialog onCode={go} />
      </div>
      <FormError message={error} />
    </form>
  );
}

"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export type FormResult = string | void | { error: string };
export type FormAction = (fd: FormData) => Promise<FormResult>;
export default function PeopleForm({ action, children, confirm, className = "panel form" }: {
  action: FormAction; children: React.ReactNode; confirm?: string; className?: string;
}) {
  const router = useRouter();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [state, submit, pending] = useActionState<{ error?: string; success?: number }, FormData>(async (_previous, fd) => {
    try {
      const url = await action(fd);
      if (url && typeof url === "object") return { error: url.error };
      if (url) router.push(url);
      router.refresh();
      return { success: Date.now() };
    } catch (error) { return { error: error instanceof Error ? error.message : "Speichern fehlgeschlagen." }; }
  }, {});
  useEffect(() => { if (state.success) toast.success("Gespeichert."); }, [state.success]);
  useEffect(() => { if (state.error) errorRef.current?.focus(); }, [state]);
  // Dispatch manually so React does not reset uncontrolled fields after a
  // handled validation error. Keep the submitted values available for correction.
  return <form className={className} aria-busy={pending} onSubmit={event => {
    event.preventDefault();
    if (pending || (confirm && !window.confirm(confirm))) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  }}>
    <fieldset disabled={pending} className="people-fields">{children}</fieldset>
    {pending && <p role="status">Wird gespeichert …</p>}
    {state.error && <p ref={errorRef} tabIndex={-1} role="alert" className="accent">{state.error}</p>}
  </form>;
}

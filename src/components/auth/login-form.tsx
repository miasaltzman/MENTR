"use client";

import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { GoogleIcon } from "@/components/auth/google-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emailAuth,
  signInWithGoogle,
  type AuthFormState,
} from "@/lib/auth/actions";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className="w-full"
      disabled={pending}
    >
      {pending ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
      Continue with Google
    </Button>
  );
}

const initial: AuthFormState = { status: "idle" };

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [state, action] = useActionState(emailAuth, initial);
  // Lets the user go back to the email step after a code was sent.
  const [editingEmail, setEditingEmail] = useState(false);

  const sentEmail =
    state.status === "sent" ||
    (state.status === "error" && state.stage === "code")
      ? (state.email ?? null)
      : null;
  const showCodeStep = sentEmail !== null && !editingEmail;
  const error = state.status === "error" ? state.message : initialError;

  if (showCodeStep) {
    return (
      <div className="space-y-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Mail className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-2 text-muted-foreground">
            We sent a sign-in link to{" "}
            <span className="font-medium text-foreground">{sentEmail}</span>.
            Open it on this device, or enter the code from the email.
          </p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <form action={action} className="space-y-3">
          <input type="hidden" name="intent" value="verify" />
          <input type="hidden" name="email" value={sentEmail} />
          <input type="hidden" name="next" value={next} />
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="123456"
            className="h-11 text-center font-mono text-lg tracking-[0.3em]"
            required
          />
          <SubmitButton>Verify and continue</SubmitButton>
        </form>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setEditingEmail(true)}
        >
          <ArrowLeft />
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleButton />
      </form>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <form
        action={action}
        onSubmit={() => setEditingEmail(false)}
        className="space-y-3"
      >
        <input type="hidden" name="intent" value="send" />
        <input type="hidden" name="next" value={next} />
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="h-11"
          defaultValue={state.status !== "idle" ? state.email : undefined}
          required
        />
        <SubmitButton>Email me a sign-in link</SubmitButton>
      </form>
      <p className="text-xs text-muted-foreground">
        No password needed. New here? This creates your account.
      </p>
    </div>
  );
}

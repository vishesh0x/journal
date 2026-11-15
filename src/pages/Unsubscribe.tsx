import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [message, setMessage] = useState("Removing you from the list…");

  useEffect(() => {
    if (!token) {
      setMessage("This link is missing its unsubscribe code.");
      return;
    }
    api
      .post<{ ok: boolean; message: string }>("/subscribers/unsubscribe", { token })
      .then((res) => setMessage(res.message))
      .catch(() => setMessage("Something went wrong. Please try the link again."));
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">Email preferences</h1>
        <p className="mt-3 text-muted-foreground">{message}</p>
        <a href="/" className="mt-6 inline-block text-primary underline underline-offset-2">
          Back to the journal
        </a>
      </div>
    </div>
  );
}

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
    <main className="container flex min-h-screen items-center">
      <div className="tile tone-c flex max-w-xl flex-col gap-5">
        <h1 className="h-section">Email preferences</h1>
        <p role="status">{message}</p>
        <a href="/" className="btn self-start">
          Back to the journal
        </a>
      </div>
    </main>
  );
}

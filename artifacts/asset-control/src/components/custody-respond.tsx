import { useState } from "react";
import { useRoute } from "wouter";
import { ShieldCheck } from "lucide-react";
import { useGetPublicCustody, useRespondPublicCustody } from "@workspace/api-client-react";
import { AppFooter, Button } from "@/components/asset-ui";

function errorText(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { error?: string } }).data;
    if (data?.error) return data.error;
  }
  return err instanceof Error ? err.message : fallback;
}

export function CustodyRespondPage() {
  const [, params] = useRoute("/custody/:token");
  const token = params?.token ?? "";
  const view = useGetPublicCustody(token);
  const respond = useRespondPublicCustody();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function answer(itemId: string, response: "confirmed" | "denied") {
    setError("");
    try {
      await respond.mutateAsync({ token, data: { items: [{ itemId, response, note: notes[itemId] ?? "" }] } });
      await view.refetch();
    } catch (err) {
      setError(errorText(err, "Could not save that answer."));
      void view.refetch();
    }
  }

  const data = view.data;
  const pending = data?.items.filter((item) => item.response === "pending") ?? [];

  return (
    <div className="auth-landing noise custody-public">
      <header className="auth-landing-header">
        <span className="brand">
          <span className="brand-mark"><ShieldCheck size={20} strokeWidth={2.4} /></span>
          <span className="brand-copy"><strong>asset<span>control</span></strong><small>CUSTODY CHECK</small></span>
        </span>
      </header>
      <main className="auth-landing-main">
        {view.isLoading ? <p>Loading your assigned equipment…</p> : view.isError ? (
          <div>
            <h1>This link is not valid</h1>
            <p>{errorText(view.error, "It may have expired, or this check is closed.")}</p>
          </div>
        ) : data ? (
          <div>
            <div className="auth-kicker"><span className="health-dot" /> {data.checkTitle}</div>
            <h1>Hi {data.personName.split(" ")[0] || data.personName}, do you still have this equipment?</h1>
            <p>Please confirm each item. If something is missing, say so — inventory status is not changed automatically.</p>
            <div className="custody-items">
              {data.items.map((item) => (
                <div className="custody-item" key={item.id} data-testid={`custody-item-${item.id}`}>
                  <div>
                    <b>{item.assetName}</b>
                    <small>{item.assetTag} · {item.response === "pending" ? "Waiting" : item.response === "confirmed" ? "You have it" : "Reported missing"}</small>
                  </div>
                  {item.response === "pending" && (
                    <>
                      <label className="field field-full">
                        <span>Optional note</span>
                        <input value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Anything we should know?" />
                      </label>
                      <div className="topbar-button-row">
                        <Button type="button" className="button-dark" data-testid={`button-confirm-${item.id}`} disabled={respond.isPending} onClick={() => void answer(item.id, "confirmed")}>I have it</Button>
                        <Button type="button" className="button-ghost" data-testid={`button-deny-${item.id}`} disabled={respond.isPending} onClick={() => void answer(item.id, "denied")}>I don’t have it</Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {error && <p className="form-error">{error}</p>}
            {pending.length === 0 && <p className="custody-thanks">Thank you. You can close this page.</p>}
          </div>
        ) : null}
      </main>
      <AppFooter />
    </div>
  );
}

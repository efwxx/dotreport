import Link from "next/link";

import { isPasswordConfigured, loadConfig } from "@/lib/og";

import { OgEditor } from "./OgEditor";

export const dynamic = "force-dynamic";

export const metadata = { title: "embed editor" };

export default async function OgPage() {
  const configured = isPasswordConfigured();
  if (!configured) {
    return (
      <main className="page">
        <div className="sched-header">
          <Link href="/" className="sched-back">
            ← home
          </Link>
          <h1 className="sched-title">embed editor</h1>
        </div>
        <div className="sched-card sched-warn">
          <p>
            neither <strong>OG_PASSWORD_HASH</strong> nor{" "}
            <strong>SCHEDULE_PASSWORD_HASH</strong> is set in{" "}
            <code>.env.local</code>. generate one with{" "}
            <code>node scripts/hash-password.mjs yourpassword</code>, paste the
            output, then restart the server.
          </p>
        </div>
      </main>
    );
  }

  const config = await loadConfig();
  return <OgEditor initial={config} />;
}

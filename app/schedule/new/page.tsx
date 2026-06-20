import Link from "next/link";

import { isPasswordConfigured } from "@/lib/schedule";

import { NewScheduleForm } from "./NewScheduleForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "new schedule" };

export default function NewSchedulePage() {
  const configured = isPasswordConfigured();
  return (
    <main className="page">
      <div className="sched-header">
        <Link href="/" className="sched-back">
          ← home
        </Link>
        <h1 className="sched-title">new schedule</h1>
      </div>

      {configured ? (
        <NewScheduleForm />
      ) : (
        <div className="sched-card sched-warn">
          <p>
            <strong>SCHEDULE_PASSWORD_HASH</strong> isn’t set in <code>.env.local</code>.
            Generate one with{" "}
            <code>node scripts/hash-password.mjs yourpassword</code>, paste the
            output into <code>.env.local</code>, then restart the server.
          </p>
        </div>
      )}
    </main>
  );
}

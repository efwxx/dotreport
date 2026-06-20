import Link from "next/link";

import { isPasswordConfigured } from "@/lib/schedule";

import { ScheduleIndex } from "./ScheduleIndex";

export const dynamic = "force-dynamic";

export const metadata = { title: "schedules" };

export default function SchedulesIndexPage() {
  const configured = isPasswordConfigured();
  return (
    <main className="page">
      <div className="sched-header">
        <Link href="/" className="sched-back">
          ← home
        </Link>
        <h1 className="sched-title">schedules</h1>
        <p className="sched-note">
          enter the creator password to list every schedule you’ve created,
          with its share + creator URLs.
        </p>
      </div>

      {configured ? (
        <ScheduleIndex />
      ) : (
        <div className="sched-card sched-warn">
          <p>
            <strong>SCHEDULE_PASSWORD_HASH</strong> isn’t set in{" "}
            <code>.env.local</code>. Generate one with{" "}
            <code>node scripts/hash-password.mjs yourpassword</code>, paste the
            output, then restart the server.
          </p>
        </div>
      )}

      <div className="sched-actions sched-index-create">
        <Link href="/schedule/new" className="sched-btn">
          + new schedule
        </Link>
      </div>
    </main>
  );
}

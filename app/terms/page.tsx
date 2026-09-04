import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Use" };

/**
 * Grounded in mvp-brd.md §12 ("Key Edge Cases") and §17 ("Risks") — the
 * offline-settlement / no-recourse / disintermediation language here is the
 * business's own documented position, not new copy invented for this page.
 * MVP-stage and says so; this is not a substitute for reviewed legal counsel
 * before real commercial launch.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="4 September 2026">
      <p>
        SEEABLE Hoardings (&ldquo;SEEABLE&rdquo;, &ldquo;we&rdquo;) is an
        early-stage platform that helps outdoor-advertising space owners
        (&ldquo;Publishers&rdquo;) and advertisers (&ldquo;Viewers&rdquo;)
        find each other in Bengaluru. These terms are written in plain
        language for this MVP stage — they are the platform&apos;s actual
        operating rules today, not a substitute for full legal counsel before
        commercial launch.
      </p>

      <h2>What SEEABLE does — and doesn&apos;t do</h2>
      <p>
        SEEABLE lists advertising inventory, lets a Viewer send a Publisher a
        dated request, and notifies both sides as that request is accepted,
        rejected, or expires. That is the entire scope of what the platform
        does on your behalf.
      </p>
      <p>
        <strong>SEEABLE does not process payment.</strong> There is no
        payment, escrow, or invoicing feature in this product. Price, final
        terms, payment, and delivery of the advertising space are negotiated
        and settled directly between the Publisher and the Viewer, entirely
        outside SEEABLE.
      </p>
      <p>
        <strong>
          SEEABLE is not a party to any agreement, booking, or dispute
        </strong>{" "}
        that results from a request made through the platform. Sending or
        accepting a request expresses interest and intent to book — it does
        not create a payment obligation to SEEABLE, and SEEABLE does not
        guarantee that either side will honor the price, dates, or condition
        of the space once contact is made.
      </p>

      <h2>No-recourse disputes</h2>
      <p>
        Because settlement happens offline, SEEABLE currently has no
        payment-based enforcement mechanism if a Viewer doesn&apos;t pay
        after a Publisher holds dates, or a Publisher doesn&apos;t deliver
        after being paid. Our compensating control is manual: every listing
        is reviewed by an Admin before it goes live, and we act on confirmed
        policy violations — including suspending or removing an account — but
        we cannot compel either party to complete a transaction.
      </p>

      <h2>Accounts and listings</h2>
      <ul>
        <li>
          A Publisher is responsible for the accuracy of what they list —
          the description, condition, availability, and their right to use
          any photo or video submitted.
        </li>
        <li>
          Admin review before a listing goes live is a moderation check, not
          an independent verification of every real-world claim in it.
        </li>
        <li>
          A Publisher account can be suspended, and a listing rejected or
          delisted, for violating these terms or the platform&apos;s content
          and conduct guidelines.
        </li>
        <li>
          A Viewer is expected to submit requests they genuinely intend to
          honor — repeated non-serious requests that tie up a Publisher&apos;s
          calendar are a policy violation.
        </li>
      </ul>

      <h2>Changes</h2>
      <p>
        This is a fast-moving early product; these terms will change as
        features like payment are introduced. We&apos;ll update the date
        above when they do.
      </p>

      <p className="text-ink-500 text-xs">
        See also our{" "}
        <Link href="/privacy" className="text-gold-700 underline">
          Privacy Policy
        </Link>
        .
      </p>
    </LegalPage>
  );
}

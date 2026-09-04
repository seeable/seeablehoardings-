import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

/**
 * Describes what this codebase actually stores and where — cross-checked
 * against database-design.md's table list and lib/analytics/client.ts —
 * rather than boilerplate privacy-policy language unconnected to the product.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="4 September 2026">
      <p>
        This describes what SEEABLE Hoardings actually collects and stores
        today, at MVP stage, and where it lives.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details:</strong> name, email, phone (optional),
          and city you provide at signup, or the name and email Google
          shares if you sign in with Google.
        </li>
        <li>
          <strong>Publisher details:</strong> business name, and — only for
          Publisher verification — a business verification document you
          upload, visible only to you and to SEEABLE&apos;s Admin team.
        </li>
        <li>
          <strong>Listing content:</strong> the photos, descriptions, and
          location details a Publisher submits for their advertising space.
        </li>
        <li>
          <strong>Requests:</strong> the dates and optional message a Viewer
          sends when requesting a listing, visible to that Viewer, the
          listing&apos;s Publisher, and SEEABLE&apos;s Admin team.
        </li>
        <li>
          <strong>Usage events:</strong> lightweight, best-effort records of
          actions like a search, a filter, or viewing a listing, linked to
          your account when you&apos;re signed in. These are used only to
          measure how the platform is used (e.g. how many requests get
          confirmed) — never sold, and readable only by Admins.
        </li>
      </ul>

      <h2>Where it lives</h2>
      <p>
        All data is stored on <strong>Supabase</strong> (database, sign-in,
        and file storage) and served through <strong>Cloudflare</strong>.
        Map tiles are loaded from <strong>MapTiler</strong>. We don&apos;t run
        our own servers or databases outside of these providers, and we
        don&apos;t sell or share your data with anyone else.
      </p>

      <h2>Who can see what</h2>
      <p>
        A Viewer never sees a Publisher&apos;s phone number, email, or name
        directly — only their business name and verification status. This is
        enforced at the database level, not just hidden in the app. Contact
        happens through the request flow, and any direct arrangement after
        that is between the two of you (see our{" "}
        <Link href="/terms" className="text-gold-700 underline">
          Terms of Use
        </Link>{" "}
        for what that means for disputes).
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>No payment processing, so no payment-card data is ever collected.</li>
        <li>No SMS, and no paid AI processing of your data.</li>
        <li>No advertising trackers or third-party analytics pixels.</li>
      </ul>

      <h2>Your account</h2>
      <p>
        You can update your profile details from your account settings at
        any time. This is an early-stage product without a self-service
        account-deletion flow yet — to remove your account or data, reach
        the SEEABLE team through the same channel you used to sign up or get
        verified.
      </p>
    </LegalPage>
  );
}

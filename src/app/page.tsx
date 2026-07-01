import { LANDING_LIFTS, landingMediaUrl } from "@/lib/landingMedia";
import LandingPageClient from "./LandingPageClient";

export default function LandingPage() {
  return (
    <>
      {LANDING_LIFTS.map((lift) => (
        <link
          key={lift.id}
          rel="preload"
          as="video"
          href={landingMediaUrl("videos", lift.video)}
        />
      ))}
      <LandingPageClient />
    </>
  );
}

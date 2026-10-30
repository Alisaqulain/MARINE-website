import { HomeHero } from "@/components/HomeHero";
import { HomeCollections } from "@/components/HomeCollections";
import { HomeAllProducts } from "@/components/HomeAllProducts";
import { HomeWholesaleCta } from "@/components/HomeWholesaleCta";
import { CustomerReviewsSection } from "@/components/CustomerReviewsSection";

// Render per request so categories added in admin show without a redeploy.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="bg-[#FAF7F2]">
      <HomeHero />
      <HomeCollections />
      <HomeAllProducts />
      <HomeWholesaleCta />
      <CustomerReviewsSection />
    </div>
  );
}

import { BlogProductCard } from "@/components/BlogProductCard";
import { splitProducts, toArticleHtml } from "@/lib/blog-html";

/** Article HTML (sanitized) with live, location-priced product boxes where the admin placed them. */
export function ArticleBody({ body, className = "" }: { body: string[]; className?: string }) {
  const parts = splitProducts(toArticleHtml(body));
  return (
    <div className={`blog-content ${className}`}>
      {parts.map((part, i) =>
        "product" in part ? (
          <BlogProductCard key={i} slug={part.product} />
        ) : (
          <div key={i} className="blog-content" dangerouslySetInnerHTML={{ __html: part.html }} />
        )
      )}
    </div>
  );
}
